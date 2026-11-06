import type { MemberRole } from '@/db/schema'

export const roleLabel: Record<MemberRole, string> = { owner: 'Owner', admin: 'Administrator', coach: 'Coach' }

/** Mirrors the database policies; the database remains the source of truth. */
export const canManageTeam = (role: MemberRole) => role === 'owner'
export const canSeePricing = (role: MemberRole) => role === 'owner' || role === 'admin'
/** Owners and administrators can see the business's payment setup (stripe_accounts RLS). */
export const canSeePayments = (role: MemberRole) => role === 'owner' || role === 'admin'
/** Connecting or changing the Stripe account is a financial action: owners, or administrators with financial delegation (P-02). */
export const canManagePayments = (m: { role: MemberRole; financial: boolean }) => m.role === 'owner' || (m.role === 'admin' && m.financial)
