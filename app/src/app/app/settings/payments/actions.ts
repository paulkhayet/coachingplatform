'use server'

import { redirect } from 'next/navigation'
import { requireWorkspace } from '@/lib/workspace'
import { canManagePayments } from '@/lib/roles'
import { isStripeConfigured } from '@/lib/stripe/server'
import { PAYMENTS_PATH, createOnboardingLink, getOrCreateConnectedAccount } from '@/lib/stripe/connect'

/** Create (or reuse) the business's connected account and send the person to Stripe's onboarding. */
export async function connectStripe() {
  const ws = await requireWorkspace()
  if (!canManagePayments(ws.membership)) redirect(`${PAYMENTS_PATH}?error=forbidden`)
  if (!isStripeConfigured) redirect(`${PAYMENTS_PATH}?error=setup`)
  let url: string
  try {
    url = await createOnboardingLink(await getOrCreateConnectedAccount(ws))
  } catch (error) {
    console.error('Stripe Connect onboarding failed', error)
    redirect(`${PAYMENTS_PATH}?error=stripe`)
  }
  redirect(url)
}
