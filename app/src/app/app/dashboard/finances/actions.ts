'use server'

import { revalidatePath } from 'next/cache'
import { syncStripeFees } from '@/lib/booking/server'
import { syncPackageFees } from '@/lib/clients/card-payments'
import { isStripeConfigured } from '@/lib/stripe/server'
import { actionAccess } from '../guard'

export interface SyncState {
  ok?: boolean
  message?: string
}

/** Fetches Stripe's fee for paid calls that don't have one on record yet (D-074). Owner only. */
export async function syncFees(businessId: string, _state: SyncState, _form: FormData): Promise<SyncState> {
  const access = await actionAccess(businessId, 'owner')
  if (!access.ok) return { message: access.message }
  if (!isStripeConfigured) return { message: 'Stripe isn’t set up on this server, so fees can’t be fetched.' }
  // Paid calls, then card payments for packages (D-076).
  const calls = await syncStripeFees(businessId)
  const packages = await syncPackageFees(businessId)
  const result = { saved: calls.saved + packages.saved, failed: calls.failed + packages.failed, more: calls.more || packages.more }
  revalidatePath('/app/dashboard/finances')
  if (result.saved === 0 && result.failed > 0) {
    return { message: `Stripe wouldn’t give the fee for ${result.failed} ${result.failed === 1 ? 'payment' : 'payments'}. Check that your Stripe account is still connected in Settings → Payments.` }
  }
  const more = result.more ? ' There are more: run it again.' : ''
  const failed = result.failed ? ` ${result.failed} couldn’t be read.` : ''
  return { ok: true, message: result.saved === 0 ? 'Every payment already has its fee.' : `Fetched fees for ${result.saved} ${result.saved === 1 ? 'payment' : 'payments'}.${failed}${more}` }
}
