'use server'

import { redirect } from 'next/navigation'
import { paymentAccount } from '@/lib/booking/server'
import { CardPaymentError, findPaymentRequest, startPackageCheckout } from '@/lib/clients/card-payments'
import { isStripeConfigured } from '@/lib/stripe/server'

export interface PayState {
  message?: string
}

/** Sends the family to Stripe Checkout for the way of paying they chose. */
export async function startPayment(token: string, _state: PayState, form: FormData): Promise<PayState> {
  const choice = form.get('choice') === 'instalments' ? 'instalments' : 'full'
  if (!isStripeConfigured) return { message: 'Card payments aren’t available right now. Contact the business.' }
  const found = await findPaymentRequest(token)
  if (!found) return { message: 'This payment link isn’t valid.' }
  const account = await paymentAccount(found.request.businessId)
  if (!account) return { message: 'This business can’t take card payments right now. Contact them to pay another way.' }
  let url: string
  try {
    url = await startPackageCheckout(token, choice, account)
  } catch (error) {
    if (error instanceof CardPaymentError) return { message: error.message }
    console.error('Could not start package checkout', error instanceof Error ? error.message : 'unknown error')
    return { message: 'We couldn’t open the payment page. Try again in a moment.' }
  }
  redirect(url)
}
