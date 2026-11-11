'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { canManageTeam } from '@/lib/roles'
import { weeklyHoursSchema } from '@/lib/slots'
import { z } from 'zod'

export interface OpeningHoursState {
  ok?: boolean
  message?: string
}

export async function saveBusinessName(businessId: string, _state: OpeningHoursState, form: FormData): Promise<OpeningHoursState> {
  const { membership, business } = await requireWorkspace()
  if (business.id !== businessId) return { message: 'You switched businesses. Reopen these settings.' }
  if (!canManageTeam(membership.role)) return { message: 'Only the owner can change the business name.' }
  const name = z.string().trim().min(2).max(80).safeParse(form.get('name'))
  if (!name.success) return { message: 'Enter a business name of 2 to 80 characters.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('businesses').update({ name: name.data }).eq('id', businessId).select('id')
  if (error || !data?.length) return { message: 'We couldn’t save the business name. Try again.' }
  revalidatePath('/app', 'layout')
  return { ok: true, message: 'Business name saved.' }
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

function reservationHours(value: FormDataEntryValue | null) {
  if (value === '' || value === null) return null
  return typeof value === 'string' && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 720 ? Number(value) : Number.NaN
}

export async function saveReservationSettings(businessId: string, _prev: OpeningHoursState, form: FormData): Promise<OpeningHoursState> {
  const { membership, business } = await requireWorkspace()
  if (business.id !== businessId) return { message: 'You switched businesses. Reopen these settings.' }
  if (!canManageTeam(membership.role)) return { message: 'Only the owner can change reservation settings.' }
  const enabled = form.get('advanceReservations') === 'on'
  const reminder = reservationHours(form.get('paymentReminderHours'))
  const cutoff = reservationHours(form.get('unpaidCancellationHours'))
  if (Number.isNaN(reminder) || Number.isNaN(cutoff)) return { message: 'Enter whole hours between 1 and 720, or leave the field blank.' }
  if (reminder !== null && cutoff !== null && reminder <= cutoff) return { message: 'The payment reminder must go out before the cancellation deadline.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('businesses')
    .update({ allow_advance_reservations: enabled, payment_reminder_hours: reminder, unpaid_cancellation_hours: cutoff })
    .eq('id', businessId).select('id')
  if (error || !data?.length) return { message: 'We couldn’t save the reservation settings. Try again.' }
  revalidatePath('/app', 'layout')
  return { ok: true, message: 'Coaching reservation settings saved.' }
}
