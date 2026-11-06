import 'server-only'
import type Stripe from 'stripe'
import { eq, sql } from 'drizzle-orm'
import { adminDb, type AdminDb } from '@/db/server'
import { stripeAccounts, stripeEvents } from '@/db/schema'
import { accountFields } from '@/lib/payments'

type Tx = Parameters<Parameters<AdminDb['transaction']>[0]>[0]

/**
 * Record a verified Stripe event and apply it, exactly once. The insert and its effects share one
 * transaction: if applying fails, nothing is recorded and Stripe's retry gets another go. A second
 * delivery of the same event waits on the first one's row lock, then finds it and does nothing.
 *
 * @returns false when the event had already been processed.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<boolean> {
  return adminDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(stripeEvents)
      .values({
        id: event.id,
        type: event.type,
        account: event.account ?? null,
        livemode: event.livemode,
        stripeCreatedAt: new Date(event.created * 1000),
      })
      .onConflictDoNothing()
      .returning({ id: stripeEvents.id })
    if (inserted.length === 0) return false
    await applyEvent(tx, event)
    return true
  })
}

async function applyEvent(tx: Tx, event: Stripe.Event) {
  switch (event.type) {
    case 'account.updated': {
      const account = event.data.object
      await tx
        .update(stripeAccounts)
        .set({ ...accountFields(account), updatedAt: sql`now()` })
        .where(eq(stripeAccounts.stripeAccountId, account.id))
      return
    }
    case 'account.application.deauthorized': {
      // The business disconnected schedulefa.st from its Stripe account.
      if (!event.account) return
      await tx
        .update(stripeAccounts)
        .set({ disconnectedAt: sql`now()`, chargesEnabled: false, payoutsEnabled: false, updatedAt: sql`now()` })
        .where(eq(stripeAccounts.stripeAccountId, event.account))
      return
    }
    default:
      // Recorded but not acted on yet. Payment, refund and dispute events arrive with checkout (phase 2+).
      return
  }
}
