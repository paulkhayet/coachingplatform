'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { fieldErrors, type FieldErrors } from '@/lib/validation'
import { bookingPageSchema } from '@/lib/booking/schemas'
import { questionsSchema } from '@/lib/booking/questions'
import { parseDollars } from '@/lib/booking/policy'
import { canAssignHosts, canManageBookings } from '@/lib/roles'
import { cancelBooking } from '@/lib/booking/server'
import { coachOptions } from './hosts'
import { adminDb } from '@/db/server'
import { bookings } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Booking pages are written with the signed-in user's Supabase client, so row-level security decides
// who may create or change them (a coach for their own pages; owners and administrators for any).

export interface BookingPageState {
  errors?: FieldErrors
  message?: string
  values?: Record<string, string>
}

const extraSchema = z.object({
  priceCents: z.number().int().min(50, 'Charge at least $0.50, or leave the price blank for a free call').max(1_000_000, 'Charge at most $10,000').nullable(),
  refundCutoffHours: z.coerce.number().int('Use whole hours').min(0, 'Use 0 or more hours').max(720, 'Use at most 720 hours (30 days)'),
  questions: questionsSchema,
})

function read(formData: FormData) {
  const raw = Object.fromEntries(['title', 'slug', 'description', 'durationMinutes', 'locationType', 'locationDetail', 'minNoticeMinutes', 'windowDays', 'bufferBeforeMinutes', 'bufferAfterMinutes', 'price', 'refundCutoffHours', 'questions'].map((k) => [k, String(formData.get(k) ?? '')]))
  const active = formData.get('active') === 'on'
  const askNotes = formData.get('askNotes') === 'on'
  const values = { ...raw, active: active ? 'on' : '', askNotes: askNotes ? 'on' : '' }
  const base = bookingPageSchema.safeParse({ ...raw, active })
  const price = parseDollars(raw.price)
  let questions: unknown = []
  try {
    questions = JSON.parse(raw.questions || '[]')
  } catch {
    questions = null
  }
  const extra = extraSchema.safeParse({ priceCents: Number.isNaN(price) ? -1 : price, refundCutoffHours: raw.refundCutoffHours, questions })
  const errors: FieldErrors = { ...(base.success ? {} : fieldErrors(base.error)), ...(extra.success ? {} : fieldErrors(extra.error)) }
  if (Number.isNaN(price)) errors.priceCents = 'Enter a price like 45 or 45.50'
  if (!base.success || !extra.success) return { values, errors, data: null }
  return { values, errors: {} as FieldErrors, data: { ...base.data, ...extra.data, askNotes } }
}

function columns(d: z.infer<typeof bookingPageSchema> & z.infer<typeof extraSchema> & { askNotes: boolean }) {
  return {
    ask_notes: d.askNotes,
    price_cents: d.priceCents,
    refund_cutoff_hours: d.refundCutoffHours,
    questions: d.questions,
    title: d.title,
    slug: d.slug,
    description: d.description || null,
    duration_minutes: d.durationMinutes,
    location_type: d.locationType,
    location_detail: d.locationDetail || null,
    min_notice_minutes: d.minNoticeMinutes,
    window_days: d.windowDays,
    buffer_before_minutes: d.bufferBeforeMinutes,
    buffer_after_minutes: d.bufferAfterMinutes,
    active: d.active,
  }
}

/**
 * Who takes the page's calls (D-061). Owners and administrators choose one coach or a group ("shared");
 * everyone else always hosts their own pages, and `null` means "leave the host as it is".
 */
async function readHosts(formData: FormData, isManager: boolean, businessId: string): Promise<{ values: Record<string, string>; error?: string; host?: { id: string | null; pool: string[] } }> {
  const mode = formData.get('hostMode') === 'shared' ? 'shared' : 'one'
  const hostId = String(formData.get('hostMembershipId') ?? '')
  const pool = formData.getAll('poolHost').map(String)
  const values = { hostMode: mode, hostMembershipId: hostId, poolHost: pool.join(',') }
  if (!isManager || !formData.has('hostMode')) return { values }
  const allowed = new Set((await coachOptions(businessId)).map((c) => c.id))
  if (mode === 'one') {
    if (!allowed.has(hostId)) return { values, error: 'Choose who takes these calls.' }
    return { values, host: { id: hostId, pool: [] } }
  }
  const chosen = [...new Set(pool)].filter((id) => allowed.has(id))
  if (chosen.length === 0) return { values, error: 'Choose at least one coach for the group.' }
  return { values, host: { id: null, pool: chosen } }
}

/** Makes the page's group of coaches match `pool` (empty for a single-host page). */
async function saveHosts(supabase: Awaited<ReturnType<typeof createClient>>, pageId: string, businessId: string, pool: string[]) {
  const { error } = await supabase.from('booking_page_hosts').delete().eq('booking_page_id', pageId)
  if (error) return false
  if (pool.length === 0) return true
  const { error: insertError } = await supabase.from('booking_page_hosts').insert(pool.map((membership_id) => ({ booking_page_id: pageId, membership_id, business_id: businessId })))
  return !insertError
}

function dbError(code: string | undefined, raw: Record<string, string>): BookingPageState {
  if (code === '23505') return { errors: { slug: 'You already have a page with that link. Try another.' }, values: raw }
  return { message: 'We couldn’t save this page. Try again in a moment.', values: raw }
}

export async function createBookingPage(_prev: BookingPageState, formData: FormData): Promise<BookingPageState> {
  const { membership, business } = await requireWorkspace()
  const { values: base, errors, data: parsed } = read(formData)
  const hosts = await readHosts(formData, canAssignHosts(membership.role), business.id)
  const raw = { ...base, ...hosts.values }
  if (hosts.error) errors.host = hosts.error
  if (!parsed || hosts.error) return { errors, values: raw }
  const host = hosts.host ?? { id: membership.id, pool: [] }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('booking_pages')
    .insert({ ...columns(parsed), business_id: business.id, host_membership_id: host.id })
    .select('id')
    .single<{ id: string }>()
  if (error || !data) return dbError(error?.code, raw)
  if (host.pool.length && !(await saveHosts(supabase, data.id, business.id, host.pool))) {
    // Without its coaches a shared page can't be booked; don't leave it live half-made.
    await supabase.from('booking_pages').update({ active: false }).eq('id', data.id)
    redirect(`/app/booking-pages/${data.id}?hosts=failed`)
  }
  revalidatePath('/app/booking-pages')
  redirect(`/app/booking-pages/${data.id}?saved=1`)
}

export async function updateBookingPage(id: string, _prev: BookingPageState, formData: FormData): Promise<BookingPageState> {
  const { membership, business } = await requireWorkspace()
  const { values: base, errors, data: parsed } = read(formData)
  const hosts = await readHosts(formData, canAssignHosts(membership.role), business.id)
  const raw = { ...base, ...hosts.values }
  if (hosts.error) errors.host = hosts.error
  if (!parsed || hosts.error) return { errors, values: raw }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('booking_pages')
    .update({ ...columns(parsed), ...(hosts.host ? { host_membership_id: hosts.host.id } : {}), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', business.id)
    .select('id')
  if (error) return dbError(error.code, raw)
  if (!data?.length) return { message: 'Only the page’s host, an owner or an administrator can change it.', values: raw }
  // Existing bookings stay with the coach they were made with.
  if (hosts.host && !(await saveHosts(supabase, id, business.id, hosts.host.pool))) return { message: 'Saved, but we couldn’t update the group of coaches. Try again.', values: raw }
  revalidatePath('/app/booking-pages')
  revalidatePath(`/app/booking-pages/${id}`)
  redirect(`/app/booking-pages/${id}?saved=1`)
}

/** Staff cancel a booking: the host, an owner or an administrator. The guest is refunded in full if they paid (D-056). */
export async function cancelBookingAction(formData: FormData) {
  const { membership, business } = await requireWorkspace()
  const id = z.uuid().safeParse(formData.get('id'))
  if (!id.success) return
  const [row] = await adminDb().select({ businessId: bookings.businessId, host: bookings.hostMembershipId }).from(bookings).where(eq(bookings.id, id.data)).limit(1)
  if (!row || row.businessId !== business.id || !canManageBookings(membership, row.host)) return
  await cancelBooking(id.data, 'business')
  revalidatePath('/app/bookings')
}
