import 'server-only'

import { randomBytes, randomUUID } from 'node:crypto'
import type Stripe from 'stripe'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { adminDb, type AdminDb } from '@/db/server'
import {
  businesses, clientCreditEvents, clientCreditPayments, clientCreditPeriods, clientGuardians, clientPackages, clientPaymentRequests, coachingClients,
  familyAccess, memberships, profiles, type AssignedPackageTerms, type ClientPaymentRequest,
} from '@/db/schema'
import { packagePaidStaffEmail, packageReceiptEmail, paymentRequestEmail } from '@/lib/booking/emails'
import { formatCents } from '@/lib/booking/policy'
import { businessLogoUrl } from '@/lib/business-logo'
import { sendEmail } from '@/lib/email/server'
import { siteUrl } from '@/lib/env'
import { canManagePayments } from '@/lib/roles'
import { stripe } from '@/lib/stripe/server'
import { hashToken, looksLikeToken } from '@/lib/team/invitations'
import { cadenceWord, cardOptions, describeInstalments, instalmentSplit, type CardOption } from './card-plan'
import { allocateCoverage } from './coverage'
import { businessDate, fundedCreditUnits } from './credits'

// Card payments for packages (D-076). Staff create a link for one credit period and send it to the
// family. The family pays the balance, or in instalments, through Stripe Checkout on the business's own
// account (direct charges, D-055). Every payment is recorded from Stripe's events, once per Stripe
// payment, under the credit period's lock, with the same funding rules as offline payments.

type Tx = Parameters<Parameters<AdminDb['transaction']>[0]>[0]
type Exec = AdminDb | Tx

export class CardPaymentError extends Error {}

export const payUrl = (token: string) => `${siteUrl}/pay/${token}`
const clientUrl = (clientId: string) => `${siteUrl}/app/clients/${clientId}`
/** Ties our Checkout sessions, subscriptions and invoices to a payment link. */
export const PACKAGE_METADATA_KIND = 'package'

// ── Links ────────────────────────────────────────────────────────────────────────────────────────────

/** Balance and terms for a period, read under the caller's transaction (and lock, if it holds one). */
async function periodState(db: Exec, scope: { businessId: string; clientId: string; periodId: string }) {
  const [row] = await db.select({ period: clientCreditPeriods, terms: clientPackages.terms, clientName: coachingClients.name, timezone: businesses.timezone,
    businessName: businesses.name, logoPath: businesses.logoPath })
    .from(clientCreditPeriods)
    .innerJoin(clientPackages, eq(clientPackages.id, clientCreditPeriods.clientPackageId))
    .innerJoin(coachingClients, eq(coachingClients.id, clientCreditPeriods.clientId))
    .innerJoin(businesses, eq(businesses.id, clientCreditPeriods.businessId))
    .where(and(eq(clientCreditPeriods.businessId, scope.businessId), eq(clientCreditPeriods.clientId, scope.clientId), eq(clientCreditPeriods.id, scope.periodId)))
  if (!row) return null
  const [{ paid }] = await db.select({ paid: sql<number>`coalesce(sum(${clientCreditPayments.amountCents}), 0)::integer` }).from(clientCreditPayments)
    .where(and(eq(clientCreditPayments.businessId, scope.businessId), eq(clientCreditPayments.clientId, scope.clientId), eq(clientCreditPayments.periodId, scope.periodId)))
  return { ...row, paidCents: paid, remainingCents: Math.max(0, row.terms.priceCents - paid) }
}

const isPlanLive = (r: Pick<ClientPaymentRequest, 'planStatus'>) => r.planStatus === 'active' || r.planStatus === 'past_due'

/**
 * Creates a payment link for a credit period and emails it to the chosen contact. Needs financial
 * permission (the same as recording an offline payment) and a connected Stripe account that can take
 * payments. Returns the link: it's shown once, since only its hash is stored.
 */
export async function createPaymentRequest(db: AdminDb, actor: { businessId: string; userId: string }, input: {
  clientId: string; periodId: string; contact: { guardianId: string } | 'client' | null; invite: boolean; allowInstalments: boolean; stripeAccountId: string
}) {
  const token = randomBytes(32).toString('base64url')
  const result = await db.transaction(async (tx) => {
    const [member] = await tx.select({ role: memberships.role, financial: memberships.financial, name: profiles.fullName }).from(memberships)
      .leftJoin(profiles, eq(profiles.id, memberships.userId))
      .where(and(eq(memberships.businessId, actor.businessId), eq(memberships.userId, actor.userId), eq(memberships.status, 'active'))).for('share', { of: memberships })
    if (!member || !canManagePayments(member)) throw new CardPaymentError('You need financial permission to take card payments.')
    const state = await periodState(tx, { businessId: actor.businessId, clientId: input.clientId, periodId: input.periodId })
    if (!state) throw new CardPaymentError('This credit period could not be found.')
    if (cardOptions({ terms: state.terms, paidCents: state.paidCents, allowInstalments: false }).length === 0) throw new CardPaymentError('There’s nothing left to pay by card on this package.')

    let email: string | null = null
    let guardianId: string | null = null
    if (input.contact === 'client') {
      const [client] = await tx.select({ email: coachingClients.email }).from(coachingClients).where(and(eq(coachingClients.businessId, actor.businessId), eq(coachingClients.id, input.clientId)))
      email = client?.email ?? null
      if (!email) throw new CardPaymentError('Add an email address to the client first, or choose another contact.')
    } else if (input.contact) {
      const [g] = await tx.select({ id: clientGuardians.id, email: clientGuardians.email }).from(clientGuardians)
        .where(and(eq(clientGuardians.businessId, actor.businessId), eq(clientGuardians.clientId, input.clientId), eq(clientGuardians.id, input.contact.guardianId)))
      if (!g) throw new CardPaymentError('Choose one of this client’s contacts.')
      if (!g.email) throw new CardPaymentError('Add an email address to this contact first, or choose another.')
      email = g.email.trim().toLowerCase()
      guardianId = g.id
    }
    const [request] = await tx.insert(clientPaymentRequests).values({
      businessId: actor.businessId, clientId: input.clientId, periodId: input.periodId, tokenHash: hashToken(token), sentTo: email,
      inviteGuardianId: input.invite && guardianId ? guardianId : null, allowInstalments: input.allowInstalments, createdBy: actor.userId,
    }).returning()
    return { request, state, email, senderName: member.name ?? 'Your coach' }
  })

  const url = payUrl(token)
  let emailed = false
  if (result.email) {
    const { state } = result
    const instalments = cardOptions({ terms: state.terms, paidCents: state.paidCents, allowInstalments: input.allowInstalments }).find((o) => o.kind === 'instalments')
    emailed = await sendEmail(result.email, paymentRequestEmail({
      businessName: state.businessName, logoUrl: businessLogoUrl(state.logoPath), studentName: state.clientName, packageName: state.terms.name,
      amountCents: state.remainingCents, instalments: instalments?.kind === 'instalments' ? describeInstalments(instalments, formatCents) : null, url, senderName: result.senderName,
    }), { idempotencyKey: `payment-request:${result.request.id}` })
  }
  return { id: result.request.id, url, emailed, sentTo: result.email }
}

/** Withdraws a link. An instalment plan on it is cancelled in Stripe too; payments already made stay. */
export async function cancelPaymentRequest(db: AdminDb, actor: { businessId: string; userId: string }, requestId: string) {
  const request = await db.transaction(async (tx) => {
    const [member] = await tx.select({ role: memberships.role, financial: memberships.financial }).from(memberships)
      .where(and(eq(memberships.businessId, actor.businessId), eq(memberships.userId, actor.userId), eq(memberships.status, 'active')))
    if (!member || !canManagePayments(member)) throw new CardPaymentError('You need financial permission to change card payments.')
    const [row] = await tx.update(clientPaymentRequests).set({ cancelledAt: new Date() })
      .where(and(eq(clientPaymentRequests.id, requestId), eq(clientPaymentRequests.businessId, actor.businessId), isNull(clientPaymentRequests.cancelledAt))).returning()
    if (!row) throw new CardPaymentError('This link was already turned off.')
    return row
  })
  if (request.stripeSubscriptionId && request.stripeAccountId && isPlanLive(request)) {
    await stripe().subscriptions.cancel(request.stripeSubscriptionId, {}, { stripeAccount: request.stripeAccountId })
    await db.update(clientPaymentRequests).set({ planStatus: 'canceled' }).where(eq(clientPaymentRequests.id, request.id))
  }
}

// ── The pay page ─────────────────────────────────────────────────────────────────────────────────────

export type PayPageState = 'open' | 'paid' | 'plan' | 'closed'

/** What a family sees on the pay page for a link. Null when the link doesn't exist. */
export async function findPaymentRequest(token: string, db: AdminDb = adminDb()) {
  if (!looksLikeToken(token)) return null
  const [request] = await db.select().from(clientPaymentRequests).where(eq(clientPaymentRequests.tokenHash, hashToken(token)))
  if (!request) return null
  const state = await periodState(db, request)
  if (!state) return null
  const options = cardOptions({ terms: state.terms, paidCents: state.paidCents, allowInstalments: request.allowInstalments })
  const status: PayPageState = isPlanLive(request) ? 'plan' : state.remainingCents === 0 ? 'paid' : request.cancelledAt || options.length === 0 ? 'closed' : 'open'
  return { request, ...state, options, status }
}

/**
 * Starts Stripe Checkout for a link: the balance in one payment, or instalments as a Stripe subscription
 * that's cancelled after the last one is paid. Leftover cents go on the first instalment.
 */
export async function startPackageCheckout(token: string, choice: 'full' | 'instalments', stripeAccountId: string): Promise<string> {
  const found = await findPaymentRequest(token)
  if (!found || found.status !== 'open') throw new CardPaymentError('This payment link can’t be used any more.')
  const option = found.options.find((o): o is CardOption => o.kind === choice)
  if (!option) throw new CardPaymentError('That way of paying isn’t available for this package any more.')
  const { request, terms } = found
  const base = payUrl(token)
  const metadata = { kind: PACKAGE_METADATA_KIND, request_id: request.id }
  const name = `${terms.name} for ${found.clientName}`
  // Remember which account the money goes to, so later events and refunds can be matched to it.
  await adminDb().update(clientPaymentRequests).set({ stripeAccountId }).where(eq(clientPaymentRequests.id, request.id))
  const common = {
    customer_email: request.sentTo ?? undefined,
    client_reference_id: request.id,
    metadata,
    success_url: `${base}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}?cancelled=1`,
  }
  const session = option.kind === 'full'
    ? await stripe().checkout.sessions.create({
      ...common, mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: option.amountCents, product_data: { name, description: `${found.businessName} · coaching package` } } }],
      payment_intent_data: { metadata, description: name },
    }, { stripeAccount: stripeAccountId })
    : await stripe().checkout.sessions.create({
      ...common, mode: 'subscription',
      line_items: [
        { quantity: 1, price_data: { currency: 'usd', unit_amount: option.eachCents, recurring: { interval: cadenceWord(option.cadence) }, product_data: { name: `${name} (${option.count} ${option.cadence} payments)` } } },
        // Stripe charges the same each period, so the leftover cents ride on the first invoice only.
        ...(option.firstCents > option.eachCents ? [{ quantity: 1, price_data: { currency: 'usd', unit_amount: option.firstCents - option.eachCents, product_data: { name: 'Rounding on the first payment' } } }] : []),
      ],
      subscription_data: { metadata: { ...metadata, instalments: String(option.count), cadence: option.cadence }, description: name },
    }, { stripeAccount: stripeAccountId })
  if (!session.url) throw new CardPaymentError('Stripe didn’t return a checkout page. Try again.')
  return session.url
}

// ── Recording payments ───────────────────────────────────────────────────────────────────────────────

export interface CardPaymentResult {
  paymentId: string | null
  coveredIds: string[]
  amountCents: number
  /** Money that arrived after the package was already paid: not recorded, needs refunding in Stripe. */
  overpaidCents: number
  remainingCents: number
  fullyPaid: boolean
  firstPayment: boolean
  paymentIntentId: string | null
  request: ClientPaymentRequest
}

/**
 * Records one card payment against its link's credit period, once per Stripe payment, under the period
 * lock that every credit writer takes. Funds credits like an offline payment and covers waiting
 * reservations in order. Never records more than the package price.
 */
export async function recordCardPayment(tx: Tx, input: { requestId: string; amountCents: number; paymentIntentId: string | null; invoiceId: string | null; paidAt: Date }): Promise<CardPaymentResult | null> {
  const [request] = await tx.select().from(clientPaymentRequests).where(eq(clientPaymentRequests.id, input.requestId))
  if (!request) return null
  const scope = { businessId: request.businessId, clientId: request.clientId, periodId: request.periodId }
  await tx.select({ id: clientCreditPeriods.id }).from(clientCreditPeriods).where(eq(clientCreditPeriods.id, request.periodId)).for('update')
  const ids = [input.paymentIntentId ? eq(clientCreditPayments.stripePaymentIntentId, input.paymentIntentId) : undefined, input.invoiceId ? eq(clientCreditPayments.stripeInvoiceId, input.invoiceId) : undefined].filter(Boolean)
  if (!ids.length) throw new Error('A card payment needs a Stripe payment or invoice id.')
  const [already] = await tx.select({ id: clientCreditPayments.id }).from(clientCreditPayments).where(or(...ids))
  if (already) return null
  const state = await periodState(tx, scope)
  if (!state) return null
  const amount = Math.min(input.amountCents, state.remainingCents)
  const overpaid = input.amountCents - amount
  if (overpaid > 0) console.error(`Card payment for link ${request.id} is ${overpaid} cents over the package price; refund it in Stripe.`)
  const base = { paymentId: null, coveredIds: [], amountCents: amount, overpaidCents: overpaid, request, firstPayment: state.paidCents === 0, paymentIntentId: input.paymentIntentId }
  if (amount <= 0) return { ...base, remainingCents: 0, fullyPaid: true }

  const paymentId = randomUUID()
  const paidAfter = state.paidCents + amount
  const paidCount = input.invoiceId
    ? (await tx.select({ n: sql<number>`count(*)::int` }).from(clientCreditPayments).where(and(eq(clientCreditPayments.requestId, request.id), sql`${clientCreditPayments.stripeInvoiceId} is not null`)))[0].n + 1
    : 0
  await tx.insert(clientCreditPayments).values({
    ...scope, id: paymentId, amountCents: amount, method: 'card', receivedOn: businessDate(state.timezone, input.paidAt),
    reference: input.invoiceId && request.planInstalments ? `Instalment ${paidCount} of ${request.planInstalments}` : 'Paid by card',
    requestId: request.id, stripePaymentIntentId: input.paymentIntentId, stripeInvoiceId: input.invoiceId,
  })
  const before = fundedCreditUnits(state.period.creditUnits, state.terms.priceCents, state.paidCents)
  const after = fundedCreditUnits(state.period.creditUnits, state.terms.priceCents, paidAfter)
  if (after > before) await tx.insert(clientCreditEvents).values({ ...scope, kind: 'funded', creditUnits: after - before, paymentId })
  const { coveredIds } = await allocateCoverage(tx, scope, new Date())
  const remaining = Math.max(0, state.terms.priceCents - paidAfter)
  return { ...base, paymentId, coveredIds, remainingCents: remaining, fullyPaid: remaining === 0 }
}

// ── Stripe events (inside the event's transaction) ───────────────────────────────────────────────────

const id = (value: string | { id: string } | null | undefined) => (typeof value === 'string' ? value : value?.id ?? null)
type AfterCommit = (() => Promise<void>) | undefined

/** checkout.session.completed for a payment link. One payment is recorded now; a plan is linked. */
export async function applyPackageCheckout(tx: Tx, session: Stripe.Checkout.Session, account: string): Promise<AfterCommit> {
  const requestId = session.metadata?.request_id
  if (!requestId) return
  if (session.mode === 'subscription') {
    const subscriptionId = id(session.subscription)
    if (subscriptionId) await linkPlan(tx, requestId, subscriptionId, account, session.metadata ?? {})
    return
  }
  if (session.payment_status !== 'paid' || !session.amount_total) return
  const result = await recordCardPayment(tx, { requestId, amountCents: session.amount_total, paymentIntentId: id(session.payment_intent), invoiceId: null, paidAt: new Date(session.created * 1000) })
  return result ? () => afterCardPayment(result, account, session.customer_details?.email ?? null) : undefined
}

/** Remembers the instalment plan behind a link, whichever of Stripe's events arrives first. */
async function linkPlan(tx: Tx, requestId: string, subscriptionId: string, account: string, metadata: Record<string, string>) {
  const count = Number(metadata.instalments)
  const cadence = metadata.cadence === 'weekly' ? 'weekly' : 'monthly'
  if (!Number.isInteger(count) || count < 2) return
  await tx.update(clientPaymentRequests).set({ stripeSubscriptionId: subscriptionId, stripeAccountId: account, planInstalments: count, planCadence: cadence, planStatus: 'active' })
    .where(and(eq(clientPaymentRequests.id, requestId), isNull(clientPaymentRequests.stripeSubscriptionId)))
}

/**
 * Whether an event's invoice belongs to a package plan. Events are shaped by the webhook endpoint's API
 * version, and older versions keep the subscription's metadata at the top of the invoice rather than
 * under `parent`, so look in both before asking Stripe for the invoice.
 */
function looksLikePackageInvoice(invoice: Stripe.Invoice) {
  const legacy = (invoice as unknown as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details
  return (invoice.parent?.subscription_details?.metadata ?? legacy?.metadata)?.kind === PACKAGE_METADATA_KIND
}

/** invoice.paid for an instalment. Each paid invoice is one payment; after the last, the plan stops. */
export async function applyPackageInvoice(tx: Tx, event: Stripe.Invoice, account: string): Promise<AfterCommit> {
  if (!event.id || !looksLikePackageInvoice(event)) return
  // Read it fresh, in this SDK's shape, with the payment behind it (so a refund can be matched later).
  const invoice = await stripe().invoices.retrieve(event.id, { expand: ['payments'] }, { stripeAccount: account })
  const details = invoice.parent?.subscription_details
  const metadata = details?.metadata ?? {}
  if (metadata.kind !== PACKAGE_METADATA_KIND || !metadata.request_id || invoice.status !== 'paid' || invoice.amount_paid <= 0) return
  const subscriptionId = id(details?.subscription)
  if (subscriptionId) await linkPlan(tx, metadata.request_id, subscriptionId, account, metadata)
  const paid = invoice.payments?.data.find((p) => p.status === 'paid') ?? invoice.payments?.data[0]
  const result = await recordCardPayment(tx, {
    requestId: metadata.request_id, amountCents: invoice.amount_paid, paymentIntentId: id(paid?.payment.payment_intent), invoiceId: invoice.id!,
    paidAt: new Date((invoice.status_transitions?.paid_at ?? invoice.created) * 1000),
  })
  if (!result) return
  if (result.fullyPaid) await tx.update(clientPaymentRequests).set({ planStatus: 'completed' }).where(eq(clientPaymentRequests.id, result.request.id))
  return () => afterCardPayment(result, account, invoice.customer_email ?? null)
}

/** The plan's status in Stripe: past due while it retries a failed card, cancelled if it gives up. */
export async function applyPackageSubscription(tx: Tx, subscription: Stripe.Subscription) {
  // metadata and status read the same in every API version.
  if (subscription.metadata?.kind !== PACKAGE_METADATA_KIND) return
  const status = subscription.status === 'active' || subscription.status === 'trialing' ? 'active'
    : subscription.status === 'canceled' || subscription.status === 'incomplete_expired' ? 'canceled' : 'past_due'
  await tx.update(clientPaymentRequests).set({ planStatus: status })
    .where(and(eq(clientPaymentRequests.stripeSubscriptionId, subscription.id), sql`${clientPaymentRequests.planStatus} <> 'completed'`))
}

/**
 * A card payment refunded in Stripe. The refund is noted on the payment; credits already funded are
 * left alone, since some may be used. Staff decide what to do about them.
 */
export async function applyPackageRefund(tx: Tx, charge: Stripe.Charge) {
  const paymentIntentId = id(charge.payment_intent)
  if (!paymentIntentId) return
  await tx.update(clientCreditPayments)
    .set({ refundedCents: sql`least(${clientCreditPayments.amountCents}, ${charge.amount_refunded})`, refundedAt: sql`coalesce(${clientCreditPayments.refundedAt}, now())` })
    .where(and(eq(clientCreditPayments.stripePaymentIntentId, paymentIntentId), sql`${charge.amount_refunded} > 0`))
}

// ── After a payment is committed ─────────────────────────────────────────────────────────────────────

/**
 * Follow-up once a payment is safely recorded, never undoing it: Stripe's fee, emails for newly covered
 * sessions, a receipt to the family and a note to the staff member who sent the link, the family portal
 * invitation (D-014), and stopping an instalment plan once the package is paid.
 */
export async function afterCardPayment(result: CardPaymentResult, account: string, payerEmail: string | null) {
  const db = adminDb()
  const { request } = result
  const step = async (what: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (error) {
      console.error(`After a card payment: ${what} failed`, error instanceof Error ? error.message : 'unknown error')
    }
  }
  if (result.paymentId) await step('reading the Stripe fee', () => recordPaymentFee(result.paymentId!, account))
  // Paid twice over (say, an offline payment was recorded while the family paid by card): give back
  // whatever is beyond the package price.
  if (result.overpaidCents > 0 && result.paymentIntentId) {
    await step('refunding an overpayment', () => stripe().refunds.create({ payment_intent: result.paymentIntentId!, amount: result.overpaidCents, metadata: { reason: 'package_overpaid', request_id: request.id } },
      { stripeAccount: account, idempotencyKey: `package-overpaid:${result.paymentIntentId}` }))
  }
  if (result.coveredIds.length) {
    const { syncCoachingConfirmations } = await import('@/lib/booking/server')
    await step('confirming covered sessions', () => syncCoachingConfirmations(result.coveredIds))
  }
  if (result.fullyPaid && request.stripeSubscriptionId) {
    await step('stopping the instalment plan', async () => {
      const sub = await stripe().subscriptions.retrieve(request.stripeSubscriptionId!, {}, { stripeAccount: account })
      if (sub.status !== 'canceled') await stripe().subscriptions.cancel(sub.id, {}, { stripeAccount: account })
      await db.update(clientPaymentRequests).set({ planStatus: 'completed' }).where(eq(clientPaymentRequests.id, request.id))
    })
  }
  if (!result.paymentId) return
  const state = await periodState(db, request)
  if (!state) return
  const logoUrl = businessLogoUrl(state.logoPath)
  const to = (payerEmail ?? request.sentTo)?.toLowerCase() ?? null
  let nextLine: string | null = null
  if (!result.fullyPaid && request.stripeSubscriptionId && request.planCadence) {
    nextLine = `Charged automatically each ${cadenceWord(request.planCadence)} until it’s paid`
  }
  if (to) {
    await step('the receipt', () => sendEmail(to, packageReceiptEmail({ businessName: state.businessName, logoUrl, studentName: state.clientName, packageName: state.terms.name,
      amountCents: result.amountCents, remainingCents: result.remainingCents, nextLine }), { idempotencyKey: `package-receipt:${result.paymentId}` }))
  }
  if (request.createdBy) {
    await step('the staff note', async () => {
      const [creator] = await db.select({ email: profiles.email }).from(profiles).where(eq(profiles.id, request.createdBy!))
      if (creator?.email) await sendEmail(creator.email, packagePaidStaffEmail({ studentName: state.clientName, packageName: state.terms.name, amountCents: result.amountCents,
        remainingCents: result.remainingCents, url: clientUrl(request.clientId) }), { idempotencyKey: `package-paid:${result.paymentId}` })
    })
  }
  if (request.inviteGuardianId && !request.invitedAt) await step('the family portal invitation', () => inviteAfterPayment(request))
}

/**
 * Stops any instalment plan on a period that's now paid, e.g. after staff recorded an offline payment
 * for the rest. Never throws: the payment is already recorded.
 */
export async function stopPaidPlans(scope: { businessId: string; clientId: string; periodId: string }) {
  try {
    const db = adminDb()
    const state = await periodState(db, scope)
    if (!state || state.remainingCents > 0) return
    const live = await db.select().from(clientPaymentRequests).where(and(eq(clientPaymentRequests.businessId, scope.businessId), eq(clientPaymentRequests.periodId, scope.periodId),
      sql`${clientPaymentRequests.planStatus} in ('active', 'past_due')`))
    for (const r of live) {
      if (r.stripeSubscriptionId && r.stripeAccountId) await stripe().subscriptions.cancel(r.stripeSubscriptionId, {}, { stripeAccount: r.stripeAccountId })
      await db.update(clientPaymentRequests).set({ planStatus: 'completed' }).where(eq(clientPaymentRequests.id, r.id))
    }
  } catch (error) {
    console.error('Stopping a paid instalment plan failed', error instanceof Error ? error.message : 'unknown error')
  }
}

/** Stripe's fee for a card payment, from the charge's balance transaction on the business's account. */
async function recordPaymentFee(paymentId: string, account: string) {
  const db = adminDb()
  const [payment] = await db.select({ intent: clientCreditPayments.stripePaymentIntentId, fee: clientCreditPayments.stripeFeeCents }).from(clientCreditPayments).where(eq(clientCreditPayments.id, paymentId))
  if (!payment?.intent || payment.fee !== null) return
  const intent = await stripe().paymentIntents.retrieve(payment.intent, { expand: ['latest_charge.balance_transaction'] }, { stripeAccount: account })
  const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge : null
  const transaction = charge && typeof charge.balance_transaction === 'object' ? charge.balance_transaction : null
  if (transaction) await db.update(clientCreditPayments).set({ stripeFeeCents: transaction.fee }).where(and(eq(clientCreditPayments.id, paymentId), isNull(clientCreditPayments.stripeFeeCents)))
}

/** Fills in Stripe's fee for a business's card package payments that don't have one yet (Finances → Sync). */
export async function syncPackageFees(businessId: string, limit = 50) {
  const missing = await adminDb().select({ id: clientCreditPayments.id, account: clientPaymentRequests.stripeAccountId }).from(clientCreditPayments)
    .innerJoin(clientPaymentRequests, eq(clientPaymentRequests.id, clientCreditPayments.requestId))
    .where(and(eq(clientCreditPayments.businessId, businessId), eq(clientCreditPayments.method, 'card'), isNull(clientCreditPayments.stripeFeeCents),
      sql`${clientCreditPayments.stripePaymentIntentId} is not null`))
    .limit(limit + 1)
  let saved = 0
  for (const row of missing.slice(0, limit)) {
    if (!row.account) continue
    try {
      await recordPaymentFee(row.id, row.account)
      saved++
    } catch (error) {
      console.error('Reading a package payment fee failed', error instanceof Error ? error.message : 'unknown error')
    }
  }
  return { saved, failed: Math.min(missing.length, limit) - saved, more: missing.length > limit }
}

/** D-014: once the family has paid, the guardian the link was sent to is invited to the portal. Once. */
async function inviteAfterPayment(request: ClientPaymentRequest) {
  const db = adminDb()
  const [claimed] = await db.update(clientPaymentRequests).set({ invitedAt: new Date() })
    .where(and(eq(clientPaymentRequests.id, request.id), isNull(clientPaymentRequests.invitedAt))).returning({ id: clientPaymentRequests.id })
  if (!claimed || !request.inviteGuardianId || !request.createdBy) return
  // Someone who already has the portal doesn't need another invitation.
  const [access] = await db.select({ acceptedAt: familyAccess.acceptedAt, revokedAt: familyAccess.revokedAt }).from(familyAccess).where(eq(familyAccess.guardianId, request.inviteGuardianId))
  if (access?.acceptedAt && !access.revokedAt) return
  const [inviter] = await db.select({ id: profiles.id, name: profiles.fullName, email: profiles.email }).from(profiles).where(eq(profiles.id, request.createdBy))
  if (!inviter) return
  const { sendFamilyInvite } = await import('@/lib/family/invitations')
  const sent = await sendFamilyInvite({ businessId: request.businessId, guardianId: request.inviteGuardianId, inviter: { id: inviter.id, name: inviter.name ?? 'Your coach', email: inviter.email ?? '' } })
  if ('error' in sent) console.info(`Family portal invitation after payment skipped: ${sent.error}`)
}

// ── Back from Checkout ───────────────────────────────────────────────────────────────────────────────

/**
 * The pay page's return from Stripe: if Stripe says it's paid but the webhook hasn't landed yet, record
 * it now, the same way the webhook would (recording is once per Stripe payment, so they can't double up).
 */
export async function syncPackageCheckout(token: string, sessionId: string) {
  const found = await findPaymentRequest(token)
  const account = found?.request.stripeAccountId
  if (!found || !account || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return
  const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ['invoice'] }, { stripeAccount: account })
  if (session.metadata?.request_id !== found.request.id) return
  const db = adminDb()
  const follow = await db.transaction(async (tx) => {
    if (session.mode === 'payment') return applyPackageCheckout(tx, session, account)
    const after = await applyPackageCheckout(tx, session, account)
    const invoice = typeof session.invoice === 'object' ? session.invoice : null
    return invoice?.status === 'paid' ? applyPackageInvoice(tx, invoice, account) : after
  })
  if (follow) await follow()
}
