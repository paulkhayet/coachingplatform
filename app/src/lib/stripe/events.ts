import 'server-only'
import type Stripe from 'stripe'
import { eq, sql } from 'drizzle-orm'
import { adminDb, type AdminDb } from '@/db/server'
import { stripeAccounts, stripeEvents } from '@/db/schema'
import { accountFields } from '@/lib/payments'
import { afterPaidCheckout, confirmPaidCheckout, expireCheckout } from '@/lib/booking/server'

/** Work to do after the event's database changes are committed (emails, calendar), at most once. */
type AfterCommit = (() => Promise<void>) | void

type Tx = Parameters<Parameters<AdminDb['transaction']>[0]>[0]

/**
 * Record a verified Stripe event and apply it, exactly once. The insert and its effects share one
 * transaction: if applying fails, nothing is recorded and Stripe's retry gets another go. A second
 * delivery of the same event waits on the first one's row lock, then finds it and does nothing.
 *
 * @returns false when the event had already been processed.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<boolean> {
  const box: { after: AfterCommit } = { after: undefined }
  const fresh = await adminDb().transaction(async (tx) => {
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
    box.after = await applyEvent(tx, event)
    return true
  })
  const after = box.after
  if (fresh && after) {
    // The event is already recorded, so a failure here must not make Stripe retry it.
    try {
      await after()
    } catch (error) {
      console.error(`Follow-up for Stripe event ${event.id} failed`, error)
    }
  }
  return fresh
}

async function applyEvent(tx: Tx, event: Stripe.Event): Promise<AfterCommit> {
  switch (event.type) {
    case 'checkout.session.completed': {
      // A guest paid for a booked call on the business's Stripe account. Confirm it (once), then
      // add it to the calendar and send emails after the commit.
      const session = event.data.object
      if (session.payment_status !== 'paid') return
      const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null)
      const result = await confirmPaidCheckout(session.id, paymentIntent, tx)
      return result.confirmed || result.refundLate ? () => afterPaidCheckout(result) : undefined
    }
    case 'checkout.session.expired': {
      await expireCheckout(event.data.object.id, tx)
      return
    }
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
