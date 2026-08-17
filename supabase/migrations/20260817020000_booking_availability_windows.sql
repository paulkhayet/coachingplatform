-- Per-day availability windows, free-form call lengths, and in-person meetings.
--
-- `availability` moves from one weekly window applied to every selected day:
--     {"days":[1,2,3,4,5],"start":"09:00","end":"17:00"}
-- to a list of windows per weekday, so a coach can work 9-12 and 1-5 on Monday
-- and 6-8pm on Thursday:
--     {"version":2,"windows":{"0":[],"1":[{"start":"09:00","end":"12:00"},
--                                         {"start":"13:00","end":"17:00"}],...}}
--
-- Keys are weekday numbers 0-6 as strings, matching both JS `Date#getDay()` and
-- Postgres `extract(dow from ...)`. `"24:00"` is a legal window end (Postgres
-- accepts '24:00'::time and it lands on next-day midnight); it is never a start.
--
-- IMPORTANT: apply this before deploying the matching client. The old
-- submit_public_booking reads availability->'days' as SQL NULL against the new
-- shape, which makes its whole availability check evaluate to NULL — plpgsql
-- treats that as false, so it would accept any timestamp at all.

-- The inline check constraints from 20260813060000 get auto-generated names.
-- Those names are conventional but not guaranteed, and `drop constraint if
-- exists` on a guessed name is a silent no-op that would leave the old, narrower
-- constraint enforcing. Find them by definition instead.
do $$
declare
  stale_constraint text;
begin
  for stale_constraint in
    select constraint_row.conname
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.booking_pages'::regclass
      and constraint_row.contype = 'c'
      and (pg_get_constraintdef(constraint_row.oid) like '%duration_minutes%'
        or pg_get_constraintdef(constraint_row.oid) like '%location_type%')
  loop
    execute format(
      'alter table public.booking_pages drop constraint %I', stale_constraint
    );
  end loop;
end $$;

alter table public.booking_pages
  add constraint booking_pages_duration_minutes_check
  check (duration_minutes between 5 and 480);

alter table public.booking_pages
  add constraint booking_pages_location_type_check
  check (location_type in ('zoom', 'google_meet', 'phone', 'in_person'));

-- Where an in-person session happens. Kept for every location type so switching
-- to Zoom and back does not lose the address; only published when it is
-- actually the meeting location (see get_public_booking_page).
alter table public.booking_pages
  add column if not exists location_details text not null default '';

-- Existing rows: fan the single window out across the weekdays it applied to.
--
-- The guard is load-bearing, not hygiene. Run unguarded against a row that is
-- already in the new shape and availability->>'start' is NULL, which would write
-- {"start":null,"end":null} over good data. `jsonb_typeof(...) is distinct from
-- 'object'` (rather than `is null`) catches missing, JSON-null and wrong-typed
-- in one predicate, because `->` on a JSON null returns 'null'::jsonb, not SQL
-- NULL. Both statements below are therefore idempotent and self-healing.
update public.booking_pages
set availability = jsonb_build_object(
  'version', 2,
  'windows', (
    select jsonb_object_agg(
      weekday.value::text,
      case
        when public.booking_pages.availability -> 'days'
             @> to_jsonb(array[weekday.value])
        then jsonb_build_array(jsonb_build_object(
               'start', public.booking_pages.availability ->> 'start',
               'end',   public.booking_pages.availability ->> 'end'
             ))
        else '[]'::jsonb
      end
    )
    from generate_series(0, 6) as weekday(value)
  )
)
where jsonb_typeof(availability -> 'windows') is distinct from 'object'
  and jsonb_typeof(availability -> 'days') = 'array'
  and (availability ->> 'start') ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
  and (availability ->> 'end') ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$|^24:00$';

-- Anything matching neither shape (or holding unparseable times) resets to the
-- default rather than staying in a state the slot generator cannot read.
update public.booking_pages
set availability = '{"version":2,"windows":{"0":[],"1":[{"start":"09:00","end":"17:00"}],"2":[{"start":"09:00","end":"17:00"}],"3":[{"start":"09:00","end":"17:00"}],"4":[{"start":"09:00","end":"17:00"}],"5":[{"start":"09:00","end":"17:00"}],"6":[]}}'::jsonb
where jsonb_typeof(availability -> 'windows') is distinct from 'object';

alter table public.booking_pages
  alter column availability set default
  '{"version":2,"windows":{"0":[],"1":[{"start":"09:00","end":"17:00"}],"2":[{"start":"09:00","end":"17:00"}],"3":[{"start":"09:00","end":"17:00"}],"4":[{"start":"09:00","end":"17:00"}],"5":[{"start":"09:00","end":"17:00"}],"6":[]}}'::jsonb;

-- Single source of truth for "which instants can a visitor actually book?".
-- Both get_public_booking_page and submit_public_booking call this, so the
-- calendar a visitor sees and the grid the server re-validates against cannot
-- drift apart.
--
-- horizon_days counts local calendar days starting today (inclusive), not a
-- maximum day offset.
create or replace function public.booking_page_slots(
  target_page_id uuid,
  horizon_days integer default 21
)
returns setof timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with page as (
    select
      booking_page.id,
      booking_page.duration_minutes,
      booking_page.minimum_notice_hours,
      booking_page.availability,
      organization.timezone as practice_timezone
    from public.booking_pages booking_page
    join public.organizations organization
      on organization.id = booking_page.organization_id
    where booking_page.id = target_page_id
      and booking_page.is_active = true
  ),
  -- One row per local calendar day, carrying that weekday's window list.
  -- Stepping by whole local dates rather than by 24 hours is what keeps day
  -- boundaries correct across a DST transition.
  local_day as (
    select
      page.id,
      page.duration_minutes,
      page.minimum_notice_hours,
      page.practice_timezone,
      day.local_date,
      case
        when jsonb_typeof(
               (page.availability -> 'windows')
                 -> (extract(dow from day.local_date)::integer::text)
             ) = 'array'
        then (page.availability -> 'windows')
               -> (extract(dow from day.local_date)::integer::text)
        else '[]'::jsonb
      end as day_windows
    from page
    cross join generate_series(
      0, greatest(coalesce(horizon_days, 21), 1) - 1
    ) as offset_days(value)
    cross join lateral (
      select ((now() at time zone page.practice_timezone)::date
                + offset_days.value) as local_date
    ) as day
  ),
  -- One row per (local day, window). Times are parsed defensively: a row left
  -- malformed by a direct table write yields NULL rather than raising, because
  -- raising here would 500 the entire public booking page.
  day_window as (
    select
      local_day.id,
      local_day.duration_minutes,
      local_day.minimum_notice_hours,
      local_day.practice_timezone,
      local_day.local_date,
      case
        when (element.value ->> 'start') ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
        then (element.value ->> 'start')::time
      end as window_start,
      case
        when (element.value ->> 'end') ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$|^24:00$'
        then (element.value ->> 'end')::time
      end as window_end
    from local_day
    cross join lateral jsonb_array_elements(local_day.day_windows) as element(value)
    where jsonb_typeof(element.value) = 'object'
  )
  -- distinct: DST spring-forward collapses two distinct local starts onto one
  -- instant, which would otherwise surface as a duplicated time button.
  select distinct
    (open_slot.local_start at time zone day_window.practice_timezone)
  from day_window
  -- The grid is re-anchored at each window's own start, so 13:00-17:00 at 50
  -- minutes gives 13:00, 13:50, 14:50, 15:50 rather than continuing the
  -- morning window's phase. A window shorter than the duration, or one that
  -- ends before it starts, makes stop < start and emits zero rows.
  cross join lateral generate_series(
    day_window.local_date + day_window.window_start,
    day_window.local_date + day_window.window_end
      - make_interval(mins => day_window.duration_minutes),
    make_interval(mins => day_window.duration_minutes)
  ) as open_slot(local_start)
  where day_window.window_start is not null
    and day_window.window_end is not null
    and (open_slot.local_start at time zone day_window.practice_timezone)
        >= now() + make_interval(hours => day_window.minimum_notice_hours)
    and not exists (
      select 1
      from public.booking_requests request
      where request.booking_page_id = day_window.id
        and request.status <> 'cancelled'
        and request.starts_at =
          (open_slot.local_start at time zone day_window.practice_timezone)
    )
  order by 1;
$$;

create or replace function public.get_public_booking_page(org_slug text, type_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', page.id,
    'slug', page.slug,
    'orgSlug', organization.slug,
    'brandName', page.brand_name,
    'coachName', profile.full_name,
    'coachAvatarUrl', profile.avatar_url,
    'title', page.title,
    'description', page.description,
    'accentColor', page.accent_color,
    'durationMinutes', page.duration_minutes,
    'locationType', page.location_type,
    -- Only surfaced when it is actually the meeting location, so an address
    -- kept from an earlier in-person setup is never published.
    'locationDetails', case
      when page.location_type = 'in_person' then page.location_details
      else ''
    end,
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
    -- 21 days is a presentation choice: how far ahead the calendar paints.
    -- submit_public_booking deliberately accepts a longer horizon.
    'availableSlots', coalesce((
      select jsonb_agg(open_slot.slot_start order by open_slot.slot_start)
      from public.booking_page_slots(page.id, 21) as open_slot(slot_start)
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
set search_path = public, pg_temp
as $$
#variable_conflict use_variable
declare
  target_page public.booking_pages%rowtype;
  created_request uuid;
  required_question public.booking_questions%rowtype;
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
  -- Kept even though booking_page_slots re-applies both bounds: it gives a
  -- distinct message, and it short-circuits before the generator runs.
  if requested_starts_at < now() + make_interval(hours => target_page.minimum_notice_hours)
    or requested_starts_at > now() + interval '90 days' then
    raise exception 'That time is outside the available booking window.';
  end if;

  -- Checked before availability, because booking_page_slots already excludes
  -- taken slots — without this a lost race would report the misleading
  -- "not part of this coach's availability" instead. The partial unique index
  -- remains the authoritative guard against the real race.
  if exists (
    select 1 from public.booking_requests request
    where request.booking_page_id = target_page.id
      and request.status <> 'cancelled'
      and request.starts_at = requested_starts_at
  ) then
    raise exception 'That time was just booked. Please choose another.';
  end if;

  -- The same generator the public calendar was rendered from, so what the
  -- visitor clicked and what we re-validate cannot diverge. 91 days rather
  -- than the calendar's 21 so a stale tab or an emailed link still works.
  if not exists (
    select 1
    from public.booking_page_slots(target_page.id, 91) as open_slot(slot_start)
    where open_slot.slot_start = requested_starts_at
  ) then
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

-- Adding target_location_details changes the arity from 13 to 14. A
-- `create or replace` would leave the old signature in place as a second
-- overload, and PostgREST could then no longer resolve rpc("save_booking_page").
-- The new signature is dropped too, so replaying this file is not an error.
drop function if exists public.save_booking_page(
  uuid, uuid, text, text, text, text, text, integer, text, jsonb, integer, boolean, jsonb
);
drop function if exists public.save_booking_page(
  uuid, uuid, text, text, text, text, text, integer, text, text, jsonb, integer, boolean, jsonb
);

create function public.save_booking_page(
  target_organization uuid,
  target_page_id uuid,
  target_slug text,
  target_brand_name text,
  target_title text,
  target_description text,
  target_accent_color text,
  target_duration_minutes integer,
  target_location_type text,
  target_location_details text,
  target_availability jsonb,
  target_minimum_notice_hours integer,
  target_is_active boolean,
  target_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved_page_id uuid;
  next_sort_order integer;
  question jsonb;
  question_index integer := 0;
  day_key text;
  day_windows jsonb;
  day_window jsonb;
  previous_end time;
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
  if coalesce(target_duration_minutes, 0) < 5 or target_duration_minutes > 480 then
    raise exception 'Call length must be between 5 and 480 minutes.';
  end if;
  if target_location_type not in ('zoom', 'google_meet', 'phone', 'in_person') then
    raise exception 'Choose a valid meeting location.';
  end if;
  if target_location_type = 'in_person'
    and length(trim(coalesce(target_location_details, ''))) = 0 then
    raise exception 'Add the address for in-person sessions.';
  end if;

  -- availability carries no check constraint (a shape check needs a subquery,
  -- which CHECK forbids, and routing it through a function breaks pg_restore
  -- because pg_dump emits column checks before functions exist). This is the
  -- only thing standing between a malformed payload and booking_page_slots.
  if jsonb_typeof(target_availability -> 'windows') <> 'object' then
    raise exception 'Availability must list time windows for each day.';
  end if;
  for day_key in select generate_series(0, 6)::text
  loop
    day_windows := coalesce(target_availability -> 'windows' -> day_key, '[]'::jsonb);
    if jsonb_typeof(day_windows) <> 'array' then
      raise exception 'Each day of availability must be a list of time windows.';
    end if;
    previous_end := null;
    for day_window in
      select element.value
      from jsonb_array_elements(day_windows) as element(value)
      order by element.value ->> 'start'
    loop
      if coalesce(day_window ->> 'start', '') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
        or coalesce(day_window ->> 'end', '') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$|^24:00$' then
        raise exception 'Availability times must look like 09:00.';
      end if;
      if (day_window ->> 'end')::time <= (day_window ->> 'start')::time then
        raise exception 'Each availability window must end after it starts.';
      end if;
      if previous_end is not null and (day_window ->> 'start')::time < previous_end then
        raise exception 'Availability windows on the same day cannot overlap.';
      end if;
      previous_end := (day_window ->> 'end')::time;
    end loop;
  end loop;

  if target_page_id is not null then
    update public.booking_pages set
      slug = target_slug,
      brand_name = trim(target_brand_name),
      title = trim(target_title),
      description = trim(target_description),
      accent_color = target_accent_color,
      duration_minutes = target_duration_minutes,
      location_type = target_location_type,
      location_details = trim(coalesce(target_location_details, '')),
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
      accent_color, duration_minutes, location_type, location_details,
      availability, minimum_notice_hours, is_active, sort_order, updated_at
    ) values (
      target_organization, auth.uid(), target_slug, trim(target_brand_name),
      trim(target_title), trim(target_description), target_accent_color,
      target_duration_minutes, target_location_type,
      trim(coalesce(target_location_details, '')),
      target_availability, target_minimum_notice_hours, target_is_active,
      next_sort_order, now()
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

-- booking_page_slots is intentionally not granted to anon or authenticated. The
-- owner keeps execute independently of the PUBLIC pseudo-role, so the definer
-- RPCs above still call it. Granting anon would expose a page-id-keyed schedule
-- oracle; granting authenticated would be worse, since the helper deliberately
-- does not check org membership.
revoke all on function public.booking_page_slots(uuid, integer) from public;
revoke all on function public.get_public_booking_page(text, text) from public;
revoke all on function public.submit_public_booking(
  text, text, text, text, text, timestamptz, text, jsonb, text
) from public;

grant execute on function public.save_booking_page(
  uuid, uuid, text, text, text, text, text, integer, text, text, jsonb, integer, boolean, jsonb
) to authenticated;
grant execute on function public.get_public_booking_page(text, text) to anon, authenticated;
grant execute on function public.submit_public_booking(
  text, text, text, text, text, timestamptz, text, jsonb, text
) to anon, authenticated;

comment on function public.booking_page_slots(uuid, integer) is
  'Bookable instants for one active booking page. Internal: called only by the public booking RPCs, which already run as the owner.';
comment on function public.get_public_booking_page(text, text) is
  'Returns only public-facing booking configuration and occupied timestamps for one booking type.';
