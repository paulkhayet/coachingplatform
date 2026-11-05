import type { DB, Purchase, Appointment, ID } from './types'

export const round2 = (n: number) => Math.round(n * 100) / 100
const floor2 = (n: number) => Math.floor(n * 100 + 1e-9) / 100

export const isCanceled = (a: Appointment) => a.status.startsWith('canceled')
const consumesCredit = (a: Appointment) =>
  a.status === 'attended' || ((a.status === 'no_show' || a.status === 'canceled_late') && a.lateOutcomeApplied === 'forfeit')

export interface Bucket {
  key: string
  start: Date
  end: Date
  purchased: number
  funded: number
  paidCents: number
  priceCents: number
}

/** Fixed-term: one bucket; funded = purchased × paid ÷ price, rounded down to hundredths, capped (D-024).
 *  Monthly: one bucket per cycle; a fully paid cycle funds that cycle's allowance (P-09). */
export function buckets(p: Purchase, adjustments: number): Bucket[] {
  if (p.kind === 'fixed') {
    const paid = p.installments.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amountCents, 0)
    const funded = paid >= p.priceCents ? p.credits : Math.min(p.credits, floor2((p.credits * paid) / p.priceCents))
    return [{ key: p.id, start: new Date(p.startDate), end: new Date(p.endDate), purchased: p.credits + adjustments, funded: funded + adjustments, paidCents: paid, priceCents: p.priceCents }]
  }
  return p.installments.map((inst, i) => {
    const start = new Date(inst.dueDate)
    const next = p.installments[i + 1]
    const end = next ? new Date(next.dueDate) : new Date(start.getTime() + 30 * 86400000)
    const paid = inst.status === 'paid'
    const adj = i === 0 ? adjustments : 0
    return { key: inst.id, start, end, purchased: p.credits + adj, funded: (paid ? p.credits : 0) + adj, paidCents: paid ? inst.amountCents : 0, priceCents: inst.amountCents }
  })
}

export interface BucketBalance extends Bucket {
  consumed: number
  forfeited: number
  reservedFunded: number
  reservedUnfunded: number
  usableFunded: number
  remainingEntitlement: number
}

export interface PurchaseBalance {
  purchase: Purchase
  buckets: BucketBalance[]
  current: BucketBalance
  purchased: number
  funded: number
  consumed: number
  forfeited: number
  reservedFunded: number
  reservedUnfunded: number
  usableFunded: number
  remainingEntitlement: number
  paidCents: number
  totalCents: number
  makeup: { available: number; deadline: Date; used: number; earned: number } | null
  coverage: Map<ID, 'funded' | 'unfunded'>
  ended: boolean
}

function bucketFor(bs: Bucket[], a: Appointment) {
  const t = new Date(a.start).getTime()
  return bs.find((b) => t >= b.start.getTime() && t < b.end.getTime()) ?? (t < bs[0].start.getTime() ? bs[0] : bs[bs.length - 1])
}

export function purchaseBalance(db: DB, purchaseId: ID, now = new Date()): PurchaseBalance {
  const p = db.purchases.find((x) => x.id === purchaseId)!
  const adj = db.adjustments.filter((a) => a.purchaseId === p.id).reduce((s, a) => s + a.credits, 0)
  const bs = buckets(p, adj)
  const appts = db.appointments.filter((a) => a.purchaseId === p.id).sort((a, b) => a.start.localeCompare(b.start))
  const coverage = new Map<ID, 'funded' | 'unfunded'>()
  const balances: BucketBalance[] = bs.map((b) => {
    const mine = appts.filter((a) => bucketFor(bs, a) === b)
    const consumed = round2(mine.filter((a) => a.status === 'attended').reduce((s, a) => s + a.credits, 0))
    const forfeited = round2(mine.filter((a) => consumesCredit(a) && a.status !== 'attended').reduce((s, a) => s + a.credits, 0))
    // Funding applies to consumed/forfeited obligations first, then upcoming reservations chronologically.
    let freeFunded = round2(b.funded - consumed - forfeited)
    let reservedFunded = 0
    let reservedUnfunded = 0
    for (const a of mine.filter((x) => x.status === 'scheduled')) {
      if (a.credits <= freeFunded + 1e-9) {
        freeFunded = round2(freeFunded - a.credits)
        reservedFunded += a.credits
        coverage.set(a.id, 'funded')
      } else {
        reservedUnfunded += a.credits
        coverage.set(a.id, 'unfunded')
      }
    }
    return {
      ...b,
      consumed,
      forfeited,
      reservedFunded: round2(reservedFunded),
      reservedUnfunded: round2(reservedUnfunded),
      usableFunded: Math.max(0, freeFunded),
      remainingEntitlement: round2(b.purchased - consumed - forfeited - reservedFunded - reservedUnfunded),
    }
  })
  const current = balances.find((b) => now >= b.start && now < b.end) ?? balances[balances.length - 1]
  const sum = (k: keyof BucketBalance) => round2(balances.reduce((s, b) => s + (b[k] as number), 0))
  const ended = now > new Date(p.endDate)

  // Makeups: timely family cancellations and business cancellations preserve entitlement past the term end (D-008/D-009).
  let makeup: PurchaseBalance['makeup'] = null
  if (p.kind === 'fixed') {
    const earned = appts.filter((a) => a.status === 'canceled_timely' || a.status === 'canceled_business' || ((a.status === 'canceled_late' || a.status === 'no_show') && a.lateOutcomeApplied === 'preserve')).reduce((s, a) => s + a.credits, 0)
    const used = appts.filter((a) => a.isMakeup && !isCanceled(a)).reduce((s, a) => s + a.credits, 0)
    const deadline = new Date(new Date(p.endDate).getTime() + p.policy.makeupWindowDays * 86400000)
    if (earned > 0) makeup = { earned: round2(earned), used: round2(used), available: round2(Math.max(0, Math.min(earned - used, balances[0].remainingEntitlement))), deadline }
  }

  return {
    purchase: p,
    buckets: balances,
    current,
    purchased: p.kind === 'fixed' ? balances[0].purchased : current.purchased,
    funded: p.kind === 'fixed' ? balances[0].funded : current.funded,
    consumed: p.kind === 'fixed' ? sum('consumed') : current.consumed,
    forfeited: p.kind === 'fixed' ? sum('forfeited') : current.forfeited,
    reservedFunded: p.kind === 'fixed' ? sum('reservedFunded') : current.reservedFunded,
    reservedUnfunded: p.kind === 'fixed' ? sum('reservedUnfunded') : current.reservedUnfunded,
    usableFunded: p.kind === 'fixed' ? balances[0].usableFunded : current.usableFunded,
    remainingEntitlement: p.kind === 'fixed' ? balances[0].remainingEntitlement : current.remainingEntitlement,
    paidCents: balances.reduce((s, b) => s + b.paidCents, 0),
    totalCents: p.kind === 'fixed' ? p.priceCents : p.installments.reduce((s, i) => s + i.amountCents, 0),
    makeup,
    coverage,
    ended,
  }
}

export type Coverage = 'eligible' | 'payment_needed' | 'not_required' | 'no_purchase' | 'not_applicable' | 'paid_call'

/** Price-free eligibility shown to coaches (P-10): eligible / payment needed. */
export function apptCoverage(db: DB, a: Appointment, cache?: Map<ID, PurchaseBalance>): Coverage {
  if (isCanceled(a)) return 'not_applicable'
  if (a.kind === 'consultation') return a.payment?.status === 'paid' ? 'paid_call' : 'not_required'
  if (!a.purchaseId) return 'no_purchase'
  let bal = cache?.get(a.purchaseId)
  if (!bal) {
    bal = purchaseBalance(db, a.purchaseId)
    cache?.set(a.purchaseId, bal)
  }
  if (a.status !== 'scheduled') return 'eligible'
  return bal.coverage.get(a.id) === 'funded' ? 'eligible' : 'payment_needed'
}

export function activePurchases(db: DB, studentId: ID) {
  return db.purchases.filter((p) => p.studentId === studentId && p.status !== 'completed')
}

export interface LedgerRow {
  at: string
  label: string
  delta: number | null
  kind: 'purchase' | 'funding' | 'reserve' | 'consume' | 'release' | 'forfeit' | 'adjust' | 'makeup'
  detail?: string
}

/** A readable, traceable credit history derived from the purchase's events (P-08). */
export function ledger(db: DB, p: Purchase, showMoney: boolean): LedgerRow[] {
  const rows: LedgerRow[] = [{ at: p.startDate, label: `${p.name} purchased`, delta: p.credits, kind: 'purchase', detail: p.kind === 'monthly' ? `${p.credits} credits per cycle` : `${p.credits} credits of entitlement` }]
  let paid = 0
  const insts = [...p.installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  for (const i of insts) {
    if (i.status === 'paid') {
      const before = p.kind === 'fixed' ? Math.min(p.credits, floor2((p.credits * paid) / p.priceCents)) : 0
      paid += i.amountCents
      const after = p.kind === 'fixed' ? (paid >= p.priceCents ? p.credits : Math.min(p.credits, floor2((p.credits * paid) / p.priceCents))) : p.credits
      rows.push({ at: i.paidAt ?? i.dueDate, label: i.historical ? 'Historical paid coverage verified' : 'Payment funded credits', delta: round2(after - before), kind: 'funding', detail: showMoney ? `${(i.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} ${i.historical ? 'recorded (not a new charge)' : 'via Stripe'}` : undefined })
    } else if (i.status === 'failed') {
      rows.push({ at: i.dueDate, label: 'Payment failed — no credits funded', delta: 0, kind: 'funding' })
    }
  }
  for (const a of db.appointments.filter((x) => x.purchaseId === p.id)) {
    const st = db.sessionTypes.find((s) => s.id === a.sessionTypeId)
    const what = `${st?.name ?? 'Session'} · ${new Date(a.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    if (a.status === 'scheduled') rows.push({ at: a.createdAt, label: `Reserved ${a.isMakeup ? '(makeup) ' : ''}${what}`, delta: null, kind: 'reserve', detail: `${a.credits} held` })
    if (a.status === 'attended') rows.push({ at: a.start, label: `Used — ${what}`, delta: -a.credits, kind: 'consume' })
    if (a.status === 'canceled_timely' || a.status === 'canceled_business' || a.status === 'canceled_unpaid') rows.push({ at: a.canceledAt ?? a.start, label: `Released — ${what}`, delta: null, kind: 'release', detail: a.status === 'canceled_unpaid' ? 'Unpaid reservation cancelled at cutoff' : a.status === 'canceled_business' ? 'Business cancelled; entitlement preserved' : 'Timely cancellation; eligible for makeup' })
    if ((a.status === 'canceled_late' || a.status === 'no_show') && a.lateOutcomeApplied === 'forfeit') rows.push({ at: a.canceledAt ?? a.start, label: `Forfeited — ${what}`, delta: -a.credits, kind: 'forfeit', detail: a.status === 'no_show' ? 'No-show' : 'Late cancellation' })
    if ((a.status === 'canceled_late' || a.status === 'no_show') && a.lateOutcomeApplied === 'preserve') rows.push({ at: a.canceledAt ?? a.start, label: `Preserved — ${what}`, delta: null, kind: 'release', detail: a.exception ? `Exception: ${a.exception.reason}` : 'Policy preserves late changes' })
  }
  for (const adj of db.adjustments.filter((x) => x.purchaseId === p.id)) rows.push({ at: adj.at, label: 'Authorized adjustment', delta: adj.credits, kind: 'adjust', detail: adj.reason })
  return rows.sort((a, b) => b.at.localeCompare(a.at))
}
