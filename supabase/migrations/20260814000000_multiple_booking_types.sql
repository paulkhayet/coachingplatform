-- Allow each coach to publish several booking types (e.g. "Discovery call",
-- "Coaching session") instead of a single consultation page, addressed at
-- /{organization slug}/{booking type slug} instead of /book/{slug}.

alter table public.booking_pages
  drop constraint if exists booking_pages_organization_id_coach_id_key;
alter table public.booking_pages
  drop constraint if exists booking_pages_slug_key;
alter table public.booking_pages
  add constraint booking_pages_org_slug_key unique (organization_id, slug);

alter table public.booking_pages
  add column if not exists sort_order integer not null default 0;

alter table public.organizations
  add constraint organizations_slug_format
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') not valid;
alter table public.organizations
  validate constraint organizations_slug_format;

-- Reserved so a practice URL can never shadow a real app route.
create or replace function public.is_reserved_slug(candidate text)
returns boolean
language sql
immutable
as $$
  select candidate = any (array['api', 'book', 'www', 'app', 'admin', 'auth']);
$$;

create or replace function public.update_organization_slug(
  target_organization uuid,
  target_slug text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_member(target_organization) then
    raise exception 'You do not have access to this practice.';
  end if;
  if target_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Use lowercase letters, numbers, and hyphens for your practice URL.';
  end if;
  if public.is_reserved_slug(target_slug) then
    raise exception 'That practice URL is reserved. Choose another one.';
  end if;

  update public.organizations
  set slug = target_slug
  where id = target_organization;
exception
  when unique_violation then
    raise exception 'That practice URL is already in use. Choose another one.';
end;
$$;

grant execute on function public.update_organization_slug(uuid, text) to authenticated;

-- Replaced below with signatures that key off (org slug, booking type slug)
-- instead of assuming one page per coach.
drop function if exists public.save_booking_page(
  uuid, text, text, text, text, text, integer, text, jsonb, integer, boolean, jsonb
);
drop function if exists public.get_public_booking_page(text);
drop function if exists public.submit_public_booking(
  text, text, text, text, timestamptz, text, jsonb, text
);

create or replace function public.save_booking_page(
  target_organization uuid,
  target_page_id uuid,
  target_slug text,
  target_brand_name text,
  target_title text,
  target_description text,
  target_accent_color text,
  target_duration_minutes integer,
  target_location_type text,
  target_availability jsonb,
  target_minimum_notice_hours integer,
  target_is_active boolean,
  target_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_page_id uuid;
  next_sort_order integer;
  question jsonb;
  question_index integer := 0;
begin
  if not public.is_org_member(target_organization) then
    raise exception 'You do not have access to this practice.';
  end if;
  if target_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Use lowercase letters, numbers, and hyphens for the booking link.';
  end if;
  if jsonb_typeof(target_questions) <> 'array' then
    raise exception 'Questions must be an array.';
  end if;

  if target_page_id is not null then
    update public.booking_pages set
      slug = target_slug,
      brand_name = trim(target_brand_name),
      title = trim(target_title),
      description = trim(target_description),
      accent_color = target_accent_color,
      duration_minutes = target_duration_minutes,
      location_type = target_location_type,
      availability = target_availability,
      minimum_notice_hours = target_minimum_notice_hours,
      is_active = target_is_active,
      updated_at = now()
    where id = target_page_id
      and organization_id = target_organization
      and coach_id = auth.uid()
    returning id into saved_page_id;

    if saved_page_id is null then
      raise exception 'That booking type could not be found.';
    end if;
  else
    select coalesce(max(sort_order) + 1, 0) into next_sort_order
    from public.booking_pages
    where organization_id = target_organization and coach_id = auth.uid();

    insert into public.booking_pages (
      organization_id, coach_id, slug, brand_name, title, description,
      accent_color, duration_minutes, location_type, availability,
      minimum_notice_hours, is_active, sort_order, updated_at
    ) values (
      target_organization, auth.uid(), target_slug, trim(target_brand_name),
      trim(target_title), trim(target_description), target_accent_color,
      target_duration_minutes, target_location_type, target_availability,
      target_minimum_notice_hours, target_is_active, next_sort_order, now()
    )
    returning id into saved_page_id;
  end if;

  delete from public.booking_questions where booking_page_id = saved_page_id;
  for question in select * from jsonb_array_elements(target_questions)
  loop
    if length(trim(coalesce(question->>'label', ''))) > 0 then
      insert into public.booking_questions (
        booking_page_id, label, question_type, is_required, options, sort_order
      ) values (
        saved_page_id,
        trim(question->>'label'),
        coalesce(question->>'type', 'long_text'),
        coalesce((question->>'required')::boolean, false),
        coalesce(question->'options', '[]'::jsonb),
        question_index
      );
      question_index := question_index + 1;
    end if;
  end loop;

  return saved_page_id;
exception
  when unique_violation then
    raise exception 'That booking link is already in use. Choose another one.';
end;
$$;

create or replace function public.get_public_booking_page(org_slug text, type_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', page.id,
    'slug', page.slug,
    'orgSlug', organization.slug,
    'brandName', page.brand_name,
    'coachName', profile.full_name,
    'title', page.title,
    'description', page.description,
    'accentColor', page.accent_color,
    'durationMinutes', page.duration_minutes,
    'locationType', page.location_type,
    'timezone', organization.timezone,
    'availability', page.availability,
    'minimumNoticeHours', page.minimum_notice_hours,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', question.id,
        'label', question.label,
        'type', question.question_type,
        'required', question.is_required,
        'options', question.options
      ) order by question.sort_order)
      from public.booking_questions question
      where question.booking_page_id = page.id
    ), '[]'::jsonb),
    'bookedStarts', coalesce((
      select jsonb_agg(request.starts_at)
      from public.booking_requests request
      where request.booking_page_id = page.id
        and request.status <> 'cancelled'
        and request.starts_at >= now()
    ), '[]'::jsonb),
    'availableSlots', coalesce((
      select jsonb_agg(
        to_jsonb(open_slot.local_start at time zone organization.timezone)
        order by open_slot.local_start
      )
      from generate_series(0, 20) as day_offset(value)
      cross join lateral generate_series(
        ((now() at time zone organization.timezone)::date + day_offset.value)
          + (page.availability->>'start')::time,
        ((now() at time zone organization.timezone)::date + day_offset.value)
          + (page.availability->>'end')::time
          - make_interval(mins => page.duration_minutes),
        make_interval(mins => page.duration_minutes)
      ) as open_slot(local_start)
      where page.availability->'days' @>
        to_jsonb(array[extract(dow from open_slot.local_start)::integer])
        and open_slot.local_start at time zone organization.timezone >=
          now() + make_interval(hours => page.minimum_notice_hours)
        and not exists (
          select 1
          from public.booking_requests request
          where request.booking_page_id = page.id
            and request.status <> 'cancelled'
            and request.starts_at =
              open_slot.local_start at time zone organization.timezone
        )
    ), '[]'::jsonb)
  )
  from public.booking_pages page
  join public.profiles profile on profile.id = page.coach_id
  join public.organizations organization on organization.id = page.organization_id
  where organization.slug = org_slug
    and page.slug = type_slug
    and page.is_active = true;
$$;

create or replace function public.submit_public_booking(
  org_slug text,
  type_slug text,
  guest_name text,
  guest_email text,
  guest_phone text,
  requested_starts_at timestamptz,
  guest_timezone text,
  submitted_answers jsonb,
  website text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  target_page public.booking_pages%rowtype;
  created_request uuid;
  required_question public.booking_questions%rowtype;
  practice_timezone text;
  local_start timestamp;
  availability_start time;
  availability_end time;
begin
  if length(coalesce(website, '')) > 0 then
    raise exception 'Unable to submit this booking.';
  end if;
  select page.* into target_page
  from public.booking_pages page
  join public.organizations organization on organization.id = page.organization_id
  where organization.slug = org_slug and page.slug = type_slug and page.is_active = true;

  if target_page.id is null then
    raise exception 'This booking page is not available.';
  end if;
  if length(trim(guest_name)) < 2 or guest_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid name and email address.';
  end if;
  if requested_starts_at < now() + make_interval(hours => target_page.minimum_notice_hours)
    or requested_starts_at > now() + interval '90 days' then
    raise exception 'That time is outside the available booking window.';
  end if;

  select timezone into practice_timezone
  from public.organizations where id = target_page.organization_id;
  local_start := requested_starts_at at time zone practice_timezone;
  availability_start := (target_page.availability->>'start')::time;
  availability_end := (target_page.availability->>'end')::time;
  if not (target_page.availability->'days' @> to_jsonb(array[extract(dow from local_start)::integer]))
    or local_start::time < availability_start
    or local_start::time + make_interval(mins => target_page.duration_minutes) > availability_end
    or mod(
      floor(extract(epoch from (local_start::time - availability_start)) / 60)::integer,
      target_page.duration_minutes
    ) <> 0 then
    raise exception 'That time is not part of this coach’s availability.';
  end if;

  if (
    select count(*) from public.booking_requests request
    where request.booking_page_id = target_page.id
      and lower(request.guest_email) = lower(trim(guest_email))
      and request.created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'Please wait before requesting another consultation.';
  end if;

  for required_question in
    select * from public.booking_questions
    where booking_page_id = target_page.id and is_required = true
  loop
    if nullif(trim(coalesce(submitted_answers->>required_question.id::text, '')), '') is null then
      raise exception 'Please answer all required questions.';
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtext(target_page.id::text || requested_starts_at::text));

  insert into public.booking_requests (
    booking_page_id, organization_id, coach_id, guest_name, guest_email,
    guest_phone, starts_at, ends_at, guest_timezone, answers, status
  ) values (
    target_page.id, target_page.organization_id, target_page.coach_id,
    trim(guest_name), lower(trim(guest_email)), nullif(trim(guest_phone), ''),
    requested_starts_at,
    requested_starts_at + make_interval(mins => target_page.duration_minutes),
    coalesce(nullif(guest_timezone, ''), 'UTC'),
    coalesce(submitted_answers, '{}'::jsonb),
    'confirmed'
  ) returning id into created_request;

  return created_request;
exception
  when unique_violation then
    raise exception 'That time was just booked. Please choose another.';
end;
$$;

revoke all on function public.get_public_booking_page(text, text) from public;
revoke all on function public.submit_public_booking(text, text, text, text, text, timestamptz, text, jsonb, text) from public;
grant execute on function public.save_booking_page(uuid, uuid, text, text, text, text, text, integer, text, jsonb, integer, boolean, jsonb) to authenticated;
grant execute on function public.get_public_booking_page(text, text) to anon, authenticated;
grant execute on function public.submit_public_booking(text, text, text, text, text, timestamptz, text, jsonb, text) to anon, authenticated;

comment on function public.get_public_booking_page(text, text) is
  'Returns only public-facing booking configuration and occupied timestamps for one booking type.';
