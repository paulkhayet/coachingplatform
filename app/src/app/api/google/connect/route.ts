import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireWorkspace } from '@/lib/workspace'
import { OAUTH_COOKIE, googleAuthUrl } from '@/lib/google/scopes'
import { calendarAllowed, googleClientId, googleRedirectUri, isGoogleCalendarConfigured } from '@/lib/google/server'
import { INTEGRATIONS_PATH } from '@/lib/settings-paths'

/** Starts connecting the signed-in person's own Google Calendar (used by all their businesses). */
export async function GET() {
  const { user } = await requireWorkspace()
  if (!isGoogleCalendarConfigured) redirect(`${INTEGRATIONS_PATH}?calendar=not_configured`)
  if (!calendarAllowed(user.email)) redirect(`${INTEGRATIONS_PATH}?calendar=not_available`)

  // One-time values tying Google's reply to this browser and this person (state + PKCE).
  const state = randomBytes(24).toString('base64url')
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  ;(await cookies()).set(OAUTH_COOKIE, JSON.stringify({ state, verifier, userId: user.id }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/google',
    maxAge: 600,
  })
  redirect(googleAuthUrl({ clientId: googleClientId, redirectUri: googleRedirectUri, state, codeChallenge: challenge, loginHint: user.email }))
}
