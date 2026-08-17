-- Expose the coach's profile photo on the public booking page, so it can show
-- a real avatar instead of only a name (falls back to initials client-side
-- when this is null, so this is safe to ship ahead of any photo uploads).
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
    'coachAvatarUrl', profile.avatar_url,
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
