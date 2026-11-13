import { z } from 'zod'
import { PERIOD_PRESETS, monthPeriods, presetPeriod, previousPeriod, type Basis, type PeriodPreset } from '@/lib/insights/finance'

export type FinanceParams = { period?: string; from?: string; to?: string; basis?: string }

/** The period and basis a Finances URL asks for, with safe defaults. Shared by the page and the CSV export. */
export function readFinanceParams(params: FinanceParams, timeZone: string, now: Date) {
  const asked: PeriodPreset = PERIOD_PRESETS.find((p) => p.value === params.period)?.value ?? 'this_month'
  const day = z.iso.date()
  const custom = { from: day.safeParse(params.from).success ? params.from : undefined, to: day.safeParse(params.to).success ? params.to : undefined }
  const validCustom = Boolean(asked === 'custom' && custom.from && custom.to && custom.from <= custom.to)
  // A custom period without two usable dates falls back to this month.
  const preset: PeriodPreset = asked === 'custom' && !validCustom ? 'this_month' : asked
  const period = presetPeriod(preset, timeZone, now, custom)
  const basis: Basis = params.basis === 'cash' ? 'cash' : 'delivered'
  const months = monthPeriods(12, timeZone, now)
  const previous = previousPeriod(period, timeZone)
  const since = new Date(Math.min(period.from.getTime(), previous.from.getTime(), months[0].from.getTime()))
  const query = (over: Partial<FinanceParams> = {}) => {
    const merged = { period: preset as string, from: validCustom ? custom.from : undefined, to: validCustom ? custom.to : undefined, basis: basis as string, ...over }
    const q = new URLSearchParams()
    if (merged.period && merged.period !== 'this_month') q.set('period', merged.period)
    if (merged.period === 'custom' && merged.from && merged.to) {
      q.set('from', merged.from)
      q.set('to', merged.to)
    }
    if (merged.basis === 'cash') q.set('basis', 'cash')
    return q.size ? `?${q}` : ''
  }
  return { preset, period, previous, months, since, basis, query }
}
