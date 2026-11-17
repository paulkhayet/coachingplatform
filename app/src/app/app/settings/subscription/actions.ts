'use server'

import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { activeMemberCount, ensureCustomer, ensurePrice, syncStripeSubscription, workspacePlan } from '@/lib/billing/server'
import { teamSeats } from '@/lib/billing/plans'
import { siteUrl } from '@/lib/env'
import { canManageTeam } from '@/lib/roles'
import { SUBSCRIPTION_PATH } from '@/lib/settings-paths'
import { billingCustomer } from '@/lib/stripe/billing'
import { isStripeConfigured, stripe } from '@/lib/stripe/server'
import { requireWorkspace } from '@/lib/workspace'

// D-072. Only the owner manages the plan. Stripe Checkout takes the first payment; switching between
// Solo and Team or yearly and monthly happens here; Stripe's billing portal handles cards, invoices
// and cancelling.

const choice = z.object({ plan: z.enum(['solo', 'team']), interval: z.enum(['year', 'month']) })

async function ownerWorkspace(businessId: string) {
  const ws = await requireWorkspace()
  if (!canManageTeam(ws.membership.role)) notFound()
  if (ws.business.id !== businessId) redirect(`${SUBSCRIPTION_PATH}?error=workspace`)
  if (!isStripeConfigured) redirect(`${SUBSCRIPTION_PATH}?error=unavailable`)
  return ws
}

export async function startCheckout(businessId: string, form: FormData) {
  const { business, user } = await ownerWorkspace(businessId)
  const parsed = choice.safeParse({ plan: form.get('plan'), interval: form.get('interval') })
  if (!parsed.success) redirect(SUBSCRIPTION_PATH)
  const current = await workspacePlan(businessId)
  if (current.plan !== 'free') redirect(`${SUBSCRIPTION_PATH}?error=already`)
  const people = await activeMemberCount(businessId)
  if (parsed.data.plan === 'solo' && people > 1) redirect(`${SUBSCRIPTION_PATH}?error=solo-team`)
  // Team: the owner chooses how many people to pay for (at least everyone already on the team).
  const seats = parsed.data.plan === 'team' ? teamSeats(form.get('seats'), people) : 1
  if (seats === null) redirect(`${SUBSCRIPTION_PATH}?error=seats`)

  let url: string | null = null
  try {
    const customer = await ensureCustomer(business, { email: user.email, name: user.fullName })
    const price = await ensurePrice(parsed.data.plan, parsed.data.interval)
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: business.id,
      line_items: [{ price, quantity: seats }],
      subscription_data: { metadata: { business_id: business.id } },
      metadata: { business_id: business.id },
      allow_promotion_codes: true,
      customer_update: { name: 'auto', address: 'auto' },
      success_url: `${siteUrl}${SUBSCRIPTION_PATH}?checkout=success`,
      cancel_url: `${siteUrl}${SUBSCRIPTION_PATH}?checkout=cancelled`,
    })
    url = session.url
  } catch (error) {
    console.error('Could not start plan checkout', error instanceof Error ? error.message : 'unknown error')
  }
  redirect(url ?? `${SUBSCRIPTION_PATH}?error=checkout`)
}

/** Moves an active subscription to another plan or billing interval, prorated by Stripe. */
export async function changePlan(businessId: string, form: FormData) {
  await ownerWorkspace(businessId)
  const parsed = choice.safeParse({ plan: form.get('plan'), interval: form.get('interval') })
  if (!parsed.success) redirect(SUBSCRIPTION_PATH)
  const current = await workspacePlan(businessId)
  if (current.source !== 'stripe' || current.plan === 'free' || !current.stripeSubscriptionId) redirect(`${SUBSCRIPTION_PATH}?error=no-subscription`)
  if (current.plan === parsed.data.plan && current.interval === parsed.data.interval) redirect(SUBSCRIPTION_PATH)
  const people = await activeMemberCount(businessId)
  if (parsed.data.plan === 'solo' && people > 1) redirect(`${SUBSCRIPTION_PATH}?error=solo-team`)
  // Moving to Team uses the size chosen; staying on Team (a yearly/monthly switch) keeps the seats paid for.
  const seats = parsed.data.plan !== 'team' ? 1
    : current.plan === 'team' ? Math.max(current.seats, people)
    : teamSeats(form.get('seats'), people)
  if (seats === null) redirect(`${SUBSCRIPTION_PATH}?error=seats`)

  let ok = false
  try {
    const sub = await stripe().subscriptions.retrieve(current.stripeSubscriptionId)
    const item = sub.items.data[0]
    const price = await ensurePrice(parsed.data.plan, parsed.data.interval)
    const updated = await stripe().subscriptions.update(sub.id, {
      items: [{ id: item.id, price, quantity: seats }],
      // Invoice the difference now (an upgrade is charged today; a downgrade leaves a credit).
      proration_behavior: 'always_invoice',
      // Switching back to a plan clears a pending cancellation.
      cancel_at_period_end: false,
    })
    await syncStripeSubscription(updated)
    ok = true
  } catch (error) {
    console.error('Could not change plan', error instanceof Error ? error.message : 'unknown error')
  }
  revalidatePath('/app', 'layout')
  redirect(ok ? `${SUBSCRIPTION_PATH}?changed=1` : `${SUBSCRIPTION_PATH}?error=change`)
}

/**
 * Changes how many people a Team subscription pays for. Never below the people already on the team.
 * More seats are charged now, prorated; fewer leave a credit on the next bill.
 */
export async function changeSeats(businessId: string, form: FormData) {
  await ownerWorkspace(businessId)
  const current = await workspacePlan(businessId)
  if (current.source !== 'stripe' || current.plan !== 'team' || !current.stripeSubscriptionId) redirect(`${SUBSCRIPTION_PATH}?error=no-subscription`)
  const people = await activeMemberCount(businessId)
  const seats = teamSeats(form.get('seats'), people)
  if (seats === null) redirect(`${SUBSCRIPTION_PATH}?error=seats`)
  if (seats === current.seats) redirect(SUBSCRIPTION_PATH)

  let ok = false
  try {
    const sub = await stripe().subscriptions.retrieve(current.stripeSubscriptionId)
    const item = sub.items.data[0]
    const updated = await stripe().subscriptions.update(sub.id, { items: [{ id: item.id, quantity: seats }], proration_behavior: 'always_invoice' })
    await syncStripeSubscription(updated)
    ok = true
  } catch (error) {
    console.error('Could not change Team seats', error instanceof Error ? error.message : 'unknown error')
  }
  revalidatePath('/app', 'layout')
  redirect(ok ? `${SUBSCRIPTION_PATH}?seats=${seats}` : `${SUBSCRIPTION_PATH}?error=change`)
}

/** Stripe's portal, set up for cards, invoices, billing details and cancelling (not plan changes). */
async function portalConfiguration() {
  const { data } = await stripe().billingPortal.configurations.list({ active: true, limit: 20 })
  const ours = data.find((c) => c.metadata?.app === 'schedulefast')
  if (ours) return ours.id
  const created = await stripe().billingPortal.configurations.create({
    business_profile: { headline: 'Manage your schedulefa.st subscription' },
    features: {
      customer_update: { enabled: true, allowed_updates: ['email', 'name', 'address', 'tax_id'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'] } },
    },
    metadata: { app: 'schedulefast' },
  })
  return created.id
}

export async function openBillingPortal(businessId: string) {
  await ownerWorkspace(businessId)
  let url: string | undefined
  try {
    const customer = await billingCustomer(businessId)
    if (customer) {
      const portal = await stripe().billingPortal.sessions.create({ customer, configuration: await portalConfiguration(), return_url: `${siteUrl}${SUBSCRIPTION_PATH}?portal=1` })
      url = portal.url
    }
  } catch (error) {
    console.error('Could not open the workspace billing portal', error instanceof Error ? error.message : 'unknown error')
  }
  redirect(url ?? `${SUBSCRIPTION_PATH}?error=portal`)
}
