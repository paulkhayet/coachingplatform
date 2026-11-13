'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { PAY_METHODS } from '@/db/schema'
import { parseDollars } from '@/lib/booking/policy'
import { createClient } from '@/lib/supabase/server'
import { actionAccess } from '../../dashboard/guard'

export interface CoachPayState {
  ok?: boolean
  message?: string
  errors?: Partial<Record<string, string>>
}

const uuid = z.uuid()
const overrides = z.array(z.object({ formatName: z.string().trim().min(1).max(80), amount: z.string() })).max(10)

function text(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function refresh() {
  revalidatePath('/app/settings/coach-pay')
  revalidatePath('/app/dashboard/finances')
}

/**
 * Sets how a coach is paid from a date onward (D-074). Owner only, saved through row-level security,
 * so nobody else can write these rows even by calling the API directly. Saving again for the same
 * start date replaces that entry; an earlier entry keeps applying to the days before it.
 */
export async function saveCoachPay(businessId: string, membershipId: string, _state: CoachPayState, form: FormData): Promise<CoachPayState> {
  const access = await actionAccess(businessId, 'owner')
  if (!access.ok) return { message: access.message }
  if (!uuid.safeParse(membershipId).success) return { message: 'This coach could not be found.' }
  const method = z.enum(PAY_METHODS).safeParse(text(form, 'method'))
  const effectiveFrom = z.iso.date().safeParse(text(form, 'effectiveFrom'))
  const errors: Record<string, string> = {}
  if (!method.success) return { message: 'Choose how this coach is paid.' }
  if (!effectiveFrom.success) errors.effectiveFrom = 'Choose the date this starts'

  let amountCents: number | null = null
  let percentBps: number | null = null
  let formatOverrides: { formatName: string; amountCents: number }[] = []
  if (method.data === 'percent') {
    const percent = Number(text(form, 'percent'))
    if (!text(form, 'percent') || !Number.isFinite(percent) || percent < 0 || percent > 100) errors.percent = 'Enter a percentage from 0 to 100'
    else percentBps = Math.round(percent * 100)
  } else {
    const cents = parseDollars(text(form, 'amount'))
    if (cents === null || Number.isNaN(cents) || cents > 100_000_000) errors.amount = 'Enter an amount in dollars, like 40 or 37.50'
    else amountCents = cents
  }
  if (method.data === 'per_session') {
    let raw: unknown
    try {
      raw = JSON.parse(text(form, 'overrides') || '[]')
    } catch {
      raw = null
    }
    const parsed = overrides.safeParse(raw)
    if (!parsed.success) errors.overrides = 'Check the session formats and amounts'
    else {
      const seen = new Set<string>()
      for (const o of parsed.data) {
        const cents = parseDollars(o.amount)
        const key = o.formatName.toLowerCase()
        if (cents === null || Number.isNaN(cents) || cents > 100_000_000) errors.overrides = `Enter an amount for “${o.formatName}”`
        else if (seen.has(key)) errors.overrides = `“${o.formatName}” is listed twice`
        else formatOverrides.push({ formatName: o.formatName, amountCents: cents })
        seen.add(key)
      }
      if (errors.overrides) formatOverrides = []
    }
  }
  if (Object.keys(errors).length || !effectiveFrom.success) return { errors }

  const supabase = await createClient()
  const { data, error } = await supabase.from('coach_pay_rates').upsert({
    business_id: businessId, membership_id: membershipId, effective_from: effectiveFrom.data, method: method.data, amount_cents: amountCents,
    percent_bps: percentBps, format_overrides: formatOverrides, pay_forfeited: form.get('payForfeited') === 'on', created_by: access.access.user.id,
  }, { onConflict: 'business_id,membership_id,effective_from' }).select('id')
  if (error?.code === '22023') return { message: 'Choose someone from this business.' }
  if (error || !data?.length) return { message: 'The pay rate couldn’t be saved. Check your access and try again.' }
  refresh()
  return { ok: true, message: 'Saved.' }
}

/** Removes one entry from a coach's pay history, e.g. one entered by mistake. The entry before it applies again. */
export async function removeCoachPay(businessId: string, rateId: string, _state: CoachPayState, _form: FormData): Promise<CoachPayState> {
  const access = await actionAccess(businessId, 'owner')
  if (!access.ok) return { message: access.message }
  if (!uuid.safeParse(rateId).success) return { message: 'This entry could not be found.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('coach_pay_rates').delete().eq('id', rateId).eq('business_id', businessId).select('id')
  if (error || !data?.length) return { message: 'The entry couldn’t be removed. Try again.' }
  refresh()
  return { ok: true }
}
