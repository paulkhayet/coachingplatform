// schedulefa.st plans (D-044, D-067–D-069, D-072). Shared by the pricing page, Settings and the server.

export type PaidPlan = 'solo' | 'team'
export type PlanId = 'free' | PaidPlan
export type BillingInterval = 'year' | 'month'

export const PAID_PLANS: Record<PaidPlan, { name: string; perPerson: boolean; cents: Record<BillingInterval, number> }> = {
  // The one place prices are set. The landing page, Settings and Stripe Checkout all read these; if a
  // price changes here, the next checkout creates the new Stripe price (existing subscribers keep theirs).
  // Per person (team) or per workspace (solo); `year` is the whole yearly bill.
  solo: { name: 'Solo', perPerson: false, cents: { year: 12000, month: 1200 } },
  team: { name: 'Team', perPerson: true, cents: { year: 18000, month: 1700 } },
}

/** Stripe lookup key for a plan's price, so the same prices are found in test and live mode. */
export const priceLookupKey = (plan: PaidPlan, interval: BillingInterval) => `schedulefast_${plan}_${interval}`

export function planFromLookupKey(key: string | null | undefined): { plan: PaidPlan; interval: BillingInterval } | null {
  const m = /^schedulefast_(solo|team)_(year|month)$/.exec(key ?? '')
  return m ? { plan: m[1] as PaidPlan, interval: m[2] as BillingInterval } : null
}

/** Stripe statuses that keep paid features on. Past due keeps them while Stripe retries the card. */
export const PAID_STATUSES = new Set(['active', 'trialing', 'past_due'])

export interface PlanLimits {
  /** How many people can be on the team (active members). */
  people: number
  /** Active booking pages; null = unlimited. */
  bookingPages: number | null
  paidCalls: boolean
  zoom: boolean
  /** Clients, packages and credits, client files. */
  clients: boolean
  /** Reminder emails to guests before their call (confirmations are sent on every plan). */
  reminders: boolean
  /** The team dashboard (D-074): intake, assignments, the attention queue and finances. */
  teamDashboard: boolean
}

/** What a workspace can do on each plan (D-072). Limits stop creating more; nothing existing breaks. */
export function planLimits(plan: PlanId, seats = 1): PlanLimits {
  if (plan === 'free') return { people: 1, bookingPages: 1, paidCalls: false, zoom: false, clients: false, reminders: false, teamDashboard: false }
  if (plan === 'solo') return { people: 1, bookingPages: null, paidCalls: true, zoom: true, clients: true, reminders: true, teamDashboard: false }
  return { people: Math.max(1, seats), bookingPages: null, paidCalls: true, zoom: true, clients: true, reminders: true, teamDashboard: true }
}

export const FREE_PLAN_SUMMARY = 'One person, one active booking page, free calls. Guests get confirmation emails; reminder emails are on Solo and Team.'

/** Shown wherever a paid feature is blocked on the free plan. */
export const UPGRADE_MESSAGES = {
  bookingPages: 'The free plan includes one active booking page. Upgrade to Solo or Team for more.',
  paidCalls: 'Paid calls need the Solo or Team plan. Upgrade in Settings → Subscription.',
  zoom: 'Zoom meetings need the Solo or Team plan. Upgrade in Settings → Subscription.',
  clients: 'Clients, packages and files need the Solo or Team plan. Upgrade in Settings → Subscription.',
  people: 'Adding people needs the Team plan. Upgrade in Settings → Subscription.',
  teamDashboard: 'The team dashboard needs the Team plan. Upgrade in Settings → Subscription.',
} as const

/** Dollars, without cents when whole: 10 → "10", 12.5 → "12.50". */
export function formatDollars(dollars: number) {
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2)
}

/** What the plan costs per month (per person for Team) on each billing interval, in dollars. */
export function monthlyDollars(plan: PaidPlan, interval: BillingInterval) {
  const cents = PAID_PLANS[plan].cents[interval]
  return (interval === 'year' ? cents / 12 : cents) / 100
}

/** The yearly bill in dollars (per person for Team). */
export const yearlyDollars = (plan: PaidPlan) => PAID_PLANS[plan].cents.year / 100

/** The biggest saving from paying yearly across the paid plans, as a whole percentage. */
export function bestYearlySaving() {
  const savings = (Object.keys(PAID_PLANS) as PaidPlan[]).map((plan) => 1 - PAID_PLANS[plan].cents.year / (PAID_PLANS[plan].cents.month * 12))
  return Math.round(Math.max(0, ...savings) * 100)
}

export function formatPlanPrice(plan: PaidPlan, interval: BillingInterval) {
  return `$${formatDollars(monthlyDollars(plan, interval))}/month${PAID_PLANS[plan].perPerson ? ' per person' : ''}${interval === 'year' ? ', billed yearly' : ''}`
}
