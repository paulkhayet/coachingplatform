import type Stripe from 'stripe'
import { isStripeConfigured, stripe, webhookSecrets } from '@/lib/stripe/server'
import { processStripeEvent } from '@/lib/stripe/events'

// Stripe calls this for events on connected accounts (and, later, the platform account).
// Every request must carry a valid Stripe signature; nothing is trusted otherwise.

export async function POST(request: Request) {
  if (!isStripeConfigured || webhookSecrets.length === 0) return new Response('Stripe is not configured', { status: 503 })
  const signature = request.headers.get('stripe-signature')
  if (!signature) return new Response('Missing Stripe signature', { status: 400 })

  // The signature covers the exact bytes Stripe sent, so read the raw body before any parsing.
  const body = await request.text()
  let event: Stripe.Event | undefined
  for (const secret of webhookSecrets) {
    try {
      event = stripe().webhooks.constructEvent(body, signature, secret)
      break
    } catch {
      // Try the next endpoint's secret.
    }
  }
  if (!event) return new Response('Invalid Stripe signature', { status: 400 })

  try {
    const processed = await processStripeEvent(event)
    return Response.json({ received: true, duplicate: !processed })
  } catch (error) {
    // A 500 makes Stripe retry later; nothing was recorded, so the retry is processed in full.
    console.error(`Stripe event ${event.id} (${event.type}) failed`, error)
    return new Response('Event processing failed', { status: 500 })
  }
}
