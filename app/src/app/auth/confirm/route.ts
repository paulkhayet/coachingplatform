import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/validation'

/** Handles Supabase email links (confirmation, sign-in link, recovery: token_hash or PKCE code) and Google sign-in (code). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = safeNext(searchParams.get('next'))
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const supabase = await createClient()

  let ok = false
  if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error
  else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error

  // Google failures (cancelled, provider error) come back with ?error=… and no code.
  const failure = searchParams.get('via') === 'google' ? 'oauth' : 'link'
  return NextResponse.redirect(new URL(ok ? next : `/sign-in?error=${failure}`, origin))
}
