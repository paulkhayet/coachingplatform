import 'server-only'

import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { AdminDb } from '@/db/server'
import { bookings, coachingReservationLocations, memberships } from '@/db/schema'
import { uncommittedPaidUnits } from './credits'

export type CreditScope = { businessId: string; clientId: string; periodId: string }
type Tx = Parameters<Parameters<AdminDb['transaction']>[0]>[0]

export async function creditBalance(db: Pick<AdminDb, 'execute'>, scope: CreditScope) {
  const [balance] = await db.execute<{
    credit_units: number; funded_units: number; reserved_units: number; used_units: number; forfeited_units: number;
    expired_units: number; unpaid_reserved_units: number; waiting_reserved_units: number;
  }>(sql`
    SELECT credit_units, funded_units, reserved_units, used_units, forfeited_units, expired_units,
      unpaid_reserved_units, waiting_reserved_units
    FROM public.client_credit_balances(${scope.businessId}::uuid, ${scope.clientId}::uuid)
    WHERE id = ${scope.periodId}::uuid`)
  return balance
}

/** Call while holding the credit-period row lock. A covered reservation retains its credits until its outcome. */
export async function allocateCoverage(tx: Tx, scope: CreditScope, now: Date) {
  const balance = await creditBalance(tx, scope)
  let available = balance ? uncommittedPaidUnits(balance) : 0
  const coveredIds: string[] = []
  if (!available) return { coveredIds, available }

  const waiting = await tx.select({ id: bookings.id, units: bookings.creditUnits, detail: coachingReservationLocations.detail })
    .from(bookings)
    .innerJoin(memberships, and(eq(memberships.id, bookings.hostMembershipId), eq(memberships.status, 'active')))
    .leftJoin(coachingReservationLocations, eq(coachingReservationLocations.bookingId, bookings.id))
    .where(and(eq(bookings.businessId, scope.businessId), eq(bookings.coachingClientId, scope.clientId),
      eq(bookings.creditPeriodId, scope.periodId), eq(bookings.status, 'confirmed'), isNull(bookings.creditCoveredAt), isNotNull(bookings.creditUnits),
      sql`${bookings.startsAt} > ${now.toISOString()}::timestamptz + coalesce(${bookings.unpaidCancellationHours}, 0) * interval '1 hour'`))
    .orderBy(asc(bookings.startsAt), asc(bookings.id))
  for (const reservation of waiting) {
    if (!reservation.units || reservation.units > available) return { coveredIds, available: 0 }
    await tx.update(bookings).set({ creditCoveredAt: now, locationDetail: reservation.detail }).where(eq(bookings.id, reservation.id))
    if (reservation.detail !== null) await tx.delete(coachingReservationLocations).where(eq(coachingReservationLocations.bookingId, reservation.id))
    coveredIds.push(reservation.id)
    available -= reservation.units
    if (!available) break
  }
  return { coveredIds, available }
}
