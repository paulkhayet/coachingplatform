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
export type CreditPaymentRow = { id: string; period_id: string; amount_cents: number; method: 'cash' | 'check' | 'bank_transfer' | 'other'; received_on: string; reference: string | null }

export const paymentMethodLabels: Record<CreditPaymentRow['method'], string> = { cash: 'Cash', check: 'Check', bank_transfer: 'Bank transfer', other: 'Other offline payment' }
