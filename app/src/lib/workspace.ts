import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { MemberRole } from '@/db/schema'

export interface Workspace {
  user: { id: string; email: string; fullName: string }
  membership: { id: string; role: MemberRole; coaches: boolean; financial: boolean; title: string | null }
  business: { id: string; name: string; slug: string; timezone: string }
}

type MembershipRow = {
  id: string
  role: MemberRole
  coaches: boolean
  financial: boolean
  title: string | null
  business: { id: string; name: string; slug: string; timezone: string } | null
}

/** The signed-in user, verified with Supabase Auth. Cached per request. */
export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user
})

/** The signed-in user's business. Redirects to sign-in or onboarding when either is missing.
 *  Multi-business switching is not a launch feature (spec P-01), so the first active membership is used. */
export const requireWorkspace = cache(async (): Promise<Workspace> => {
  const user = await getUser()
  if (!user) redirect('/sign-in')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('memberships')
    .select('id, role, coaches, financial, title, business:businesses(id, name, slug, timezone)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .returns<MembershipRow[]>()
  if (error) throw new Error(`Couldn't load your workspace: ${error.message}`)
  const row = data?.[0]
  if (!row?.business) redirect('/onboarding')
  return {
    user: { id: user.id, email: user.email ?? '', fullName: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'You' },
    membership: { id: row.id, role: row.role, coaches: row.coaches, financial: row.financial, title: row.title },
    business: row.business,
  }
})
