import type { Metadata } from 'next'
import Link from 'next/link'
import { Download, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatClientDate } from '@/lib/clients/credits'
import { PAY_METHOD_LABELS, PERIOD_PRESETS, change, owedCents, prepaidCents, summarize, type Basis, type FinanceSummary } from '@/lib/insights/finance'
import { loadFinanceFacts } from '@/lib/insights/server'
import { cn } from '@/lib/utils'
import { requireDashboard } from '../guard'
import { syncFees } from './actions'
import { BarList, MonthlyChart } from './charts'
import { SyncFeesButton } from './forms'
import { readFinanceParams, type FinanceParams } from './params'

export const metadata: Metadata = { title: 'Finances' }

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100)
const percent = (ratio: number | null) => (ratio === null ? '—' : `${Math.round(ratio * 100)}%`)
const revenueOf = (s: FinanceSummary, basis: Basis) => (basis === 'delivered' ? s.delivered.revenueCents : s.cash.netCents)

function Delta({ now, before, goodWhenUp = true }: { now: number; before: number; goodWhenUp?: boolean }) {
  const c = change(now, before)
  if (c === null) return <span className="text-muted-foreground text-xs">No earlier figure</span>
  const up = c >= 0
  const good = c === 0 ? null : up === goodWhenUp
  return (
    <span className={cn('text-xs tabular-nums', good === null ? 'text-muted-foreground' : good ? 'text-success' : 'text-destructive')}>
      {/* Against a tiny or negative earlier figure the percentage stops meaning much: cap it. */}
      {up ? '+' : '−'}{Math.abs(c) > 9.99 ? 'over 999' : Math.abs(Math.round(c * 100))}% <span className="text-muted-foreground">vs. before</span>
    </span>
  )
}

function Tile({ label, value, children, hint }: { label: string; value: string; children?: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-card grid content-start gap-1 rounded-xl border p-4 shadow-xs">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}

/** Finances (D-074): the owner's view of revenue, coach pay, Stripe fees and profit. requireDashboard('owner') runs before any figure is loaded. */
export default async function FinancesPage({ searchParams }: { searchParams: Promise<FinanceParams> }) {
  const { business } = await requireDashboard('owner')
  const now = new Date()
  const { preset, period, previous, months, since, basis, query } = readFinanceParams(await searchParams, business.timezone, now)
  const facts = await loadFinanceFacts(business, since, now)
  const current = summarize(facts, period)
  const before = summarize(facts, previous)
  const series = months.map((m) => {
    const s = summarize(facts, m)
    return { label: m.label, revenue: revenueOf(s, basis), pay: s.coachPayCents, profit: s.profit[basis] }
  })
  const revenue = revenueOf(current, basis)
  const withWork = current.byCoach.filter((c) => c.sessions > 0 || c.payCents > 0 || c.cashCents !== 0)
  const unrated = current.byCoach.filter((c) => c.unratedSessions > 0)
  const pill = (active: boolean) => cn('rounded-md px-2.5 py-1 text-sm whitespace-nowrap', active ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground')
  const dateTime = new Intl.DateTimeFormat('en-US', { timeZone: business.timezone, month: 'short', day: 'numeric' })

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <nav aria-label="Period" className="flex flex-wrap items-center gap-1">
            {PERIOD_PRESETS.filter((p) => p.value !== 'custom').map((p) => <Link key={p.value} href={`/app/dashboard/finances${query({ period: p.value })}`} className={pill(preset === p.value)}>{p.label}</Link>)}
          </nav>
          <div className="flex items-center gap-1" role="group" aria-label="How revenue is counted">
            <Link href={`/app/dashboard/finances${query({ basis: 'delivered' })}`} className={pill(basis === 'delivered')}>Delivered</Link>
            <Link href={`/app/dashboard/finances${query({ basis: 'cash' })}`} className={pill(basis === 'cash')}>Cash</Link>
          </div>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="period" value="custom" />
          {basis === 'cash' && <input type="hidden" name="basis" value="cash" />}
          <div className="grid gap-1"><Label htmlFor="from" className="text-xs">From</Label><Input id="from" name="from" type="date" defaultValue={period.fromDay} className="h-8 w-40" required /></div>
          <div className="grid gap-1"><Label htmlFor="to" className="text-xs">To</Label><Input id="to" name="to" type="date" defaultValue={period.toDay} className="h-8 w-40" required /></div>
          <Button type="submit" variant="outline" size="sm">Show these dates</Button>
        </form>
        <p className="text-muted-foreground text-sm">
          {formatClientDate(period.fromDay)} – {formatClientDate(period.toDay)}, compared with {formatClientDate(previous.fromDay)} – {formatClientDate(previous.toDay)}.{' '}
          {basis === 'delivered'
            ? 'Delivered counts revenue when a session happens, so it lines up with what coaches are paid for.'
            : 'Cash counts money when it arrives: paid calls and package payments, less refunds.'}
        </p>
      </div>

      {unrated.length > 0 && (
        <Alert variant="warning">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>
            <p>{unrated.map((c) => c.name).join(', ')} {unrated.length === 1 ? 'has' : 'have'} sessions with no pay rate, counted as $0. Profit is overstated until you <Link href="/app/settings/coach-pay" className="text-primary hover:underline">set their pay</Link>.</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label={basis === 'delivered' ? 'Revenue delivered' : 'Cash in, less refunds'} value={money(revenue)}><Delta now={revenue} before={revenueOf(before, basis)} /></Tile>
        <Tile label="Coach pay" value={money(current.coachPayCents)}><Delta now={current.coachPayCents} before={before.coachPayCents} goodWhenUp={false} /></Tile>
        <Tile label="Stripe fees" value={money(current.feesCents)}><Delta now={current.feesCents} before={before.feesCents} goodWhenUp={false} /></Tile>
        <Tile label="Profit" value={money(current.profit[basis])}><Delta now={current.profit[basis]} before={before.profit[basis]} /></Tile>
        <Tile label="Margin" value={percent(current.margin[basis])} hint={before.margin[basis] === null ? undefined : `${percent(before.margin[basis])} before`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Paid ahead, not yet delivered" value={money(prepaidCents(facts.periods))} hint="Package money for sessions still to come. As of today." />
        <Tile label="Owed by families" value={money(owedCents(facts.periods))} hint="Unpaid balances on packages. As of today." />
        <Tile label="Refunds" value={money(current.cash.refundsCents)} hint="Refunded calls in this period." />
        {basis === 'delivered'
          ? <Tile label="Cash in" value={money(current.cash.collectedCents)} hint={`${money(current.cash.callsCents)} calls · ${money(current.cash.packagesCents)} packages`} />
          : <Tile label="Revenue delivered" value={money(current.delivered.revenueCents)} hint={`${money(current.delivered.callsCents)} calls · ${money(current.delivered.coachingCents)} sessions`} />}
      </div>

      {current.feesMissing > 0 && (
        <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
          <p className="text-sm">{current.feesMissing} {current.feesMissing === 1 ? 'payment has' : 'payments have'} no Stripe fee on record, so fees are understated.</p>
          <SyncFeesButton sync={syncFees.bind(null, business.id)} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Last 12 months</CardTitle>
          <CardDescription>{basis === 'delivered' ? 'Revenue as sessions were delivered.' : 'Revenue as cash arrived, less refunds.'} Profit is revenue minus coach pay and Stripe fees.</CardDescription>
        </CardHeader>
        <CardContent><MonthlyChart data={series} /></CardContent>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by coach</CardTitle>
            <CardDescription>{basis === 'delivered' ? 'From sessions each coach delivered.' : 'Calls they hosted, plus package payments from clients assigned to them.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList empty="No revenue in this period." rows={withWork.map((c) => ({ label: c.name, value: basis === 'delivered' ? c.deliveredCents : c.cashCents, display: money(basis === 'delivered' ? c.deliveredCents : c.cashCents) }))
              .filter((r) => r.value !== 0).sort((a, b) => b.value - a.value)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Revenue by package</CardTitle><CardDescription>Delivered sessions, with paid calls on their own row.</CardDescription></CardHeader>
          <CardContent><BarList empty="Nothing delivered in this period." rows={current.byPackage.map((p) => ({ label: p.name, value: p.cents, display: money(p.cents) }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Margin by coach</CardTitle><CardDescription>What each coach delivered, less what they were paid.</CardDescription></CardHeader>
          <CardContent>
            <BarList tone="bg-success" empty="Nothing delivered in this period." rows={withWork.filter((c) => c.deliveredCents > 0 || c.payCents > 0).map((c) => {
              const kept = c.deliveredCents - c.payCents
              return { label: c.name, value: kept, display: money(kept), note: c.deliveredCents > 0 ? `${Math.round(kept / c.deliveredCents * 100)}%` : undefined }
            }).sort((a, b) => b.value - a.value)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="sm:grid-cols-[1fr_auto]">
          <div className="grid gap-1">
            <CardTitle>Coach pay report</CardTitle>
            <CardDescription>What each coach earned in this period, from the rates in <Link href="/app/settings/coach-pay" className="text-primary hover:underline">Settings → Coach pay</Link>.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><a href={`/app/dashboard/finances/export${query()}${query() ? '&' : '?'}kind=pay`} download><Download /> Pay report CSV</a></Button>
            <Button asChild variant="outline" size="sm"><a href={`/app/dashboard/finances/export${query()}${query() ? '&' : '?'}kind=transactions`} download><Download /> Transactions CSV</a></Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-0 divide-y">
          {current.byCoach.length === 0 && <p className="text-muted-foreground text-sm">Nobody coaches for {business.name} yet.</p>}
          {current.byCoach.map((c) => (
            <details key={c.coachId} className="group py-3 first:pt-0 last:pb-0">
              <summary className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_5rem_5rem_6rem]">
                <span className="min-w-0">
                  <span className="font-medium">{c.name}</span>
                  {c.method === null && <Badge variant="outline" className="text-warning ml-2">No pay rate set</Badge>}
                  {c.method !== null && c.unratedSessions > 0 && <Badge variant="outline" className="text-warning ml-2">{c.unratedSessions} before a rate</Badge>}
                </span>
                <span className="text-muted-foreground hidden text-sm sm:block">{c.method ? PAY_METHOD_LABELS[c.method] : '—'}</span>
                <span className="hidden text-right text-sm tabular-nums sm:block">{c.sessions} {c.sessions === 1 ? 'session' : 'sessions'}</span>
                <span className="hidden text-right text-sm tabular-nums sm:block">{(c.minutes / 60).toFixed(1)} h</span>
                <span className="text-right font-medium tabular-nums">{money(c.payCents)}</span>
              </summary>
              <div className="mt-3 grid gap-2">
                <p className="text-muted-foreground text-xs sm:hidden">{c.method ? PAY_METHOD_LABELS[c.method] : 'No pay rate'} · {c.sessions} {c.sessions === 1 ? 'session' : 'sessions'} · {(c.minutes / 60).toFixed(1)} h</p>
                {c.salaryCents > 0 && <p className="text-sm">Salary for this period: <span className="font-medium tabular-nums">{money(c.salaryCents)}</span></p>}
                {c.lines.length === 0 ? <p className="text-muted-foreground text-sm">No delivered sessions in this period.</p> : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[32rem] text-sm">
                      <thead><tr className="text-muted-foreground border-b text-left text-xs"><th className="px-3 py-1.5 font-medium">Date</th><th className="px-3 py-1.5 font-medium">Session</th><th className="px-3 py-1.5 font-medium">With</th><th className="px-3 py-1.5 text-right font-medium">Worth</th><th className="px-3 py-1.5 text-right font-medium">Pay</th></tr></thead>
                      <tbody>
                        {c.lines.map((l) => (
                          <tr key={l.sessionId} className="border-b last:border-0">
                            <td className="px-3 py-1.5 whitespace-nowrap">{dateTime.format(l.at)}</td>
                            <td className="px-3 py-1.5">{l.title}{l.kind === 'forfeited' && <span className="text-muted-foreground"> · late cancellation</span>}{l.kind === 'call' && <span className="text-muted-foreground"> · paid call</span>}{l.kind === 'kept_call' && <span className="text-muted-foreground"> · cancelled late, payment kept</span>}</td>
                            <td className="px-3 py-1.5">{l.who}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{money(l.revenueCents)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{money(l.payCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </details>
          ))}
          {current.byCoach.length > 0 && (
            <div className="flex items-center justify-between pt-3 text-sm font-medium"><span>Total coach pay</span><span className="tabular-nums">{money(current.coachPayCents)}</span></div>
          )}
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs">Free calls, including first calls from Intake, aren’t counted as delivered sessions, so they add no revenue or pay. Times are in {business.name}’s time zone.</p>
    </div>
  )
}
