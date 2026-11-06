import { z } from 'zod'

// Validation for booking pages and guest bookings. Mirrors the database checks in 0006_booking_pages.

export const PAGE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/

export const LOCATION_TYPES = [
  { value: 'video_link', label: 'Video call link' },
  { value: 'phone', label: 'Phone call' },
  { value: 'in_person', label: 'In person' },
] as const

const minutes = (min: number, max: number, label: string) => z.coerce.number().int(`${label} must be whole minutes`).min(min, `${label} must be at least ${min}`).max(max, `${label} can be at most ${max}`)

export const bookingPageSchema = z.object({
  title: z.string().trim().min(2, 'Give the page a name').max(80, 'Keep the name under 80 characters'),
  slug: z.string().trim().toLowerCase().regex(PAGE_SLUG_PATTERN, 'Use lowercase letters, numbers and dashes, starting and ending with a letter or number'),
  description: z.string().trim().max(1000, 'Keep the description under 1,000 characters'),
  durationMinutes: minutes(5, 480, 'Length'),
  locationType: z.enum(['video_link', 'phone', 'in_person'], 'Choose where the call happens'),
  locationDetail: z.string().trim().max(500, 'Keep the location under 500 characters'),
  minNoticeMinutes: minutes(0, 43200, 'Minimum notice'),
  windowDays: minutes(1, 365, 'Booking window'),
  bufferBeforeMinutes: minutes(0, 240, 'Buffer before'),
  bufferAfterMinutes: minutes(0, 240, 'Buffer after'),
  active: z.boolean(),
})

export type BookingPageInput = z.infer<typeof bookingPageSchema>

export const guestBookingSchema = z.object({
  start: z.iso.datetime({ offset: true, error: 'Choose a time' }),
  name: z.string().trim().min(1, 'Enter your name').max(120, 'Keep your name under 120 characters'),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  notes: z.string().trim().max(2000, 'Keep your note under 2,000 characters'),
  timezone: z.string().trim().max(64),
  // A field people never see. Bots that fill in every input get caught by it.
  website: z.string().max(0, 'Something went wrong'),
})

export type GuestBookingInput = z.infer<typeof guestBookingSchema>

/** "Free intro call" → "free-intro-call", within the page slug rules. */
export function pageSlugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '')
}

/** Groups ISO start times by calendar day in a time zone, keeping order. */
export function groupByDay(starts: string[], timeZone: string) {
  const key = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const days = new Map<string, string[]>()
  for (const s of starts) {
    const k = key.format(new Date(s))
    days.set(k, [...(days.get(k) ?? []), s])
  }
  return days
}
