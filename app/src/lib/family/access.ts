import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/** Portal access the signed-in person has accepted and that is still on (D-073). Read through RLS. */
export type FamilyLink = {
  id: string
  business_id: string
  client_id: string
  can_view_sessions: boolean
  can_view_credits: boolean
  can_reschedule: boolean
  can_book: boolean
}

export const familyLinks = cache(async (userId: string): Promise<FamilyLink[]> => {
  const supabase = await createClient()
  const { data } = await supabase.from('family_access')
    .select('id, business_id, client_id, can_view_sessions, can_view_credits, can_reschedule, can_book')
    .eq('user_id', userId).not('accepted_at', 'is', null).is('revoked_at', null)
    .returns<FamilyLink[]>()
  return data ?? []
})
