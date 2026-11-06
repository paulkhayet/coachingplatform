'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { BUSINESS_COOKIE } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'
import { businessSchema, fieldErrors, type FieldErrors } from '@/lib/validation'

export interface OnboardingState {
  errors?: FieldErrors
  message?: string
  values?: Record<string, string>
}

export async function createBusiness(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const raw = { name: String(formData.get('name') ?? ''), slug: String(formData.get('slug') ?? ''), timezone: String(formData.get('timezone') ?? '') }
  const parsed = businessSchema.safeParse(raw)
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw }
  const supabase = await createClient()
  const { data: businessId, error } = await supabase.rpc('create_business', { p_name: parsed.data.name, p_slug: parsed.data.slug, p_timezone: parsed.data.timezone })
  if (error) {
    if (error.code === '23505') return { errors: { slug: 'That link is already taken. Try another.' }, values: raw }
    if (error.code === '42501') redirect('/sign-in?next=/onboarding')
    return { message: 'We couldn’t create your business. Try again in a moment.', values: raw }
  }
  // Open the new business (matters when the person already belongs to another one).
  if (typeof businessId === 'string') (await cookies()).set(BUSINESS_COOKIE, businessId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 })
  redirect('/app')
}
