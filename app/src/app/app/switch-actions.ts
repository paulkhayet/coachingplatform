'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { BUSINESS_COOKIE, requireWorkspace } from '@/lib/workspace'

/** Switch to another business the person is an active member of (D-057). */
export async function switchBusiness(formData: FormData) {
  const { workspaces } = await requireWorkspace()
  const id = String(formData.get('businessId') ?? '')
  if (!workspaces.some((w) => w.businessId === id)) redirect('/app')
  ;(await cookies()).set(BUSINESS_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 })
  redirect('/app')
}
