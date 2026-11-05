'use server'

import { redirect } from 'next/navigation'
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
  const { error } = await supabase.rpc('create_business', { p_name: parsed.data.name, p_slug: parsed.data.slug, p_timezone: parsed.data.timezone })
  if (error) {
    if (error.code === '23505') return { errors: { slug: 'That link is already taken. Try another.' }, values: raw }
    if (error.code === '42501') redirect('/sign-in?next=/onboarding')
    return { message: 'We couldn’t create your business. Try again in a moment.', values: raw }
  }
  redirect('/app')
}
