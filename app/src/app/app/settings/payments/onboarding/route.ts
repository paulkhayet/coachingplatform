import { redirect } from 'next/navigation'
import { requireWorkspace } from '@/lib/workspace'
import { canManagePayments } from '@/lib/roles'
import { isStripeConfigured } from '@/lib/stripe/server'
import { PAYMENTS_PATH, createOnboardingLink, getStripeAccount } from '@/lib/stripe/connect'

/**
 * Continue Stripe onboarding for an account that already exists. Also Stripe's refresh_url: Stripe sends
 * people here when an onboarding link has expired. It never creates an account (that takes a POST from
 * the Payments page), so following this link can't do more than open Stripe.
 */
export async function GET() {
  const ws = await requireWorkspace()
  if (!canManagePayments(ws.membership) || !isStripeConfigured) redirect(PAYMENTS_PATH)
  const account = await getStripeAccount(ws.business.id)
  if (!account || account.disconnectedAt) redirect(PAYMENTS_PATH)
  let url: string
  try {
    url = await createOnboardingLink(account.stripeAccountId)
  } catch (error) {
    console.error('Stripe onboarding link failed', error)
    redirect(`${PAYMENTS_PATH}?error=stripe`)
  }
  redirect(url)
}
