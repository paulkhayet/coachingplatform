import 'server-only'
import { eq, inArray, sql } from 'drizzle-orm'
import { adminDb } from '@/db/server'
import { memberships, profiles, zoomConnections, zoomTokens } from '@/db/schema'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { siteUrl } from '@/lib/env'

// Zoom meetings for bookings (D-038). Each coach connects their own Zoom account (a user-managed OAuth app),
// and the connection serves every business they work with, like Google Calendar (D-057). Plain HTTPS calls.

const clientId = process.env.ZOOM_CLIENT_ID ?? ''
const clientSecret = process.env.ZOOM_CLIENT_SECRET ?? ''
// The same app-wide key that seals Google tokens; it never touches the database.
const encryptionKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? ''

export const isZoomConfigured = Boolean(clientId && clientSecret && encryptionKey)
export const zoomRedirectUri = `${siteUrl}/api/zoom/callback`
/** Short-lived cookie holding the OAuth state and PKCE verifier between /api/zoom/connect and /callback. */
export const ZOOM_OAUTH_COOKIE = 'zoom_oauth'

export function zoomAuthUrl(p: { state: string; codeChallenge: string }) {
  const params = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: zoomRedirectUri, state: p.state, code_challenge: p.codeChallenge, code_challenge_method: 'S256' })
  return `https://zoom.us/oauth/authorize?${params}`
}

/** Zoom said our access is gone (revoked, expired after 90 days unused, app removed). */
export class ZoomReconnectNeeded extends Error {}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope?: string
}

const basicAuth = () => `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: { authorization: basicAuth(), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string; reason?: string }
  if (!res.ok || !json.access_token || !json.refresh_token) {
    if (json.error === 'invalid_grant' || json.error === 'invalid_token' || res.status === 401) throw new ZoomReconnectNeeded(json.reason ?? json.error ?? 'invalid_grant')
    throw new Error(`Zoom token request failed: ${res.status} ${json.error ?? ''}`)
  }
  return json as TokenResponse
}

export function exchangeZoomCode(code: string, codeVerifier: string) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: zoomRedirectUri, code_verifier: codeVerifier })
}

/** The Zoom user behind a fresh access token (who connected). */
export async function zoomMe(accessToken: string): Promise<{ id: string; email: string }> {
  const res = await fetch('https://api.zoom.us/v2/users/me', { headers: { authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
  if (!res.ok) throw new Error(`Zoom users/me failed: ${res.status}`)
  const me = (await res.json()) as { id: string; email: string }
  return { id: me.id, email: me.email }
}

async function revoke(token: string) {
  await fetch(`https://zoom.us/oauth/revoke?${new URLSearchParams({ token })}`, { method: 'POST', headers: { authorization: basicAuth() } }).catch(() => undefined)
}

// ── Stored connections ───────────────────────────────────────────────────────────────────────────────

export async function saveZoomConnection(input: { userId: string; zoomUserId: string; zoomEmail: string; tokens: TokenResponse }) {
  const fields = { zoomUserId: input.zoomUserId, zoomEmail: input.zoomEmail, status: 'active', lastError: null, updatedAt: sql`now()` }
  const sealed = sealTokens(input.tokens)
  await adminDb().transaction(async (tx) => {
    await tx.insert(zoomConnections).values({ userId: input.userId, ...fields }).onConflictDoUpdate({ target: zoomConnections.userId, set: fields })
    await tx.insert(zoomTokens).values({ userId: input.userId, ...sealed }).onConflictDoUpdate({ target: zoomTokens.userId, set: sealed })
  })
}

function sealTokens(t: TokenResponse) {
  return {
    refreshTokenCiphertext: encryptSecret(t.refresh_token, encryptionKey),
    accessTokenCiphertext: encryptSecret(t.access_token, encryptionKey),
    accessExpiresAt: new Date(Date.now() + t.expires_in * 1000),
    updatedAt: new Date(),
  }
}

export async function getZoomConnection(userId: string) {
  const [row] = await adminDb().select().from(zoomConnections).where(eq(zoomConnections.userId, userId)).limit(1)
  return row
}

/** Forget the connection and revoke our access at Zoom. Meetings already created stay on their Zoom account. */
export async function disconnectZoom(userId: string) {
  const [token] = await adminDb().select().from(zoomTokens).where(eq(zoomTokens.userId, userId)).limit(1)
  if (token) {
    try {
      await revoke(decryptSecret(token.refreshTokenCiphertext, encryptionKey))
    } catch {
      // Revoking is a courtesy; deleting our copy is what matters.
    }
  }
  await adminDb().delete(zoomConnections).where(eq(zoomConnections.userId, userId))
}

async function markNeedsReconnect(userId: string, reason: string) {
  await adminDb().update(zoomConnections).set({ status: 'needs_reconnect', lastError: reason.slice(0, 300), updatedAt: sql`now()` }).where(eq(zoomConnections.userId, userId))
}

/**
 * A working access token for the coach. Zoom issues a new refresh token on every refresh and the old one
 * stops working, so the refresh happens under a row lock: two requests at once can't both use the old one.
 */
async function accessTokenFor(userId: string): Promise<string> {
  try {
    return await adminDb().transaction(async (tx) => {
      const [row] = await tx.select().from(zoomTokens).where(eq(zoomTokens.userId, userId)).for('update')
      if (!row) throw new ZoomReconnectNeeded('No stored token')
      if (row.accessTokenCiphertext && row.accessExpiresAt && row.accessExpiresAt.getTime() > Date.now() + 60_000) return decryptSecret(row.accessTokenCiphertext, encryptionKey)
      const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decryptSecret(row.refreshTokenCiphertext, encryptionKey) })
      await tx.update(zoomTokens).set(sealTokens(t)).where(eq(zoomTokens.userId, userId))
      return t.access_token
    })
  } catch (error) {
    if (error instanceof ZoomReconnectNeeded) await markNeedsReconnect(userId, 'Zoom access was removed or expired. Reconnect Zoom to keep creating meeting links.')
    throw error
  }
}

async function zoomApi<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessTokenFor(userId)
  const res = await fetch(`https://api.zoom.us/v2${path}`, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init.headers }, cache: 'no-store' })
  if (res.status === 401) {
    await markNeedsReconnect(userId, 'Zoom rejected our access. Reconnect Zoom to keep creating meeting links.')
    throw new ZoomReconnectNeeded('401 from Zoom')
  }
  if (res.status === 404 && init.method === 'DELETE') return undefined as T
  if (!res.ok) throw new Error(`Zoom ${init.method ?? 'GET'} ${path.split('?')[0]} failed: ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`)
  return (res.status === 204 ? undefined : await res.json()) as T
}

/** Which of these memberships' people can't get Zoom links right now (not connected, or needs reconnecting). */
export async function withoutZoom(membershipIds: string[]): Promise<string[]> {
  if (membershipIds.length === 0) return []
  const rows = await adminDb()
    .select({ name: profiles.fullName, email: profiles.email, status: zoomConnections.status })
    .from(memberships)
    .leftJoin(profiles, eq(profiles.id, memberships.userId))
    .leftJoin(zoomConnections, eq(zoomConnections.userId, memberships.userId))
    .where(inArray(memberships.id, membershipIds))
  return rows.filter((r) => r.status !== 'active').map((r) => r.name ?? r.email ?? 'A coach')
}

// ── Meetings ─────────────────────────────────────────────────────────────────────────────────────────

export interface MeetingInput {
  topic: string
  start: Date
  durationMinutes: number
  timeZone: string
  agenda?: string
}

const meetingBody = (m: MeetingInput) => ({
  topic: m.topic.slice(0, 200),
  type: 2, // a scheduled meeting
  start_time: m.start.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  duration: m.durationMinutes,
  timezone: m.timeZone,
  agenda: m.agenda?.slice(0, 2000),
})

/** Creates a meeting on the coach's Zoom account. Returns its id and the link guests join with. */
export async function createZoomMeeting(userId: string, m: MeetingInput): Promise<{ id: string; joinUrl: string }> {
  const created = await zoomApi<{ id: number | string; join_url: string }>(userId, '/users/me/meetings', {
    method: 'POST',
    body: JSON.stringify({ ...meetingBody(m), settings: { join_before_host: false, waiting_room: true } }),
  })
  return { id: String(created.id), joinUrl: created.join_url }
}

export async function updateZoomMeeting(userId: string, meetingId: string, m: MeetingInput) {
  await zoomApi(userId, `/meetings/${encodeURIComponent(meetingId)}`, { method: 'PATCH', body: JSON.stringify(meetingBody(m)) })
}

/** Deletes the meeting (already gone is fine). */
export async function deleteZoomMeeting(userId: string, meetingId: string) {
  await zoomApi(userId, `/meetings/${encodeURIComponent(meetingId)}`, { method: 'DELETE' })
}
