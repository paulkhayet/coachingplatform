import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireWorkspace } from '@/lib/workspace'
import { OAUTH_COOKIE, googleAuthUrl } from '@/lib/google/scopes'
import { calendarAllowed, googleClientId, googleRedirectUri, isGoogleCalendarConfigured } from '@/lib/google/server'

const AVAILABILITY = '/app/availability'

/** Starts connecting the signed-in coach's own Google Calendar. */
export async function GET() {
  const { user, membership } = await requireWorkspace()
  if (!isGoogleCalendarConfigured) redirect(`${AVAILABILITY}?calendar=not_configured`)
  if (!calendarAllowed(user.email)) redirect(`${AVAILABILITY}?calendar=not_available`)

  // One-time values tying Google's reply to this browser and this membership (state + PKCE).
  const state = randomBytes(24).toString('base64url')
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  ;(await cookies()).set(OAUTH_COOKIE, JSON.stringify({ state, verifier, membershipId: membership.id }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/google',
    maxAge: 600,
  })
  redirect(googleAuthUrl({ clientId: googleClientId, redirectUri: googleRedirectUri, state, codeChallenge: challenge, loginHint: user.email }))
}
