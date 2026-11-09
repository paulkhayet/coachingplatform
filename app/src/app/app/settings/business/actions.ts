'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { canManageTeam } from '@/lib/roles'
import { weeklyHoursSchema } from '@/lib/slots'

export interface OpeningHoursState {
  ok?: boolean
  message?: string
}

/** The owner sets when the business takes bookings, for everyone (D-059). Blank = no limit. */
export async function saveOpeningHours(_prev: OpeningHoursState, formData: FormData): Promise<OpeningHoursState> {
  const { membership, business } = await requireWorkspace()
  if (!canManageTeam(membership.role)) return { message: 'Only the owner can change opening hours.' }
  let hours: ReturnType<typeof weeklyHoursSchema.parse> | null = null
  if (formData.get('mode') === 'some') {
    let raw: unknown
    try {
      raw = JSON.parse(String(formData.get('weekly') ?? '[]'))
    } catch {
      return { message: 'Something went wrong reading the hours. Try again.' }
    }
    const parsed = weeklyHoursSchema.safeParse(raw)
    if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? 'Check the hours.' }
    if (parsed.data.length === 0) return { message: 'Choose at least one block of time, or choose no limit.' }
    hours = parsed.data.sort((a, b) => a.day - b.day || a.start - b.start)
  }
  // Row-level security only lets owners update the business.
  const supabase = await createClient()
  const { data, error } = await supabase.from('businesses').update({ opening_hours: hours }).eq('id', business.id).select('id')
  if (error || !data?.length) return { message: 'We couldn’t save the opening hours. Try again in a moment.' }
  revalidatePath('/app/settings/business')
  revalidatePath('/app/availability')
  return { ok: true, message: 'Opening hours saved.' }
}
