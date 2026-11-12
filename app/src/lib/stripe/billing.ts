import 'server-only'

import { and, eq } from 'drizzle-orm'
import { adminDb } from '@/db/server'
import { workspaceBillingCustomers } from '@/db/schema'
import { isStripeConfigured, stripeLivemode } from './server'

/** Call after verifying that the signed-in person owns the selected workspace. */
export async function billingCustomer(businessId: string) {
  if (!isStripeConfigured) return null
  const [row] = await adminDb().select({ id: workspaceBillingCustomers.stripeCustomerId }).from(workspaceBillingCustomers)
    .where(and(eq(workspaceBillingCustomers.businessId, businessId), eq(workspaceBillingCustomers.livemode, stripeLivemode)))
  return row?.id ?? null
}
