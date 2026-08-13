-- Branded public consultation booking pages and intake questionnaires.
-- Public visitors use narrow security-definer functions; the underlying tables
-- remain private and organization-scoped.

create table if not exists public.booking_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  brand_name text not null,
  title text not null default 'Let’s explore working together',
  description text not null default 'Choose a time for a relaxed, no-pressure consultation.',
  accent_color text not null default '#6c63e8' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  duration_minutes integer not null default 30 check (duration_minutes between 15 and 120),
  location_type text not null default 'zoom' check (location_type in ('zoom', 'google_meet', 'phone')),
  availability jsonb not null default '{"days":[1,2,3,4,5],"start":"09:00","end":"17:00"}'::jsonb,
  minimum_notice_hours integer not null default 24 check (minimum_notice_hours between 0 and 336),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, coach_id)
);

create table if not exists public.booking_questions (
  id uuid primary key default gen_random_uuid(),
  booking_page_id uuid not null references public.booking_pages(id) on delete cascade,
  label text not null,
  question_type text not null default 'long_text' check (question_type in ('short_text', 'long_text', 'select', 'checkbox')),
  is_required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists booking_questions_page_order_idx
  on public.booking_questions (booking_page_id, sort_order);

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  booking_page_id uuid not null references public.booking_pages(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  guest_timezone text not null default 'UTC',
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create unique index if not exists booking_requests_open_slot_idx
  on public.booking_requests (booking_page_id, starts_at)
  where status <> 'cancelled';

create index if not exists booking_requests_coach_time_idx
  on public.booking_requests (coach_id, starts_at desc);

alter table public.booking_pages enable row level security;
alter table public.booking_questions enable row level security;
alter table public.booking_requests enable row level security;

drop policy if exists "members manage booking pages" on public.booking_pages;
create policy "members manage booking pages"
  on public.booking_pages for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "members manage booking questions" on public.booking_questions;
create policy "members manage booking questions"
  on public.booking_questions for all
  using (
    exists (
      select 1 from public.booking_pages page
      where page.id = booking_page_id
        and public.is_org_member(page.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.booking_pages page
      where page.id = booking_page_id
        and public.is_org_member(page.organization_id)
    )
  );

drop policy if exists "members manage booking requests" on public.booking_requests;
create policy "members manage booking requests"
  on public.booking_requests for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create or replace function public.save_booking_page(
  target_organization uuid,
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

  insert into public.booking_pages (
    organization_id, coach_id, slug, brand_name, title, description,
    accent_color, duration_minutes, location_type, availability,
    minimum_notice_hours, is_active, updated_at
  ) values (
    target_organization, auth.uid(), target_slug, trim(target_brand_name),
    trim(target_title), trim(target_description), target_accent_color,
    target_duration_minutes, target_location_type, target_availability,
    target_minimum_notice_hours, target_is_active, now()
  )
  on conflict (organization_id, coach_id) do update set
    slug = excluded.slug,
    brand_name = excluded.brand_name,
    title = excluded.title,
    description = excluded.description,
    accent_color = excluded.accent_color,
    duration_minutes = excluded.duration_minutes,
    location_type = excluded.location_type,
    availability = excluded.availability,
    minimum_notice_hours = excluded.minimum_notice_hours,
    is_active = excluded.is_active,
    updated_at = now()
  returning id into saved_page_id;

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

create or replace function public.get_public_booking_page(page_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', page.id,
    'slug', page.slug,
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
  where page.slug = page_slug and page.is_active = true;
$$;

create or replace function public.submit_public_booking(
  page_slug text,
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
  select * into target_page
  from public.booking_pages
  where slug = page_slug and is_active = true;

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

revoke all on function public.get_public_booking_page(text) from public;
revoke all on function public.submit_public_booking(text, text, text, text, timestamptz, text, jsonb, text) from public;
grant execute on function public.save_booking_page(uuid, text, text, text, text, text, integer, text, jsonb, integer, boolean, jsonb) to authenticated;
grant execute on function public.get_public_booking_page(text) to anon, authenticated;
grant execute on function public.submit_public_booking(text, text, text, text, timestamptz, text, jsonb, text) to anon, authenticated;

comment on function public.get_public_booking_page(text) is
  'Returns only public-facing booking configuration and occupied timestamps.';
comment on table public.booking_requests is
  'Prospective-client contact details and questionnaire responses; never directly public.';
