import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { ArrowRight, CircleCheck } from 'lucide-react'
import { adminDb } from '@/db/server'
import { inquiries } from '@/db/schema'
import { UpgradeNotice } from '@/components/upgrade-notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatPlanPrice } from '@/lib/billing/plans'
import { buildAttention, relativeTime } from '@/lib/insights/attention'
import { presetPeriod } from '@/lib/insights/finance'
import { dashboardAccess, loadAttentionFacts, loadCoachLoads } from '@/lib/insights/server'
import { OPEN_STAGES, STAGE_LABELS, pipelineStats } from '@/lib/intake/shared'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Dashboard' }

const hours = (minutes: number) => {
  const h = minutes / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`
}

export default async function DashboardOverview() {
  const access = await dashboardAccess()
  if (!access.manager) {
    if (access.enabled) redirect('/app/dashboard/intake')
    notFound()
  }
  const { business } = access
  if (!access.enabled) {
    return (
      <div className="mx-auto grid max-w-3xl gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">One place to run a team of coaches.</p>
        </div>
        <UpgradeNotice title="The team dashboard is on the Team plan" owner={access.owner}>
          Team is {formatPlanPrice('team', 'year')} ({formatPlanPrice('team', 'month')} paid monthly).
        </UpgradeNotice>
        <Card>
          <CardHeader><CardTitle>What you get</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm">
              {[
                ['Intake', 'A public inquiry form and a board that follows each family from first contact to enrolled.'],
                ['Assignments', 'Coach suggestions based on subjects, free time and workload, and one place to move clients between coaches.'],
                ['Attention queue', 'Unanswered inquiries, payments due, credits running out, sessions to mark, and calendar errors.'],
                ['Finances', 'Revenue, coach pay, Stripe fees and profit, with a pay report you can export. Visible to the owner only.'],
              ].map(([title, text]) => (
                <li key={title} className="flex gap-3"><CircleCheck className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" /><span><span className="font-medium">{title}.</span> <span className="text-muted-foreground">{text}</span></span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    )
  }

  const now = new Date()
  const [facts, loads, pipelineRows] = await Promise.all([
    loadAttentionFacts(business, now),
    loadCoachLoads(business.id),
    adminDb().select({ stage: inquiries.stage, createdAt: inquiries.createdAt, stageChangedAt: inquiries.stageChangedAt }).from(inquiries).where(eq(inquiries.businessId, business.id)),
  ])
  const groups = buildAttention(facts)
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const pipeline = pipelineStats(pipelineRows, { thisFrom: presetPeriod('this_month', business.timezone, now).from, lastFrom: presetPeriod('last_month', business.timezone, now).from }, now)
  const byLoad = [...loads].sort((a, b) => (b.utilization ?? -1) - (a.utilization ?? -1) || a.name.localeCompare(b.name))

  return (
    <div className="grid gap-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>{total === 0 ? 'Nothing is waiting on you.' : `${total} ${total === 1 ? 'thing' : 'things'} to look at.`}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {total === 0 && <p className="text-muted-foreground flex items-center gap-2 text-sm"><CircleCheck className="text-success size-4" aria-hidden="true" /> All caught up.</p>}
            {groups.filter((g) => g.items.length > 0).map((g) => (
              <details key={g.kind} open={g.items.length <= 5} className="group min-w-0 rounded-md border">
                <summary className="hover:bg-muted/50 flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium">
                  <span>{g.label}</span>
                  <Badge variant="secondary">{g.items.length}</Badge>
                </summary>
                <ul className="divide-y border-t">
                  {g.items.map((item) => (
                    <li key={item.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm break-words"><span className="font-medium">{item.subject}</span> <span className="text-muted-foreground">· {item.title}</span></p>
                        {item.at && <p className="text-muted-foreground text-xs">{relativeTime(item.at, now)}</p>}
                      </div>
                      <Button asChild variant="ghost" size="sm" className="text-primary -mr-2 shrink-0"><Link href={item.href}>{item.action} <ArrowRight /></Link></Button>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>Families on their way to enrolling.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-4 gap-2">
              {OPEN_STAGES.map((stage) => (
                <Link key={stage} href={`/app/dashboard/intake#${stage}`} className="hover:bg-muted/50 rounded-md border p-2.5 text-center">
                  <p className="text-xl font-semibold tabular-nums">{pipeline.counts[stage]}</p>
                  <p className="text-muted-foreground text-xs">{STAGE_LABELS[stage]}</p>
                </Link>
              ))}
            </div>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">New inquiries this month</dt><dd className="tabular-nums">{pipeline.thisMonth} <span className="text-muted-foreground">({pipeline.lastMonth} last month)</span></dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Enrolled, of those closed in 90 days</dt><dd className="tabular-nums">{pipeline.conversion === null ? '—' : `${Math.round(pipeline.conversion * 100)}% (${pipeline.enrolled} of ${pipeline.closed})`}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Typical time to enrol</dt><dd className="tabular-nums">{pipeline.medianDaysToEnrol === null ? '—' : `${Math.round(pipeline.medianDaysToEnrol)} ${Math.round(pipeline.medianDaysToEnrol) === 1 ? 'day' : 'days'}`}</dd></div>
            </dl>
            <Button asChild variant="outline" size="sm" className="justify-self-start"><Link href="/app/dashboard/intake">Open intake</Link></Button>
          </CardContent>
        </Card>
      </div>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Team load</CardTitle>
          <CardDescription>The next 14 days. Bookable hours are each coach’s hours for {business.name}, minus time off.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {byLoad.length === 0 ? <p className="text-muted-foreground px-5 pb-5 text-sm">Nobody coaches for {business.name} yet.</p> : (
            <Table className="min-w-[40rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Coach</TableHead><TableHead>Clients</TableHead><TableHead>Booked</TableHead><TableHead className="w-48">How full</TableHead><TableHead className="pr-5 text-right">Sessions, last 30 days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byLoad.map((c) => {
                  const pct = c.utilization === null ? null : Math.round(c.utilization * 100)
                  const full = c.maxClients !== null && c.activeClients >= c.maxClients
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="pl-5 whitespace-nowrap"><Link href={`/app/dashboard/assignments?coach=${c.id}`} className="font-medium hover:underline">{c.name}</Link></TableCell>
                      <TableCell className={cn('tabular-nums', full && 'text-warning font-medium')}>{c.activeClients}{c.maxClients !== null && ` of ${c.maxClients}`}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{hours(c.bookedMinutes)} <span className="text-muted-foreground">of {hours(c.openMinutes)}</span></TableCell>
                      <TableCell>
                        {pct === null ? <span className="text-muted-foreground text-xs">No bookable hours</span> : (
                          <div className="flex items-center gap-2">
                            <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full" role="img" aria-label={`${pct}% booked`}>
                              <div className={cn('h-full rounded-full', pct >= 85 ? 'bg-warning' : 'bg-primary')} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-9 text-right text-xs tabular-nums">{pct}%</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="pr-5 text-right tabular-nums">{c.recentSessions}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
