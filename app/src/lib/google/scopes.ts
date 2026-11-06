// Google Calendar permissions (D-039). Kept to the minimum Google approved on the Data Access page:
// busy times only, the list of calendars, and events on calendars the coach owns.

export const CALENDAR_SCOPES = {
  freebusy: 'https://www.googleapis.com/auth/calendar.freebusy',
  calendarList: 'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  ownedEvents: 'https://www.googleapis.com/auth/calendar.events.owned',
} as const

/** Short-lived cookie holding the OAuth state and PKCE verifier between /api/google/connect and /callback. */
export const OAUTH_COOKIE = 'gcal_oauth'

export const REQUESTED_SCOPES = ['openid', 'email', CALENDAR_SCOPES.freebusy, CALENDAR_SCOPES.calendarList, CALENDAR_SCOPES.ownedEvents]

/** Google lets people untick individual permissions. Returns the calendar ones they didn't grant. */
export function missingCalendarScopes(granted: string | string[]): string[] {
  const set = new Set(Array.isArray(granted) ? granted : granted.split(/\s+/).filter(Boolean))
  return Object.values(CALENDAR_SCOPES).filter((s) => !set.has(s))
}

export interface AuthUrlParams {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  loginHint?: string
}

/** Google's consent screen. offline + consent so we always get a refresh token. */
export function googleAuthUrl(p: AuthUrlParams) {
  const params = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: REQUESTED_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
    state: p.state,
    code_challenge: p.codeChallenge,
    code_challenge_method: 'S256',
  })
  if (p.loginHint) params.set('login_hint', p.loginHint)
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/**
 * Reads the claims from an ID token we just received from Google's token endpoint over TLS. Per OpenID
 * Connect, a token obtained directly from the token endpoint can be trusted without re-checking its
 * signature. Never use this for tokens that arrive from a browser.
 */
export function idTokenClaims(idToken: string): { sub: string; email: string; email_verified?: boolean } {
  const payload = idToken.split('.')[1]
  if (!payload) throw new Error('Malformed ID token')
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') throw new Error('ID token is missing sub or email')
  return claims
}

/** Whether this person may connect Google Calendar yet. Until Google verifies the app, only listed testers. */
export function calendarAllowedFor(email: string, env: { open?: string; testers?: string }) {
  if (env.open === 'true') return true
  const testers = (env.testers ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return testers.includes(email.trim().toLowerCase())
}
