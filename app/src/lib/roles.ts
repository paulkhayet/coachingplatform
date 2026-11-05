import type { MemberRole } from '@/db/schema'

export const roleLabel: Record<MemberRole, string> = { owner: 'Owner', admin: 'Administrator', coach: 'Coach' }

/** Mirrors the database policies; the database remains the source of truth. */
export const canManageTeam = (role: MemberRole) => role === 'owner'
export const canSeePricing = (role: MemberRole) => role === 'owner' || role === 'admin'
