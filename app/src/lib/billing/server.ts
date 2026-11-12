import 'server-only'

import { cache } from 'react'
import type Stripe from 'stripe'
import { and, count, eq, or, sql } from 'drizzle-orm'
import { adminDb, type AdminDb } from '@/db/server'
import { bookingPages, memberships, workspaceBillingCustomers, workspaceSubscriptions } from '@/db/schema'
import { isStripeConfigured, stripe, stripeLivemode } from '@/lib/stripe/server'
import {
  PAID_PLANS, PAID_STATUSES, UPGRADE_MESSAGES, planFromLookupKey, planLimits, priceLookupKey,
  type BillingInterval, type PaidPlan, type PlanId, type PlanLimits,
} from './plans'

// D-072: the workspace's plan comes from workspace_subscriptions, kept in step with Stripe by the
// webhook (and refreshed when the owner returns from Stripe). Limits are checked here, on the server.

type Exec = AdminDb | Parameters<Parameters<AdminDb['transaction']>[0]>[0]

export interface WorkspacePlan {
  plan: PlanId
  /** The paid plan on record, even when it has lapsed (plan is then 'free'). */
  subscribedPlan: PaidPlan | null
  status: string | null
  source: 'stripe' | 'complimentary' | null
  interval: BillingInterval | null
  seats: number
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  stripeSubscriptionId: string | null
  limits: PlanLimits
}

export const workspacePlan = cache(async (businessId: string): Promise<WorkspacePlan> => {
  const rows = await adminDb().select().from(workspaceSubscriptions)
    .where(and(eq(workspaceSubscriptions.businessId, businessId),
      or(eq(workspaceSubscriptions.livemode, stripeLivemode), eq(workspaceSubscriptions.source, 'complimentary'))))
  const row = rows.find((r) => r.source === 'complimentary') ?? rows[0]
  const paid = Boolean(row && (row.source === 'complimentary' || PAID_STATUSES.has(row.status)))
  const plan: PlanId = paid && row ? row.plan : 'free'
  return {
    plan,
    subscribedPlan: row?.plan ?? null,
    status: row?.status ?? null,
    source: row?.source ?? null,
    interval: row?.billingInterval ?? null,
    seats: row?.seats ?? 1,
    currentPeriodEnd: row?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
    stripeSubscriptionId: row?.stripeSubscriptionId ?? null,
    limits: planLimits(plan, row?.seats ?? 1),
  }
})

export async function activeMemberCount(businessId: string, db: Exec = adminDb()) {
  const [r] = await db.select({ n: count() }).from(memberships).where(and(eq(memberships.businessId, businessId), eq(memberships.status, 'active')))
  return r?.n ?? 0
}

/** Null when allowed; otherwise the message to show. */
export async function checkFeature(businessId: string, feature: 'paidCalls' | 'zoom' | 'clients'): Promise<string | null> {
  const { limits } = await workspacePlan(businessId)
  return limits[feature] ? null : UPGRADE_MESSAGES[feature]
}

/** Whether one more active booking page fits the plan (excluding `exceptPageId`, the page being saved). */
export async function checkBookingPageLimit(businessId: string, exceptPageId?: string): Promise<string | null> {
  const { limits } = await workspacePlan(businessId)
  if (limits.bookingPages === null) return null
  const [r] = await adminDb().select({ n: count() }).from(bookingPages)
    .where(and(eq(bookingPages.businessId, businessId), eq(bookingPages.active, true),
      exceptPageId ? sql`${bookingPages.id} <> ${exceptPageId}` : undefined))
  return (r?.n ?? 0) >= limits.bookingPages ? UPGRADE_MESSAGES.bookingPages : null
}

/** Inviting people needs the Team plan; Team grows with the team, billed per person. */
export async function checkCanInvite(businessId: string): Promise<string | null> {
  const { plan } = await workspacePlan(businessId)
  return plan === 'team' ? null : UPGRADE_MESSAGES.people
}

// ── Stripe ─────────────────────────────────────────────────────────────────────────────────────────

/** The price for a plan, creating the product and price the first time (test or live mode). */
/**
 * The Stripe price for a plan, matching PAID_PLANS. Created the first time (test or live mode); when a
 * price in PAID_PLANS changes, a new Stripe price takes over the lookup key, so new checkouts and plan
 * switches charge the new amount while existing subscribers keep the price they signed up at.
 */
export async function ensurePrice(plan: PaidPlan, interval: BillingInterval): Promise<string> {
  const key = priceLookupKey(plan, interval)
  const amount = PAID_PLANS[plan].cents[interval]
  const found = await stripe().prices.list({ lookup_keys: [key], active: true, limit: 1 })
  const current = found.data[0]
  if (current && current.unit_amount === amount && current.currency === 'usd') return current.id
  const productId = `schedulefast_${plan}`
  const product = await stripe().products.retrieve(productId).catch(() => null)
    ?? await stripe().products.create({ id: productId, name: `schedulefa.st ${PAID_PLANS[plan].name}`, metadata: { plan } })
  try {
    const price = await stripe().prices.create({
      product: product.id, currency: 'usd', unit_amount: amount, lookup_key: key, transfer_lookup_key: Boolean(current),
      recurring: { interval, usage_type: 'licensed' }, nickname: `${PAID_PLANS[plan].name} (${interval}ly)`,
      tax_behavior: 'exclusive', metadata: { plan, interval },
    })
    // The old price stays attached to existing subscriptions; it just stops being offered.
    if (current) await stripe().prices.update(current.id, { active: false }).catch(() => undefined)
    return price.id
  } catch (error) {
    // Another request created it at the same moment.
    const again = await stripe().prices.list({ lookup_keys: [key], active: true, limit: 1 })
    if (again.data[0]?.unit_amount === amount) return again.data[0].id
    throw error
  }
}

/** The workspace's Stripe customer (one per business and mode), created the first time. */
export async function ensureCustomer(business: { id: string; name: string }, owner: { email: string; name: string }): Promise<string> {
  const db = adminDb()
  const [row] = await db.select({ id: workspaceBillingCustomers.stripeCustomerId }).from(workspaceBillingCustomers)
    .where(and(eq(workspaceBillingCustomers.businessId, business.id), eq(workspaceBillingCustomers.livemode, stripeLivemode)))
  if (row) return row.id
  const customer = await stripe().customers.create({
    name: business.name, email: owner.email, metadata: { business_id: business.id, owner_name: owner.name },
  }, { idempotencyKey: `workspace-customer-${business.id}-${stripeLivemode ? 'live' : 'test'}` })
  await db.insert(workspaceBillingCustomers).values({ businessId: business.id, livemode: stripeLivemode, stripeCustomerId: customer.id }).onConflictDoNothing()
  const [saved] = await db.select({ id: workspaceBillingCustomers.stripeCustomerId }).from(workspaceBillingCustomers)
    .where(and(eq(workspaceBillingCustomers.businessId, business.id), eq(workspaceBillingCustomers.livemode, stripeLivemode)))
  return saved.id
}

async function businessForCustomer(customerId: string, livemode: boolean, db: Exec) {
  const [row] = await db.select({ businessId: workspaceBillingCustomers.businessId }).from(workspaceBillingCustomers)
    .where(and(eq(workspaceBillingCustomers.stripeCustomerId, customerId), eq(workspaceBillingCustomers.livemode, livemode)))
  return row?.businessId ?? null
}

/**
 * Records a schedulefa.st subscription from Stripe. Ignores subscriptions that aren't ours, and never
 * lets an older subscription overwrite a newer one or a complimentary plan.
 */
export async function syncStripeSubscription(sub: Stripe.Subscription, db: Exec = adminDb()) {
  const item = sub.items.data[0]
  const parsed = planFromLookupKey(item?.price.lookup_key)
  if (!item || !parsed) return
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const businessId = sub.metadata.business_id || await businessForCustomer(customerId, sub.livemode, db)
  if (!businessId) return
  const values = {
    businessId, livemode: sub.livemode, source: 'stripe' as const, plan: parsed.plan, billingInterval: parsed.interval,
    status: sub.status, seats: Math.max(1, Math.min(1000, item.quantity ?? 1)), stripeSubscriptionId: sub.id,
    currentPeriodEnd: item.current_period_end ? new Date(item.current_period_end * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end || Boolean(sub.cancel_at), updatedAt: new Date(),
  }
  const ended = sub.status === 'canceled' || sub.status === 'incomplete_expired'
  await db.insert(workspaceSubscriptions).values(values).onConflictDoUpdate({
    target: [workspaceSubscriptions.businessId, workspaceSubscriptions.livemode],
    set: values,
    // A newer live subscription wins; an ended one only updates its own row; complimentary rows stay.
    setWhere: sql`${workspaceSubscriptions.source} = 'stripe' and (${workspaceSubscriptions.stripeSubscriptionId} = ${sub.id} or ${!ended})`,
  })
}

/** Pulls the workspace's current subscription from Stripe (after checkout, or when the webhook is late). */
export async function refreshWorkspaceSubscription(businessId: string) {
  if (!isStripeConfigured) return
  const [row] = await adminDb().select({ id: workspaceBillingCustomers.stripeCustomerId }).from(workspaceBillingCustomers)
    .where(and(eq(workspaceBillingCustomers.businessId, businessId), eq(workspaceBillingCustomers.livemode, stripeLivemode)))
  if (!row) return
  const { data } = await stripe().subscriptions.list({ customer: row.id, status: 'all', limit: 10 })
  const ours = data.filter((s) => planFromLookupKey(s.items.data[0]?.price.lookup_key))
  const current = ours.find((s) => !['canceled', 'incomplete_expired'].includes(s.status)) ?? ours[0]
  if (current) await syncStripeSubscription(current)
}

/** Team is billed per person: keep the subscription's quantity equal to the active team. */
export async function syncSeats(businessId: string) {
  try {
    const plan = await adminDb().select().from(workspaceSubscriptions)
      .where(and(eq(workspaceSubscriptions.businessId, businessId), eq(workspaceSubscriptions.livemode, stripeLivemode), eq(workspaceSubscriptions.source, 'stripe')))
    const row = plan[0]
    if (!row?.stripeSubscriptionId || row.plan !== 'team' || !PAID_STATUSES.has(row.status) || !isStripeConfigured) return
    const people = Math.max(1, await activeMemberCount(businessId))
    const sub = await stripe().subscriptions.retrieve(row.stripeSubscriptionId)
    const item = sub.items.data[0]
    if (!item || item.quantity === people) return
    const updated = await stripe().subscriptions.update(sub.id, { items: [{ id: item.id, quantity: people }], proration_behavior: 'always_invoice' })
    await syncStripeSubscription(updated)
  } catch (error) {
    // Billing catches up on the next change or webhook; never block team changes on Stripe.
    console.error('Could not update Team seats', error instanceof Error ? error.message : 'unknown error')
  }
}
