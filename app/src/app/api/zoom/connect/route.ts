import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireWorkspace } from '@/lib/workspace'
import { ZOOM_OAUTH_COOKIE, isZoomConfigured, zoomAuthUrl } from '@/lib/zoom/server'
import { INTEGRATIONS_PATH } from '@/lib/settings-paths'

/** Starts connecting the signed-in person's own Zoom account (used by all their businesses). */
export async function GET() {
  const { user } = await requireWorkspace()
  if (!isZoomConfigured) redirect(`${INTEGRATIONS_PATH}?zoom=not_configured`)
  // One-time values tying Zoom's reply to this browser and this person (state + PKCE).
  const state = randomBytes(24).toString('base64url')
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  ;(await cookies()).set(ZOOM_OAUTH_COOKIE, JSON.stringify({ state, verifier, userId: user.id }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/zoom',
    maxAge: 600,
  })
  redirect(zoomAuthUrl({ state, codeChallenge: challenge }))
}
