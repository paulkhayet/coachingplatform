import 'server-only'

import { and, eq } from 'drizzle-orm'
import { adminDb } from '@/db/server'
import { workspaceBillingCustomers } from '@/db/schema'
import { isStripeConfigured, stripe, stripeLivemode } from './server'

/** Call after verifying that the signed-in person owns the selected workspace. */
export async function billingCustomer(businessId: string) {
  if (!isStripeConfigured) return null
  const [row] = await adminDb().select({ id: workspaceBillingCustomers.stripeCustomerId }).from(workspaceBillingCustomers)
    .where(and(eq(workspaceBillingCustomers.businessId, businessId), eq(workspaceBillingCustomers.livemode, stripeLivemode)))
  return row?.id ?? null
}

export async function workspaceSubscriptions(customer: string) {
  const { data } = await stripe().subscriptions.list({ customer, limit: 10 })
  const current = data.filter(({ status }) => status !== 'canceled' && status !== 'incomplete_expired')
  const productIds = [...new Set(current.flatMap(({ items }) => items.data.map(({ price }) =>
    typeof price.product === 'string' ? price.product : price.product.id)))].slice(0, 100)
  const products = productIds.length ? (await stripe().products.list({ ids: productIds, limit: productIds.length })).data : []
  const names = new Map(products.map((product) => [product.id, product.name]))
  return current
    .map((subscription) => ({
      id: subscription.id,
      status: subscription.status,
      names: [...new Set(subscription.items.data.map(({ price }) => {
        const productId = typeof price.product === 'string' ? price.product : price.product.id
        return names.get(productId) || price.nickname || 'schedulefa.st plan'
      }))],
    }))
}
