'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { acceptFamilyInvite, type FamilyAcceptResult } from '@/lib/family/invitations'
import { getUser } from '@/lib/workspace'

export interface FamilyJoinState { message?: string }

const reasons: Record<Exclude<FamilyAcceptResult, { ok: true }>['reason'], string> = {
  gone: 'This invitation no longer works. It may have been used, turned off, or replaced by a newer one.',
  expired: 'This invitation has expired. Ask the coaching business for a new one.',
  'wrong-email': 'This invitation is for a different email address than the one you’re signed in with.',
  unverified: 'Confirm your email address first, then open the link again.',
}

/** Accepts by link token (join page) or by id for an invitation to the signed-in person's own email. */
export async function joinFamilyPortal(_prev: FamilyJoinState, form: FormData): Promise<FamilyJoinState> {
  const user = await getUser()
  if (!user) redirect('/sign-in')
  const token = form.get('token')
  const id = z.uuid().safeParse(form.get('accessId'))
  const by = typeof token === 'string' && token ? { token } : id.success ? { id: id.data } : null
  if (!by) return { message: reasons.gone }
  const result = await acceptFamilyInvite(by, { id: user.id, email: user.email, emailConfirmed: Boolean(user.email_confirmed_at) })
  if (!result.ok) return { message: reasons[result.reason] }
  redirect('/family')
}
