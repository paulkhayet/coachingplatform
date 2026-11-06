import 'server-only'
import type { Interval } from '@/lib/slots'
import { calendarApi } from './server'

// What schedulefa.st does with a coach's Google Calendar. Each call maps to one approved permission.

export interface CalendarSummary {
  id: string
  name: string
  primary: boolean
  /** Only calendars the coach owns can receive booking events (calendar.events.owned). */
  owned: boolean
}

/** calendar.calendarlist.readonly: the coach's calendars, so they can choose which count as busy. */
export async function listCalendars(membershipId: string): Promise<CalendarSummary[]> {
  const out: CalendarSummary[] = []
  let pageToken: string | undefined
  do {
    const page = await calendarApi<{ items?: { id: string; summary?: string; summaryOverride?: string; primary?: boolean; accessRole: string; hidden?: boolean; deleted?: boolean }[]; nextPageToken?: string }>(
      membershipId,
      `/users/me/calendarList?maxResults=250${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
    )
    for (const c of page.items ?? []) {
      if (c.deleted) continue
      out.push({ id: c.id, name: c.summaryOverride ?? c.summary ?? c.id, primary: Boolean(c.primary), owned: c.accessRole === 'owner' })
    }
    pageToken = page.nextPageToken
  } while (pageToken)
  return out.sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name))
}

/** calendar.freebusy: busy blocks only (no titles or details) across the chosen calendars. */
export async function busyTimes(membershipId: string, calendarIds: string[], from: Date, to: Date): Promise<Interval[]> {
  if (calendarIds.length === 0) return []
  const res = await calendarApi<{ calendars: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> }>(membershipId, '/freeBusy', {
    method: 'POST',
    body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: calendarIds.map((id) => ({ id })) }),
  })
  const busy: Interval[] = []
  for (const [id, cal] of Object.entries(res.calendars ?? {})) {
    // Don't treat a calendar we couldn't read as free (spec: never treat an unknown slot as free).
    if (cal.errors?.length) throw new Error(`Couldn't read busy times for calendar ${id}`)
    for (const b of cal.busy ?? []) busy.push({ start: new Date(b.start), end: new Date(b.end) })
  }
  return busy
}

export interface BookingEvent {
  summary: string
  description?: string
  start: Date
  end: Date
  timeZone: string
  location?: string
  attendees?: { email: string; displayName?: string }[]
  /** Our booking ID, stored privately on the event so we can find it again. */
  bookingId: string
}

function eventBody(e: BookingEvent) {
  return {
    summary: e.summary,
    description: e.description,
    location: e.location,
    start: { dateTime: e.start.toISOString(), timeZone: e.timeZone },
    end: { dateTime: e.end.toISOString(), timeZone: e.timeZone },
    attendees: e.attendees,
    extendedProperties: { private: { schedulefastBookingId: e.bookingId } },
    reminders: { useDefault: true },
  }
}

/** calendar.events.owned: add a booking to the coach's chosen calendar. Returns Google's event ID. */
export async function createBookingEvent(membershipId: string, calendarId: string, e: BookingEvent): Promise<string> {
  const created = await calendarApi<{ id: string }>(membershipId, `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`, { method: 'POST', body: JSON.stringify(eventBody(e)) })
  return created.id
}

/** calendar.events.owned: change an event schedulefa.st created (reschedules). */
export async function updateBookingEvent(membershipId: string, calendarId: string, eventId: string, e: BookingEvent) {
  await calendarApi(membershipId, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, { method: 'PUT', body: JSON.stringify(eventBody(e)) })
}

/** calendar.events.owned: remove an event schedulefa.st created (cancellations). */
export async function deleteBookingEvent(membershipId: string, calendarId: string, eventId: string) {
  await calendarApi(membershipId, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, { method: 'DELETE' })
}
