import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { UpgradeNotice } from '@/components/upgrade-notice'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PackageSessionFormat, PayFormatOverride, PayMethod } from '@/db/schema'
import { formatPlanPrice } from '@/lib/billing/plans'
import { businessDate, formatClientDate } from '@/lib/clients/credits'
import { describeRate, rateOn, type PayRate } from '@/lib/insights/finance'
import { dashboardAccess, loadTeam } from '@/lib/insights/server'
import { createClient } from '@/lib/supabase/server'
import { removeCoachPay, saveCoachPay } from './actions'
import { CoachPayForm, RemoveRateButton, type PayDefaults } from './form'

export const metadata: Metadata = { title: 'Coach pay' }

type RateRow = { id: string; membership_id: string; effective_from: string; method: PayMethod; amount_cents: number | null; percent_bps: number | null; format_overrides: PayFormatOverride[]; pay_forfeited: boolean }

const dollars = (cents: number | null) => (cents === null ? '' : (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2))

/** Settings → Coach pay (D-074). The owner's alone: row-level security returns nothing to anyone else. */
export default async function CoachPayPage() {
  const access = await dashboardAccess()
  if (!access.owner) notFound()
  const { business } = access
  if (!access.enabled) {
    return (
      <div className="grid max-w-3xl gap-5">
        <UpgradeNotice title="Coach pay is part of the team dashboard" owner>It’s on the Team plan: {formatPlanPrice('team', 'year')}.</UpgradeNotice>
      </div>
    )
  }
  const supabase = await createClient()
  const [{ data: rateRows }, { data: packages }, team] = await Promise.all([
    supabase.from('coach_pay_rates').select('id, membership_id, effective_from, method, amount_cents, percent_bps, format_overrides, pay_forfeited')
      .eq('business_id', business.id).order('effective_from', { ascending: false }).returns<RateRow[]>(),
    supabase.from('coaching_packages').select('session_formats').eq('business_id', business.id).is('archived_at', null).returns<{ session_formats: PackageSessionFormat[] }[]>(),
    loadTeam(business.id),
  ])
  const rows = rateRows ?? []
  const today = businessDate(business.timezone)
  const rates: PayRate[] = rows.map((r) => ({ membershipId: r.membership_id, effectiveFrom: r.effective_from, method: r.method, amountCents: r.amount_cents, percentBps: r.percent_bps, formatOverrides: r.format_overrides, payForfeited: r.pay_forfeited }))
  const formatNames = [...new Set((packages ?? []).flatMap((p) => p.session_formats.map((f) => f.name)))].sort()
  const coaches = team.filter((m) => m.coaches)
  const missing = coaches.filter((c) => !rateOn(rates, c.id, today)).length

  return (
    <div className="grid max-w-3xl gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Coach pay</CardTitle>
          <CardDescription>
            How each coach is paid. Only you, the owner, can see or change this. It’s what <Link href="/app/dashboard/finances" className="text-primary hover:underline">Finances</Link> uses to work out coach pay and profit.
            {missing > 0 && <span className="text-warning mt-1 block font-medium">{missing} {missing === 1 ? 'coach has' : 'coaches have'} no pay rate, so their sessions count as $0 of pay.</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-0 divide-y">
          {coaches.length === 0 && <p className="text-muted-foreground text-sm">Nobody coaches for {business.name} yet.</p>}
          {coaches.map((c) => {
            const history = rows.filter((r) => r.membership_id === c.id)
            const current = rateOn(rates, c.id, today)
            const upcoming = history.filter((r) => r.effective_from > today).length
            const defaults: PayDefaults = current
              ? { method: current.method, amount: dollars(current.amountCents), percent: current.percentBps === null ? '' : String(current.percentBps / 100),
                  overrides: current.formatOverrides.map((o) => ({ formatName: o.formatName, amount: dollars(o.amountCents) })), payForfeited: current.payForfeited }
              : { method: 'hourly', amount: '', percent: '', overrides: [], payForfeited: true }
            return (
              <details key={c.id} className="py-4 first:pt-0 last:pb-0">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <span className="font-medium">{c.name}</span>
                  <span className="flex items-center gap-2 text-sm">
                    {current ? describeRate(current) : <span className="text-warning">No pay rate set</span>}
                    {upcoming > 0 && <Badge variant="outline">Change scheduled</Badge>}
                  </span>
                </summary>
                <div className="mt-4 grid gap-5">
                  <CoachPayForm key={history.map((r) => r.id).join()} save={saveCoachPay.bind(null, business.id, c.id)} defaults={defaults} today={today} formatNames={formatNames} />
                  {history.length > 0 && (
                    <div className="grid gap-2">
                      <p className="text-sm font-medium">History</p>
                      <ul className="divide-y rounded-md border">
                        {history.map((r) => (
                          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-sm">
                            <span>
                              <span className="text-muted-foreground">From {formatClientDate(r.effective_from)}:</span>{' '}
                              {describeRate({ method: r.method, amountCents: r.amount_cents, percentBps: r.percent_bps, formatOverrides: r.format_overrides })}
                              {r.method !== 'salary' && !r.pay_forfeited && <span className="text-muted-foreground"> · no pay for late cancellations</span>}
                              {r.effective_from > today && <Badge variant="outline" className="ml-2">Scheduled</Badge>}
                            </span>
                            <RemoveRateButton remove={removeCoachPay.bind(null, business.id, r.id)} />
                          </li>
                        ))}
                      </ul>
                      <p className="text-muted-foreground text-xs">To stop paying someone, add a rate of $0 from the day it ends. A salary stops by itself when someone leaves the team.</p>
                    </div>
                  )}
                </div>
              </details>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
