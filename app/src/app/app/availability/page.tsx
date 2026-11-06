import type { Metadata } from 'next'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { US_TIME_ZONES } from '@/lib/validation'
import { openIntervals, parseWeeklyHours, subtract, zonedParts, zonedTime, type Interval } from '@/lib/slots'
import { busyTimes } from '@/lib/google/calendar'
import { calendarAllowed, isGoogleCalendarConfigured, lookupConnection } from '@/lib/google/server'
import type { WeeklyWindow } from '@/db/schema'
import { BusinessOfferForm, TimeOffForm, WeeklyHoursForm } from './forms'
import { listCalendars, type CalendarSummary } from '@/lib/google/calendar'
import { intersect } from '@/lib/slots'
import { adminDb } from '@/db/server'
import { bookings } from '@/db/schema'
import { and, eq, gt, inArray, lt } from 'drizzle-orm'
import { removeTimeOff } from './actions'
import { CalendarCard } from './calendar-card'

export const metadata: Metadata = { title: 'Availability' }

const SUGGESTED: WeeklyWindow[] = [1, 2, 3, 4, 5].map((day) => ({ day, start: 9 * 60, end: 17 * 60 }))
const PREVIEW_DAYS = 7

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ calendar?: string }> }) {
  const { membership, business, user, workspaces } = await requireWorkspace()
  const { calendar: calendarOutcome } = await searchParams
  const supabase = await createClient()
  const now = new Date()
  // Hours, time off and calendar belong to the person, across all their businesses (D-057).
  const [{ data: schedule }, { data: timeOff }, { data: offer }] = await Promise.all([
    supabase.from('availability_schedules').select('timezone, weekly_hours').eq('user_id', user.id).maybeSingle<{ timezone: string; weekly_hours: unknown }>(),
    supabase.from('availability_time_off')
      .select('id, starts_at, ends_at, note')
      .eq('user_id', user.id)
      .gt('ends_at', now.toISOString())
      .order('starts_at')
      .returns<{ id: string; starts_at: string; ends_at: string; note: string | null }[]>(),
    supabase.from('membership_availability').select('offered_hours, destination_calendar_id').eq('membership_id', membership.id).maybeSingle<{ offered_hours: unknown; destination_calendar_id: string | null }>(),
  ])
  const offered = offer?.offered_hours ? parseWeeklyHours(offer.offered_hours) : null
  const multiBusiness = workspaces.length > 1

  const timezone = schedule?.timezone ?? business.timezone
  const weekly = schedule ? parseWeeklyHours(schedule.weekly_hours) : SUGGESTED
  const zoneLabel = US_TIME_ZONES.find((t) => t.value === timezone)?.label ?? timezone

  // Preview: what's open from now to the end of the 7th day, after time off.
  const today = zonedParts(now, timezone)
  const until = zonedTime(today.year, today.month, today.day + PREVIEW_DAYS, 0, timezone)
  // (The preview shows open ranges, not start times, so clipping at "now" is right here.)
  let open = schedule
    ? openIntervals(weekly, timezone, now, until, (timeOff ?? []).map((t) => ({ start: new Date(t.starts_at), end: new Date(t.ends_at) })))
    : []
  // Busy times from Google Calendar, when connected. If Google can't be read, say so rather than guess.
  let calendarBusy: 'none' | 'applied' | 'failed' = 'none'
  const { connection } = isGoogleCalendarConfigured && calendarAllowed(user.email) ? await lookupConnection(user.id) : { connection: undefined }
  // This business's share of your hours, and your bookings from every business (only times, no details).
  if (schedule && offered) open = intersect(open, openIntervals(offered, timezone, now, until))
  if (schedule) {
    const booked = await adminDb()
      .select({ start: bookings.startsAt, end: bookings.endsAt })
      .from(bookings)
      .where(and(eq(bookings.hostUserId, user.id), inArray(bookings.status, ['confirmed', 'pending_payment']), lt(bookings.startsAt, until), gt(bookings.endsAt, now)))
    open = subtract(open, booked)
  }
  if (schedule && connection?.status === 'active') {
    try {
      const busy: Interval[] = await busyTimes(user.id, connection.busyCalendarIds, now, until)
      open = subtract(open, busy)
      calendarBusy = 'applied'
    } catch (e) {
      console.error('Reading Google busy times failed', e)
      calendarBusy = 'failed'
    }
  }
  let offerCalendars: CalendarSummary[] | null = null
  if (multiBusiness && connection?.status === 'active') {
    try {
      offerCalendars = await listCalendars(user.id)
    } catch {
      offerCalendars = null
    }
  }
  const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric' })
  const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' })
  const dateTimeFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const byDay = new Map<string, string[]>()
  for (const iv of open) {
    const key = dayFmt.format(iv.start)
    byDay.set(key, [...(byDay.get(key) ?? []), `${timeFmt.format(iv.start)} – ${timeFmt.format(iv.end)}`])
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          When families can book you. Your hours, time off and calendar apply to {multiBusiness ? 'every business you work with' : 'all your bookings'}
          {membership.coaches ? '' : ' (you’re not set up as a coach here yet, so this only matters once you take sessions)'}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly hours</CardTitle>
          <CardDescription>Times are in your own time zone and stay the same when the clocks change.</CardDescription>
        </CardHeader>
        <CardContent>
          <WeeklyHoursForm initial={weekly} timezone={timezone} saved={Boolean(schedule)} />
        </CardContent>
      </Card>

      <CalendarCard userId={user.id} email={user.email} outcome={calendarOutcome} />

      {multiBusiness && (
        <Card>
          <CardHeader>
            <CardTitle>What {business.name} gets</CardTitle>
            <CardDescription>You work with {workspaces.length} businesses. Choose which of your hours {business.name} can book, and where its bookings go. Other businesses only ever see that you’re busy.</CardDescription>
          </CardHeader>
          <CardContent>
            <BusinessOfferForm
              businessName={business.name}
              offered={offered}
              personal={weekly}
              calendars={offerCalendars}
              destination={offer?.destination_calendar_id ?? ''}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Time off</CardTitle>
            <CardDescription>Blocks you out for every business, whatever your weekly hours say. Businesses only see that you’re busy. Times are {zoneLabel}.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {(timeOff ?? []).length > 0 && (
              <ul className="divide-y rounded-lg border text-sm">
                {(timeOff ?? []).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="grid flex-1">
                      <span>{dateTimeFmt.format(new Date(t.starts_at))} – {dateTimeFmt.format(new Date(t.ends_at))}</span>
                      {t.note && <span className="text-muted-foreground text-xs">{t.note}</span>}
                    </div>
                    <form action={removeTimeOff}>
                      <input type="hidden" name="id" value={t.id} />
                      <Button type="submit" variant="ghost" size="icon-sm" aria-label="Remove this time off"><Trash2 /></Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {/* Remount when the list changes so an old "added" message doesn't linger after a removal. */}
            <TimeOffForm key={(timeOff ?? []).map((t) => t.id).join()} timezone={timezone} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next {PREVIEW_DAYS} days</CardTitle>
            <CardDescription>
              {calendarBusy === 'applied'
                ? `When ${business.name} can book you, after time off, bookings and busy times in Google Calendar.`
                : calendarBusy === 'failed'
                  ? 'We couldn’t read Google Calendar just now, so these times may include conflicts.'
                  : `When ${business.name} can book you, after time off and bookings. Connect Google Calendar to leave out busy times too.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!schedule ? (
              <p className="text-muted-foreground text-sm">Save your weekly hours to see your open times.</p>
            ) : byDay.size === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing open in the next week.</p>
            ) : (
              <dl className="grid gap-2 text-sm">
                {[...byDay].map(([day, ranges]) => (
                  <div key={day} className="flex gap-3">
                    <dt className="w-28 shrink-0 font-medium">{day}</dt>
                    <dd className="text-muted-foreground">{ranges.join(', ')}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
