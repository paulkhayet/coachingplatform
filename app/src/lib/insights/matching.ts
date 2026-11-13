// Coach suggestions for an inquiry or an unassigned client (D-074). Pure scoring with the reasons shown
// to staff, who always make the choice themselves.

export interface CoachProfile {
  id: string
  name: string
  specialties: string[]
  /** Null = no limit. */
  maxClients: number | null
  activeClients: number
  /** Free 60-minute starts in the next 14 days, or null when their time couldn't be read. */
  freeStarts: number | null
  /** Booked ÷ bookable hours over the next 14 days (0–1), or null when they have no bookable hours. */
  utilization: number | null
}

export interface MatchNeed {
  subjects: string[]
  /** For a client with a package limited to certain coaches. Null = any coach. */
  eligibleCoachIds?: string[] | null
}

export interface MatchReason {
  label: string
  tone: 'good' | 'warn' | 'neutral'
}

export interface CoachMatch {
  coachId: string
  name: string
  score: number
  reasons: MatchReason[]
}

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length > 1)

/** A subject matches a specialty when they're the same, or every word of the shorter one appears in the other ("Math" in "SAT Math"). */
export function subjectMatches(subject: string, specialty: string) {
  const a = words(subject)
  const b = words(specialty)
  if (!a.length || !b.length) return false
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.every((w) => long.includes(w))
}

export function scoreCoach(need: MatchNeed, coach: CoachProfile): CoachMatch {
  const reasons: MatchReason[] = []
  let score = 0

  // Subjects are the strongest signal: up to 50 points for covering everything asked for.
  const matched = need.subjects.filter((s) => coach.specialties.some((sp) => subjectMatches(s, sp)))
  if (need.subjects.length) {
    score += 50 * matched.length / need.subjects.length
    if (matched.length) reasons.push({ label: `Teaches ${matched.join(', ')}`, tone: 'good' })
    else if (coach.specialties.length) reasons.push({ label: 'No matching subjects', tone: 'neutral' })
    else reasons.push({ label: 'No subjects listed', tone: 'neutral' })
  }

  if (need.eligibleCoachIds) {
    if (need.eligibleCoachIds.includes(coach.id)) {
      score += 20
      reasons.push({ label: 'Eligible for the package', tone: 'good' })
    } else {
      score -= 100
      reasons.push({ label: 'Not eligible for the package', tone: 'warn' })
    }
  }

  if (coach.freeStarts === null) {
    reasons.push({ label: 'Free time unknown', tone: 'neutral' })
  } else if (coach.freeStarts === 0) {
    score -= 15
    reasons.push({ label: 'No free time in the next 2 weeks', tone: 'warn' })
  } else {
    score += 20 * Math.min(coach.freeStarts, 40) / 40
    reasons.push({ label: `${coach.freeStarts} free ${coach.freeStarts === 1 ? 'time' : 'times'} in the next 2 weeks`, tone: coach.freeStarts >= 10 ? 'good' : 'neutral' })
  }

  if (coach.maxClients === null) {
    score += 8
    reasons.push({ label: `${coach.activeClients} ${coach.activeClients === 1 ? 'client' : 'clients'}`, tone: 'neutral' })
  } else {
    const room = coach.maxClients - coach.activeClients
    if (room <= 0) {
      score -= 40
      reasons.push({ label: `Full (${coach.activeClients} of ${coach.maxClients} clients)`, tone: 'warn' })
    } else {
      score += 15 * room / Math.max(1, coach.maxClients)
      reasons.push({ label: `Room for ${room} more (${coach.activeClients} of ${coach.maxClients})`, tone: 'good' })
    }
  }

  if (coach.utilization !== null) {
    score += 15 * (1 - Math.min(1, Math.max(0, coach.utilization)))
    reasons.push({ label: `${Math.round(coach.utilization * 100)}% booked`, tone: coach.utilization >= 0.85 ? 'warn' : 'neutral' })
  }

  return { coachId: coach.id, name: coach.name, score: Math.round(score * 10) / 10, reasons }
}

/** Every coach, best match first. Ties go by name so the order is stable. */
export function rankCoaches(need: MatchNeed, coaches: CoachProfile[]): CoachMatch[] {
  return coaches.map((c) => scoreCoach(need, c)).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}
