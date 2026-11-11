import { timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireWorkspace } from '@/lib/workspace'
import { ZOOM_OAUTH_COOKIE, exchangeZoomCode, isZoomConfigured, saveZoomConnection, zoomMe } from '@/lib/zoom/server'

const AVAILABILITY = '/app/availability'

function sameString(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Zoom sends the coach back here after they approve the app. */
export async function GET(request: Request) {
  const { user } = await requireWorkspace()
  const params = new URL(request.url).searchParams
  const jar = await cookies()
  const raw = jar.get(ZOOM_OAUTH_COOKIE)?.value
  jar.delete({ name: ZOOM_OAUTH_COOKIE, path: '/api/zoom' })

  if (params.get('error')) redirect(`${AVAILABILITY}?zoom=denied`)
  if (!isZoomConfigured) redirect(`${AVAILABILITY}?zoom=not_configured`)
  let saved: { state: string; verifier: string; userId: string } | null = null
  try {
    saved = raw ? JSON.parse(raw) : null
  } catch {
    saved = null
  }
  const code = params.get('code')
  const state = params.get('state') ?? ''
  // The reply must match the request this browser started, for this same person.
  if (!saved || !code || !sameString(state, saved.state) || saved.userId !== user.id) redirect(`${AVAILABILITY}?zoom=expired`)

  let outcome = 'connected'
  try {
    const tokens = await exchangeZoomCode(code, saved.verifier)
    const me = await zoomMe(tokens.access_token)
    await saveZoomConnection({ userId: user.id, zoomUserId: me.id, zoomEmail: me.email, tokens })
  } catch (error) {
    console.error('Zoom connection failed', error)
    outcome = 'error'
  }
  redirect(`${AVAILABILITY}?zoom=${outcome}`)
}
