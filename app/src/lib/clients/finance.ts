import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'
import type { AdminDb } from '@/db/server'
import { clientCreditEvents, clientCreditPayments, clientCreditPeriods, clientPackages, coachingClients, coachingPackages, memberships, type AssignedPackageTerms, type OFFLINE_PAYMENT_METHODS } from '@/db/schema'
import { canManagePayments } from '@/lib/roles'
import { allocateCoverage } from './coverage'
import { fundedCreditUnits, servicePeriodEnd } from './credits'

type ClientActor = { userId: string; businessId: string; clientId: string }

export class ClientFinanceError extends Error {}

async function checkFinancialStaff(tx: Pick<AdminDb, 'select'>, actor: ClientActor) {
  const [membership] = await tx.select({ role: memberships.role, financial: memberships.financial })
    .from(memberships).where(and(eq(memberships.businessId, actor.businessId), eq(memberships.userId, actor.userId), eq(memberships.status, 'active')))
    .for('share')
  if (!membership || !canManagePayments(membership)) throw new ClientFinanceError('You need financial permission for this action.')
}

/** Protected writes use the server connection and check the acting membership inside the transaction. */
export async function assignClientPackage(db: AdminDb, actor: ClientActor, input: { id: string; packageId: string; packageVersion: string; startsOn: string }) {
  return db.transaction(async (tx) => {
    await checkFinancialStaff(tx, actor)
    const [client] = await tx.select({ id: coachingClients.id }).from(coachingClients)
      .where(and(eq(coachingClients.businessId, actor.businessId), eq(coachingClients.id, actor.clientId))).for('key share')
    if (!client) throw new ClientFinanceError('This client could not be found.')

    const [source] = await tx.select().from(coachingPackages)
      .where(and(eq(coachingPackages.businessId, actor.businessId), eq(coachingPackages.id, input.packageId), isNull(coachingPackages.archivedAt),
        sql`${coachingPackages.updatedAt} = ${input.packageVersion}::text::timestamptz`))
      .for('share')
    if (!source) throw new ClientFinanceError('This package changed or is unavailable. Refresh the page and review the current terms.')

    const { name, description, kind, termWeeks, creditUnits, sessionFormats, priceCents, installmentCount, installmentCadence,
      eligibleCoachIds, cancellationNoticeHours, lateCancellation, expiration, makeupExtensionDays } = source
    const terms: AssignedPackageTerms = { name, description, kind, termWeeks, creditUnits, sessionFormats, priceCents,
      installmentCount, installmentCadence, eligibleCoachIds, cancellationNoticeHours, lateCancellation, expiration, makeupExtensionDays }

    const [assignment] = await tx.insert(clientPackages).values({
      id: input.id, businessId: actor.businessId, clientId: actor.clientId, packageId: source.id, terms, assignedBy: actor.userId,
    }).onConflictDoNothing().returning({ id: clientPackages.id })

    if (!assignment) {
      const [existing] = await tx.select({ id: clientCreditPeriods.id }).from(clientCreditPeriods)
        .innerJoin(clientPackages, eq(clientPackages.id, clientCreditPeriods.clientPackageId))
        .where(and(eq(clientCreditPeriods.businessId, actor.businessId), eq(clientCreditPeriods.clientId, actor.clientId),
          eq(clientCreditPeriods.clientPackageId, input.id), eq(clientCreditPeriods.startsOn, input.startsOn), eq(clientPackages.packageId, source.id)))
      if (existing) return existing.id
      throw new ClientFinanceError('This assignment was already submitted. Refresh the client page and try again.')
    }

    const [period] = await tx.insert(clientCreditPeriods).values({
      businessId: actor.businessId, clientId: actor.clientId, clientPackageId: assignment.id,
      name, kind, creditUnits, expiration, startsOn: input.startsOn, endsOn: servicePeriodEnd(input.startsOn, termWeeks),
    }).returning({ id: clientCreditPeriods.id })
    return period.id
  })
}

type PaymentInput = {
  id: string
  periodId: string
  amountCents: number
  method: (typeof OFFLINE_PAYMENT_METHODS)[number]
  receivedOn: string
  reference: string | null
}

export async function recordClientPayment(db: AdminDb, actor: ClientActor, input: PaymentInput, now = new Date()) {
  return db.transaction(async (tx) => {
    await checkFinancialStaff(tx, actor)
    // Serialize payments for the same period so cumulative funding and balance limits stay correct.
    const [row] = await tx.select({ period: clientCreditPeriods, terms: clientPackages.terms }).from(clientCreditPeriods)
      .innerJoin(clientPackages, eq(clientPackages.id, clientCreditPeriods.clientPackageId))
      .where(and(eq(clientCreditPeriods.businessId, actor.businessId), eq(clientCreditPeriods.clientId, actor.clientId), eq(clientCreditPeriods.id, input.periodId)))
      .for('update', { of: clientCreditPeriods })
    if (!row) throw new ClientFinanceError('This credit period could not be found.')
    const { period, terms } = row

    const [existing] = await tx.select().from(clientCreditPayments).where(eq(clientCreditPayments.id, input.id))
    if (existing) {
      if (existing.businessId === actor.businessId && existing.clientId === actor.clientId && existing.periodId === period.id &&
        existing.amountCents === input.amountCents && existing.method === input.method && existing.receivedOn === input.receivedOn && existing.reference === input.reference) return []
      throw new ClientFinanceError('This payment was already submitted. Refresh the client page and try again.')
    }

    const [{ paid }] = await tx.select({ paid: sql<number>`coalesce(sum(${clientCreditPayments.amountCents}), 0)::integer` })
      .from(clientCreditPayments).where(and(eq(clientCreditPayments.businessId, actor.businessId), eq(clientCreditPayments.clientId, actor.clientId), eq(clientCreditPayments.periodId, period.id)))
    if (input.amountCents <= 0 || input.amountCents > terms.priceCents - paid) throw new ClientFinanceError('Enter a positive amount up to the remaining balance.')
    if (period.kind === 'monthly' && paid + input.amountCents !== terms.priceCents) throw new ClientFinanceError('Record the full payment for this monthly period.')

    const before = fundedCreditUnits(period.creditUnits, terms.priceCents, paid)
    const after = fundedCreditUnits(period.creditUnits, terms.priceCents, paid + input.amountCents)
    const scope = { businessId: actor.businessId, clientId: actor.clientId, periodId: period.id }
    await tx.insert(clientCreditPayments).values({ ...scope, id: input.id, amountCents: input.amountCents, method: input.method,
      receivedOn: input.receivedOn, reference: input.reference, recordedBy: actor.userId })
    if (after > before) await tx.insert(clientCreditEvents).values({ ...scope, kind: 'funded', creditUnits: after - before, paymentId: input.id })
    const { coveredIds } = await allocateCoverage(tx, scope, now)
    return coveredIds
  })
}
