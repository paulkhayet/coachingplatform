import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface CoachOption {
  id: string
  name: string
}

/** Active members of the business who take calls, with names, for choosing who hosts a page (D-061). */
export async function coachOptions(businessId: string): Promise<CoachOption[]> {
  const supabase = await createClient()
  const { data: rows } = await supabase.from('memberships').select('id, user_id').eq('business_id', businessId).eq('status', 'active').eq('coaches', true).order('created_at').returns<{ id: string; user_id: string }[]>()
  const ids = (rows ?? []).map((r) => r.user_id)
  const { data: people } = ids.length ? await supabase.from('profiles').select('id, full_name, email').in('id', ids).returns<{ id: string; full_name: string | null; email: string | null }[]>() : { data: [] }
  const byId = new Map((people ?? []).map((p) => [p.id, p.full_name ?? p.email ?? 'Unnamed coach']))
  return (rows ?? []).map((r) => ({ id: r.id, name: byId.get(r.user_id) ?? 'Unnamed coach' }))
}

/** The coaches on each shared page in this business. */
export async function sharedHosts(businessId: string): Promise<Map<string, string[]>> {
  const supabase = await createClient()
  const { data } = await supabase.from('booking_page_hosts').select('booking_page_id, membership_id').eq('business_id', businessId).returns<{ booking_page_id: string; membership_id: string }[]>()
  const map = new Map<string, string[]>()
  for (const r of data ?? []) map.set(r.booking_page_id, [...(map.get(r.booking_page_id) ?? []), r.membership_id])
  return map
}
