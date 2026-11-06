import { z } from 'zod'

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/

/** Turns a business name into a URL-safe link, matching the database check constraint. */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '')
}

export const US_TIME_ZONES = [
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Phoenix', label: 'Arizona (no daylight saving)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
] as const

// Trim before checking, so a pasted address with a stray space still works.
const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'))

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
})

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(80, 'Keep your name under 80 characters'),
  email,
  password: z.string().min(8, 'Use at least 8 characters').max(72, 'Use 72 characters or fewer'),
})

export const businessSchema = z.object({
  name: z.string().trim().min(2, 'Enter your business name').max(80, 'Keep the name under 80 characters'),
  slug: z.string().trim().toLowerCase().regex(SLUG_PATTERN, 'Use 3–50 lowercase letters, numbers or dashes, starting and ending with a letter or number'),
  timezone: z.enum(US_TIME_ZONES.map((t) => t.value) as [string, ...string[]], 'Choose a time zone'),
})

export type FieldErrors = Partial<Record<string, string>>

/** First error message per field, for showing next to inputs. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] ??= issue.message
  }
  return out
}

/** Only allow redirects to paths inside this app. Browsers treat `/\host` like `//host`, so backslashes are rejected too. */
export function safeNext(next: string | null | undefined, fallback = '/app') {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : fallback
}

export const emailLinkSchema = z.object({ email })

/** Where Supabase sends people back after Google sign-in or an email link. `via` lets /auth/confirm explain failures. */
export function authCallbackUrl(siteUrl: string, next: string | null | undefined, via?: 'google') {
  const params = new URLSearchParams({ next: safeNext(next) })
  if (via) params.set('via', via)
  return `${siteUrl}/auth/confirm?${params}`
}
