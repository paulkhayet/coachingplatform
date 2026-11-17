'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { adminDb } from '@/db/server'
import { checkFeature } from '@/lib/billing/server'
import { paymentAccount } from '@/lib/booking/server'
import { CardPaymentError, cancelPaymentRequest, createPaymentRequest } from '@/lib/clients/card-payments'
import { canManagePayments } from '@/lib/roles'
import { isStripeConfigured } from '@/lib/stripe/server'
import { requireWorkspace } from '@/lib/workspace'

// D-076: staff send a family a link to pay for a package by card, and can turn it off again.

export interface PaymentLinkState {
  message?: string
  link?: { url: string; sentTo: string | null; emailed: boolean }
}

const uuid = z.uuid()

function text(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function sendPaymentLink(businessId: string, clientId: string, periodId: string, _state: PaymentLinkState, form: FormData): Promise<PaymentLinkState> {
  const { business, user, membership } = await requireWorkspace()
  if (business.id !== businessId) return { message: 'You switched businesses. Reopen the client in the correct business.' }
  if (!canManagePayments(membership)) return { message: 'You need financial permission to take card payments.' }
  if (![clientId, periodId].every((id) => uuid.safeParse(id).success)) return { message: 'This credit period could not be found.' }
  const blocked = await checkFeature(businessId, 'clients')
  if (blocked) return { message: blocked }
  const account = isStripeConfigured ? await paymentAccount(businessId) : null
  if (!account) return { message: 'Connect Stripe in Settings → Payments to take card payments.' }
  const to = text(form, 'contact')
  const contact = to === 'client' ? 'client' as const : uuid.safeParse(to).success ? { guardianId: to } : null
  try {
    const link = await createPaymentRequest(adminDb(), { businessId, userId: user.id }, {
      clientId, periodId, contact, invite: form.get('invite') === 'on', allowInstalments: form.get('instalments') === 'on', stripeAccountId: account,
    })
    revalidatePath(`/app/clients/${clientId}`)
    return { link: { url: link.url, sentTo: link.sentTo, emailed: link.emailed } }
  } catch (error) {
    if (error instanceof CardPaymentError) return { message: error.message }
    console.error('Could not create a payment link', error instanceof Error ? error.message : 'unknown error')
    return { message: 'The payment link couldn’t be created. Try again.' }
  }
}

export async function cancelPaymentLink(businessId: string, clientId: string, requestId: string, _state: PaymentLinkState, _form: FormData): Promise<PaymentLinkState> {
  const { business, user } = await requireWorkspace()
  if (business.id !== businessId) return { message: 'You switched businesses. Reopen the client in the correct business.' }
  if (!uuid.safeParse(requestId).success) return { message: 'This link could not be found.' }
  try {
    await cancelPaymentRequest(adminDb(), { businessId, userId: user.id }, requestId)
  } catch (error) {
    if (error instanceof CardPaymentError) return { message: error.message }
    console.error('Could not turn off a payment link', error instanceof Error ? error.message : 'unknown error')
    return { message: 'The link couldn’t be turned off. Try again.' }
  }
  revalidatePath(`/app/clients/${clientId}`)
  return {}
}
