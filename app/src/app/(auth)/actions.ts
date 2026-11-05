'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { siteUrl } from '@/lib/env'
import { fieldErrors, safeNext, signInSchema, signUpSchema, type FieldErrors } from '@/lib/validation'

export interface FormState {
  errors?: FieldErrors
  message?: string
  values?: Record<string, string>
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: String(formData.get('email') ?? ''), password: String(formData.get('password') ?? '') }
  const parsed = signInSchema.safeParse(raw)
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { email: raw.email } }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    if (error.name === 'AuthRetryableFetchError') return { message: 'We couldn’t reach the sign-in service. Try again in a moment.', values: { email: raw.email } }
    const message = error.code === 'email_not_confirmed' ? 'Confirm your email first. Check your inbox for the link.' : 'That email and password don’t match.'
    return { message, values: { email: raw.email } }
  }
  redirect(safeNext(String(formData.get('next') ?? '')))
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { fullName: String(formData.get('fullName') ?? ''), email: String(formData.get('email') ?? ''), password: String(formData.get('password') ?? '') }
  const parsed = signUpSchema.safeParse(raw)
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { fullName: raw.fullName, email: raw.email } }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName }, emailRedirectTo: `${siteUrl}/auth/confirm?next=/onboarding` },
  })
  if (error) {
    const message = error.code === 'user_already_exists' ? 'An account with that email already exists. Sign in instead.' : error.code === 'weak_password' ? 'Choose a stronger password.' : 'We couldn’t create your account. Try again in a moment.'
    return { message, values: { fullName: raw.fullName, email: raw.email } }
  }
  // With email confirmation on (recommended), there is no session until the link is clicked.
  if (!data.session) redirect(`/check-email?email=${encodeURIComponent(parsed.data.email)}`)
  redirect('/onboarding')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/sign-in')
}
