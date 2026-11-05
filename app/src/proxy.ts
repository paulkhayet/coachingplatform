import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { isSupabaseConfigured } from '@/lib/env'

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next()
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)'],
}
