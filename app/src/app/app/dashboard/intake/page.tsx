import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { InquiryStage } from '@/db/schema'
import { businessDate, formatClientDate } from '@/lib/clients/credits'
import { loadTeam } from '@/lib/insights/server'
import { OPEN_STAGES, STAGE_HINTS, STAGE_LABELS, daysSince, isOpenStage } from '@/lib/intake/shared'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { requireDashboard } from '../guard'
import { moveStage } from './actions'
import { StageSelect } from './forms'

export const metadata: Metadata = { title: 'Intake' }

type Row = {
  id: string; stage: InquiryStage; student_name: string; contact_name: string; subjects: string[]; owner_membership_id: string | null; coach_membership_id: string | null
  next_action: string | null; next_action_due: string | null; stage_changed_at: string; created_at: string; lost_reason: string | null; client_id: string | null
}

const SHOW = ['open', 'enrolled', 'lost'] as const

export default async function IntakePage({ searchParams }: { searchParams: Promise<{ view?: string; show?: string }> }) {
  const access = await requireDashboard('member')
  const { business } = access
  const params = await searchParams
  const show = SHOW.find((s) => s === params.show) ?? 'open'
  const view = !access.manager || show !== 'open' || params.view === 'list' ? 'list' : 'board'

  const supabase = await createClient()
  // Row-level security: owners and administrators see every inquiry; a coach sees the ones proposed to them.
  const query = supabase.from('inquiries')
    .select('id, stage, student_name, contact_name, subjects, owner_membership_id, coach_membership_id, next_action, next_action_due, stage_changed_at, created_at, lost_reason, client_id')
    .eq('business_id', business.id)
  const [{ data, error }, team] = await Promise.all([
    (show === 'open' ? query.in('stage', [...OPEN_STAGES]) : query.eq('stage', show)).order('stage_changed_at', { ascending: false }).limit(500).returns<Row[]>(),
    loadTeam(business.id),
  ])
  const rows = data ?? []
  const names = new Map(team.map((m) => [m.id, m.name]))
  const name = (id: string | null, none: string) => (id ? names.get(id) ?? 'Former team member' : none)
  const now = new Date()
  const today = businessDate(business.timezone, now)
  const link = (next: { view?: string; show?: string }) => {
    const q = new URLSearchParams()
    const merged = { view: view === 'list' ? 'list' : undefined, show: show === 'open' ? undefined : show, ...next }
    if (merged.view === 'list') q.set('view', 'list')
    if (merged.show && merged.show !== 'open') q.set('show', merged.show)
    return `/app/dashboard/intake${q.size ? `?${q}` : ''}`
  }
  const tab = (active: boolean) => cn('rounded-md px-2.5 py-1 text-sm', active ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground')

  const days = (r: Row) => {
    const n = daysSince(new Date(r.stage_changed_at), now)
    return n === 0 ? 'Today' : `${n} ${n === 1 ? 'day' : 'days'}`
  }
  const nextStep = (r: Row) => r.next_action && (
    <p className={cn('text-xs', r.next_action_due && r.next_action_due < today ? 'text-destructive font-medium' : 'text-muted-foreground')}>
      Next: {r.next_action}{r.next_action_due && ` · ${r.next_action_due < today ? 'was due' : 'due'} ${formatClientDate(r.next_action_due)}`}
    </p>
  )

  return (
    <div className="grid min-w-0 gap-4">
      {!access.manager && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inquiries</h1>
          <p className="text-muted-foreground mt-1 text-sm">Families you’ve been proposed as the coach for. Record how the first call went on each one.</p>
        </div>
      )}
      {access.manager && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1">
            <Link href={link({ show: 'open' })} className={tab(show === 'open')}>Open</Link>
            <Link href={link({ show: 'enrolled', view: undefined })} className={tab(show === 'enrolled')}>Enrolled</Link>
            <Link href={link({ show: 'lost', view: undefined })} className={tab(show === 'lost')}>Lost</Link>
            {show === 'open' && (
              <>
                <span className="bg-border mx-2 h-4 w-px" aria-hidden="true" />
                <Link href={link({ view: undefined })} className={tab(view === 'board')}>Board</Link>
                <Link href={link({ view: 'list' })} className={tab(view === 'list')}>List</Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm"><Link href="/app/settings/intake">Inquiry form</Link></Button>
            <Button asChild size="sm"><Link href="/app/dashboard/intake/new"><Plus /> Add inquiry</Link></Button>
          </div>
        </div>
      )}
      {error && <Alert variant="destructive"><AlertDescription>Couldn’t load inquiries. Refresh the page to try again.</AlertDescription></Alert>}

      {view === 'board' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {OPEN_STAGES.map((stage) => {
            const cards = rows.filter((r) => r.stage === stage)
            return (
              <section key={stage} id={stage} aria-label={STAGE_LABELS[stage]} className="bg-muted/40 grid content-start gap-2 rounded-xl border p-2.5">
                <header className="px-1 pt-0.5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">{STAGE_LABELS[stage]} <Badge variant="secondary">{cards.length}</Badge></h2>
                  <p className="text-muted-foreground text-xs">{STAGE_HINTS[stage]}</p>
                </header>
                {cards.length === 0 && <p className="text-muted-foreground px-1 py-3 text-xs">Nothing here.</p>}
                {cards.map((r) => (
                  <article key={r.id} className="bg-card grid gap-2 rounded-lg border p-3 shadow-xs">
                    <div>
                      <Link href={`/app/dashboard/intake/${r.id}`} className="font-medium break-words hover:underline">{r.student_name}</Link>
                      {r.contact_name !== r.student_name && <p className="text-muted-foreground text-xs break-words">{r.contact_name}</p>}
                    </div>
                    {r.subjects.length > 0 && <div className="flex flex-wrap gap-1">{r.subjects.slice(0, 4).map((s) => <Badge key={s} variant="accent">{s}</Badge>)}{r.subjects.length > 4 && <Badge variant="outline">+{r.subjects.length - 4}</Badge>}</div>}
                    <dl className="text-muted-foreground grid gap-0.5 text-xs">
                      <div><dt className="inline">Handled by: </dt><dd className="text-foreground inline">{name(r.owner_membership_id, 'Nobody yet')}</dd></div>
                      <div><dt className="inline">Coach: </dt><dd className={cn('inline', r.coach_membership_id ? 'text-foreground' : 'text-warning font-medium')}>{name(r.coach_membership_id, 'Not chosen')}</dd></div>
                      <div><dt className="inline">In this stage: </dt><dd className="text-foreground inline">{days(r)}</dd></div>
                    </dl>
                    {nextStep(r)}
                    <StageSelect action={moveStage.bind(null, business.id, r.id)} stage={stage} label={`Stage for ${r.student_name}`} />
                  </article>
                ))}
              </section>
            )
          })}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          {!access.manager ? 'No inquiries are proposed to you right now.' : show === 'open' ? 'No open inquiries. Share your inquiry form or add one by hand.' : `No ${show} inquiries yet.`}
        </p>
      ) : (
        <div className="bg-card min-w-0 rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Student</TableHead><TableHead>Stage</TableHead><TableHead>Subjects</TableHead><TableHead>Handled by</TableHead><TableHead>Coach</TableHead>
                <TableHead className="pr-5">{show === 'lost' ? 'Reason' : show === 'enrolled' ? 'Enrolled' : 'Next step'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-5">
                    <Link href={`/app/dashboard/intake/${r.id}`} className="font-medium hover:underline">{r.student_name}</Link>
                    {r.contact_name !== r.student_name && <div className="text-muted-foreground text-xs">{r.contact_name}</div>}
                  </TableCell>
                  <TableCell><span className="whitespace-nowrap">{STAGE_LABELS[r.stage]}</span>{isOpenStage(r.stage) && <div className="text-muted-foreground text-xs">{days(r)}</div>}</TableCell>
                  <TableCell className="max-w-48 truncate">{r.subjects.join(', ') || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{name(r.owner_membership_id, '—')}</TableCell>
                  <TableCell>{name(r.coach_membership_id, '—')}</TableCell>
                  <TableCell className="pr-5">
                    {show === 'lost' ? r.lost_reason : show === 'enrolled'
                      ? <span className="whitespace-nowrap">{formatClientDate(businessDate(business.timezone, new Date(r.stage_changed_at)))}{r.client_id && <> · <Link href={`/app/clients/${r.client_id}`} className="text-primary hover:underline">Client</Link></>}</span>
                      : nextStep(r) || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
