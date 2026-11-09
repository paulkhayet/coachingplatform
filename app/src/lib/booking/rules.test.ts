import { describe, expect, it } from 'vitest'
import type { BookingQuestion } from '@/db/schema'
import { parseQuestions, questionsSchema, readAnswers } from './questions'
import { deriveKey, fairestFirst, formatCents, guestCanChange, manageToken, parseDollars, refundOnCancel, verifyManageToken } from './policy'
import { guestCancelled, guestConfirmation, whenText } from './emails'

const q = (over: Partial<BookingQuestion>): BookingQuestion => ({ id: 'abc123', label: 'Goals?', type: 'short', options: [], required: false, ...over })

describe('booking questions', () => {
  it('requires choices for choice questions and rejects duplicates', () => {
    expect(questionsSchema.safeParse([q({ type: 'single', options: ['Yes'] })]).success).toBe(false)
    expect(questionsSchema.safeParse([q({ type: 'multiple', options: ['A', 'A'] })]).success).toBe(false)
    expect(questionsSchema.safeParse([q({ type: 'single', options: ['Yes', 'No'] })]).success).toBe(true)
  })

  it('drops malformed stored questions instead of failing', () => {
    expect(parseQuestions([{ nope: true }])).toEqual([])
    expect(parseQuestions([q({ type: 'short', options: ['stray'] })])[0].options).toEqual([])
  })

  it('checks guest answers against the questions', () => {
    const questions = [
      q({ id: 'goal000', label: 'Goal', required: true }),
      q({ id: 'grade00', label: 'Subject', type: 'single', options: ['Math', 'English'], required: true }),
      q({ id: 'days000', label: 'Days', type: 'multiple', options: ['Mon', 'Tue', 'Wed'] }),
    ]
    const form: Record<string, string[]> = { q_goal000: ['  SAT prep '], q_grade00: ['Math'], q_days000: ['Mon', 'Wed'] }
    const ok = readAnswers(questions, (n) => form[n] ?? [])
    expect(ok.errors).toEqual({})
    expect(ok.answers).toEqual([
      { questionId: 'goal000', label: 'Goal', value: 'SAT prep' },
      { questionId: 'grade00', label: 'Subject', value: 'Math' },
      { questionId: 'days000', label: 'Days', value: ['Mon', 'Wed'] },
    ])
    const bad = readAnswers(questions, (n) => ({ q_grade00: ['Science'] } as Record<string, string[]>)[n] ?? [])
    expect(bad.errors).toEqual({ q_goal000: 'Please answer this question', q_grade00: 'Choose from the options given' })
  })
})

describe('refunds', () => {
  const startsAt = new Date('2026-12-10T17:00:00Z')
  it('refunds guests who cancel before the cutoff, not after', () => {
    expect(refundOnCancel({ paid: true, cancelledBy: 'guest', startsAt, cutoffHours: 24, now: new Date('2026-12-09T16:00:00Z') })).toBe('full')
    expect(refundOnCancel({ paid: true, cancelledBy: 'guest', startsAt, cutoffHours: 24, now: new Date('2026-12-09T18:00:00Z') })).toBe('none')
  })
  it('always refunds when the business cancels, and ignores unpaid calls', () => {
    expect(refundOnCancel({ paid: true, cancelledBy: 'business', startsAt, cutoffHours: 24, now: new Date('2026-12-10T16:59:00Z') })).toBe('full')
    expect(refundOnCancel({ paid: false, cancelledBy: 'guest', startsAt, cutoffHours: 24 })).toBe('not_paid')
  })
  it('lets guests change a call only before it starts', () => {
    expect(guestCanChange(startsAt, new Date('2026-12-10T16:59:00Z'))).toBe(true)
    expect(guestCanChange(startsAt, new Date('2026-12-10T17:00:00Z'))).toBe(false)
  })
})

describe('manage links', () => {
  const key = deriveKey(Buffer.alloc(32, 7).toString('base64'), 'booking manage links')
  const id = '3f0c5a7e-1d2b-4c3d-9e8f-0a1b2c3d4e5f'
  it('verifies genuine links and rejects tampered or foreign ones', () => {
    const token = manageToken(id, key)
    expect(verifyManageToken(token, key)).toBe(id)
    expect(verifyManageToken(token.replace(id, '3f0c5a7e-1d2b-4c3d-9e8f-0a1b2c3d4e50'), key)).toBeNull()
    expect(verifyManageToken(token, deriveKey(Buffer.alloc(32, 8).toString('base64'), 'booking manage links'))).toBeNull()
    expect(verifyManageToken('not-a-token', key)).toBeNull()
  })
  it('derives different keys for different purposes', () => {
    const master = Buffer.alloc(32, 7).toString('base64')
    expect(deriveKey(master, 'a').equals(deriveKey(master, 'b'))).toBe(false)
  })
})

describe('money', () => {
  it('parses and formats dollars', () => {
    expect(parseDollars('45')).toBe(4500)
    expect(parseDollars('$1,250.5')).toBe(125050)
    expect(parseDollars('')).toBeNull()
    expect(parseDollars('4.999')).toBeNaN()
    expect(formatCents(4500)).toBe('$45')
    expect(formatCents(4550)).toBe('$45.50')
  })
})

describe('emails', () => {
  const d = { businessName: 'Willow <Coaching>', title: 'Intro call', hostName: 'Eleni', guestName: 'Jo', start: new Date('2026-11-09T18:00:00Z'), end: new Date('2026-11-09T18:30:00Z'), timeZone: 'America/Los_Angeles', manageUrl: 'https://www.schedulefa.st/m/x' }
  it('shows the time in the guest’s zone and escapes HTML', () => {
    expect(whenText(d.start, d.end, d.timeZone)).toBe('Monday, November 9, 2026, 10:00 AM – 10:30 AM PST')
    const m = guestConfirmation(d)
    expect(m.subject).toBe('Booked: Intro call with Willow <Coaching>')
    expect(m.html).toContain('Willow &lt;Coaching&gt;')
    expect(m.text).toContain('Reschedule or cancel: https://www.schedulefa.st/m/x')
  })
  it('explains the refund on cancellation', () => {
    expect(guestCancelled(d, 'guest', 'none').text).toContain('after the refund cutoff')
    expect(guestCancelled(d, 'business', 'full').text).toContain('full refund')
  })
})

describe('shared pages (D-061)', () => {
  it('offers the call to the coach with the fewest calls first, ties at random', () => {
    const load = new Map([['a', 3], ['b', 1]])
    expect(fairestFirst(['a', 'b', 'c'], load, () => 0.5)).toEqual(['c', 'b', 'a'])
    const seq = [0.9, 0.1]
    expect(fairestFirst(['x', 'y'], new Map(), () => seq.shift()!)).toEqual(['y', 'x'])
  })
})
