import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { adminDb } from '@/db/server'
import { googleCalendarConnections, googleCalendarTokens } from '@/db/schema'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { siteUrl } from '@/lib/env'
import { calendarAllowedFor } from './scopes'

// Server-side Google Calendar access for connected coaches. Plain HTTPS calls to Google's REST APIs.

const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ''
const encryptionKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? ''

export const isGoogleCalendarConfigured = Boolean(clientId && clientSecret && encryptionKey)
export const googleClientId = clientId
export const googleRedirectUri = `${siteUrl}/api/google/callback`

export function calendarAllowed(email: string) {
  return calendarAllowedFor(email, { open: process.env.GOOGLE_CALENDAR_OPEN, testers: process.env.GOOGLE_CALENDAR_TESTERS })
}

/** Google said the refresh token is no good (revoked, expired, password changed). */
export class GoogleReconnectNeeded extends Error {}

interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  id_token?: string
  error?: string
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { error_description?: string }
  if (!res.ok) {
    if (json.error === 'invalid_grant') throw new GoogleReconnectNeeded(json.error_description ?? 'invalid_grant')
    throw new Error(`Google token request failed: ${res.status} ${json.error ?? ''}`)
  }
  return json
}

export function exchangeCode(code: string, codeVerifier: string) {
  return tokenRequest({ grant_type: 'authorization_code', code, code_verifier: codeVerifier, redirect_uri: googleRedirectUri })
}

/** Revoke our access at Google (best effort; the coach can also do it in their Google account). */
export async function revokeToken(token: string) {
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined)
}

// ── Stored connections ───────────────────────────────────────────────────────────────────────────────

export async function saveConnection(input: {
  membershipId: string
  businessId: string
  googleEmail: string
  googleSub: string
  scopes: string[]
  refreshToken: string
  busyCalendarIds: string[]
  destinationCalendarId: string | null
}) {
  const sealed = encryptSecret(input.refreshToken, encryptionKey)
  const fields = {
    businessId: input.businessId,
    googleEmail: input.googleEmail,
    googleSub: input.googleSub,
    scopes: input.scopes,
    busyCalendarIds: input.busyCalendarIds,
    destinationCalendarId: input.destinationCalendarId,
    status: 'active',
    lastError: null,
    updatedAt: sql`now()`,
  }
  await adminDb().transaction(async (tx) => {
    await tx.insert(googleCalendarConnections).values({ membershipId: input.membershipId, ...fields }).onConflictDoUpdate({ target: googleCalendarConnections.membershipId, set: fields })
    await tx
      .insert(googleCalendarTokens)
      .values({ membershipId: input.membershipId, refreshTokenCiphertext: sealed })
      .onConflictDoUpdate({ target: googleCalendarTokens.membershipId, set: { refreshTokenCiphertext: sealed, updatedAt: sql`now()` } })
  })
  accessTokens.delete(input.membershipId)
}

export async function getConnection(membershipId: string) {
  const [row] = await adminDb().select().from(googleCalendarConnections).where(eq(googleCalendarConnections.membershipId, membershipId)).limit(1)
  return row
}

/** Like getConnection, but a database failure is reported instead of breaking the page. */
export async function lookupConnection(membershipId: string): Promise<{ connection?: Awaited<ReturnType<typeof getConnection>>; failed: boolean }> {
  try {
    return { connection: await getConnection(membershipId), failed: false }
  } catch (error) {
    console.error('Looking up the Google Calendar connection failed', error)
    return { failed: true }
  }
}

export async function updateCalendarChoices(membershipId: string, busyCalendarIds: string[], destinationCalendarId: string | null) {
  await adminDb().update(googleCalendarConnections).set({ busyCalendarIds, destinationCalendarId, updatedAt: sql`now()` }).where(eq(googleCalendarConnections.membershipId, membershipId))
}

/** Forget the connection and revoke our access at Google. */
export async function disconnect(membershipId: string) {
  const [token] = await adminDb().select().from(googleCalendarTokens).where(eq(googleCalendarTokens.membershipId, membershipId)).limit(1)
  if (token) {
    try {
      await revokeToken(decryptSecret(token.refreshTokenCiphertext, encryptionKey))
    } catch {
      // Revoking is a courtesy; deleting our copy is what matters.
    }
  }
  await adminDb().delete(googleCalendarConnections).where(eq(googleCalendarConnections.membershipId, membershipId))
  accessTokens.delete(membershipId)
}

async function markNeedsReconnect(membershipId: string, reason: string) {
  await adminDb().update(googleCalendarConnections).set({ status: 'needs_reconnect', lastError: reason.slice(0, 300), updatedAt: sql`now()` }).where(eq(googleCalendarConnections.membershipId, membershipId))
}

// Access tokens last an hour; keep them in memory for the life of this server instance.
const accessTokens = new Map<string, { token: string; expiresAt: number }>()

async function accessTokenFor(membershipId: string): Promise<string> {
  const cached = accessTokens.get(membershipId)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const [row] = await adminDb().select().from(googleCalendarTokens).where(eq(googleCalendarTokens.membershipId, membershipId)).limit(1)
  if (!row) throw new GoogleReconnectNeeded('No stored token')
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decryptSecret(row.refreshTokenCiphertext, encryptionKey) })
    accessTokens.set(membershipId, { token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 })
    return t.access_token
  } catch (error) {
    if (error instanceof GoogleReconnectNeeded) await markNeedsReconnect(membershipId, 'Google access was revoked or expired. Reconnect to keep syncing.')
    throw error
  }
}

/** Calls a Google Calendar API endpoint as the coach. */
export async function calendarApi<T>(membershipId: string, path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessTokenFor(membershipId)
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init.headers },
    cache: 'no-store',
  })
  if (res.status === 401) {
    accessTokens.delete(membershipId)
    await markNeedsReconnect(membershipId, 'Google rejected our access. Reconnect to keep syncing.')
    throw new GoogleReconnectNeeded('401 from Google Calendar')
  }
  if (!res.ok) throw new Error(`Google Calendar ${init.method ?? 'GET'} ${path.split('?')[0]} failed: ${res.status}`)
  return (res.status === 204 ? undefined : await res.json()) as T
}
