import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { isSupabaseConfigured } from '@/lib/env'

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next()
  return updateSession(request)
}

export const config = {
  // api/stripe: webhooks carry no session, so skip the session refresh.
  matcher: ['/((?!_next/static|_next/image|favicon.svg|fonts/|api/stripe/|api/cron/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)'],
}
