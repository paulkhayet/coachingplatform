import 'server-only'
import { and, eq, gt, lt, sql } from 'drizzle-orm'
import { adminDb } from '@/db/server'
import { availabilitySchedules, availabilityTimeOff, bookingPages, bookings, businesses, memberships, profiles, type BookingPage } from '@/db/schema'
import { bookableStarts, openIntervals, parseWeeklyHours, type Interval } from '@/lib/slots'
import { busyTimes, createBookingEvent, deleteBookingEvent } from '@/lib/google/calendar'
import { getConnection } from '@/lib/google/server'
import type { GuestBookingInput } from './schemas'

// Public booking (D-049). Guests have no account, so these run with the server's own database
// connection; every input is checked here and the database enforces no double-booking.

const DAY_MS = 24 * 3600_000
/** Never compute more than this many days at once, whatever the page's window. */
const MAX_LOOKAHEAD_DAYS = 60
/** A guest can hold at most this many upcoming calls on one page (simple abuse limit). */
const MAX_UPCOMING_PER_GUEST = 3

export interface PublicPage {
  page: BookingPage
  business: { id: string; name: string; slug: string; timezone: string }
  hostName: string
}

/** An active booking page whose host is still an active member, by its public address. */
export async function findPublicPage(businessSlug: string, pageSlug: string): Promise<PublicPage | null> {
  const rows = await adminDb()
    .select({ page: bookingPages, business: { id: businesses.id, name: businesses.name, slug: businesses.slug, timezone: businesses.timezone }, hostName: profiles.fullName, hostEmail: profiles.email })
    .from(bookingPages)
    .innerJoin(businesses, eq(businesses.id, bookingPages.businessId))
    .innerJoin(memberships, and(eq(memberships.id, bookingPages.hostMembershipId), eq(memberships.status, 'active')))
    .leftJoin(profiles, eq(profiles.id, memberships.userId))
    .where(and(eq(businesses.slug, businessSlug), eq(bookingPages.slug, pageSlug), eq(bookingPages.active, true)))
    .limit(1)
  const r = rows[0]
  if (!r) return null
  return { page: r.page, business: r.business, hostName: r.hostName ?? r.business.name }
}

/** The business's active pages, for its public index. */
export async function listPublicPages(businessSlug: string) {
  const rows = await adminDb()
    .select({ business: { id: businesses.id, name: businesses.name, slug: businesses.slug }, page: { slug: bookingPages.slug, title: bookingPages.title, description: bookingPages.description, durationMinutes: bookingPages.durationMinutes } })
    .from(businesses)
    .leftJoin(bookingPages, and(eq(bookingPages.businessId, businesses.id), eq(bookingPages.active, true)))
    .where(eq(businesses.slug, businessSlug))
    .orderBy(bookingPages.title)
  if (rows.length === 0) return null
  return { business: rows[0].business, pages: rows.flatMap((r) => (r.page?.slug ? [r.page] : [])) }
}

export type SlotsResult = { starts: Date[]; calendarUnavailable: boolean }

/**
 * Bookable start times for a page between `from` and `to`: the host's weekly hours, minus time off,
 * Google Calendar busy times and existing bookings, with the page's length, buffers and notice.
 * If the host's connected calendar can't be read, nothing is offered: an unknown time isn't a free one.
 */
export async function availableStarts(page: BookingPage, from: Date, to: Date, now = new Date()): Promise<SlotsResult> {
  const db = adminDb()
  const [schedule] = await db.select().from(availabilitySchedules).where(eq(availabilitySchedules.membershipId, page.hostMembershipId)).limit(1)
  if (!schedule) return { starts: [], calendarUnavailable: false }

  // Look a day either side of the range: open hours are built from the start of the coach's day (so
  // starts line up with their hours: 9:00, 9:30 … rather than 11:02, 11:32 …), and a slot near the end
  // of the range still needs its full length, buffers and any time off checked.
  const outerFrom = new Date(from.getTime() - DAY_MS)
  const outerTo = new Date(to.getTime() + DAY_MS)
  const pad = (page.bufferBeforeMinutes + page.bufferAfterMinutes + page.durationMinutes) * 60_000
  const busyFrom = new Date(from.getTime() - pad)
  const busyTo = new Date(to.getTime() + pad)

  const [timeOff, booked] = await Promise.all([
    db.select({ start: availabilityTimeOff.startsAt, end: availabilityTimeOff.endsAt }).from(availabilityTimeOff).where(and(eq(availabilityTimeOff.membershipId, page.hostMembershipId), lt(availabilityTimeOff.startsAt, outerTo), gt(availabilityTimeOff.endsAt, outerFrom))),
    db.select({ start: bookings.startsAt, end: bookings.endsAt }).from(bookings).where(and(eq(bookings.hostMembershipId, page.hostMembershipId), eq(bookings.status, 'confirmed'), lt(bookings.startsAt, busyTo), gt(bookings.endsAt, busyFrom))),
  ])

  const busy: Interval[] = [...booked]
  const connection = await getConnection(page.hostMembershipId)
  if (connection) {
    if (connection.status !== 'active') return { starts: [], calendarUnavailable: true }
    try {
      busy.push(...(await busyTimes(page.hostMembershipId, connection.busyCalendarIds, busyFrom, busyTo)))
    } catch (error) {
      console.error('Reading Google busy times for booking failed', error)
      return { starts: [], calendarUnavailable: true }
    }
  }

  const open = openIntervals(parseWeeklyHours(schedule.weeklyHours), schedule.timezone, outerFrom, outerTo, timeOff)
  const all = bookableStarts(open, {
    durationMinutes: page.durationMinutes,
    bufferBeforeMinutes: page.bufferBeforeMinutes,
    bufferAfterMinutes: page.bufferAfterMinutes,
    minNoticeMinutes: page.minNoticeMinutes,
    now,
    busy,
  })
  // Keep only starts inside the requested range (from ≤ start ≤ to).
  return { starts: all.filter((s) => s >= from && s <= to), calendarUnavailable: false }
}

/** The page's whole booking window from now (capped), for showing times to a guest. */
export function bookingWindow(page: BookingPage, now = new Date()) {
  return { from: now, to: new Date(now.getTime() + Math.min(page.windowDays, MAX_LOOKAHEAD_DAYS) * DAY_MS) }
}

export type BookResult = { ok: true; bookingId: string } | { ok: false; reason: 'taken' | 'limit' | 'calendar' }

/** Books a call if the time is still open. The database's overlap guard settles races. */
export async function bookCall(pub: PublicPage, input: GuestBookingInput, now = new Date()): Promise<BookResult> {
  const { page } = pub
  const start = new Date(input.start)
  const end = new Date(start.getTime() + page.durationMinutes * 60_000)
  const window = bookingWindow(page, now)
  if (start < window.from || start > window.to) return { ok: false, reason: 'taken' }

  // Recheck this exact time against everything, including Google Calendar, right now.
  const check = await availableStarts(page, start, start, now)
  if (check.calendarUnavailable) return { ok: false, reason: 'calendar' }
  if (!check.starts.some((s) => s.getTime() === start.getTime())) return { ok: false, reason: 'taken' }

  const db = adminDb()
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.bookingPageId, page.id), eq(bookings.guestEmail, input.email), eq(bookings.status, 'confirmed'), gt(bookings.startsAt, now)))
  if (count >= MAX_UPCOMING_PER_GUEST) return { ok: false, reason: 'limit' }

  let bookingId: string
  try {
    const [row] = await db
      .insert(bookings)
      .values({
        businessId: pub.business.id,
        bookingPageId: page.id,
        hostMembershipId: page.hostMembershipId,
        title: page.title,
        startsAt: start,
        endsAt: end,
        guestName: input.name,
        guestEmail: input.email,
        guestNotes: input.notes || null,
        guestTimezone: input.timezone || null,
        locationType: page.locationType,
        locationDetail: page.locationDetail,
      })
      .returning({ id: bookings.id })
    bookingId = row.id
  } catch (error) {
    // 23P01: exclusion_violation from bookings_no_overlap. Someone else just took this time.
    if ((error as { cause?: { code?: string } }).cause?.code === '23P01' || (error as { code?: string }).code === '23P01') return { ok: false, reason: 'taken' }
    throw error
  }

  await addToCalendar(bookingId, pub, input, start, end)
  return { ok: true, bookingId }
}

/** Puts the booking on the host's chosen calendar and invites the guest. The booking stands even if this fails. */
async function addToCalendar(bookingId: string, pub: PublicPage, input: GuestBookingInput, start: Date, end: Date) {
  const { page } = pub
  const connection = await getConnection(page.hostMembershipId)
  if (!connection || connection.status !== 'active' || !connection.destinationCalendarId) return
  const lines = [`Booked through schedulefa.st (${pub.business.name}).`, `Guest: ${input.name} <${input.email}>`]
  if (page.locationDetail) lines.push(`Where: ${page.locationDetail}`)
  if (input.notes) lines.push('', `Note from ${input.name}:`, input.notes)
  try {
    const eventId = await createBookingEvent(page.hostMembershipId, connection.destinationCalendarId, {
      summary: `${page.title} with ${input.name}`,
      description: lines.join('\n'),
      location: page.locationDetail ?? undefined,
      start,
      end,
      timeZone: input.timezone || pub.business.timezone,
      attendees: [{ email: input.email, displayName: input.name }],
      bookingId,
      notify: true,
    })
    await adminDb().update(bookings).set({ googleCalendarId: connection.destinationCalendarId, googleEventId: eventId }).where(eq(bookings.id, bookingId))
  } catch (error) {
    console.error('Adding the booking to Google Calendar failed', error)
    await adminDb().update(bookings).set({ calendarSyncError: 'Couldn’t add this booking to Google Calendar.' }).where(eq(bookings.id, bookingId))
  }
}

/** Cancels a booking (staff only; the caller checks permission) and removes its calendar event. */
export async function cancelBooking(bookingId: string) {
  const [row] = await adminDb()
    .update(bookings)
    .set({ status: 'cancelled', cancelledAt: sql`now()` })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'confirmed')))
    .returning()
  if (!row?.googleEventId || !row.googleCalendarId) return
  try {
    await deleteBookingEvent(row.hostMembershipId, row.googleCalendarId, row.googleEventId, true)
  } catch (error) {
    console.error('Removing the cancelled booking from Google Calendar failed', error)
  }
}

/** What the guest's confirmation page shows. Anyone with the (unguessable) booking ID can see it. */
export async function confirmationFor(bookingId: string) {
  const [row] = await adminDb()
    .select({ booking: bookings, businessName: businesses.name, businessSlug: businesses.slug })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(eq(bookings.id, bookingId))
    .limit(1)
  return row
}
