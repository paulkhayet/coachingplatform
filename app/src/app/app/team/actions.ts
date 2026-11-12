'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { adminDb } from '@/db/server'
import { invitations, memberships } from '@/db/schema'
import { createClient } from '@/lib/supabase/server'
import { BUSINESS_COOKIE, requireWorkspace } from '@/lib/workspace'
import { canManageTeam } from '@/lib/roles'
import { releaseMember } from '@/lib/booking/server'
import { sendInvitation, type InviteRole } from '@/lib/team/invitations'
import { checkCanInvite, syncSeats } from '@/lib/billing/server'

// Removing someone, or leaving, cancels their upcoming bookings with this business (D-058).

export interface TeamState {
  message?: string
  ok?: boolean
}

/** The owner removes a member. Owners can't be removed, and nobody removes themselves this way. */
export async function removeMember(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const { membership, business } = await requireWorkspace()
  if (!canManageTeam(membership.role)) return { message: 'Only the owner can remove people.' }
  const id = z.uuid().safeParse(formData.get('membershipId'))
  if (!id.success || id.data === membership.id) return { message: 'You can’t remove that person.' }

  // The owner's own Supabase client: row-level security also refuses removing owners or yourself.
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('memberships')
    .update({ status: 'inactive' })
    .eq('id', id.data)
    .eq('business_id', business.id)
    .eq('status', 'active')
    .neq('role', 'owner')
    .select('id')
  if (error || !data?.length) return { message: 'We couldn’t remove that person. Try again in a moment.' }

  const { cancelled } = await releaseMember(id.data)
  await syncSeats(business.id)
  revalidatePath('/app/team')
  return { ok: true, message: cancelled ? `Removed. ${cancelled} upcoming ${cancelled === 1 ? 'booking was' : 'bookings were'} cancelled and the guests told.` : 'Removed.' }
}

/** A member leaves this business. Owners can't leave (ownership transfer isn't available yet). */
export async function leaveBusiness(_prev: TeamState): Promise<TeamState> {
  const { membership, business } = await requireWorkspace()
  if (membership.role === 'owner') return { message: 'Owners can’t leave their own business.' }
  // Members can't change their own membership through the API, so the server does it after these checks.
  const [left] = await adminDb()
    .update(memberships)
    .set({ status: 'inactive' })
    .where(and(eq(memberships.id, membership.id), eq(memberships.businessId, business.id), eq(memberships.status, 'active')))
    .returning({ id: memberships.id })
  if (!left) return { message: 'We couldn’t do that. Try again in a moment.' }
  await releaseMember(membership.id)
  await syncSeats(business.id)
  ;(await cookies()).delete(BUSINESS_COOKIE)
  redirect('/app')
}

// D-060: invitations. Only owners invite; the server writes invitations after this check.

export interface InviteState {
  message?: string
  ok?: boolean
  /** The link, shown once so the owner can copy it (e.g. when email isn't set up). */
  url?: string
  emailed?: boolean
  values?: { email?: string; role?: string; title?: string; coaches?: string }
}

const inviteSchema = z.object({
  email: z.email('Enter a valid email address.').max(254),
  role: z.enum(['coach', 'admin']),
  coaches: z.boolean(),
  title: z.string().trim().max(60, 'Keep the title under 60 characters.').transform((v) => v || null),
})

export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const { user, membership, business } = await requireWorkspace()
  const values = { email: String(formData.get('email') ?? ''), role: String(formData.get('role') ?? 'coach'), title: String(formData.get('title') ?? ''), coaches: formData.get('coaches') ? 'on' : '' }
  if (!canManageTeam(membership.role)) return { message: 'Only the owner can invite people.', values }
  const parsed = inviteSchema.safeParse({ email: values.email.trim(), role: values.role, coaches: values.coaches === 'on', title: values.title })
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? 'Check the details.', values }
  if (parsed.data.email.toLowerCase() === user.email.toLowerCase()) return { message: 'That’s you. Invite someone else.', values }
  const blocked = await checkCanInvite(business.id)
  if (blocked) return { message: blocked, values }
  const sent = await sendInvitation({ businessId: business.id, businessName: business.name, inviter: { id: user.id, name: user.fullName, email: user.email }, ...parsed.data })
  if ('error' in sent) return { message: sent.error, values }
  revalidatePath('/app/team')
  return { ok: true, ...sent, message: sent.emailed ? `Invitation sent to ${parsed.data.email}.` : `Invitation created for ${parsed.data.email}. Email isn’t set up yet, so send them this link yourself.` }
}

/** Sends a fresh link (the old one stops working). */
export async function resendInvitation(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const { user, membership, business } = await requireWorkspace()
  if (!canManageTeam(membership.role)) return { message: 'Only the owner can invite people.' }
  const id = z.uuid().safeParse(formData.get('invitationId'))
  if (!id.success) return { message: 'That invitation no longer exists.' }
  const [inv] = await adminDb().select().from(invitations).where(and(eq(invitations.id, id.data), eq(invitations.businessId, business.id), isNull(invitations.acceptedAt)))
  if (!inv) return { message: 'That invitation no longer exists.' }
  const sent = await sendInvitation({ businessId: business.id, businessName: business.name, inviter: { id: user.id, name: user.fullName, email: user.email }, email: inv.email, role: inv.role as InviteRole, coaches: inv.coaches, title: inv.title })
  if ('error' in sent) return { message: sent.error }
  revalidatePath('/app/team')
  return { ok: true, ...sent, message: sent.emailed ? 'New link sent.' : 'New link created. Send it yourself:' }
}

export async function cancelInvitation(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const { membership, business } = await requireWorkspace()
  if (!canManageTeam(membership.role)) return { message: 'Only the owner can cancel invitations.' }
  const id = z.uuid().safeParse(formData.get('invitationId'))
  if (!id.success) return { message: 'That invitation no longer exists.' }
  await adminDb().delete(invitations).where(and(eq(invitations.id, id.data), eq(invitations.businessId, business.id), isNull(invitations.acceptedAt)))
  revalidatePath('/app/team')
  return { ok: true, message: 'Invitation cancelled.' }
}
