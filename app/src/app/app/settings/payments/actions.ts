'use server'

import { redirect } from 'next/navigation'
import { requireWorkspace } from '@/lib/workspace'
import { canManagePayments } from '@/lib/roles'
import { isStripeConfigured } from '@/lib/stripe/server'
import { INTEGRATIONS_PATH } from '@/lib/settings-paths'
import { createOnboardingLink, getOrCreateConnectedAccount } from '@/lib/stripe/connect'

/** Create (or reuse) the business's connected account and send the person to Stripe's onboarding. */
export async function connectStripe(businessId: string) {
  const ws = await requireWorkspace()
  if (ws.business.id !== businessId) redirect(`${INTEGRATIONS_PATH}?error=workspace#stripe-connect`)
  if (!canManagePayments(ws.membership)) redirect(`${INTEGRATIONS_PATH}?error=forbidden#stripe-connect`)
  if (!isStripeConfigured) redirect(`${INTEGRATIONS_PATH}?error=setup#stripe-connect`)
  let url: string
  try {
    url = await createOnboardingLink(await getOrCreateConnectedAccount(ws))
  } catch (error) {
    console.error('Stripe Connect onboarding failed', error)
    redirect(`${INTEGRATIONS_PATH}?error=stripe#stripe-connect`)
  }
  redirect(url)
}
