import { describe, expect, it } from 'vitest'
import { rankCoaches, scoreCoach, subjectMatches, type CoachProfile } from './matching'

const coach = (over: Partial<CoachProfile> = {}): CoachProfile => ({ id: 'ana', name: 'Ana', specialties: ['SAT Math', 'Algebra'], maxClients: 10, activeClients: 4, freeStarts: 20, utilization: 0.4, ...over })
const labels = (m: { reasons: { label: string }[] }) => m.reasons.map((r) => r.label)

describe('subjects', () => {
  it('matches the same subject, or a shorter one inside a longer one', () => {
    expect(subjectMatches('sat math', 'SAT Math')).toBe(true)
    expect(subjectMatches('Math', 'SAT Math')).toBe(true)
    expect(subjectMatches('SAT Math prep', 'SAT Math')).toBe(true)
    expect(subjectMatches('Mathematics', 'Math')).toBe(false)
    expect(subjectMatches('Reading', 'SAT Math')).toBe(false)
    expect(subjectMatches('', 'SAT Math')).toBe(false)
  })
})

describe('scoring', () => {
  it('puts matching subjects ahead of everything else', () => {
    const ranked = rankCoaches({ subjects: ['Algebra'] }, [
      coach({ id: 'busy', name: 'Busy Expert', freeStarts: 2, utilization: 0.9, activeClients: 9 }),
      coach({ id: 'free', name: 'Free Generalist', specialties: ['Writing'], freeStarts: 40, utilization: 0, activeClients: 0 }),
    ])
    expect(ranked.map((m) => m.coachId)).toEqual(['busy', 'free'])
    expect(labels(ranked[0])).toContain('Teaches Algebra')
    expect(labels(ranked[1])).toContain('No matching subjects')
  })
  it('scores partial subject coverage in proportion', () => {
    const all = scoreCoach({ subjects: ['Algebra', 'SAT Math'] }, coach())
    const half = scoreCoach({ subjects: ['Algebra', 'Chemistry'] }, coach())
    expect(all.score - half.score).toBeCloseTo(25)
  })
  it('prefers free time, room for clients and a lighter load', () => {
    const base = scoreCoach({ subjects: [] }, coach())
    expect(scoreCoach({ subjects: [] }, coach({ freeStarts: 40 })).score).toBeGreaterThan(base.score)
    expect(scoreCoach({ subjects: [] }, coach({ activeClients: 1 })).score).toBeGreaterThan(base.score)
    expect(scoreCoach({ subjects: [] }, coach({ utilization: 0.1 })).score).toBeGreaterThan(base.score)
  })
  it('marks a full coach and one with no free time, and ranks them last', () => {
    const full = scoreCoach({ subjects: ['Algebra'] }, coach({ activeClients: 10 }))
    expect(labels(full)).toContain('Full (10 of 10 clients)')
    const none = scoreCoach({ subjects: ['Algebra'] }, coach({ freeStarts: 0 }))
    expect(labels(none)).toContain('No free time in the next 2 weeks')
    const ok = scoreCoach({ subjects: ['Algebra'] }, coach())
    expect(ok.score).toBeGreaterThan(full.score)
    expect(ok.score).toBeGreaterThan(none.score)
    expect(labels(ok)).toEqual(['Teaches Algebra', '20 free times in the next 2 weeks', 'Room for 6 more (4 of 10)', '40% booked'])
  })
  it('handles coaches with no limit, unknown free time and no bookable hours', () => {
    const m = scoreCoach({ subjects: [] }, coach({ maxClients: null, freeStarts: null, utilization: null, activeClients: 1 }))
    expect(labels(m)).toEqual(['Free time unknown', '1 client'])
    expect(m.score).toBe(8)
  })
  it('drops coaches a package doesn’t allow to the bottom', () => {
    const ranked = rankCoaches({ subjects: ['Algebra'], eligibleCoachIds: ['ben'] }, [coach(), coach({ id: 'ben', name: 'Ben', specialties: [] })])
    expect(ranked.map((m) => m.coachId)).toEqual(['ben', 'ana'])
    expect(labels(ranked[0])).toContain('Eligible for the package')
    expect(labels(ranked[1])).toContain('Not eligible for the package')
  })
  it('breaks ties by name', () => {
    expect(rankCoaches({ subjects: [] }, [coach({ id: 'z', name: 'Zed' }), coach({ id: 'a', name: 'Amy' })]).map((m) => m.name)).toEqual(['Amy', 'Zed'])
  })
})
