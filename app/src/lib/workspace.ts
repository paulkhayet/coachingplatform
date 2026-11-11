import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { MemberRole } from '@/db/schema'

/** Remembers which business the person last switched to (D-057). Not a security boundary: every query is
 *  still checked by row-level security, and an unknown or stale value just falls back to the first business. */
export const BUSINESS_COOKIE = 'sf_business'

export interface Workspace {
  user: { id: string; email: string; fullName: string; avatarPath: string | null }
  membership: { id: string; role: MemberRole; coaches: boolean; financial: boolean; title: string | null }
  business: { id: string; name: string; slug: string; timezone: string; allow_advance_reservations: boolean; logo_path: string | null }
  /** Every business this person is an active member of, for the switcher. */
  workspaces: { businessId: string; name: string; role: MemberRole }[]
}

type MembershipRow = {
  id: string
  role: MemberRole
  coaches: boolean
  financial: boolean
  title: string | null
  business: Workspace['business'] | null
}

/** The signed-in user, verified with Supabase Auth. Cached per request. */
export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user
})

/** The signed-in user's current business: the one they last switched to, or their first.
 *  Redirects to sign-in or onboarding when either is missing. */
export const requireWorkspace = cache(async (): Promise<Workspace> => {
  const user = await getUser()
  if (!user) redirect('/sign-in')
  const supabase = await createClient()
  const [{ data, error }, { data: profile }] = await Promise.all([
    supabase.from('memberships')
      .select('id, role, coaches, financial, title, business:businesses(id, name, slug, timezone, allow_advance_reservations, logo_path)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .returns<MembershipRow[]>(),
    supabase.from('profiles').select('full_name, avatar_path').eq('id', user.id)
      .maybeSingle<{ full_name: string | null; avatar_path: string | null }>(),
  ])
  if (error) throw new Error(`Couldn't load your workspace: ${error.message}`)
  const rows = (data ?? []).filter((r) => r.business)
  if (rows.length === 0) redirect('/onboarding')
  const chosen = (await cookies()).get(BUSINESS_COOKIE)?.value
  const row = rows.find((r) => r.business!.id === chosen) ?? rows[0]
  return {
    user: { id: user.id, email: user.email ?? '',
      fullName: profile?.full_name || (user.user_metadata?.full_name as string | undefined) || user.email || 'You',
      avatarPath: profile?.avatar_path ?? null },
    membership: { id: row.id, role: row.role, coaches: row.coaches, financial: row.financial, title: row.title },
    business: row.business!,
    workspaces: rows.map((r) => ({ businessId: r.business!.id, name: r.business!.name, role: r.role })),
  }
})
