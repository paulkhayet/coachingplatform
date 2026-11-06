import type Stripe from 'stripe'
import type { StripeAccountRow } from '@/db/schema'

/** Where a business is with Stripe Connect (D-055). Pure, so it can be unit tested. */
export type PaymentsStatus = 'not_connected' | 'disconnected' | 'onboarding' | 'restricted' | 'active'

type StatusInput = Pick<StripeAccountRow, 'disconnectedAt' | 'detailsSubmitted' | 'chargesEnabled'> | null | undefined

export function paymentsStatus(row: StatusInput): PaymentsStatus {
  if (!row) return 'not_connected'
  if (row.disconnectedAt) return 'disconnected'
  if (!row.detailsSubmitted) return 'onboarding'
  // Details are in, but Stripe still needs something or is reviewing the account.
  if (!row.chargesEnabled) return 'restricted'
  return 'active'
}

/** The parts of a Stripe account we keep in stripe_accounts. */
export function accountFields(account: Pick<Stripe.Account, 'details_submitted' | 'charges_enabled' | 'payouts_enabled' | 'requirements'>) {
  return {
    detailsSubmitted: account.details_submitted ?? false,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    disabledReason: account.requirements?.disabled_reason ?? null,
    requirementsDue: account.requirements?.currently_due?.length ?? 0,
  }
}

/** Live keys start sk_live_ / rk_live_; anything else (sk_test_, rk_test_) is test mode. */
export function isLiveKey(key: string) {
  return /^(sk|rk)_live_/.test(key)
}
