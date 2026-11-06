import { describe, expect, it } from 'vitest'
import { authCallbackUrl, businessSchema, emailLinkSchema, safeNext, signUpSchema, slugify, SLUG_PATTERN } from './validation'
import { canManageTeam, canSeePricing } from './roles'

describe('slugify', () => {
  it('makes a link the database accepts', () => {
    for (const name of ['Willow Coaching', 'Café & Study — Co.', '  Spaces  ', 'A'.repeat(90), 'Élan 2026 Tutors!!']) {
      const s = slugify(name)
      if (s.length >= 3) expect(s).toMatch(SLUG_PATTERN)
    }
    expect(slugify('Willow Coaching')).toBe('willow-coaching')
    expect(slugify('Café & Study — Co.')).toBe('cafe-and-study-co')
    expect(slugify('A'.repeat(90))).toHaveLength(50)
  })
})

describe('businessSchema', () => {
  it('accepts a valid business', () => {
    expect(businessSchema.safeParse({ name: 'Willow Coaching', slug: 'willow-coaching', timezone: 'America/Chicago' }).success).toBe(true)
  })
  it('rejects bad links and unknown time zones', () => {
    expect(businessSchema.safeParse({ name: 'Willow', slug: '-bad-', timezone: 'America/Chicago' }).success).toBe(false)
    expect(businessSchema.safeParse({ name: 'Willow', slug: 'ok-link', timezone: 'Europe/Paris' }).success).toBe(false)
  })
})

describe('signUpSchema', () => {
  it('requires a real email and an 8+ character password', () => {
    expect(signUpSchema.safeParse({ fullName: 'Eleni Morgan', email: 'eleni@example.com', password: 'longenough' }).success).toBe(true)
    expect(signUpSchema.safeParse({ fullName: 'Eleni Morgan', email: 'not-an-email', password: 'longenough' }).success).toBe(false)
    expect(signUpSchema.safeParse({ fullName: 'Eleni Morgan', email: 'eleni@example.com', password: 'short' }).success).toBe(false)
  })
})

describe('safeNext', () => {
  it('only allows redirects inside the app', () => {
    expect(safeNext('/app/team')).toBe('/app/team')
    expect(safeNext('https://evil.example')).toBe('/app')
    expect(safeNext('//evil.example')).toBe('/app')
    expect(safeNext(null)).toBe('/app')
    expect(safeNext('/\\evil.example')).toBe('/app')
  })
})

describe('authCallbackUrl', () => {
  it('builds the /auth/confirm link with a safe next path', () => {
    expect(authCallbackUrl('http://localhost:3100', '/onboarding')).toBe('http://localhost:3100/auth/confirm?next=%2Fonboarding')
    expect(authCallbackUrl('http://localhost:3100', '/app/team', 'google')).toBe('http://localhost:3100/auth/confirm?next=%2Fapp%2Fteam&via=google')
    expect(authCallbackUrl('http://localhost:3100', 'https://evil.example')).toBe('http://localhost:3100/auth/confirm?next=%2Fapp')
  })
})

describe('emailLinkSchema', () => {
  it('normalizes the email', () => {
    expect(emailLinkSchema.parse({ email: '  Eleni@Example.com ' }).email).toBe('eleni@example.com')
    expect(emailLinkSchema.safeParse({ email: 'nope' }).success).toBe(false)
  })
})

describe('roles', () => {
  it('matches the confirmed permission defaults', () => {
    expect(canManageTeam('owner')).toBe(true)
    expect(canManageTeam('admin')).toBe(false)
    expect(canSeePricing('admin')).toBe(true)
    expect(canSeePricing('coach')).toBe(false)
  })
})
