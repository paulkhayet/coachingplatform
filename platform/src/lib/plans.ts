import type { PlanId } from './types'

export interface Plan {
  id: PlanId
  name: string
  seats: number
  monthlyCents: number
  sms: number
  aiDrafts: number
  signatures: number
  blurb: string
}

// Candidate figures only — the product plan (Q-01) leaves final prices and allowances open.
export const PLANS: Plan[] = [
  { id: 'free', name: 'Free', seats: 1, monthlyCents: 0, sms: 0, aiDrafts: 10, signatures: 3, blurb: 'Try the full workflow with one staff member.' },
  { id: 'solo', name: 'Solo', seats: 1, monthlyCents: 3900, sms: 150, aiDrafts: 100, signatures: 15, blurb: 'Everything a solo coaching business needs.' },
  { id: 'studio', name: 'Studio', seats: 5, monthlyCents: 9900, sms: 600, aiDrafts: 400, signatures: 50, blurb: 'A connected workspace for a small team.' },
  { id: 'practice', name: 'Practice', seats: 15, monthlyCents: 19900, sms: 2000, aiDrafts: 1500, signatures: 150, blurb: 'More capacity for an established practice.' },
]
export const planById = (id: PlanId) => PLANS.find((p) => p.id === id)!
