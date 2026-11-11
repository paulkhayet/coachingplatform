import 'server-only'

import { and, eq, lte, sql } from 'drizzle-orm'
import type { AdminDb } from '@/db/server'
import { bookings, businesses, clientCreditEvents, clientCreditPeriods, clientGuardians, clientPackages, coachingClients, memberships, type Booking } from '@/db/schema'
import { canManageClients } from '@/lib/roles'
import { availableCreditUnits, businessDate } from './credits'
import { creditCancellationOutcome } from './session-policy'

type Actor = { businessId: string; userId: string }
type Scope = Actor & { clientId: string; periodId: string }
type SessionChoice = { coachId: string; formatIndex: number }
type Tx = Parameters<Parameters<AdminDb['transaction']>[0]>[0]
type Reader = AdminDb | Tx

export class CoachingSessionError extends Error {}

async function activeMembership(db: Reader, actor: Actor, lock: boolean) {
  const query = db.select({ id: memberships.id, role: memberships.role }).from(memberships)
    .where(and(eq(memberships.businessId, actor.businessId), eq(memberships.userId, actor.userId), eq(memberships.status, 'active')))
  const [member] = await (lock ? query.for('share') : query)
  if (!member) throw new CoachingSessionError('You no longer have access to this business.')
  return member
}

async function setup(db: Reader, scope: Scope, choice: SessionChoice, lock: boolean) {
  const actor = await activeMembership(db, scope, lock)
  if (!canManageClients(actor.role)) throw new CoachingSessionError('Only owners and administrators can book coaching sessions.')
  const hostQuery = db.select({ userId: memberships.userId }).from(memberships)
    .where(and(eq(memberships.id, choice.coachId), eq(memberships.businessId, scope.businessId), eq(memberships.status, 'active'), eq(memberships.coaches, true)))
  const [host] = await (lock ? hostQuery.for('share') : hostQuery)
  if (!host) throw new CoachingSessionError('Choose an active coach in this business.')
  const query = db.select({ period: clientCreditPeriods, terms: clientPackages.terms, client: coachingClients, timezone: businesses.timezone })
    .from(clientCreditPeriods)
    .innerJoin(clientPackages, eq(clientPackages.id, clientCreditPeriods.clientPackageId))
    .innerJoin(coachingClients, eq(coachingClients.id, clientCreditPeriods.clientId))
    .innerJoin(businesses, eq(businesses.id, clientCreditPeriods.businessId))
    .where(and(eq(clientCreditPeriods.id, scope.periodId), eq(clientCreditPeriods.businessId, scope.businessId), eq(clientCreditPeriods.clientId, scope.clientId)))
  const [row] = await (lock ? query.for('update', { of: clientCreditPeriods }) : query)
  if (!row) throw new CoachingSessionError('This client’s credit period could not be found.')
  if (row.terms.eligibleCoachIds && !row.terms.eligibleCoachIds.includes(choice.coachId)) throw new CoachingSessionError('Choose a coach eligible for this package.')
  const format = row.terms.sessionFormats[choice.formatIndex]
  if (!format) throw new CoachingSessionError('Choose a session format from this package.')
  return { ...row, host, format }
}

export async function coachingAvailabilitySetup(db: AdminDb, scope: Scope, choice: SessionChoice) {
  const { period, timezone, format } = await setup(db, scope, choice, false)
  return { startsOn: period.startsOn, endsOn: period.endsOn, timezone, durationMinutes: format.durationMinutes }
}

type Counts = { funded_units: number; reserved_units: number; used_units: number; forfeited_units: number; expired_units: number }

async function counts(db: Reader, scope: Omit<Scope, 'userId'>) {
  const [row] = await db.execute<Counts>(sql`
    SELECT funded_units, reserved_units, used_units, forfeited_units, expired_units
    FROM public.client_credit_balances(${scope.businessId}::uuid, ${scope.clientId}::uuid)
    WHERE id = ${scope.periodId}::uuid`)
  if (!row) throw new CoachingSessionError('The credit balance is unavailable. Try again.')
  return row
}

type CreateInput = SessionChoice & {
  id: string
  startsAt: Date
  locationType: Booking['locationType']
  locationDetail: string | null
  contact: 'none' | 'client' | string
  noticeHours: number | null
  lateCancellation: 'preserve' | 'forfeit' | null
}

/** The calendar slot is checked by the caller. The shared booking constraint and locked balance are checked here. */
export async function reserveCoachingSession(db: AdminDb, scope: Scope, input: CreateInput, now = new Date()) {
  return db.transaction(async (tx) => {
    const { period, terms, host, client, format, timezone } = await setup(tx, scope, input, true)
    const [existing] = await tx.select().from(bookings).where(eq(bookings.id, input.id))
    if (existing) {
      if (existing.businessId === scope.businessId && existing.coachingClientId === scope.clientId && existing.creditPeriodId === scope.periodId &&
        existing.hostMembershipId === input.coachId && existing.startsAt.getTime() === input.startsAt.getTime()) return { id: existing.id, created: false }
      throw new CoachingSessionError('This booking was already submitted. Refresh and try again.')
    }
    const end = new Date(input.startsAt.getTime() + format.durationMinutes * 60_000)
    if (input.startsAt <= now || businessDate(timezone, input.startsAt) < period.startsOn || businessDate(timezone, new Date(end.getTime() - 1)) >= period.endsOn) {
      throw new CoachingSessionError('Choose a future time within this credit period.')
    }
    const noticeHours = terms.cancellationNoticeHours ?? input.noticeHours
    const lateCancellation = terms.lateCancellation === 'inherit' ? input.lateCancellation : terms.lateCancellation
    if (noticeHours === null || !lateCancellation) throw new CoachingSessionError('Set the cancellation rule for this session.')
    if (availableCreditUnits(await counts(tx, scope)) < format.creditUnits) throw new CoachingSessionError('This session needs more funded credits than are available.')

    let email: string | null = null
    if (input.contact === 'client') {
      email = client.email
    } else if (input.contact !== 'none') {
      const [guardian] = await tx.select({ email: clientGuardians.email }).from(clientGuardians)
        .where(and(eq(clientGuardians.id, input.contact), eq(clientGuardians.businessId, scope.businessId), eq(clientGuardians.clientId, scope.clientId)))
      email = guardian?.email ?? null
    }
    if (input.contact !== 'none' && !email) throw new CoachingSessionError('Choose a contact with an email address.')

    await tx.update(bookings).set({ status: 'expired' }).where(and(eq(bookings.hostUserId, host.userId), eq(bookings.status, 'pending_payment'), lte(bookings.holdExpiresAt, now)))
    await tx.insert(bookings).values({
      id: input.id, businessId: scope.businessId, hostMembershipId: input.coachId, hostUserId: host.userId,
      coachingClientId: scope.clientId, creditPeriodId: scope.periodId, creditUnits: format.creditUnits,
      creditNoticeHours: noticeHours, creditLateCancellation: lateCancellation,
      title: format.name, startsAt: input.startsAt, endsAt: end, guestName: client.name, guestEmail: email, guestTimezone: timezone,
      locationType: input.locationType, locationDetail: input.locationDetail,
    })
    await tx.insert(clientCreditEvents).values({ businessId: scope.businessId, clientId: scope.clientId, periodId: scope.periodId,
      bookingId: input.id, kind: 'reserved', creditUnits: format.creditUnits })
    return { id: input.id, created: true }
  })
}

type Transition = { action: 'attend' } | { action: 'cancel'; by: 'guest' | 'business'; expectedOutcome?: 'released' | 'forfeited' }

async function finishLocked(tx: Tx, booking: Booking, transition: Transition, now: Date) {
  const { id, businessId, coachingClientId: clientId, creditPeriodId: periodId, creditUnits, creditNoticeHours, creditLateCancellation } = booking
  if (!clientId || !periodId || !creditUnits || creditNoticeHours === null || !creditLateCancellation) throw new CoachingSessionError('This coaching session could not be found.')
  // All credit writers lock this period first. Re-read the booking after the lock so concurrent actions see its latest state.
  await tx.select({ id: clientCreditPeriods.id }).from(clientCreditPeriods).where(eq(clientCreditPeriods.id, periodId)).for('update')
  const [current] = await tx.select().from(bookings).where(eq(bookings.id, id)).for('update')
  if (!current || current.status !== 'confirmed' || current.attendedAt) throw new CoachingSessionError('This session already has an outcome.')

  const [hold] = await tx.select({ id: clientCreditEvents.id }).from(clientCreditEvents)
    .where(and(eq(clientCreditEvents.bookingId, id), eq(clientCreditEvents.kind, 'reserved'), eq(clientCreditEvents.creditUnits, creditUnits)))
  if (!hold) throw new CoachingSessionError('The session’s credit hold could not be found.')
  const event = { businessId, clientId, periodId, bookingId: id, creditUnits }

  if (transition.action === 'attend') {
    if (current.endsAt > now) throw new CoachingSessionError('Mark attendance after the session ends.')
    const balance = await counts(tx, { businessId, clientId, periodId })
    if (balance.reserved_units < creditUnits || balance.funded_units - balance.used_units - balance.forfeited_units - balance.expired_units < balance.reserved_units) {
      throw new CoachingSessionError('The session needs paid credit coverage before attendance can be recorded.')
    }
    await tx.insert(clientCreditEvents).values([{ ...event, kind: 'released' }, { ...event, kind: 'used' }])
    const [result] = await tx.update(bookings).set({ attendedAt: now }).where(eq(bookings.id, id)).returning()
    return result
  }

  const outcome = creditCancellationOutcome({ by: transition.by, startsAt: current.startsAt, now, noticeHours: creditNoticeHours, late: creditLateCancellation })
  if (transition.expectedOutcome && outcome !== transition.expectedOutcome) throw new CoachingSessionError('The notice cutoff has passed. Refresh the page to review the credit outcome before cancelling.')
  await tx.insert(clientCreditEvents).values(outcome === 'forfeited' ? [{ ...event, kind: 'released' }, { ...event, kind: 'forfeited' }] : [{ ...event, kind: 'released' }])
  const [result] = await tx.update(bookings).set({ status: 'cancelled', cancelledBy: transition.by, cancelledAt: now, creditCancellationOutcome: outcome }).where(eq(bookings.id, id)).returning()
  return result
}

export async function finishCoachingSession(db: AdminDb, actor: Actor, id: string, transition: Transition, now = new Date()) {
  return db.transaction(async (tx) => {
    const member = await activeMembership(tx, actor, true)
    const [booking] = await tx.select().from(bookings).where(and(eq(bookings.id, id), eq(bookings.businessId, actor.businessId)))
    if (!booking?.coachingClientId || (!canManageClients(member.role) && booking.hostMembershipId !== member.id)) throw new CoachingSessionError('You do not have access to manage this session.')
    return finishLocked(tx, booking, transition, now)
  })
}

/** Staff departure follows the business-cancellation rule and releases the session's credit hold. */
export async function cancelCoachingForDepartedHost(db: AdminDb, id: string, membershipId: string, now: Date) {
  return db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(and(eq(bookings.id, id), eq(bookings.hostMembershipId, membershipId)))
    if (!booking?.coachingClientId || booking.status !== 'confirmed' || booking.attendedAt) return null
    return finishLocked(tx, booking, { action: 'cancel', by: 'business' }, now)
  })
}
