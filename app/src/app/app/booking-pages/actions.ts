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
import { canManageBookings } from '@/lib/roles'
import { cancelBooking } from '@/lib/booking/server'
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
  askStudent: z.boolean(),
  questions: questionsSchema,
})

function read(formData: FormData) {
  const raw = Object.fromEntries(['title', 'slug', 'description', 'durationMinutes', 'locationType', 'locationDetail', 'minNoticeMinutes', 'windowDays', 'bufferBeforeMinutes', 'bufferAfterMinutes', 'price', 'refundCutoffHours', 'questions'].map((k) => [k, String(formData.get(k) ?? '')]))
  const active = formData.get('active') === 'on'
  const askStudent = formData.get('askStudent') === 'on'
  const values = { ...raw, active: active ? 'on' : '', askStudent: askStudent ? 'on' : '' }
  const base = bookingPageSchema.safeParse({ ...raw, active })
  const price = parseDollars(raw.price)
  let questions: unknown = []
  try {
    questions = JSON.parse(raw.questions || '[]')
  } catch {
    questions = null
  }
  const extra = extraSchema.safeParse({ priceCents: Number.isNaN(price) ? -1 : price, refundCutoffHours: raw.refundCutoffHours, askStudent, questions })
  const errors = { ...(base.success ? {} : fieldErrors(base.error)), ...(extra.success ? {} : fieldErrors(extra.error)) }
  if (Number.isNaN(price)) errors.priceCents = 'Enter a price like 45 or 45.50'
  if (!base.success || !extra.success) return { values, errors, data: null }
  return { values, errors: {}, data: { ...base.data, ...extra.data } }
}

function columns(d: z.infer<typeof bookingPageSchema> & z.infer<typeof extraSchema>) {
  return {
    price_cents: d.priceCents,
    refund_cutoff_hours: d.refundCutoffHours,
    ask_student: d.askStudent,
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

function dbError(code: string | undefined, raw: Record<string, string>): BookingPageState {
  if (code === '23505') return { errors: { slug: 'You already have a page with that link. Try another.' }, values: raw }
  return { message: 'We couldn’t save this page. Try again in a moment.', values: raw }
}

export async function createBookingPage(_prev: BookingPageState, formData: FormData): Promise<BookingPageState> {
  const { membership, business } = await requireWorkspace()
  const { values: raw, errors, data: parsed } = read(formData)
  if (!parsed) return { errors, values: raw }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('booking_pages')
    .insert({ ...columns(parsed), business_id: business.id, host_membership_id: membership.id })
    .select('id')
    .single<{ id: string }>()
  if (error || !data) return dbError(error?.code, raw)
  revalidatePath('/app/booking-pages')
  redirect(`/app/booking-pages/${data.id}?saved=1`)
}

export async function updateBookingPage(id: string, _prev: BookingPageState, formData: FormData): Promise<BookingPageState> {
  await requireWorkspace()
  const { values: raw, errors, data: parsed } = read(formData)
  if (!parsed) return { errors, values: raw }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('booking_pages')
    .update({ ...columns(parsed), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
  if (error) return dbError(error.code, raw)
  if (!data?.length) return { message: 'Only the page’s host, an owner or an administrator can change it.', values: raw }
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
