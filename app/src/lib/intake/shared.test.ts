import { describe, expect, it } from 'vitest'
import { checkInquiry, daysSince, inquirySchema, median, parseSubjects, pipelineStats } from './shared'

const base = { contactName: 'Dana Reed', contactEmail: 'dana@example.com', contactPhone: '', relationship: 'Parent', studentName: 'Maya Reed', studentGrade: '9', subjects: 'SAT Math, reading', goals: '', availabilityNotes: '', timezone: 'America/Chicago' }

describe('inquiry form', () => {
  it('splits subjects into tags without repeats', () => {
    expect(parseSubjects(' SAT  Math, reading;Essays\nsat math ,, ')).toEqual(['SAT Math', 'reading', 'Essays'])
    expect(parseSubjects('')).toEqual([])
  })
  it('accepts a family inquiry and tidies it', () => {
    const parsed = inquirySchema.parse(base)
    expect(parsed.subjects).toEqual(['SAT Math', 'reading'])
    expect(parsed.studentName).toBe('Maya Reed')
  })
  it('needs a student name unless the student is writing in', () => {
    expect(inquirySchema.safeParse({ ...base, studentName: '' }).success).toBe(false)
    expect(inquirySchema.parse({ ...base, studentName: '', relationship: 'Self' }).studentName).toBe('Dana Reed')
  })
  it('rejects bad emails, too many subjects and overlong answers', () => {
    expect(inquirySchema.safeParse({ ...base, contactEmail: 'nope' }).success).toBe(false)
    expect(inquirySchema.safeParse({ ...base, subjects: Array.from({ length: 21 }, (_, i) => `s${i}`).join(',') }).success).toBe(false)
    expect(inquirySchema.safeParse({ ...base, subjects: 'x'.repeat(61) }).success).toBe(false)
    expect(inquirySchema.safeParse({ ...base, goals: 'x'.repeat(2001) }).success).toBe(false)
  })
})

describe('checking a submission', () => {
  it('reports every problem at once, including a missing student name', () => {
    expect(checkInquiry({ ...base, contactName: '', contactEmail: 'nope', studentName: '' })).toEqual({
      errors: { contactName: 'Enter your name', contactEmail: 'Enter a valid email address', studentName: 'Enter the student’s name' },
    })
    expect(checkInquiry({ ...base, contactName: '', studentName: '', relationship: 'Self' })).toEqual({ errors: { contactName: 'Enter your name' } })
  })
  it('lower-cases the email and returns the tidied inquiry', () => {
    const result = checkInquiry({ ...base, contactEmail: ' Dana@Example.COM ' })
    expect('data' in result && result.data.contactEmail).toBe('dana@example.com')
  })
})

describe('pipeline', () => {
  const now = new Date('2026-11-20T20:00:00Z')
  const day = (n: number) => new Date(now.getTime() - n * 86_400_000)
  it('counts stages, months, conversion and time to enrol', () => {
    const stats = pipelineStats([
      { stage: 'new', createdAt: day(1), stageChangedAt: day(1) },
      { stage: 'matching', createdAt: day(3), stageChangedAt: day(2) },
      { stage: 'offer', createdAt: day(25), stageChangedAt: day(5) },
      { stage: 'enrolled', createdAt: day(30), stageChangedAt: day(20) },
      { stage: 'enrolled', createdAt: day(40), stageChangedAt: day(10) },
      { stage: 'lost', createdAt: day(35), stageChangedAt: day(15) },
      { stage: 'lost', createdAt: day(200), stageChangedAt: day(120) }, // closed too long ago to count
    ], { thisFrom: day(19), lastFrom: day(49) }, now)
    expect(stats.counts).toEqual({ new: 1, matching: 1, first_call: 0, offer: 1 })
    expect([stats.thisMonth, stats.lastMonth]).toEqual([2, 4])
    expect([stats.enrolled, stats.closed]).toEqual([2, 3])
    expect(stats.conversion).toBeCloseTo(2 / 3)
    expect(stats.medianDaysToEnrol).toBe(20)
  })
  it('has no conversion rate before anything closes', () => {
    const stats = pipelineStats([{ stage: 'new', createdAt: day(1), stageChangedAt: day(1) }], { thisFrom: day(19), lastFrom: day(49) }, now)
    expect(stats.conversion).toBeNull()
    expect(stats.medianDaysToEnrol).toBeNull()
  })
  it('measures days and medians', () => {
    expect(daysSince(day(2.5), now)).toBe(2)
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})
