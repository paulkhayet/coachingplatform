import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/validation'

/** Handles Supabase email links: confirmation, magic link, recovery (token_hash) and the PKCE code flow. */
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

  return NextResponse.redirect(new URL(ok ? next : '/sign-in?error=link', origin))
}
