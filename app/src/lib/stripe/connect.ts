import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { adminDb } from '@/db/server'
import { stripeAccounts, type StripeAccountRow } from '@/db/schema'
import { siteUrl } from '@/lib/env'
import { accountFields } from '@/lib/payments'
import { INTEGRATIONS_PATH } from '@/lib/settings-paths'
import type { Workspace } from '@/lib/workspace'
import { stripe, stripeLivemode } from './server'

// Stripe Connect onboarding for coaching businesses (D-055). Callers check canManagePayments first;
// these functions write stripe_accounts with the admin connection because users can't write it.

export const PAYMENTS_PATH = '/app/settings/payments'

export async function getStripeAccount(businessId: string): Promise<StripeAccountRow | undefined> {
  const [row] = await adminDb().select().from(stripeAccounts).where(eq(stripeAccounts.businessId, businessId)).limit(1)
  return row
}

/**
 * The business's connected account, created on first use. A Standard-style account: the business uses
 * the full Stripe Dashboard, pays Stripe's fees on its direct charges, and Stripe collects its details
 * and covers losses. A business that disconnected us gets a fresh account.
 */
export async function getOrCreateConnectedAccount(ws: Workspace): Promise<string> {
  const existing = await getStripeAccount(ws.business.id)
  if (existing && !existing.disconnectedAt) return existing.stripeAccountId

  const account = await stripe().accounts.create(
    {
      country: 'US',
      email: ws.user.email || undefined,
      controller: {
        stripe_dashboard: { type: 'full' },
        fees: { payer: 'account' },
        losses: { payments: 'stripe' },
        requirement_collection: 'stripe',
      },
      business_profile: { name: ws.business.name },
      metadata: { business_id: ws.business.id },
    },
    // A double-click or retry returns the same account instead of creating a second one.
    { idempotencyKey: `connect-account:${ws.business.id}:${existing?.stripeAccountId ?? 'first'}` },
  )

  const fields = { stripeAccountId: account.id, livemode: stripeLivemode, ...accountFields(account), disconnectedAt: null, updatedAt: sql`now()` }
  await adminDb()
    .insert(stripeAccounts)
    .values({ businessId: ws.business.id, ...fields })
    .onConflictDoUpdate({ target: stripeAccounts.businessId, set: fields })
  return account.id
}

/** A one-time link to Stripe's hosted onboarding. Links expire quickly, so make one per click. */
export async function createOnboardingLink(stripeAccountId: string): Promise<string> {
  const link = await stripe().accountLinks.create({
    account: stripeAccountId,
    type: 'account_onboarding',
    // Stripe sends people here if the link expired or was already used; it makes a fresh one.
    refresh_url: `${siteUrl}${PAYMENTS_PATH}/onboarding`,
    return_url: `${siteUrl}${INTEGRATIONS_PATH}?returned=1#stripe-connect`,
  })
  return link.url
}

/** Pull the account from Stripe and store its current status (webhooks do this too; this is for the return page). */
export async function refreshStripeAccount(stripeAccountId: string) {
  const account = await stripe().accounts.retrieve(stripeAccountId)
  await adminDb()
    .update(stripeAccounts)
    .set({ ...accountFields(account), updatedAt: sql`now()` })
    .where(eq(stripeAccounts.stripeAccountId, stripeAccountId))
}
