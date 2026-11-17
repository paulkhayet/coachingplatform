import type { AssignedPackageTerms } from '@/db/schema'

export type ClientRow = { id: string; name: string; email: string | null; coach_membership_id: string | null }
export type GuardianRow = { id: string; name: string; relationship: string | null; email: string | null; phone: string | null }
export type PackageOption = { id: string; name: string; kind: 'fixed' | 'monthly'; price_cents: number; credit_units: number; updated_at: string }
export type AssignmentRow = { id: string; terms: AssignedPackageTerms }
export type CreditBalanceRow = {
  id: string
  client_package_id: string
  name: string
  kind: 'fixed' | 'monthly'
  starts_on: string
  ends_on: string
  credit_units: number
  expiration: 'inherit' | 'end_of_term'
  funded_units: number
  reserved_units: number
  used_units: number
  forfeited_units: number
  expired_units: number
  unpaid_reserved_units: number
  waiting_reserved_units: number
  /** Null for roles that cannot read payment records, or when there are no payments. */
  paid_cents: number | null
}
export type CreditEventRow = { id: string; period_id: string; kind: 'funded' | 'reserved' | 'released' | 'used' | 'forfeited' | 'expired'; credit_units: number; created_at: string }
export type OfflineMethod = 'cash' | 'check' | 'bank_transfer' | 'other'
export type CreditPaymentRow = { id: string; period_id: string; amount_cents: number; method: OfflineMethod | 'card'; received_on: string; reference: string | null; refunded_cents: number }

/** Methods staff can record by hand. Card payments come from Stripe (D-076). */
export const paymentMethodLabels: Record<OfflineMethod, string> = { cash: 'Cash', check: 'Check', bank_transfer: 'Bank transfer', other: 'Other offline payment' }
export const paymentLabel = (method: CreditPaymentRow['method']) => (method === 'card' ? 'Card' : paymentMethodLabels[method])

/** A payment link for a credit period (D-076), as staff see it. The link itself is shown once, when sent. */
export type PaymentLinkRow = {
  id: string; period_id: string; sent_to: string | null; created_at: string; cancelled_at: string | null; invite_guardian_id: string | null; invited_at: string | null
  plan_instalments: number | null; plan_cadence: 'weekly' | 'monthly' | null; plan_status: 'active' | 'past_due' | 'canceled' | 'completed' | null
}
