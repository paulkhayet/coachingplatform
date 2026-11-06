import { timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireWorkspace } from '@/lib/workspace'
import { OAUTH_COOKIE, idTokenClaims, missingCalendarScopes } from '@/lib/google/scopes'
import { calendarAllowed, exchangeCode, isGoogleCalendarConfigured, revokeToken, saveConnection } from '@/lib/google/server'

const AVAILABILITY = '/app/availability'

function sameString(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Google sends the coach back here after the consent screen. */
export async function GET(request: Request) {
  const { user, membership, business } = await requireWorkspace()
  const params = new URL(request.url).searchParams
  const jar = await cookies()
  const raw = jar.get(OAUTH_COOKIE)?.value
  jar.delete({ name: OAUTH_COOKIE, path: '/api/google' })

  if (params.get('error')) redirect(`${AVAILABILITY}?calendar=denied`)
  if (!isGoogleCalendarConfigured || !calendarAllowed(user.email)) redirect(`${AVAILABILITY}?calendar=not_available`)

  let saved: { state: string; verifier: string; membershipId: string } | null = null
  try {
    saved = raw ? JSON.parse(raw) : null
  } catch {
    saved = null
  }
  const code = params.get('code')
  const state = params.get('state') ?? ''
  // The reply must match the request this browser started, for this person's membership.
  if (!saved || !code || !sameString(state, saved.state) || saved.membershipId !== membership.id) redirect(`${AVAILABILITY}?calendar=expired`)

  let outcome = 'connected'
  try {
    const tokens = await exchangeCode(code, saved.verifier)
    if (missingCalendarScopes(tokens.scope).length > 0) {
      // Google lets people untick permissions; without all three the connection can't do its job.
      await revokeToken(tokens.refresh_token ?? tokens.access_token)
      outcome = 'missing_scopes'
    } else if (!tokens.refresh_token || !tokens.id_token) {
      outcome = 'error'
    } else {
      const claims = idTokenClaims(tokens.id_token)
      await saveConnection({
        membershipId: membership.id,
        businessId: business.id,
        googleEmail: claims.email,
        googleSub: claims.sub,
        scopes: tokens.scope.split(' '),
        refreshToken: tokens.refresh_token,
        // Start simple: busy times from, and bookings into, the coach's main calendar. They can change both.
        busyCalendarIds: ['primary'],
        destinationCalendarId: 'primary',
      })
    }
  } catch (error) {
    console.error('Google Calendar connection failed', error)
    outcome = 'error'
  }
  redirect(`${AVAILABILITY}?calendar=${outcome}`)
}
