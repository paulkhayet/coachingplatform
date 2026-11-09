'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { acceptInvitation, type AcceptResult } from '@/lib/team/invitations'
import { BUSINESS_COOKIE, getUser } from '@/lib/workspace'

export interface JoinState {
  message?: string
}

const reasons: Record<Exclude<AcceptResult, { ok: true }>['reason'], string> = {
  gone: 'This invitation no longer exists. It may have been cancelled or replaced by a newer link.',
  expired: 'This invitation has expired. Ask for a new one.',
  used: 'This invitation has already been used.',
  'wrong-email': 'This invitation is for a different email address than the one you’re signed in with.',
  unverified: 'Confirm your email address first, then open the link again.',
}

/** Accepts by link token (join page) or by id for an invitation to the signed-in person's own email (onboarding). */
export async function joinBusiness(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const user = await getUser()
  if (!user) redirect('/sign-in')
  const token = formData.get('token')
  const id = z.uuid().safeParse(formData.get('invitationId'))
  const by = typeof token === 'string' && token ? { token } : id.success ? { id: id.data } : null
  if (!by) return { message: reasons.gone }
  const result = await acceptInvitation(by, { id: user.id, email: user.email, emailConfirmed: Boolean(user.email_confirmed_at) })
  if (!result.ok) return { message: reasons[result.reason] }
  ;(await cookies()).set(BUSINESS_COOKIE, result.businessId, { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365 })
  redirect('/app')
}
