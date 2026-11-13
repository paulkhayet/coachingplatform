import 'server-only'

import { cache } from 'react'
import { and, eq, gt, gte, inArray, isNotNull, lt, or, sql } from 'drizzle-orm'
import { adminDb } from '@/db/server'
import {
  availabilitySchedules, availabilityTimeOff, bookings, businesses, clientCreditPayments, coachPayRates, coachingClients, googleCalendarConnections,
  inquiries, membershipAvailability, memberships, profiles, type MemberRole,
} from '@/db/schema'
import { workspacePlan } from '@/lib/billing/server'
import { canSeeFinances, canUseDashboard } from '@/lib/roles'
import { DEFAULT_WEEKLY_HOURS, bookableStarts, hoursForBusiness, parseWeeklyHours, type Interval } from '@/lib/slots'
import { requireWorkspace } from '@/lib/workspace'
import type { AttentionFacts } from './attention'
import { localDay, type FinanceFacts, type PeriodFact } from './finance'
import type { CoachProfile } from './matching'

// Loaders for the team dashboard (D-074). They read across the whole business with the server
// connection, so every caller must have checked the person's role first: use `dashboardAccess`.

const DAY_MS = 86_400_000

/** The signed-in person's workspace, whether its plan includes the dashboard, and what they may see in it. */
export const dashboardAccess = cache(async () => {
  const workspace = await requireWorkspace()
  const plan = await workspacePlan(workspace.business.id)
  return { ...workspace, enabled: plan.limits.teamDashboard, manager: canUseDashboard(workspace.membership.role), owner: canSeeFinances(workspace.membership.role) }
})

export interface TeamMember {
  id: string
  userId: string
  name: string
  email: string | null
  role: MemberRole
  coaches: boolean
  specialties: string[]
  maxClients: number | null
}

/** Active members of the business, by name. */
export const loadTeam = cache(async (businessId: string): Promise<TeamMember[]> => {
  const rows = await adminDb().select({ id: memberships.id, userId: memberships.userId, role: memberships.role, coaches: memberships.coaches,
    specialties: memberships.specialties, maxClients: memberships.maxClients, fullName: profiles.fullName, email: profiles.email })
    .from(memberships).leftJoin(profiles, eq(profiles.id, memberships.userId))
    .where(and(eq(memberships.businessId, businessId), eq(memberships.status, 'active')))
  return rows.map((r) => ({ id: r.id, userId: r.userId, name: r.fullName ?? r.email ?? 'Unknown', email: r.email, role: r.role, coaches: r.coaches, specialties: r.specialties, maxClients: r.maxClients }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

/** Everyone who has ever been in the business, for naming past hosts in reports. */
async function allMemberNames(businessId: string) {
  const rows = await adminDb().select({ id: memberships.id, fullName: profiles.fullName, email: profiles.email, coaches: memberships.coaches, status: memberships.status })
    .from(memberships).leftJoin(profiles, eq(profiles.id, memberships.userId)).where(eq(memberships.businessId, businessId))
  return rows.map((r) => ({ id: r.id, name: r.fullName ?? r.email ?? 'Unknown', coaches: r.coaches, active: r.status === 'active' }))
}

export interface CoachLoad extends CoachProfile {
  /** Minutes they can be booked by this business in the next 14 days (their hours here minus time off). */
  openMinutes: number
  /** Minutes already booked with this business in the next 14 days. */
  bookedMinutes: number
  /** Sessions and calls they hosted here that ended in the last 30 days. */
  recentSessions: number
  /** Whether they've saved working hours of their own. */
  hasHours: boolean
  calendar: 'active' | 'needs_reconnect' | null
}

/**
 * Each coach's load for the overview and for match suggestions: clients, bookable and booked time over
 * the next 14 days, and free hour-long starts once everything they have on (in any business) is taken
 * out. Google Calendar isn't read here; it's checked when a time is actually booked.
 */
export const loadCoachLoads = cache(async (businessId: string): Promise<CoachLoad[]> => {
  const db = adminDb()
  const now = new Date()
  const to = new Date(now.getTime() + 14 * DAY_MS)
  const coaches = (await loadTeam(businessId)).filter((m) => m.coaches)
  if (!coaches.length) return []
  const userIds = coaches.map((c) => c.userId)
  const ids = coaches.map((c) => c.id)
  const [[business], offered, schedules, timeOff, booked, clients, recent, calendars] = await Promise.all([
    db.select({ timezone: businesses.timezone, openingHours: businesses.openingHours }).from(businesses).where(eq(businesses.id, businessId)),
    db.select({ membershipId: membershipAvailability.membershipId, hours: membershipAvailability.offeredHours }).from(membershipAvailability).where(inArray(membershipAvailability.membershipId, ids)),
    db.select().from(availabilitySchedules).where(inArray(availabilitySchedules.userId, userIds)),
    db.select({ userId: availabilityTimeOff.userId, start: availabilityTimeOff.startsAt, end: availabilityTimeOff.endsAt }).from(availabilityTimeOff)
      .where(and(inArray(availabilityTimeOff.userId, userIds), lt(availabilityTimeOff.startsAt, to), gt(availabilityTimeOff.endsAt, now))),
    db.select({ userId: bookings.hostUserId, membershipId: bookings.hostMembershipId, start: bookings.startsAt, end: bookings.endsAt }).from(bookings)
      .where(and(inArray(bookings.hostUserId, userIds), lt(bookings.startsAt, to), gt(bookings.endsAt, now),
        or(eq(bookings.status, 'confirmed'), and(eq(bookings.status, 'pending_payment'), gt(bookings.holdExpiresAt, now))))),
    db.select({ coachId: coachingClients.coachMembershipId, n: sql<number>`count(*)::int` }).from(coachingClients)
      .where(and(eq(coachingClients.businessId, businessId), isNotNull(coachingClients.coachMembershipId))).groupBy(coachingClients.coachMembershipId),
    db.select({ coachId: bookings.hostMembershipId, n: sql<number>`count(*)::int` }).from(bookings)
      .where(and(eq(bookings.businessId, businessId), eq(bookings.status, 'confirmed'), lt(bookings.endsAt, now), gt(bookings.endsAt, new Date(now.getTime() - 30 * DAY_MS)))).groupBy(bookings.hostMembershipId),
    db.select({ userId: googleCalendarConnections.userId, status: googleCalendarConnections.status }).from(googleCalendarConnections).where(inArray(googleCalendarConnections.userId, userIds)),
  ])
  const minutes = (list: Interval[]) => list.reduce((sum, i) => sum + Math.max(0, Math.min(i.end.getTime(), to.getTime()) - Math.max(i.start.getTime(), now.getTime())), 0) / 60_000
  return coaches.map((c) => {
    const saved = schedules.find((s) => s.userId === c.userId)
    const own = offered.find((o) => o.membershipId === c.id)?.hours
    const open = hoursForBusiness({
      personTimezone: saved?.timezone ?? business.timezone,
      defaultHours: saved ? parseWeeklyHours(saved.weeklyHours) : DEFAULT_WEEKLY_HOURS,
      businessHours: own ? parseWeeklyHours(own) : null,
      openingHours: business.openingHours ? parseWeeklyHours(business.openingHours) : null,
      businessTimezone: business.timezone,
      from: now, to,
      timeOff: timeOff.filter((t) => t.userId === c.userId),
    })
    const busy = booked.filter((b) => b.userId === c.userId)
    const openMinutes = Math.round(minutes(open))
    const bookedMinutes = Math.round(minutes(busy.filter((b) => b.membershipId === c.id)))
    const freeStarts = bookableStarts(open, { durationMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, minNoticeMinutes: 0, now, busy }).filter((s) => s >= now && s <= to).length
    const status = calendars.find((g) => g.userId === c.userId)?.status
    return {
      id: c.id, name: c.name, specialties: c.specialties, maxClients: c.maxClients,
      activeClients: clients.find((r) => r.coachId === c.id)?.n ?? 0,
      freeStarts, utilization: openMinutes > 0 ? Math.min(1, bookedMinutes / openMinutes) : null,
      openMinutes, bookedMinutes, recentSessions: recent.find((r) => r.coachId === c.id)?.n ?? 0,
      hasHours: Boolean(saved || own), calendar: status === 'active' || status === 'needs_reconnect' ? status : null,
    }
  })
})

type PeriodRow = {
  id: string; client_id: string; client_name: string; client_coach_id: string | null; name: string; package_name: string | null
  starts_on: string; ends_on: string; credit_units: number; price_cents: number | null; paid_cents: number
  reserved_units: number; used_units: number; forfeited_units: number; expired_units: number
}

/** Every credit period with its price, payments and ledger totals. */
const loadPeriods = cache(async (businessId: string) => {
  const rows = await adminDb().execute<PeriodRow>(sql`
    SELECT p.id, p.client_id, c.name AS client_name, c.coach_membership_id AS client_coach_id, p.name, cp.terms->>'name' AS package_name,
      p.starts_on::text AS starts_on, p.ends_on::text AS ends_on, p.credit_units, (cp.terms->>'priceCents')::integer AS price_cents,
      COALESCE((SELECT SUM(pay.amount_cents) FROM public.client_credit_payments pay
        WHERE pay.business_id = p.business_id AND pay.client_id = p.client_id AND pay.period_id = p.id), 0)::integer AS paid_cents,
      COALESCE(SUM(CASE e.kind WHEN 'reserved' THEN e.credit_units WHEN 'released' THEN -e.credit_units ELSE 0 END), 0)::integer AS reserved_units,
      COALESCE(SUM(e.credit_units) FILTER (WHERE e.kind = 'used'), 0)::integer AS used_units,
      COALESCE(SUM(e.credit_units) FILTER (WHERE e.kind = 'forfeited'), 0)::integer AS forfeited_units,
      COALESCE(SUM(e.credit_units) FILTER (WHERE e.kind = 'expired'), 0)::integer AS expired_units
    FROM public.client_credit_periods p
    JOIN public.client_packages cp ON cp.business_id = p.business_id AND cp.client_id = p.client_id AND cp.id = p.client_package_id
    JOIN public.coaching_clients c ON c.business_id = p.business_id AND c.id = p.client_id
    LEFT JOIN public.client_credit_events e ON e.business_id = p.business_id AND e.client_id = p.client_id AND e.period_id = p.id
    WHERE p.business_id = ${businessId}::uuid
    GROUP BY p.id, c.id, cp.id`)
  return [...rows]
})

/** What the attention queue looks at. Sessions go back 45 days, plus any refund that failed. */
export async function loadAttentionFacts(business: { id: string; timezone: string }, now = new Date()): Promise<AttentionFacts> {
  const db = adminDb()
  const [open, periods, sessions, coaches] = await Promise.all([
    db.select({ id: inquiries.id, studentName: inquiries.studentName, stage: inquiries.stage, createdAt: inquiries.createdAt, nextAction: inquiries.nextAction, nextActionDue: inquiries.nextActionDue })
      .from(inquiries).where(and(eq(inquiries.businessId, business.id), inArray(inquiries.stage, ['new', 'matching', 'first_call', 'offer']))),
    loadPeriods(business.id),
    db.select({ id: bookings.id, clientId: bookings.coachingClientId, who: bookings.guestName, title: bookings.title, startsAt: bookings.startsAt, endsAt: bookings.endsAt,
      status: bookings.status, attendedAt: bookings.attendedAt, creditCoveredAt: bookings.creditCoveredAt, unpaidCancellationHours: bookings.unpaidCancellationHours,
      calendarSyncError: bookings.calendarSyncError, meetingError: bookings.meetingError, paymentStatus: bookings.paymentStatus, cancelledAt: bookings.cancelledAt })
      .from(bookings).where(and(eq(bookings.businessId, business.id),
        or(and(inArray(bookings.status, ['confirmed', 'cancelled']), gte(bookings.startsAt, new Date(now.getTime() - 45 * DAY_MS))), eq(bookings.paymentStatus, 'refund_failed')))),
    loadCoachLoads(business.id),
  ])
  return {
    timeZone: business.timezone, now, inquiries: open, sessions,
    periods: periods.map((p) => ({ id: p.id, clientId: p.client_id, clientName: p.client_name, name: p.name, startsOn: p.starts_on, endsOn: p.ends_on,
      priceCents: p.price_cents ?? 0, paidCents: p.paid_cents, creditUnits: p.credit_units, reservedUnits: p.reserved_units, usedUnits: p.used_units,
      forfeitedUnits: p.forfeited_units, expiredUnits: p.expired_units })),
    coaches: coaches.map((c) => ({ id: c.id, name: c.name, hasHours: c.hasHours, calendar: c.calendar })),
  }
}

/**
 * Everything the finance figures are built from, back to `since`. OWNER ONLY: the caller must have
 * checked `dashboardAccess().owner` before calling.
 */
export async function loadFinanceFacts(business: { id: string; timezone: string }, since: Date, now = new Date()): Promise<FinanceFacts> {
  const db = adminDb()
  const [sessions, periods, payments, rates, members] = await Promise.all([
    db.select({ id: bookings.id, coachId: bookings.hostMembershipId, title: bookings.title, who: bookings.guestName, startsAt: bookings.startsAt, endsAt: bookings.endsAt,
      status: bookings.status, cancelledAt: bookings.cancelledAt, priceCents: bookings.priceCents, paymentStatus: bookings.paymentStatus, paidAt: bookings.paidAt,
      stripeFeeCents: bookings.stripeFeeCents, periodId: bookings.creditPeriodId, creditUnits: bookings.creditUnits, attendedAt: bookings.attendedAt, creditOutcome: bookings.creditCancellationOutcome })
      .from(bookings).where(and(eq(bookings.businessId, business.id), inArray(bookings.status, ['confirmed', 'cancelled']),
        or(gte(bookings.endsAt, since), gte(bookings.paidAt, since), gte(bookings.cancelledAt, since)))),
    loadPeriods(business.id),
    db.select({ id: clientCreditPayments.id, periodId: clientCreditPayments.periodId, amountCents: clientCreditPayments.amountCents, receivedOn: clientCreditPayments.receivedOn, method: clientCreditPayments.method })
      .from(clientCreditPayments).where(and(eq(clientCreditPayments.businessId, business.id), gte(clientCreditPayments.receivedOn, localDay(since, business.timezone)))),
    db.select().from(coachPayRates).where(eq(coachPayRates.businessId, business.id)),
    allMemberNames(business.id),
  ])
  const rated = new Set(rates.map((r) => r.membershipId))
  const hosted = new Set(sessions.map((s) => s.coachId))
  return {
    timeZone: business.timezone, now, sessions, payments,
    periods: periods.map((p): PeriodFact => ({ id: p.id, clientName: p.client_name, clientCoachId: p.client_coach_id, packageName: p.package_name ?? p.name, priceCents: p.price_cents ?? 0,
      creditUnits: p.credit_units, paidCents: p.paid_cents, deliveredUnits: p.used_units + p.forfeited_units })),
    rates: rates.map((r) => ({ membershipId: r.membershipId, effectiveFrom: r.effectiveFrom, method: r.method, amountCents: r.amountCents, percentBps: r.percentBps, formatOverrides: r.formatOverrides, payForfeited: r.payForfeited })),
    // Current coaches, plus anyone who left but still has a rate or sessions in the window.
    coaches: members.filter((m) => (m.active && m.coaches) || rated.has(m.id) || hosted.has(m.id)).map((m) => ({ id: m.id, name: m.name })),
  }
}
