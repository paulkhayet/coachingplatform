'use server'

import { revalidatePath } from 'next/cache'
import { listCalendars } from '@/lib/google/calendar'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { US_TIME_ZONES } from '@/lib/validation'
import { weeklyHoursSchema, zonedTime } from '@/lib/slots'

// Every write goes through the signed-in user's Supabase client, so row-level security decides what can
// be changed. A person's hours, time off and calendar belong to them across all their businesses (D-057);
// what one business is offered is set per membership.

export interface AvailabilityState {
  ok?: boolean
  message?: string
}

const timezoneSchema = z.enum(US_TIME_ZONES.map((t) => t.value) as [string, ...string[]], 'Choose a time zone')
const PATH = '/app/availability'

export async function saveAvailability(_prev: AvailabilityState, formData: FormData): Promise<AvailabilityState> {
  const { user } = await requireWorkspace()
  const tz = timezoneSchema.safeParse(formData.get('timezone'))
  if (!tz.success) return { message: 'Choose a time zone.' }
  let raw: unknown
  try {
    raw = JSON.parse(String(formData.get('weekly') ?? '[]'))
  } catch {
    return { message: 'Something went wrong reading your hours. Try again.' }
  }
  const weekly = weeklyHoursSchema.safeParse(raw)
  if (!weekly.success) return { message: weekly.error.issues[0]?.message ?? 'Check your hours.' }

  const supabase = await createClient()
  const { error } = await supabase.from('availability_schedules').upsert({
    user_id: user.id,
    timezone: tz.data,
    weekly_hours: weekly.data.sort((a, b) => a.day - b.day || a.start - b.start),
    updated_at: new Date().toISOString(),
  })
  if (error) return { message: 'We couldn’t save your hours. Try again in a moment.' }
  revalidatePath(PATH)
  return { ok: true, message: 'Hours saved.' }
}

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Choose a date and time')

/** Adds time off. The form's date-times are read in the person's schedule time zone. */
export async function addTimeOff(_prev: AvailabilityState, formData: FormData): Promise<AvailabilityState> {
  const { user } = await requireWorkspace()
  const parsed = z
    .object({ start: localDateTime, end: localDateTime, note: z.string().trim().max(200, 'Keep the note under 200 characters'), timezone: timezoneSchema })
    .safeParse({ start: formData.get('start'), end: formData.get('end'), note: formData.get('note') ?? '', timezone: formData.get('timezone') })
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? 'Check the dates.' }

  const toInstant = (v: string) => {
    const [date, time] = v.split('T')
    const [y, m, d] = date.split('-').map(Number)
    const [h, min] = time.split(':').map(Number)
    return zonedTime(y, m, d, h * 60 + min, parsed.data.timezone)
  }
  const startsAt = toInstant(parsed.data.start)
  const endsAt = toInstant(parsed.data.end)
  if (endsAt <= startsAt) return { message: 'Time off must end after it starts.' }
  if (endsAt.getTime() - startsAt.getTime() > 366 * 24 * 3600_000) return { message: 'Add time off a year or less at a time.' }

  const supabase = await createClient()
  const { error } = await supabase.from('availability_time_off').insert({
    user_id: user.id,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    note: parsed.data.note || null,
  })
  if (error) return { message: 'We couldn’t add that time off. Try again in a moment.' }
  revalidatePath(PATH)
  return { ok: true, message: 'Time off added.' }
}

export async function removeTimeOff(formData: FormData) {
  const { user } = await requireWorkspace()
  const id = z.uuid().safeParse(formData.get('id'))
  if (!id.success) return
  const supabase = await createClient()
  await supabase.from('availability_time_off').delete().eq('id', id.data).eq('user_id', user.id)
  revalidatePath(PATH)
}

/**
 * Your hours for this business (D-059): your default hours, or separate hours just for it; and which of
 * your calendars its bookings go into (blank = your default).
 */
export async function saveBusinessOffer(_prev: AvailabilityState, formData: FormData): Promise<AvailabilityState> {
  const { user, membership, business } = await requireWorkspace()
  const all = formData.get('mode') !== 'some'
  let offered: z.infer<typeof weeklyHoursSchema> | null = null
  if (!all) {
    let raw: unknown
    try {
      raw = JSON.parse(String(formData.get('weekly') ?? '[]'))
    } catch {
      return { message: 'Something went wrong reading the hours. Try again.' }
    }
    const parsed = weeklyHoursSchema.safeParse(raw)
    if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? 'Check the hours.' }
    if (parsed.data.length === 0) return { message: `Choose at least one block of time for ${business.name}, or use your default hours.` }
    offered = parsed.data.sort((a, b) => a.day - b.day || a.start - b.start)
  }
  const destination = String(formData.get('destination') ?? '') || null
  if (destination) {
    try {
      const calendars = await listCalendars(user.id)
      if (!calendars.some((c) => c.id === destination && c.owned)) return { message: 'Choose a calendar you own.' }
    } catch {
      return { message: 'We couldn’t reach Google Calendar. Try again, or reconnect.' }
    }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('membership_availability').upsert({
    membership_id: membership.id,
    business_id: business.id,
    offered_hours: offered,
    destination_calendar_id: destination,
    updated_at: new Date().toISOString(),
  })
  if (error) return { message: 'We couldn’t save that. Try again in a moment.' }
  revalidatePath(PATH)
  return { ok: true, message: `Saved your hours for ${business.name}.` }
}
