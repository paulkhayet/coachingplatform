import { describe, expect, it } from 'vitest'
import { CALENDAR_SCOPES, calendarAllowedFor, googleAuthUrl, idTokenClaims, missingCalendarScopes } from './scopes'

describe('google scopes', () => {
  it('spots calendar permissions the person unticked', () => {
    expect(missingCalendarScopes(`openid email ${CALENDAR_SCOPES.freebusy} ${CALENDAR_SCOPES.calendarList} ${CALENDAR_SCOPES.ownedEvents}`)).toEqual([])
    expect(missingCalendarScopes(['openid', CALENDAR_SCOPES.freebusy])).toEqual([CALENDAR_SCOPES.calendarList, CALENDAR_SCOPES.ownedEvents])
  })

  it('builds a consent URL that asks for offline access with PKCE and only our scopes', () => {
    const url = new URL(googleAuthUrl({ clientId: 'cid', redirectUri: 'http://localhost:3100/api/google/callback', state: 's', codeChallenge: 'c', loginHint: 'a@b.com' }))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('scope')!.split(' ')).toEqual(['openid', 'email', CALENDAR_SCOPES.freebusy, CALENDAR_SCOPES.calendarList, CALENDAR_SCOPES.ownedEvents])
    expect(url.searchParams.get('login_hint')).toBe('a@b.com')
  })

  it('reads the ID token claims', () => {
    const token = ['x', Buffer.from(JSON.stringify({ sub: '123', email: 'coach@example.com' })).toString('base64url'), 'sig'].join('.')
    expect(idTokenClaims(token)).toMatchObject({ sub: '123', email: 'coach@example.com' })
    expect(() => idTokenClaims('nope')).toThrow()
  })

  it('limits calendar connections to testers until Google verifies the app', () => {
    expect(calendarAllowedFor('Coach@Example.com', { testers: 'coach@example.com, other@example.com' })).toBe(true)
    expect(calendarAllowedFor('someone@example.com', { testers: 'coach@example.com' })).toBe(false)
    expect(calendarAllowedFor('someone@example.com', { open: 'true' })).toBe(true)
    expect(calendarAllowedFor('someone@example.com', {})).toBe(false)
  })
})
