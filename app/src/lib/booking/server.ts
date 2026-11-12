import 'server-only'
import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from 'drizzle-orm'
import { adminDb, type AdminDb } from '@/db/server'
import {
  availabilitySchedules,
  availabilityTimeOff,
  bookingPageHosts,
  bookingPages,
  bookings,
  businesses,
  membershipAvailability,
  memberships,
  profiles,
  stripeAccounts,
  workspaceSubscriptions,
  type Booking,
  type BookingAnswer,
  type BookingPage,
} from '@/db/schema'
import { siteUrl } from '@/lib/env'
import { DEFAULT_WEEKLY_HOURS, bookableStarts, hoursForBusiness, parseWeeklyHours, subtract, zonedTime, type Interval } from '@/lib/slots'
import { unpaidDeadline } from '@/lib/clients/credits'
import { cancelCoachingForDepartedHost, cancelUnpaidReservation } from '@/lib/clients/sessions'
import { busyTimes, createBookingEvent, deleteBookingEvent, updateBookingEvent } from '@/lib/google/calendar'
import { getConnection } from '@/lib/google/server'
import { stripe, stripeLivemode } from '@/lib/stripe/server'
import { isEmailConfigured, sendEmail } from '@/lib/email/server'
import { createZoomMeeting, deleteZoomMeeting, updateZoomMeeting } from '@/lib/zoom/server'
import { formatAnswer } from './questions'
import { deriveKey, fairestFirst, formatCents, guestCanChange, manageToken, refundOnCancel, verifyManageToken } from './policy'
import { guestCancelled, guestConfirmation, guestReminder, guestRescheduled, hostGuestChange, hostNewBooking, reservationPaymentCancelled, reservationPaymentReminder, type CallDetails } from './emails'
import type { GuestBookingInput } from './schemas'

// Public booking (D-049, D-056). Guests have no account, so these run with the server's own database
// connection; every input is checked here, and the database refuses double-booking.

const DAY_MS = 24 * 3600_000
const MAX_LOOKAHEAD_DAYS = 60
const MAX_UPCOMING_PER_GUEST = 3
/** Stripe Checkout sessions last at least 30 minutes; hold the time a little longer than that. */
const CHECKOUT_MINUTES = 30
const HOLD_MINUTES = CHECKOUT_MINUTES + 2

// ── Manage links ─────────────────────────────────────────────────────────────────────────────────────

function linkKey() {
  const master = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  return master ? deriveKey(master, 'booking manage links') : null
}

/** The guest's private link to reschedule or cancel, or undefined if links aren't set up on this server. */
export function manageUrl(bookingId: string) {
  const key = linkKey()
  return key ? `${siteUrl}/m/${manageToken(bookingId, key)}` : undefined
}

export function bookingIdFromToken(token: string) {
  const key = linkKey()
  return key ? verifyManageToken(token, key) : null
}

// ── Pages ────────────────────────────────────────────────────────────────────────────────────────────

export interface PublicPage {
  page: BookingPage
  business: { id: string; name: string; slug: string; timezone: string; logoPath: string | null; websiteUrl: string | null }
  /** The host's name, or for a shared page (D-061) a description of who takes the call. */
  hostName: string
  hostEmail: string | null
  /** Any available coach from a group takes the call (D-061). */
  shared: boolean
}

export async function findPublicPage(businessSlug: string, pageSlug: string): Promise<PublicPage | null> {
  const rows = await adminDb()
    .select({ page: bookingPages, business: { id: businesses.id, name: businesses.name, slug: businesses.slug, timezone: businesses.timezone, logoPath: businesses.logoPath, websiteUrl: businesses.websiteUrl }, hostName: profiles.fullName, hostEmail: profiles.email, hostActive: memberships.id })
    .from(bookingPages)
    .innerJoin(businesses, eq(businesses.id, bookingPages.businessId))
    .leftJoin(memberships, and(eq(memberships.id, bookingPages.hostMembershipId), eq(memberships.status, 'active')))
    .leftJoin(profiles, eq(profiles.id, memberships.userId))
    .where(and(eq(businesses.slug, businessSlug), eq(bookingPages.slug, pageSlug), eq(bookingPages.active, true)))
    .limit(1)
  const r = rows[0]
  if (!r) return null
  if (!r.page.hostMembershipId) return { page: r.page, business: r.business, hostName: `a ${r.business.name} coach`, hostEmail: null, shared: true }
  // A single-host page whose host has left isn't bookable.
  if (!r.hostActive) return null
  return { page: r.page, business: r.business, hostName: r.hostName ?? r.business.name, hostEmail: r.hostEmail, shared: false }
}

export async function listPublicPages(businessSlug: string) {
  const rows = await adminDb()
    .select({ business: { id: businesses.id, name: businesses.name, slug: businesses.slug, logoPath: businesses.logoPath, about: businesses.about, websiteUrl: businesses.websiteUrl, contactEmail: businesses.contactEmail }, page: { slug: bookingPages.slug, title: bookingPages.title, description: bookingPages.description, durationMinutes: bookingPages.durationMinutes, priceCents: bookingPages.priceCents } })
    .from(businesses)
    .leftJoin(bookingPages, and(eq(bookingPages.businessId, businesses.id), eq(bookingPages.active, true)))
    .where(eq(businesses.slug, businessSlug))
    .orderBy(bookingPages.title)
  if (rows.length === 0) return null
  return { business: rows[0].business, pages: rows.flatMap((r) => (r.page?.slug ? [r.page] : [])) }
}

/** The business's connected Stripe account, if it can take card payments right now. */
export async function paymentAccount(businessId: string): Promise<string | null> {
  const [row] = await adminDb().select().from(stripeAccounts).where(eq(stripeAccounts.businessId, businessId)).limit(1)
  return row && !row.disconnectedAt && row.chargesEnabled ? row.stripeAccountId : null
}

// ── Availability ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Who a membership's bookings belong to and the hours that apply (D-057, D-059): the person, their own
 * hours for this business (null = their default hours), where its bookings go on their calendar, and the
 * business's opening hours and time zone.
 */
async function hostContext(membershipId: string) {
  const [row] = await adminDb()
    .select({
      userId: memberships.userId,
      businessHours: membershipAvailability.offeredHours,
      destinationCalendarId: membershipAvailability.destinationCalendarId,
      openingHours: businesses.openingHours,
      businessTimezone: businesses.timezone,
    })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .leftJoin(membershipAvailability, eq(membershipAvailability.membershipId, memberships.id))
    .where(eq(memberships.id, membershipId))
    .limit(1)
  return row
}

export type SlotsResult = { starts: Date[]; calendarUnavailable: boolean }

/**
 * Bookable start times for a page between `from` and `to`: the host's weekly hours (limited to the
 * hours they offer this business), minus their time off, Google Calendar busy times, and their
 * confirmed bookings and unexpired payment holds in every business they work with (D-057). If their
 * calendar can't be read, nothing is offered: an unknown time isn't a free one.
 */
/**
 * A member's time for one business between the given bounds: their open hours (see hoursForBusiness:
 * their hours for that business inside its opening hours, minus time off) and everything that makes them busy (bookings and
 * payment holds in every business they work with, plus Google Calendar busy times). `unknown` when their
 * calendar can't be read: an unknown time is never treated as free.
 */
async function memberTime(membershipId: string, open: { from: Date; to: Date }, busyRange: { from: Date; to: Date }, now: Date, ignoreBookingId?: string): Promise<{ open: Interval[]; busy: Interval[] } | 'unknown' | null> {
  const db = adminDb()
  const host = await hostContext(membershipId)
  if (!host) return null
  // Nobody needs to save hours before they can be booked: until they do, weekdays 9 to 5 in this business's time zone.
  const [saved] = await db.select().from(availabilitySchedules).where(eq(availabilitySchedules.userId, host.userId)).limit(1)
  const schedule = saved ?? { timezone: host.businessTimezone, weeklyHours: DEFAULT_WEEKLY_HOURS }

  const holding = or(eq(bookings.status, 'confirmed'), and(eq(bookings.status, 'pending_payment'), gt(bookings.holdExpiresAt, now)))
  const [timeOff, booked] = await Promise.all([
    db.select({ start: availabilityTimeOff.startsAt, end: availabilityTimeOff.endsAt }).from(availabilityTimeOff).where(and(eq(availabilityTimeOff.userId, host.userId), lt(availabilityTimeOff.startsAt, open.to), gt(availabilityTimeOff.endsAt, open.from))),
    db
      .select({ start: bookings.startsAt, end: bookings.endsAt })
      .from(bookings)
      .where(and(eq(bookings.hostUserId, host.userId), holding, lt(bookings.startsAt, busyRange.to), gt(bookings.endsAt, busyRange.from), ignoreBookingId ? ne(bookings.id, ignoreBookingId) : undefined)),
  ])

  const busy: Interval[] = [...booked]
  const connection = await getConnection(host.userId)
  if (connection) {
    if (connection.status !== 'active') return 'unknown'
    try {
      let googleBusy = await busyTimes(host.userId, connection.busyCalendarIds, busyRange.from, busyRange.to)
      // When rescheduling, the booking's own Google event shows as busy; don't let it block itself.
      if (ignoreBookingId) {
        const [own] = await db.select({ start: bookings.startsAt, end: bookings.endsAt }).from(bookings).where(eq(bookings.id, ignoreBookingId)).limit(1)
        if (own) googleBusy = googleBusy.filter((b) => !(b.start.getTime() === own.start.getTime() && b.end.getTime() === own.end.getTime()))
      }
      busy.push(...googleBusy)
    } catch (error) {
      console.error('Reading Google busy times failed', error)
      return 'unknown'
    }
  }

  const openHours = hoursForBusiness({
    personTimezone: schedule.timezone,
    defaultHours: parseWeeklyHours(schedule.weeklyHours),
    businessHours: host.businessHours ? parseWeeklyHours(host.businessHours) : null,
    openingHours: host.openingHours ? parseWeeklyHours(host.openingHours) : null,
    businessTimezone: host.businessTimezone,
    from: open.from,
    to: open.to,
    timeOff,
  })
  return { open: openHours, busy }
}

/** The coaches who take a page's calls: its host, or for a shared page every active coach on it (D-061). */
export async function pageHosts(page: Pick<BookingPage, 'id' | 'hostMembershipId'>): Promise<string[]> {
  if (page.hostMembershipId) return [page.hostMembershipId]
  const rows = await adminDb()
    .select({ id: bookingPageHosts.membershipId })
    .from(bookingPageHosts)
    .innerJoin(memberships, and(eq(memberships.id, bookingPageHosts.membershipId), eq(memberships.status, 'active')))
    .where(eq(bookingPageHosts.bookingPageId, page.id))
  return rows.map((r) => r.id)
}

export type HostSlots = SlotsResult & { byHost: Map<string, Date[]> }

/**
 * Bookable start times for a page between `from` and `to`. One host: their time for this business (see
 * memberTime) with the page's length, buffers and notice. A shared page (D-061): every time at least one
 * of its coaches is free. A coach whose calendar can't be read offers nothing (an unknown time isn't a
 * free one); `calendarUnavailable` says so when that leaves no times at all. `hostMembershipId` limits
 * it to one coach, e.g. when a guest moves a call that's already theirs.
 */
export async function availableStarts(page: BookingPage, from: Date, to: Date, now = new Date(), opts: { ignoreBookingId?: string; hostMembershipId?: string } = {}): Promise<HostSlots> {
  const hosts = opts.hostMembershipId ? [opts.hostMembershipId] : await pageHosts(page)
  const results = await Promise.all(hosts.map(async (h) => [h, await hostStarts(page, h, from, to, now, opts.ignoreBookingId)] as const))
  const byHost = new Map(results.map(([h, r]) => [h, r.starts]))
  const seen = new Map<number, Date>()
  for (const [, r] of results) for (const d of r.starts) seen.set(d.getTime(), d)
  const starts = [...seen.values()].sort((a, b) => a.getTime() - b.getTime())
  return { starts, calendarUnavailable: starts.length === 0 && results.some(([, r]) => r.calendarUnavailable), byHost }
}

async function hostStarts(page: Pick<BookingPage, 'durationMinutes' | 'bufferBeforeMinutes' | 'bufferAfterMinutes' | 'minNoticeMinutes'>, hostMembershipId: string, from: Date, to: Date, now: Date, ignoreBookingId?: string): Promise<SlotsResult> {
  // A day either side: open hours start from the coach's day (so starts line up 9:00, 9:30 … not
  // 11:02, 11:32 …), and slots near the edges still get their full length, buffers and time off checked.
  const pad = (page.bufferBeforeMinutes + page.bufferAfterMinutes + page.durationMinutes) * 60_000
  const time = await memberTime(
    hostMembershipId,
    { from: new Date(from.getTime() - DAY_MS), to: new Date(to.getTime() + DAY_MS) },
    { from: new Date(from.getTime() - pad), to: new Date(to.getTime() + pad) },
    now,
    ignoreBookingId,
  )
  if (time === 'unknown') return { starts: [], calendarUnavailable: true }
  if (!time) return { starts: [], calendarUnavailable: false }
  const all = bookableStarts(time.open, {
    durationMinutes: page.durationMinutes,
    bufferBeforeMinutes: page.bufferBeforeMinutes,
    bufferAfterMinutes: page.bufferAfterMinutes,
    minNoticeMinutes: page.minNoticeMinutes,
    now,
    busy: time.busy,
  })
  return { starts: all.filter((s) => s >= from && s <= to), calendarUnavailable: false }
}

type CoachingSlotInput = { clientId: string; coachId: string; durationMinutes: number; ignoreBookingId?: string }

async function coachingStartsInRange(input: CoachingSlotInput, from: Date, to: Date, now: Date) {
  if (to < from) return { starts: [], calendarUnavailable: false }
  const [host, clientBusy] = await Promise.all([
    hostStarts({ durationMinutes: input.durationMinutes, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, minNoticeMinutes: 0 }, input.coachId, from, to, now, input.ignoreBookingId),
    adminDb().select({ start: bookings.startsAt, end: bookings.endsAt }).from(bookings)
      .where(and(eq(bookings.coachingClientId, input.clientId), eq(bookings.status, 'confirmed'), gt(bookings.endsAt, from),
        lt(bookings.startsAt, new Date(to.getTime() + input.durationMinutes * 60_000)), input.ignoreBookingId ? ne(bookings.id, input.ignoreBookingId) : undefined)),
  ])
  return { ...host, starts: host.starts.filter((start) => !clientBusy.some((busy) => start < busy.end && start.getTime() + input.durationMinutes * 60_000 > busy.start.getTime())) }
}

/** A weekly preview checks its dates in one calendar range rather than making a request per occurrence. */
export async function availableCoachingDates(input: CoachingSlotInput, dates: Date[], now = new Date()) {
  if (!dates.length) return { starts: [], calendarUnavailable: false }
  const wanted = new Set(dates.map((date) => date.getTime()))
  const result = await coachingStartsInRange(input, new Date(Math.min(...wanted)), new Date(Math.max(...wanted)), now)
  return { ...result, starts: result.starts.filter((date) => wanted.has(date.getTime())) }
}

/** Staff select a day in the business time zone. Only starts free for both coach and client are offered. */
export async function availableCoachingStarts(input: CoachingSlotInput & { day: string; endsOn: string; timezone: string }, now = new Date()) {
  const atMidnight = (day: string, minutes = 0) => {
    const [year, month, date] = day.split('-').map(Number)
    return zonedTime(year, month, date, minutes, input.timezone)
  }
  const from = new Date(Math.max(atMidnight(input.day).getTime(), now.getTime() + 1))
  const until = atMidnight(input.day, 1440)
  const periodEnd = atMidnight(input.endsOn)
  const to = new Date(Math.min(until.getTime() - 1, periodEnd.getTime() - input.durationMinutes * 60_000, now.getTime() + MAX_LOOKAHEAD_DAYS * DAY_MS))
  return coachingStartsInRange(input, from, to, now)
}

/**
 * When a member is free for this business between `from` and `to` (D-058): the owner's team view.
 * Only free ranges come back, never what makes someone busy. Null if they haven't set hours.
 */
export async function freeTimes(membershipId: string, from: Date, to: Date, now = new Date()): Promise<Interval[] | 'unknown' | null> {
  const time = await memberTime(membershipId, { from, to }, { from, to }, now)
  if (time === 'unknown' || time === null) return time
  return subtract(time.open, time.busy)
}

export function bookingWindow(page: BookingPage, now = new Date()) {
  return { from: now, to: new Date(now.getTime() + Math.min(page.windowDays, MAX_LOOKAHEAD_DAYS) * DAY_MS) }
}

/** How many live calls each coach already has from this page, recent and upcoming, for spreading calls evenly. */
async function pageLoad(pageId: string, hosts: string[], now: Date) {
  const rows = await adminDb()
    .select({ host: bookings.hostMembershipId, n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.bookingPageId, pageId), inArray(bookings.hostMembershipId, hosts), or(eq(bookings.status, 'confirmed'), and(eq(bookings.status, 'pending_payment'), gt(bookings.holdExpiresAt, now))), gt(bookings.startsAt, new Date(now.getTime() - 30 * DAY_MS))))
    .groupBy(bookings.hostMembershipId)
  return new Map(rows.map((r) => [r.host, r.n]))
}

async function memberName(membershipId: string, fallback: string) {
  const [r] = await adminDb().select({ name: profiles.fullName }).from(memberships).innerJoin(profiles, eq(profiles.id, memberships.userId)).where(eq(memberships.id, membershipId)).limit(1)
  return r?.name ?? fallback
}

// ── Booking ──────────────────────────────────────────────────────────────────────────────────────────

export type BookResult = { ok: true; bookingId: string; checkoutUrl?: string } | { ok: false; reason: 'taken' | 'limit' | 'calendar' | 'payments' }

export interface GuestExtras {
  answers: BookingAnswer[]
}

/** The admin connection, or a transaction on it (so callers inside a transaction don't need a second connection). */
type Exec = AdminDb | Parameters<Parameters<AdminDb['transaction']>[0]>[0]

const isOverlap = (error: unknown) => (error as { cause?: { code?: string } }).cause?.code === '23P01' || (error as { code?: string }).code === '23P01'

/**
 * Books a call if the time is still open. Free calls are confirmed at once. Paid calls hold the time
 * and send the guest to Stripe Checkout on the business's own account; payment confirms the booking.
 */
export async function bookCall(pub: PublicPage, input: GuestBookingInput, extras: GuestExtras, now = new Date()): Promise<BookResult> {
  const { page } = pub
  const start = new Date(input.start)
  const end = new Date(start.getTime() + page.durationMinutes * 60_000)
  const window = bookingWindow(page, now)
  if (start < window.from || start > window.to) return { ok: false, reason: 'taken' }

  const paid = page.priceCents != null
  const account = paid ? await paymentAccount(pub.business.id) : null
  if (paid && !account) return { ok: false, reason: 'payments' }

  const check = await availableStarts(page, start, start, now)
  const free = [...check.byHost].filter(([, starts]) => starts.some((s) => s.getTime() === start.getTime())).map(([h]) => h)
  if (free.length === 0) return { ok: false, reason: check.calendarUnavailable ? 'calendar' : 'taken' }

  const db = adminDb()
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.bookingPageId, page.id), eq(bookings.guestEmail, input.email), or(eq(bookings.status, 'confirmed'), and(eq(bookings.status, 'pending_payment'), gt(bookings.holdExpiresAt, now))), gt(bookings.startsAt, now)))
  if (count >= MAX_UPCOMING_PER_GUEST) return { ok: false, reason: 'limit' }

  // A shared page gives the call to the free coach with the fewest recent calls from it (D-061). If the
  // database says that coach was just booked by someone else, try the next one.
  const order = free.length > 1 ? fairestFirst(free, await pageLoad(page.id, free, now)) : free
  let bookingId: string | null = null
  let hostMembershipId = order[0]
  for (const candidate of order) {
    const host = await hostContext(candidate)
    if (!host) continue
    // Free up times held by guests who never finished paying, so they don't block this booking.
    await db.update(bookings).set({ status: 'expired' }).where(and(eq(bookings.hostUserId, host.userId), eq(bookings.status, 'pending_payment'), lte(bookings.holdExpiresAt, now)))
    try {
      const [row] = await db
        .insert(bookings)
        .values({
          businessId: pub.business.id,
          bookingPageId: page.id,
          hostMembershipId: candidate,
          hostUserId: host.userId,
          title: page.title,
          startsAt: start,
          endsAt: end,
          status: paid ? 'pending_payment' : 'confirmed',
          holdExpiresAt: paid ? new Date(now.getTime() + HOLD_MINUTES * 60_000) : null,
          paymentStatus: paid ? 'pending' : 'not_required',
          priceCents: page.priceCents,
          stripeAccountId: account,
          refundCutoffHours: page.refundCutoffHours,
          guestName: input.name,
          guestEmail: input.email,
          guestNotes: input.notes || null,
          guestTimezone: input.timezone || null,
          answers: extras.answers,
          locationType: page.locationType,
          locationDetail: page.locationDetail,
        })
        .returning({ id: bookings.id })
      bookingId = row.id
      hostMembershipId = candidate
      break
    } catch (error) {
      if (isOverlap(error)) continue
      throw error
    }
  }
  if (!bookingId) return { ok: false, reason: 'taken' }

  if (!paid) {
    await afterConfirmed(bookingId)
    return { ok: true, bookingId }
  }

  try {
    const pagePath = `/b/${pub.business.slug}/${page.slug}`
    const session = await stripe().checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: input.email,
        line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: page.priceCents!, product_data: { name: `${page.title} with ${pub.shared ? await memberName(hostMembershipId, pub.business.name) : pub.hostName}`, description: `${pub.business.name} · ${page.durationMinutes} minutes` } } }],
        metadata: { booking_id: bookingId },
        payment_intent_data: { metadata: { booking_id: bookingId } },
        success_url: `${siteUrl}${pagePath}/booked/${bookingId}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}${pagePath}?payment=cancelled&hold=${bookingId}`,
        expires_at: Math.floor(now.getTime() / 1000) + CHECKOUT_MINUTES * 60,
      },
      { stripeAccount: account!, idempotencyKey: `checkout:${bookingId}` },
    )
    await db.update(bookings).set({ stripeCheckoutSessionId: session.id }).where(eq(bookings.id, bookingId))
    return { ok: true, bookingId, checkoutUrl: session.url! }
  } catch (error) {
    await db.update(bookings).set({ status: 'expired' }).where(eq(bookings.id, bookingId))
    throw error
  }
}

/** A guest left Stripe Checkout without paying: free the time now rather than when the hold ends. */
export async function releaseHold(bookingId: string) {
  await adminDb().update(bookings).set({ status: 'expired' }).where(and(eq(bookings.id, bookingId), eq(bookings.status, 'pending_payment')))
}

/**
 * Marks a paid booking confirmed (from the Stripe webhook or the success page, whichever comes first).
 * `confirmed` is set only for the call that made the change, so follow-up work happens once. If the
 * money arrived for a booking that's no longer held (shouldn't happen: Checkout expires first),
 * `refundLate` says what to refund. No network calls here, so it's safe inside a transaction.
 */
export async function confirmPaidCheckout(sessionId: string, paymentIntentId: string | null, db: Exec = adminDb()): Promise<{ confirmed?: string; refundLate?: { bookingId: string; paymentIntentId: string; account: string } }> {
  const [row] = await db
    .update(bookings)
    .set({ status: 'confirmed', paymentStatus: 'paid', stripePaymentIntentId: paymentIntentId, holdExpiresAt: null })
    .where(and(eq(bookings.stripeCheckoutSessionId, sessionId), eq(bookings.status, 'pending_payment')))
    .returning({ id: bookings.id })
  if (row) return { confirmed: row.id }
  const [late] = await db.select().from(bookings).where(eq(bookings.stripeCheckoutSessionId, sessionId)).limit(1)
  if (late && late.status !== 'confirmed' && late.paymentStatus === 'pending' && paymentIntentId && late.stripeAccountId) {
    return { refundLate: { bookingId: late.id, paymentIntentId, account: late.stripeAccountId } }
  }
  return {}
}

/** Runs the follow-up of confirmPaidCheckout once its database change is committed. */
export async function afterPaidCheckout(result: Awaited<ReturnType<typeof confirmPaidCheckout>>) {
  if (result.confirmed) await afterConfirmed(result.confirmed)
  if (result.refundLate) await refund(result.refundLate.bookingId, result.refundLate.paymentIntentId, result.refundLate.account)
}

export async function expireCheckout(sessionId: string, db: Exec = adminDb()) {
  await db.update(bookings).set({ status: 'expired' }).where(and(eq(bookings.stripeCheckoutSessionId, sessionId), eq(bookings.status, 'pending_payment')))
}

/** For the success page: if Stripe says it's paid but the webhook hasn't landed yet, confirm now. */
export async function syncCheckout(bookingId: string, sessionId: string) {
  const [b] = await adminDb().select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
  if (!b || b.status !== 'pending_payment' || b.stripeCheckoutSessionId !== sessionId || !b.stripeAccountId) return
  const session = await stripe().checkout.sessions.retrieve(sessionId, {}, { stripeAccount: b.stripeAccountId })
  if (session.payment_status !== 'paid') return
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null)
  await afterPaidCheckout(await confirmPaidCheckout(sessionId, paymentIntent))
}

// ── After confirmation: calendar and emails ──────────────────────────────────────────────────────────

async function context(bookingId: string) {
  const [row] = await adminDb()
    .select({ booking: bookings, business: { name: businesses.name, slug: businesses.slug, timezone: businesses.timezone }, hostName: profiles.fullName, hostEmail: profiles.email })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .innerJoin(memberships, eq(memberships.id, bookings.hostMembershipId))
    .leftJoin(profiles, eq(profiles.id, memberships.userId))
    .where(eq(bookings.id, bookingId))
    .limit(1)
  return row
}

type Ctx = NonNullable<Awaited<ReturnType<typeof context>>>

function details(c: Ctx, forGuest: boolean): CallDetails {
  const b = c.booking
  return {
    businessName: c.business.name,
    title: b.title,
    hostName: c.hostName ?? c.business.name,
    guestName: b.guestName,
    start: b.startsAt,
    end: b.endsAt,
    timeZone: (forGuest ? b.guestTimezone : null) ?? c.business.timezone,
    location: b.locationDetail,
    manageUrl: forGuest && !b.coachingClientId ? manageUrl(b.id) : undefined,
    paymentLine: b.paymentStatus === 'paid' && b.priceCents ? `${formatCents(b.priceCents)} paid` : undefined,
  }
}

function eventDescription(c: Ctx) {
  const b = c.booking
  const lines = [`Booked through schedulefa.st (${c.business.name}).`, `Guest: ${b.guestName}${b.guestEmail ? ` <${b.guestEmail}>` : ''}`]
  if (b.locationDetail) lines.push(`Where: ${b.locationDetail}`)
  for (const a of b.answers) lines.push(`${a.label}: ${formatAnswer(a.value)}`)
  if (b.guestNotes) lines.push('', `Note from ${b.guestName}:`, b.guestNotes)
  if (b.paymentStatus === 'paid' && b.priceCents) lines.push('', `Paid ${formatCents(b.priceCents)} by card.`)
  return lines.join('\n')
}

const meetingFor = (b: Booking, timeZone: string) => ({ topic: `${b.title} with ${b.guestName}`, start: b.startsAt, durationMinutes: Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60_000), timeZone })

/**
 * Zoom pages (D-038): a meeting on the host's own Zoom account, whose link becomes the booking's location.
 * If Zoom can't be reached the booking still stands; the host sees that the link is missing.
 */
async function addZoomMeeting(c: Ctx) {
  const b = c.booking
  if (b.locationType !== 'zoom' || b.zoomMeetingId) return
  try {
    const meeting = await createZoomMeeting(b.hostUserId, { ...meetingFor(b, c.business.timezone), agenda: `Booked through schedulefa.st (${c.business.name}).` })
    await adminDb().update(bookings).set({ zoomMeetingId: meeting.id, locationDetail: meeting.joinUrl, meetingError: null }).where(eq(bookings.id, b.id))
  } catch (error) {
    console.error('Creating the Zoom meeting failed', error)
    await adminDb().update(bookings).set({ meetingError: 'Couldn’t create a Zoom meeting. Send the guest a link yourself, or check your Zoom connection.' }).where(eq(bookings.id, b.id))
  }
}

/** Puts a newly confirmed booking on the host's calendar and emails the guest and host. Never throws. */
export async function afterConfirmed(bookingId: string) {
  const first = await context(bookingId)
  if (!first || first.booking.status !== 'confirmed') return
  if (first.booking.coachingClientId && !first.booking.creditCoveredAt) return
  // The Zoom link comes first, so the calendar invitation and emails include it.
  await addZoomMeeting(first)
  const c = first.booking.locationType === 'zoom' ? ((await context(bookingId)) ?? first) : first
  const b = c.booking
  try {
    const connection = await getConnection(b.hostUserId)
    const destination = (await hostContext(b.hostMembershipId))?.destinationCalendarId ?? connection?.destinationCalendarId
    if (connection?.status === 'active' && destination) {
      const eventId = await createBookingEvent(b.hostUserId, destination, {
        summary: `${b.title} with ${b.guestName}`,
        description: eventDescription(c),
        location: b.locationDetail ?? undefined,
        start: b.startsAt,
        end: b.endsAt,
        timeZone: b.guestTimezone || c.business.timezone,
        attendees: b.guestEmail ? [{ email: b.guestEmail, displayName: b.guestName }] : [],
        bookingId: b.id,
        notify: true,
      })
      await adminDb().update(bookings).set({ googleCalendarId: destination, googleEventId: eventId }).where(eq(bookings.id, b.id))
    }
  } catch (error) {
    console.error('Adding the booking to Google Calendar failed', error)
    await adminDb().update(bookings).set({ calendarSyncError: 'Couldn’t add this booking to Google Calendar.' }).where(eq(bookings.id, b.id))
  }
  if (b.guestEmail) await sendEmail(b.guestEmail, guestConfirmation(details(c, true)), { replyTo: c.hostEmail, idempotencyKey: `confirm:${b.id}` })
  if (c.hostEmail) {
    const extras: [string, string][] = []
    for (const a of b.answers) extras.push([a.label, formatAnswer(a.value)])
    if (b.guestNotes) extras.push(['Note', b.guestNotes])
    await sendEmail(c.hostEmail, hostNewBooking({ ...details(c, false), guestEmail: b.guestEmail, staffBooked: Boolean(b.coachingClientId), extras }), { replyTo: b.guestEmail, idempotencyKey: `host-new:${b.id}` })
  }
}

export async function syncCoachingConfirmations(ids: string[]) {
  for (let i = 0; i < ids.length; i += 3) {
    const results = await Promise.allSettled(ids.slice(i, i + 3).map(afterConfirmed))
    if (results.some((result) => result.status === 'rejected')) console.error('Some coaching session confirmations could not be sent')
  }
}

// ── Changes ──────────────────────────────────────────────────────────────────────────────────────────

async function refund(bookingId: string, paymentIntentId: string, account: string): Promise<boolean> {
  try {
    await stripe().refunds.create({ payment_intent: paymentIntentId, metadata: { booking_id: bookingId } }, { stripeAccount: account, idempotencyKey: `refund:${bookingId}` })
    await adminDb().update(bookings).set({ paymentStatus: 'refunded' }).where(eq(bookings.id, bookingId))
    return true
  } catch (error) {
    console.error('Refund failed', error)
    await adminDb().update(bookings).set({ paymentStatus: 'refund_failed' }).where(eq(bookings.id, bookingId))
    return false
  }
}

export type CancelResult = { ok: true; refund: 'full' | 'none' | 'not_paid'; refundFailed: boolean } | { ok: false }

/** Cancels a confirmed call, refunds per the policy (D-056), removes the calendar event and emails people. */
export async function cancelBooking(bookingId: string, by: 'guest' | 'business', now = new Date()): Promise<CancelResult> {
  const [b] = await adminDb()
    .update(bookings)
    .set({ status: 'cancelled', cancelledAt: sql`now()`, cancelledBy: by })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'confirmed'), isNull(bookings.coachingClientId)))
    .returning()
  if (!b) return { ok: false }

  const decision = refundOnCancel({ paid: b.paymentStatus === 'paid', cancelledBy: by, startsAt: b.startsAt, cutoffHours: b.refundCutoffHours, now })
  let refundFailed = false
  if (decision === 'full' && b.stripePaymentIntentId && b.stripeAccountId) refundFailed = !(await refund(b.id, b.stripePaymentIntentId, b.stripeAccountId))
  await afterBookingCancelled(b, decision)
  return { ok: true, refund: decision, refundFailed }
}

export async function afterBookingCancelled(b: Booking, decision: 'full' | 'none' | 'not_paid' = 'not_paid') {
  const by = b.cancelledBy ?? 'business'
  if (b.googleEventId && b.googleCalendarId) {
    try {
      await deleteBookingEvent(b.hostUserId, b.googleCalendarId, b.googleEventId, true)
    } catch (error) {
      console.error('Removing the cancelled booking from Google Calendar failed', error)
    }
  }
  if (b.zoomMeetingId) {
    try {
      await deleteZoomMeeting(b.hostUserId, b.zoomMeetingId)
    } catch (error) {
      console.error('Deleting the Zoom meeting failed', error)
    }
  }
  const c = await context(b.id)
  if (c) {
    if (b.guestEmail) {
      const call = details(c, true)
      const message = b.unpaidCancelled ? reservationPaymentCancelled(call) : guestCancelled(call, by, decision)
      await sendEmail(b.guestEmail, message, { replyTo: c.hostEmail, idempotencyKey: `cancel:${b.id}` })
    }
    if (by === 'guest' && c.hostEmail) await sendEmail(c.hostEmail, hostGuestChange({ ...details(c, false), guestEmail: b.guestEmail }, 'cancelled', decision), { replyTo: b.guestEmail, idempotencyKey: `host-cancel:${b.id}` })
  }
}

/** Moves a confirmed call to a new open time (no new charge), and updates the calendar and people. */
export async function rescheduleBooking(bookingId: string, newStart: Date, now = new Date()): Promise<{ ok: true } | { ok: false; reason: 'taken' | 'calendar' | 'closed' }> {
  const db = adminDb()
  const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
  if (!b || b.coachingClientId || !b.guestEmail || b.status !== 'confirmed' || !guestCanChange(b.startsAt, now) || !b.bookingPageId) return { ok: false, reason: 'closed' }
  const [page] = await db.select().from(bookingPages).where(eq(bookingPages.id, b.bookingPageId)).limit(1)
  if (!page) return { ok: false, reason: 'closed' }

  const window = bookingWindow(page, now)
  if (newStart < window.from || newStart > window.to) return { ok: false, reason: 'taken' }
  // The call stays with its coach, also on a shared page (D-061).
  const check = await availableStarts(page, newStart, newStart, now, { ignoreBookingId: b.id, hostMembershipId: b.hostMembershipId })
  if (check.calendarUnavailable) return { ok: false, reason: 'calendar' }
  if (!check.starts.some((s) => s.getTime() === newStart.getTime())) return { ok: false, reason: 'taken' }

  const newEnd = new Date(newStart.getTime() + (b.endsAt.getTime() - b.startsAt.getTime()))
  let moved: Booking
  try {
    const [row] = await db
      .update(bookings)
      .set({ startsAt: newStart, endsAt: newEnd, reminderSentAt: null })
      .where(and(eq(bookings.id, b.id), eq(bookings.status, 'confirmed')))
      .returning()
    if (!row) return { ok: false, reason: 'closed' }
    moved = row
  } catch (error) {
    if (isOverlap(error)) return { ok: false, reason: 'taken' }
    throw error
  }

  await afterBookingMoved(moved)
  return { ok: true }
}

/** Apply the committed time to the existing provider records and notify the original invitees. */
export async function afterBookingMoved(moved: Booking) {
  if (moved.coachingClientId && !moved.creditCoveredAt) return
  const c = await context(moved.id)
  if (!c || c.booking.status !== 'confirmed' || c.booking.startsAt.getTime() !== moved.startsAt.getTime()) return
  const b = c.booking
  const db = adminDb()
  if (b.zoomMeetingId) {
    try {
      await updateZoomMeeting(b.hostUserId, b.zoomMeetingId, meetingFor(b, c.business.timezone))
      if (b.meetingError) await db.update(bookings).set({ meetingError: null }).where(eq(bookings.id, b.id))
    } catch (error) {
      console.error('Moving the Zoom meeting failed', error)
      await db.update(bookings).set({ meetingError: 'Couldn’t update the time in Zoom.' }).where(eq(bookings.id, b.id))
    }
  }
  if (b.googleEventId && b.googleCalendarId) {
    try {
      await updateBookingEvent(b.hostUserId, b.googleCalendarId, b.googleEventId, {
        summary: `${b.title} with ${b.guestName}`,
        description: eventDescription(c),
        location: b.locationDetail ?? undefined,
        start: b.startsAt,
        end: b.endsAt,
        timeZone: b.guestTimezone || c.business.timezone,
        attendees: b.guestEmail ? [{ email: b.guestEmail, displayName: b.guestName }] : [],
        bookingId: b.id,
        notify: true,
      })
      if (b.calendarSyncError) await db.update(bookings).set({ calendarSyncError: null }).where(eq(bookings.id, b.id))
    } catch (error) {
      console.error('Moving the Google Calendar event failed', error)
      await db.update(bookings).set({ calendarSyncError: 'Couldn’t move this booking in Google Calendar.' }).where(eq(bookings.id, b.id))
    }
  }
  const stamp = Date.now()
  if (b.guestEmail) await sendEmail(b.guestEmail, guestRescheduled(details(c, true)), { replyTo: c.hostEmail, idempotencyKey: `moved:${b.id}:${stamp}` })
  if (c.hostEmail) await sendEmail(c.hostEmail, hostGuestChange({ ...details(c, false), guestEmail: b.guestEmail, staffMoved: Boolean(b.coachingClientId) }, 'rescheduled'), { replyTo: b.guestEmail, idempotencyKey: `host-moved:${b.id}:${stamp}` })
}

/**
 * Someone was removed from a business or left it (D-058): cancel their upcoming bookings with that
 * business as business cancellations (paid guests are refunded in full), release any payment holds, and
 * stop their booking pages there. Their other businesses are untouched. Returns how many were cancelled.
 */
export async function releaseMember(membershipId: string, now = new Date()) {
  const db = adminDb()
  await db.update(bookingPages).set({ active: false, updatedAt: sql`now()` }).where(eq(bookingPages.hostMembershipId, membershipId))
  // Shared pages carry on with the other coaches (D-061).
  await db.delete(bookingPageHosts).where(eq(bookingPageHosts.membershipId, membershipId))
  await db.update(bookings).set({ status: 'expired' }).where(and(eq(bookings.hostMembershipId, membershipId), eq(bookings.status, 'pending_payment')))
  const upcoming = await db.select({ id: bookings.id, coachingClientId: bookings.coachingClientId }).from(bookings).where(and(eq(bookings.hostMembershipId, membershipId), eq(bookings.status, 'confirmed'), gt(bookings.endsAt, now)))
  let cancelled = 0
  for (const { id, coachingClientId } of upcoming) {
    try {
      if (coachingClientId) {
        const session = await cancelCoachingForDepartedHost(db, id, membershipId, now)
        if (session) {
          cancelled++
          await Promise.all([afterBookingCancelled(session), syncCoachingConfirmations(session.coveredIds)])
        }
      } else if ((await cancelBooking(id, 'business', now)).ok) cancelled++
    } catch (error) {
      console.error(`Cancelling booking ${id} for a removed member failed`, error)
    }
  }
  return { cancelled, total: upcoming.length }
}

// ── Guest views ──────────────────────────────────────────────────────────────────────────────────────

/** What the confirmation and manage pages show. Anyone with the booking ID or link can see it. */
export async function bookingView(bookingId: string) {
  const c = await context(bookingId)
  if (!c || c.booking.coachingClientId) return null
  const page = c.booking.bookingPageId ? (await adminDb().select().from(bookingPages).where(eq(bookingPages.id, c.booking.bookingPageId)).limit(1))[0] : undefined
  return { booking: c.booking as Booking, business: c.business, hostName: c.hostName ?? c.business.name, page }
}

// ── Reminders ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Emails a reminder about a day before each call. Run every 15 minutes or so. Each booking is claimed
 * (reminder_sent_at set) before sending, so overlapping runs never send twice. Calls booked less than a
 * day ahead get no reminder: the confirmation was just sent.
 */
export async function sendDueReminders(now = new Date()) {
  const db = adminDb()
  const claimed = await db
    .update(bookings)
    .set({ reminderSentAt: now })
    .where(
      and(
        eq(bookings.status, 'confirmed'),
        isNotNull(bookings.guestEmail),
        isNull(bookings.reminderSentAt),
        or(isNull(bookings.coachingClientId), isNotNull(bookings.creditCoveredAt)),
        gt(bookings.startsAt, now),
        lte(bookings.startsAt, new Date(now.getTime() + DAY_MS)),
        sql`coalesce(${bookings.creditCoveredAt}, ${bookings.createdAt}) <= ${bookings.startsAt} - interval '24 hours'`,
        // Reminder emails are a paid-plan feature (D-072). Free bookings stay unclaimed, so a business
        // that upgrades before the call still gets its reminder sent.
        sql`exists (select 1 from ${workspaceSubscriptions} ws where ws.business_id = ${bookings.businessId}
          and (ws.source = 'complimentary' or (ws.livemode = ${stripeLivemode} and ws.status in ('active', 'trialing', 'past_due'))))`,
      ),
    )
    .returning({ id: bookings.id })
  let sent = 0
  for (const { id } of claimed) {
    const c = await context(id)
    if (!c?.booking.guestEmail || c.booking.status !== 'confirmed') continue
    if (await sendEmail(c.booking.guestEmail, guestReminder(details(c, true)), { replyTo: c.hostEmail, idempotencyKey: `remind:${id}:${c.booking.startsAt.getTime()}` })) sent++
  }
  return { claimed: claimed.length, sent }
}

/** Release holds that missed the payment cutoff, then remind contacts about upcoming unpaid reservations. */
export async function processUnpaidReservations(now = new Date()) {
  const db = adminDb()
  const unpaid = and(isNotNull(bookings.coachingClientId), eq(bookings.status, 'confirmed'), isNull(bookings.creditCoveredAt))
  const cutoff = sql`${bookings.startsAt} - ${bookings.unpaidCancellationHours} * interval '1 hour'`
  const currentTime = sql`${now.toISOString()}::timestamptz`
  const due = await db.select({ id: bookings.id }).from(bookings)
    .where(and(unpaid, lte(cutoff, currentTime))).orderBy(cutoff, bookings.id).limit(30)
  let cancelled = 0
  // A separate transaction rechecks coverage and time under the same lock used to record payments.
  for (const { id } of due) {
    try {
      const session = await cancelUnpaidReservation(db, id, now)
      if (!session) continue
      cancelled++
      await Promise.all([afterBookingCancelled(session), syncCoachingConfirmations(session.coveredIds)])
    } catch (error) {
      console.error('Unpaid reservation cancellation failed', error)
    }
  }
  if (!isEmailConfigured) return { cancelled, reminded: 0 }
  const ready = and(unpaid, isNull(bookings.paymentReminderSentAt), isNotNull(bookings.guestEmail), gt(bookings.startsAt, now),
    or(isNull(bookings.unpaidCancellationHours), gt(cutoff, currentTime)),
    sql`${bookings.startsAt} - ${bookings.paymentReminderHours} * interval '1 hour' <= ${currentTime}`)
  const candidates = await db.select({ id: bookings.id }).from(bookings).where(ready).orderBy(bookings.startsAt, bookings.id).limit(30)
  let reminded = 0
  for (const { id } of candidates) {
    const [claimed] = await db.update(bookings).set({ paymentReminderSentAt: now }).where(and(eq(bookings.id, id), ready))
      .returning({ startsAt: bookings.startsAt })
    if (!claimed) continue
    try {
      const c = await context(id)
      const b = c?.booking
      if (!c || !b?.guestEmail || b.creditCoveredAt || b.status !== 'confirmed' || b.startsAt.getTime() !== claimed.startsAt.getTime()) continue
      const deadline = b.unpaidCancellationHours === null ? null : unpaidDeadline(claimed.startsAt, b.unpaidCancellationHours)
      if (await sendEmail(b.guestEmail, reservationPaymentReminder(details(c, true), deadline), {
        replyTo: c.hostEmail, idempotencyKey: `payment-needed:${id}:${claimed.startsAt.getTime()}`,
      })) {
        reminded++
        continue
      }
    } catch (error) {
      console.error('Reservation payment reminder failed', error)
    }
    await db.update(bookings).set({ paymentReminderSentAt: null })
      .where(and(eq(bookings.id, id), eq(bookings.paymentReminderSentAt, now), isNull(bookings.creditCoveredAt)))
  }
  return { cancelled, reminded }
}
