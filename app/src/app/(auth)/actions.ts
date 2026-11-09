'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { siteUrl } from '@/lib/env'
import { authCallbackUrl, emailLinkSchema, fieldErrors, safeNext, signInSchema, signUpSchema, type FieldErrors } from '@/lib/validation'

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
  // Usually onboarding; an invitation link sends people back to it instead (D-060).
  const next = safeNext(String(formData.get('next') ?? ''), '/onboarding')
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName }, emailRedirectTo: authCallbackUrl(siteUrl, next) },
  })
  if (error) {
    const message = error.code === 'user_already_exists' ? 'An account with that email already exists. Sign in instead.' : error.code === 'weak_password' ? 'Choose a stronger password.' : 'We couldn’t create your account. Try again in a moment.'
    return { message, values: { fullName: raw.fullName, email: raw.email } }
  }
  // With email confirmation on (recommended), there is no session until the link is clicked.
  if (!data.session) redirect(`/check-email?email=${encodeURIComponent(parsed.data.email)}`)
  redirect(next)
}

/** Starts Google sign-in. New and returning people both use this; /app sends anyone without a business to onboarding. */
export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authCallbackUrl(siteUrl, String(formData.get('next') ?? ''), 'google') },
  })
  if (error || !data.url) redirect('/sign-in?error=oauth')
  redirect(data.url)
}

/** Emails a one-time sign-in link to an existing account. Never says whether the account exists. */
export async function sendSignInLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: String(formData.get('email') ?? '') }
  const parsed = emailLinkSchema.safeParse(raw)
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    // Accounts are created on the sign-up page, so every account starts with a name.
    options: { shouldCreateUser: false, emailRedirectTo: authCallbackUrl(siteUrl, String(formData.get('next') ?? '')) },
  })
  if (error?.name === 'AuthRetryableFetchError') return { message: 'We couldn’t reach the sign-in service. Try again in a moment.', values: raw }
  if (error?.status === 429) return { message: 'Too many sign-in emails. Wait a minute, then try again.', values: raw }
  // Any other error (including "no account with that email") still shows the same confirmation.
  redirect(`/check-email?kind=sign-in&email=${encodeURIComponent(parsed.data.email)}`)
}

export async function signOut(formData?: FormData) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // An invitation page signs the wrong account out and comes straight back (D-060).
  const next = formData?.get('next')
  redirect(typeof next === 'string' && next ? safeNext(next) : '/sign-in')
}
