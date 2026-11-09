import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto'

// Booking rules that need no database: refunds, when guests can change a call, signed manage links,
// and money formatting. Pure so they can be unit tested.

/** What happens to a payment when a call is cancelled (D-056). */
export function refundOnCancel(opts: { paid: boolean; cancelledBy: 'guest' | 'business'; startsAt: Date; cutoffHours: number; now?: Date }): 'full' | 'none' | 'not_paid' {
  if (!opts.paid) return 'not_paid'
  if (opts.cancelledBy === 'business') return 'full'
  const hoursBefore = (opts.startsAt.getTime() - (opts.now ?? new Date()).getTime()) / 3600_000
  return hoursBefore >= opts.cutoffHours ? 'full' : 'none'
}

/** Guests can reschedule or cancel until the call starts. */
export function guestCanChange(startsAt: Date, now = new Date()) {
  return startsAt.getTime() > now.getTime()
}

// ── Manage links ─────────────────────────────────────────────────────────────────────────────────────
// A guest's link carries "<bookingId>.<signature>", where the signature is an HMAC of the booking ID
// with a server key. Nothing secret is stored per booking, any email can include a working link, and
// a link for one booking can't be turned into a link for another.

export function manageSignature(bookingId: string, key: Buffer) {
  return createHmac('sha256', key).update(`manage:${bookingId}`).digest('base64url')
}

export function manageToken(bookingId: string, key: Buffer) {
  return `${bookingId}.${manageSignature(bookingId, key)}`
}

/** The booking ID if the token is genuine, otherwise null. */
export function verifyManageToken(token: string, key: Buffer): string | null {
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(token)
  if (!m) return null
  const expected = Buffer.from(manageSignature(m[1], key))
  const given = Buffer.from(m[2])
  return expected.length === given.length && timingSafeEqual(expected, given) ? m[1] : null
}

/** A key for one purpose, derived from the server's master key (so one secret in the environment). */
export function deriveKey(masterBase64: string, purpose: string) {
  return Buffer.from(hkdfSync('sha256', Buffer.from(masterBase64, 'base64'), Buffer.alloc(0), `schedulefa.st ${purpose}`, 32))
}

// ── Money ────────────────────────────────────────────────────────────────────────────────────────────

export function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100)
}

/** "45", "45.5", "$45.00" → 4500 / 4550. Returns null for blank (free) and NaN for nonsense. */
export function parseDollars(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '')
  if (!cleaned) return null
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN
  return Math.round(Number(cleaned) * 100)
}

/**
 * D-061: the order to offer a shared page's call to its free coaches: fewest live calls from that page
 * first (`load`), ties broken at random so nobody is always first.
 */
export function fairestFirst(hosts: string[], load: Map<string, number>, random = Math.random): string[] {
  return hosts
    .map((h) => ({ h, n: load.get(h) ?? 0, r: random() }))
    .sort((a, b) => a.n - b.n || a.r - b.r)
    .map((x) => x.h)
}
