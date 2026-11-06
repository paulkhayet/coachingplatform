import 'server-only'
import Stripe from 'stripe'
import { isLiveKey } from '@/lib/payments'

// Server-only secrets. Test keys (sk_test_…) locally and on preview deployments; live keys only in production.
const secretKey = process.env.STRIPE_SECRET_KEY ?? ''

/** False until the Stripe secret key is added, so pages can explain instead of crashing. */
export const isStripeConfigured = Boolean(secretKey)
export const stripeLivemode = isLiveKey(secretKey)

/**
 * Signing secrets for the webhook endpoint. STRIPE_WEBHOOK_SECRET is the Connect endpoint
 * ("Events on connected accounts") or the `stripe listen` secret locally. STRIPE_PLATFORM_WEBHOOK_SECRET
 * is for a second endpoint for the platform account's own events (schedulefa.st subscriptions, later).
 */
export const webhookSecrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_PLATFORM_WEBHOOK_SECRET].filter((s): s is string => Boolean(s))

let client: Stripe | undefined

export function stripe(): Stripe {
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not set.')
  client ??= new Stripe(secretKey, { appInfo: { name: 'schedulefa.st', url: 'https://www.schedulefa.st' } })
  return client
}
