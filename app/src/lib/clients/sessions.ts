import 'server-only'

import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNotNull, isNull, lte, or } from 'drizzle-orm'
import type { AdminDb } from '@/db/server'
import { bookings, businesses, clientCreditEvents, clientCreditPeriods, clientGuardians, clientPackages, coachingClients, coachingReservationLocations, familyAccess, memberships, type Booking } from '@/db/schema'
import { canManageClients } from '@/lib/roles'
import { allocateCoverage, creditBalance } from './coverage'
import { availableCreditUnits, availablePurchasedUnits, businessDate, unpaidDeadline } from './credits'
import { creditCancellationOutcome, MAX_WEEKLY_SESSIONS } from './session-policy'
import { insideCreditPeriod } from './weekly-sessions'

/**
 * Who is acting: a staff member of the business, or (D-073 slices 2–3) a parent or guardian with portal
 * access to the client, who can book, move and cancel within narrower rules.
 */
type Actor = { businessId: string; userId: string; family?: true }
type Scope = Actor & { clientId: string; periodId: string }
type SessionChoice = { coachId: string; formatIndex: number }
type Tx = Parameters<Parameters<AdminDb['transaction']>[0]>[0]
type Reader = AdminDb | Tx

export class CoachingSessionError extends Error {}

/** Families book at least this far ahead, and move sessions to times at least this far ahead. */
export const FAMILY_MIN_NOTICE_HOURS = 12

/** A guardian's accepted, active portal access to a client, with the switch the action needs turned on. */
async function familyPermission(db: Reader, actor: Actor, clientId: string, permission: 'book' | 'reschedule', lock: boolean) {
  const query = db.select({ id: familyAccess.id, guardianId: familyAccess.guardianId }).from(familyAccess)
    .where(and(eq(familyAccess.businessId, actor.businessId), eq(familyAccess.clientId, clientId), eq(familyAccess.userId, actor.userId),
      isNotNull(familyAccess.acceptedAt), isNull(familyAccess.revokedAt), eq(permission === 'book' ? familyAccess.canBook : familyAccess.canReschedule, true)))
  const [row] = await (lock ? query.for('share') : query)
  if (!row) throw new CoachingSessionError(permission === 'book' ? 'Booking from the portal isn’t turned on for you. Contact the coaching business.' : 'Changing sessions from the portal isn’t turned on for you. Contact the coaching business.')
  return row
}

async function activeMembership(db: Reader, actor: Actor, lock: boolean) {
  const query = db.select({ id: memberships.id, role: memberships.role }).from(memberships)
    .where(and(eq(memberships.businessId, actor.businessId), eq(memberships.userId, actor.userId), eq(memberships.status, 'active')))
  const [member] = await (lock ? query.for('share') : query)
  if (!member) throw new CoachingSessionError('You no longer have access to this business.')
  return member
}

async function setup(db: Reader, scope: Scope, choice: SessionChoice, lock: boolean) {
  const access = scope.family ? await familyPermission(db, scope, scope.clientId, 'book', lock) : null
  if (!scope.family) {
    const actor = await activeMembership(db, scope, lock)
    if (!canManageClients(actor.role)) throw new CoachingSessionError('Only owners and administrators can book coaching sessions.')
  }
  const hostQuery = db.select({ userId: memberships.userId }).from(memberships)
    .where(and(eq(memberships.id, choice.coachId), eq(memberships.businessId, scope.businessId), eq(memberships.status, 'active'), eq(memberships.coaches, true)))
  const [host] = await (lock ? hostQuery.for('share') : hostQuery)
  if (!host) throw new CoachingSessionError('Choose an active coach in this business.')
  const query = db.select({ period: clientCreditPeriods, terms: clientPackages.terms, client: coachingClients, timezone: businesses.timezone,
    allowAdvance: businesses.allowAdvanceReservations, reminderHours: businesses.paymentReminderHours, cutoffHours: businesses.unpaidCancellationHours })
    .from(clientCreditPeriods)
    .innerJoin(clientPackages, eq(clientPackages.id, clientCreditPeriods.clientPackageId))
    .innerJoin(coachingClients, eq(coachingClients.id, clientCreditPeriods.clientId))
    .innerJoin(businesses, eq(businesses.id, clientCreditPeriods.businessId))
    .where(and(eq(clientCreditPeriods.id, scope.periodId), eq(clientCreditPeriods.businessId, scope.businessId), eq(clientCreditPeriods.clientId, scope.clientId)))
  const [row] = await (lock ? query.for('update', { of: clientCreditPeriods }) : query)
  if (!row) throw new CoachingSessionError('This client’s credit period could not be found.')
  if (row.terms.eligibleCoachIds && !row.terms.eligibleCoachIds.includes(choice.coachId)) throw new CoachingSessionError('Choose a coach eligible for this package.')
  // Families book with the student's own coach.
  if (scope.family && row.client.coachMembershipId !== choice.coachId) throw new CoachingSessionError('Sessions can only be booked with the student’s coach.')
  const format = row.terms.sessionFormats[choice.formatIndex]
  if (!format) throw new CoachingSessionError('Choose a session format from this package.')
  return { ...row, host, format, access }
}

export async function coachingAvailabilitySetup(db: AdminDb, scope: Scope, choice: SessionChoice) {
  const { period, timezone, format, allowAdvance, cutoffHours } = await setup(db, scope, choice, false)
  const balance = await counts(db, scope)
  const availableUnits = availableCreditUnits(balance)
  // Families only ever book with credits that are already paid for.
  return { startsOn: period.startsOn, endsOn: period.endsOn, timezone, durationMinutes: format.durationMinutes,
    creditUnits: format.creditUnits, availableUnits, reservableUnits: allowAdvance && !scope.family ? availablePurchasedUnits(balance) : availableUnits, cutoffHours }
}

async function counts(db: Reader, scope: Omit<Scope, 'userId'>) {
  const row = await creditBalance(db, scope)
  if (!row) throw new CoachingSessionError('The credit balance is unavailable. Try again.')
  return row
}

type SessionDetails = SessionChoice & {
  id: string
  locationType: Booking['locationType']
  locationDetail: string | null
  contact: 'none' | 'client' | string
  noticeHours: number | null
  lateCancellation: 'preserve' | 'forfeit' | null
}

/** Reserve the selected dates as one transaction, so a conflict can't leave a partially booked series. */
async function reserveSessions(db: AdminDb, scope: Scope, input: SessionDetails, starts: Date[], series: boolean, now: Date) {
  const stamps = starts.map((start) => start.getTime())
  if (!starts.length || starts.length > MAX_WEEKLY_SESSIONS || new Set(stamps).size !== starts.length) throw new CoachingSessionError('Choose distinct dates for this booking.')
  return db.transaction(async (tx) => {
    const { period, terms, host, client, format, timezone, allowAdvance: businessAllowsAdvance, reminderHours, cutoffHours, access } = await setup(tx, scope, input, true)
    const allowAdvance = businessAllowsAdvance && !scope.family
    if (scope.family) {
      if (series) throw new CoachingSessionError('Book one session at a time.')
      if (starts.some((start) => start.getTime() < now.getTime() + FAMILY_MIN_NOTICE_HOURS * 3_600_000)) throw new CoachingSessionError(`Choose a time at least ${FAMILY_MIN_NOTICE_HOURS} hours from now.`)
    }
    const existing = await tx.select().from(bookings).where(or(eq(bookings.coachingSeriesId, input.id), eq(bookings.id, input.id)))
    if (existing.length) {
      if (existing.length === starts.length && existing.every((booking) => booking.businessId === scope.businessId && booking.coachingClientId === scope.clientId && booking.creditPeriodId === scope.periodId &&
        booking.hostMembershipId === input.coachId && booking.coachingSeriesId === (series ? input.id : null) &&
        stamps.includes(booking.startsAt.getTime()))) return { ids: existing.map((booking) => booking.id), coveredIds: [], created: false }
      throw new CoachingSessionError('This booking was already submitted. Refresh and try again.')
    }
    if (starts.some((start) => start <= now || !insideCreditPeriod(start, format.durationMinutes, { ...period, timezone }))) {
      throw new CoachingSessionError('Choose future times within this credit period.')
    }
    const noticeHours = terms.cancellationNoticeHours ?? input.noticeHours
    const lateCancellation = terms.lateCancellation === 'inherit' ? input.lateCancellation : terms.lateCancellation
    if (noticeHours === null || !lateCancellation) throw new CoachingSessionError('Set the cancellation rule for this session.')
    const requestedUnits = format.creditUnits * starts.length
    const { coveredIds, available } = await allocateCoverage(tx, scope, now)
    if (!allowAdvance && available < requestedUnits) throw new CoachingSessionError('The selected dates need more funded credits than are available.')
    if (availablePurchasedUnits(await counts(tx, scope)) < requestedUnits) throw new CoachingSessionError('The selected dates exceed the remaining package allowance.')

    let email: string | null = null
    // A family booking goes to the guardian who made it.
    if (access) input = { ...input, contact: access.guardianId }
    if (input.contact === 'client') {
      email = client.email
    } else if (input.contact !== 'none') {
      const [guardian] = await tx.select({ email: clientGuardians.email }).from(clientGuardians)
        .where(and(eq(clientGuardians.id, input.contact), eq(clientGuardians.businessId, scope.businessId), eq(clientGuardians.clientId, scope.clientId)))
      email = guardian?.email ?? null
    }
    if (input.contact !== 'none' && !email) throw new CoachingSessionError('Choose a contact with an email address.')

    await tx.update(bookings).set({ status: 'expired' }).where(and(eq(bookings.hostUserId, host.userId), eq(bookings.status, 'pending_payment'), lte(bookings.holdExpiresAt, now)))
    const fundedSlots = Math.floor(available / format.creditUnits)
    const rows = starts.toSorted((a, b) => a.getTime() - b.getTime()).map((start, index) => {
      const covered = index < fundedSlots
      if (!covered && cutoffHours !== null && unpaidDeadline(start, cutoffHours) <= now) {
        throw new CoachingSessionError('The selected dates inside the payment cutoff need paid credits before they can be booked.')
      }
      return {
        id: series ? randomUUID() : input.id, businessId: scope.businessId, hostMembershipId: input.coachId, hostUserId: host.userId,
        coachingClientId: scope.clientId, creditPeriodId: scope.periodId, creditUnits: format.creditUnits,
        coachingSeriesId: series ? input.id : null, creditNoticeHours: noticeHours, creditLateCancellation: lateCancellation,
        title: format.name, startsAt: start, endsAt: new Date(start.getTime() + format.durationMinutes * 60_000), guestName: client.name, guestEmail: email, guestTimezone: timezone,
        locationType: input.locationType, locationDetail: covered ? input.locationDetail : null, creditCoveredAt: covered ? now : null,
        paymentReminderHours: covered ? null : reminderHours, unpaidCancellationHours: covered ? null : cutoffHours,
      }
    })
    await tx.insert(bookings).values(rows)
    if (input.locationDetail && fundedSlots < rows.length) {
      const detail = input.locationDetail
      await tx.insert(coachingReservationLocations).values(rows.slice(fundedSlots).map((row) => ({ bookingId: row.id, detail })))
    }
    await tx.insert(clientCreditEvents).values(rows.map((row) => ({ businessId: scope.businessId, clientId: scope.clientId, periodId: scope.periodId,
      bookingId: row.id, kind: 'reserved' as const, creditUnits: format.creditUnits })))
    return { ids: rows.map((row) => row.id), coveredIds: [...coveredIds, ...rows.slice(0, fundedSlots).map((row) => row.id)], created: true }
  })
}

export async function reserveCoachingSession(db: AdminDb, scope: Scope, input: SessionDetails & { startsAt: Date }, now = new Date()) {
  const result = await reserveSessions(db, scope, input, [input.startsAt], false, now)
  return { id: result.ids[0], coveredIds: result.coveredIds, created: result.created }
}

export function reserveCoachingSeries(db: AdminDb, scope: Scope, input: SessionDetails & { starts: Date[] }, now = new Date()) {
  return reserveSessions(db, scope, input, input.starts, true, now)
}

async function managedBooking(db: Reader, actor: Actor, id: string, lock: boolean) {
  const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, id), eq(bookings.businessId, actor.businessId)))
  if (actor.family) {
    if (!booking?.coachingClientId) throw new CoachingSessionError('This session could not be found.')
    await familyPermission(db, actor, booking.coachingClientId, 'reschedule', lock)
    return booking
  }
  const member = await activeMembership(db, actor, lock)
  if (!booking?.coachingClientId || (!canManageClients(member.role) && booking.hostMembershipId !== member.id)) throw new CoachingSessionError('You do not have access to manage this session.')
  return booking
}

/**
 * Families may move a session only before its late-cancellation notice starts; after that, moving it
 * would sidestep the late-cancellation rule, so they cancel instead (or ask the business).
 */
export function familyCanMove(booking: Pick<Booking, 'startsAt' | 'creditNoticeHours'>, now: Date) {
  return booking.startsAt.getTime() - now.getTime() >= Math.max(booking.creditNoticeHours ?? 0, FAMILY_MIN_NOTICE_HOURS) * 3_600_000
}

async function moveSetup(db: Reader, actor: Actor, id: string, now: Date, lock: boolean) {
  const booking = await managedBooking(db, actor, id, lock)
  if (!booking.coachingClientId || !booking.creditPeriodId || booking.status !== 'confirmed' || booking.attendedAt || booking.startsAt <= now) {
    throw new CoachingSessionError('Only upcoming sessions can be moved.')
  }
  if (actor.family && !familyCanMove(booking, now)) {
    throw new CoachingSessionError('It’s too close to the session to move it. You can cancel it, or contact the coaching business.')
  }
  const hostQuery = db.select({ id: memberships.id }).from(memberships)
    .where(and(eq(memberships.id, booking.hostMembershipId), eq(memberships.status, 'active'), eq(memberships.coaches, true)))
  const [host] = await (lock ? hostQuery.for('share') : hostQuery)
  if (!host) throw new CoachingSessionError('The session’s coach is no longer available.')
  const query = db.select({ startsOn: clientCreditPeriods.startsOn, endsOn: clientCreditPeriods.endsOn, timezone: businesses.timezone })
    .from(clientCreditPeriods).innerJoin(businesses, eq(businesses.id, clientCreditPeriods.businessId))
    .where(eq(clientCreditPeriods.id, booking.creditPeriodId))
  const [period] = await (lock ? query.for('update', { of: clientCreditPeriods }) : query)
  if (!period) throw new CoachingSessionError('This credit period could not be found.')
  return { ...period, booking, periodId: booking.creditPeriodId, clientId: booking.coachingClientId, coachId: booking.hostMembershipId, durationMinutes: (booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000 }
}

export function coachingMoveSetup(db: AdminDb, actor: Actor, id: string, now = new Date()) {
  return moveSetup(db, actor, id, now, false)
}

/** A move keeps the same booking and ledger entries. Lock and recheck the state after the calendar check. */
export async function moveCoachingSession(db: AdminDb, actor: Actor, id: string, previousStart: Date, start: Date, now = new Date()) {
  return db.transaction(async (tx) => {
    const context = await moveSetup(tx, actor, id, now, true)
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id)).for('update')
    if (!booking || booking.status !== 'confirmed' || booking.attendedAt || booking.startsAt <= now || booking.startsAt.getTime() !== previousStart.getTime()) {
      throw new CoachingSessionError('This session changed. Refresh the page before moving it.')
    }
    if (start <= now || start.getTime() === previousStart.getTime() || !insideCreditPeriod(start, context.durationMinutes, context)) {
      throw new CoachingSessionError('Choose a different future time within this credit period.')
    }
    if (actor.family && start.getTime() < now.getTime() + FAMILY_MIN_NOTICE_HOURS * 3_600_000) {
      throw new CoachingSessionError(`Choose a time at least ${FAMILY_MIN_NOTICE_HOURS} hours from now.`)
    }
    if (!booking.creditCoveredAt && booking.unpaidCancellationHours !== null &&
      (unpaidDeadline(booking.startsAt, booking.unpaidCancellationHours) <= now || unpaidDeadline(start, booking.unpaidCancellationHours) <= now)) {
      throw new CoachingSessionError('An unpaid reservation can only be moved before its payment cutoff and to a time outside the cutoff.')
    }
    await tx.update(bookings).set({ status: 'expired' }).where(and(eq(bookings.hostUserId, booking.hostUserId), eq(bookings.status, 'pending_payment'), lte(bookings.holdExpiresAt, now)))
    const [moved] = await tx.update(bookings).set({ startsAt: start, endsAt: new Date(start.getTime() + context.durationMinutes * 60_000), reminderSentAt: null, paymentReminderSentAt: null })
      .where(eq(bookings.id, id)).returning()
    const { coveredIds } = booking.creditCoveredAt ? { coveredIds: [] } : await allocateCoverage(tx, {
      businessId: actor.businessId, clientId: context.clientId, periodId: context.periodId,
    }, now)
    return { ...moved, coveredIds }
  })
}

type Transition = { action: 'attend' } | { action: 'cancel'; by: 'guest' | 'business'; expectedOutcome?: 'released' | 'forfeited'; unpaidCutoff?: true }

async function lockSession(tx: Tx, booking: Booking) {
  if (!booking.creditPeriodId) return null
  // All credit writers lock the period before reading the latest booking state.
  await tx.select({ id: clientCreditPeriods.id }).from(clientCreditPeriods).where(eq(clientCreditPeriods.id, booking.creditPeriodId)).for('update')
  const [current] = await tx.select().from(bookings).where(eq(bookings.id, booking.id)).for('update')
  return current?.status === 'confirmed' && !current.attendedAt ? current : null
}

async function finishLocked(tx: Tx, current: Booking, transition: Transition, now: Date) {
  const { id, businessId, coachingClientId: clientId, creditPeriodId: periodId, creditUnits, creditNoticeHours, creditLateCancellation } = current
  if (!clientId || !periodId || !creditUnits || creditNoticeHours === null || !creditLateCancellation) throw new CoachingSessionError('This coaching session could not be found.')
  const [hold] = await tx.select({ id: clientCreditEvents.id }).from(clientCreditEvents)
    .where(and(eq(clientCreditEvents.bookingId, id), eq(clientCreditEvents.kind, 'reserved'), eq(clientCreditEvents.creditUnits, creditUnits)))
  if (!hold) throw new CoachingSessionError('The session’s credit hold could not be found.')
  const event = { businessId, clientId, periodId, bookingId: id, creditUnits }

  if (transition.action === 'attend') {
    if (current.endsAt > now) throw new CoachingSessionError('Mark attendance after the session ends.')
    const balance = await counts(tx, { businessId, clientId, periodId })
    if (!current.creditCoveredAt || balance.reserved_units - balance.unpaid_reserved_units < creditUnits ||
      balance.funded_units - balance.used_units - balance.forfeited_units - balance.expired_units < balance.reserved_units - balance.unpaid_reserved_units) {
      throw new CoachingSessionError('The session needs paid credit coverage before attendance can be recorded.')
    }
    await tx.insert(clientCreditEvents).values([{ ...event, kind: 'released' }, { ...event, kind: 'used' }])
    const [result] = await tx.update(bookings).set({ attendedAt: now }).where(eq(bookings.id, id)).returning()
    return { ...result, coveredIds: [] as string[] }
  }

  const outcome = current.creditCoveredAt ? creditCancellationOutcome({ by: transition.by, startsAt: current.startsAt, now, noticeHours: creditNoticeHours, late: creditLateCancellation }) : 'released'
  if (transition.expectedOutcome && outcome !== transition.expectedOutcome) throw new CoachingSessionError('The notice cutoff has passed. Refresh the page to review the credit outcome before cancelling.')
  await tx.insert(clientCreditEvents).values(outcome === 'forfeited' ? [{ ...event, kind: 'released' }, { ...event, kind: 'forfeited' }] : [{ ...event, kind: 'released' }])
  const [result] = await tx.update(bookings).set({ status: 'cancelled', cancelledBy: transition.by, cancelledAt: now, creditCancellationOutcome: outcome, unpaidCancelled: transition.unpaidCutoff ?? false }).where(eq(bookings.id, id)).returning()
  if (!current.creditCoveredAt) await tx.delete(coachingReservationLocations).where(eq(coachingReservationLocations.bookingId, id))
  const { coveredIds } = await allocateCoverage(tx, { businessId, clientId, periodId }, now)
  return { ...result, coveredIds }
}

export async function finishCoachingSession(db: AdminDb, actor: Actor, id: string, transition: Transition, now = new Date()) {
  // Families can only cancel, and a family cancellation is always theirs, under the late-cancellation rule.
  if (actor.family && (transition.action !== 'cancel' || transition.by !== 'guest' || transition.unpaidCutoff)) {
    throw new CoachingSessionError('You can only cancel sessions from the portal.')
  }
  return db.transaction(async (tx) => {
    const booking = await managedBooking(tx, actor, id, true)
    const current = await lockSession(tx, booking)
    if (!current) throw new CoachingSessionError('This session already has an outcome.')
    return finishLocked(tx, current, transition, now)
  })
}

/** Staff departure follows the business-cancellation rule and releases the session's credit hold. */
export async function cancelCoachingForDepartedHost(db: AdminDb, id: string, membershipId: string, now: Date) {
  return db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(and(eq(bookings.id, id), eq(bookings.hostMembershipId, membershipId)))
    if (!booking?.coachingClientId || booking.status !== 'confirmed' || booking.attendedAt) return null
    const current = await lockSession(tx, booking)
    return current ? finishLocked(tx, current, { action: 'cancel', by: 'business' }, now) : null
  })
}

export async function cancelUnpaidReservation(db: AdminDb, id: string, now: Date) {
  return db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id))
    if (!booking?.coachingClientId) return null
    const current = await lockSession(tx, booking)
    if (!current || current.creditCoveredAt || current.unpaidCancellationHours === null ||
      unpaidDeadline(current.startsAt, current.unpaidCancellationHours) > now) return null
    return finishLocked(tx, current, { action: 'cancel', by: 'business', unpaidCutoff: true }, now)
  })
}

// ── Families (D-073 slices 2–3) ──────────────────────────────────────────────────────────────────────

export interface FamilyBookingContext {
  coachId: string
  timezone: string
  /** Copied from the student's latest session with their coach, so families never set these. */
  locationType: Booking['locationType']
  locationDetail: string | null
  noticeHours: number | null
  lateCancellation: 'preserve' | 'forfeit' | null
  periods: { id: string; name: string; startsOn: string; endsOn: string; availableUnits: number
    formats: { index: number; name: string; durationMinutes: number; creditUnits: number }[] }[]
}

/**
 * What a guardian can book for a student: the paid credits left in each current or upcoming period, the
 * formats they cover, and the meeting details and cancellation rules from the student's latest session
 * with their coach. Returns a reason instead when booking isn't possible yet.
 */
export async function familyBookingContext(db: AdminDb, actor: Actor & { family: true }, clientId: string, now = new Date()): Promise<FamilyBookingContext | { reason: string }> {
  await familyPermission(db, actor, clientId, 'book', false)
  const [client] = await db.select({ coachId: coachingClients.coachMembershipId, timezone: businesses.timezone }).from(coachingClients)
    .innerJoin(businesses, eq(businesses.id, coachingClients.businessId))
    .innerJoin(memberships, and(eq(memberships.id, coachingClients.coachMembershipId), eq(memberships.status, 'active'), eq(memberships.coaches, true)))
    .where(and(eq(coachingClients.businessId, actor.businessId), eq(coachingClients.id, clientId)))
  if (!client?.coachId) return { reason: 'The student doesn’t have a coach yet. Contact the coaching business to book.' }
  const today = businessDate(client.timezone, now)
  const [template] = await db.select({ locationType: bookings.locationType, locationDetail: bookings.locationDetail, noticeHours: bookings.creditNoticeHours,
    lateCancellation: bookings.creditLateCancellation }).from(bookings)
    .where(and(eq(bookings.businessId, actor.businessId), eq(bookings.coachingClientId, clientId), eq(bookings.hostMembershipId, client.coachId),
      or(isNotNull(bookings.locationDetail), eq(bookings.locationType, 'zoom'))))
    .orderBy(desc(bookings.startsAt)).limit(1)
  if (!template) return { reason: 'The coach books the first session. After that you can book more here.' }
  const rows = await db.select({ period: clientCreditPeriods, terms: clientPackages.terms }).from(clientCreditPeriods)
    .innerJoin(clientPackages, eq(clientPackages.id, clientCreditPeriods.clientPackageId))
    .where(and(eq(clientCreditPeriods.businessId, actor.businessId), eq(clientCreditPeriods.clientId, clientId)))
  const periods: FamilyBookingContext['periods'] = []
  for (const { period, terms } of rows) {
    if (period.endsOn <= today) continue
    if (terms.eligibleCoachIds && !terms.eligibleCoachIds.includes(client.coachId)) continue
    const balance = await creditBalance(db, { businessId: actor.businessId, clientId, periodId: period.id })
    const availableUnits = balance ? availableCreditUnits(balance) : 0
    const formats = terms.sessionFormats.map((f, index) => ({ index, ...f })).filter((f) => f.creditUnits <= availableUnits)
    // A package that leaves the cancellation rule to the business needs one from an earlier session.
    const noticeHours = terms.cancellationNoticeHours ?? template.noticeHours
    const late = terms.lateCancellation === 'inherit' ? template.lateCancellation : terms.lateCancellation
    if (formats.length && noticeHours !== null && late) periods.push({ id: period.id, name: period.name, startsOn: period.startsOn, endsOn: period.endsOn, availableUnits, formats })
  }
  if (!periods.length) return { reason: 'There are no paid credits left to book with. Contact the coaching business to add more.' }
  return { coachId: client.coachId, timezone: client.timezone, ...template, noticeHours: template.noticeHours, lateCancellation: template.lateCancellation, periods }
}
