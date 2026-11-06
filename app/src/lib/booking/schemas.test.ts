import { describe, expect, it } from 'vitest'
import { bookingPageSchema, groupByDay, guestBookingSchema, pageSlugify } from './schemas'

const page = {
  title: 'Free intro call',
  slug: 'intro-call',
  description: '',
  durationMinutes: '30',
  locationType: 'video_link',
  locationDetail: 'https://zoom.us/j/123',
  minNoticeMinutes: '240',
  windowDays: '30',
  bufferBeforeMinutes: '0',
  bufferAfterMinutes: '15',
  active: true,
}

describe('booking page validation', () => {
  it('accepts a sensible page and turns numbers from the form into numbers', () => {
    const parsed = bookingPageSchema.parse(page)
    expect(parsed.durationMinutes).toBe(30)
    expect(parsed.bufferAfterMinutes).toBe(15)
  })

  it('rejects bad links, lengths and buffers', () => {
    expect(bookingPageSchema.safeParse({ ...page, slug: 'Intro Call!' }).success).toBe(false)
    expect(bookingPageSchema.safeParse({ ...page, durationMinutes: '2' }).success).toBe(false)
    expect(bookingPageSchema.safeParse({ ...page, bufferBeforeMinutes: '-5' }).success).toBe(false)
    expect(bookingPageSchema.safeParse({ ...page, durationMinutes: '30.5' }).success).toBe(false)
  })

  it('makes a link from the name', () => {
    expect(pageSlugify('Free Intro Call — 30 min!')).toBe('free-intro-call-30-min')
  })
})

describe('guest booking validation', () => {
  const guest = { start: '2026-11-09T17:00:00.000Z', name: ' Jo ', email: ' Jo@Example.com ', notes: '', timezone: 'America/Chicago', website: '' }

  it('cleans up name and email', () => {
    expect(guestBookingSchema.parse(guest)).toMatchObject({ name: 'Jo', email: 'jo@example.com' })
  })

  it('rejects a filled-in honeypot and a missing time', () => {
    expect(guestBookingSchema.safeParse({ ...guest, website: 'http://spam' }).success).toBe(false)
    expect(guestBookingSchema.safeParse({ ...guest, start: 'tomorrow' }).success).toBe(false)
  })
})

describe('groupByDay', () => {
  it('groups start times by the guest’s calendar day', () => {
    // 23:30 UTC on the 9th is still the 9th in New York but the 10th in Berlin.
    const starts = ['2026-11-09T15:00:00.000Z', '2026-11-09T23:30:00.000Z']
    expect([...groupByDay(starts, 'America/New_York').keys()]).toEqual(['2026-11-09'])
    expect([...groupByDay(starts, 'Europe/Berlin').keys()]).toEqual(['2026-11-09', '2026-11-10'])
  })
})
