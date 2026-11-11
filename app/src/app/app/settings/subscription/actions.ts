'use server'

import { notFound, redirect } from 'next/navigation'
import { siteUrl } from '@/lib/env'
import { canManageTeam } from '@/lib/roles'
import { SUBSCRIPTION_PATH } from '@/lib/settings-paths'
import { billingCustomer } from '@/lib/stripe/billing'
import { stripe } from '@/lib/stripe/server'
import { requireWorkspace } from '@/lib/workspace'

export async function openBillingPortal(businessId: string) {
  const { business, membership } = await requireWorkspace()
  if (!canManageTeam(membership.role)) notFound()
  if (business.id !== businessId) redirect(`${SUBSCRIPTION_PATH}?error=workspace`)

  let url: string | undefined
  try {
    const customer = await billingCustomer(businessId)
    if (customer) {
      const portal = await stripe().billingPortal.sessions.create({ customer, return_url: `${siteUrl}${SUBSCRIPTION_PATH}` })
      url = portal.url
    }
  } catch {
    console.error('Could not open the workspace billing portal')
  }
  redirect(url ?? `${SUBSCRIPTION_PATH}?error=portal`)
}
