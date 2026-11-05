import * as React from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { addDays } from 'date-fns'
import { ArrowLeft, CalendarPlus, ShieldCheck, NotebookPen, Lock, CreditCard, CircleAlert, Clock, MoreHorizontal, Plus, FileText, Eye } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Avatar } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Empty, Field, KV } from '@/components/page'
import { ApptStatusBadge, CoverageBadge } from '@/components/status'
import { CreditSummary } from '@/components/credit-summary'
import { BookingDialog } from '@/components/booking-dialog'
import { CancelDialog } from '@/components/cancel-dialog'
import { enrollmentTone } from './Clients'
import { useDB, useStaffViewer, actions } from '@/lib/store'
import { clientAccess, isFinancial, canSeePricing } from '@/lib/permissions'
import { apptCoverage, ledger, purchaseBalance } from '@/lib/credits'
import { date, money, num, relative, shortDate, time } from '@/lib/format'
import { run } from '@/components/run'
import type { Appointment, Student, Staff } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function ClientDetail() {
  const { id } = useParams()
  const db = useDB()
  const me = useStaffViewer()!
  const [params, setParams] = useSearchParams()
  const [booking, setBooking] = React.useState(false)
  const [hwOpen, setHwOpen] = React.useState(false)
  const s = db.students.find((x) => x.id === id)
  if (!s) return <Navigate to="/app/clients" replace />
  const access = clientAccess(db, me, s)
  if (!access)
    return (
      <Empty icon={<Lock />} title="You don’t have access to this client" action={<Button variant="outline" asChild><Link to="/app/clients">Back to clients</Link></Button>}>
        Coaches see assigned clients and clients authorised through a pool booking or an explicit grant.
      </Empty>
    )
  const tab = params.get('tab') ?? 'overview'
  const coach = db.staff.find((x) => x.id === s.assignedCoachId)
  const pool = db.pools.find((p) => p.id === s.poolId)
  const [tone, label] = enrollmentTone[s.status]

  return (
    <>
      <Link to="/app/clients" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"><ArrowLeft className="size-4" /> Clients</Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={s.name} className="size-14 text-base" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{s.name}</h1>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span>{s.grade} · {s.school}</span>
              <StatusBadge tone={tone}>{label}</StatusBadge>
              <Badge variant="outline">Portal {s.portal === 'active' ? 'active' : s.portal === 'invited' ? 'invited' : 'not set up'}</Badge>
              {s.manualEntry && <Badge variant="secondary">Entered manually</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setHwOpen(true)}><NotebookPen /> Assign homework</Button>
          <Button size="sm" onClick={() => setBooking(true)}><CalendarPlus /> Book session</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="credits">Credits</TabsTrigger>
          {canSeePricing(me) && <TabsTrigger value="billing">Billing</TabsTrigger>}
          <TabsTrigger value="work">Follow-ups and homework</TabsTrigger>
          {me.role !== 'coach' && <TabsTrigger value="access">Access</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid content-start gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Family and permissions</CardTitle>
                <CardDescription>Student, guardian, payer, signer, and portal access are separate. Each guardian has their own login.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} />
                    <div>
                      <div className="text-sm font-medium">{s.name} <span className="text-muted-foreground font-normal">· Student</span></div>
                      <div className="text-muted-foreground text-xs">{s.email ?? 'No email'}{s.smsOptIn ? ' · SMS opted in' : ''}</div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    Can self-book
                    <Switch checked={s.studentCanBook} disabled={me.role === 'coach'} onCheckedChange={(v) => actions.updateStudent(s.id, { studentCanBook: v })} />
                  </label>
                </div>
                {s.guardians.map((l) => {
                  const g = db.guardians.find((x) => x.id === l.guardianId)!
                  const perms: [keyof typeof l, string][] = [['canBook', 'Book and change'], ['followUps', 'Follow-ups'], ['homework', 'Homework and files'], ['billing', 'Billing']]
                  return (
                    <div key={g.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Avatar name={g.name} />
                          <div>
                            <div className="text-sm font-medium">{g.name} <span className="text-muted-foreground font-normal">· {l.relationship}</span></div>
                            <div className="text-muted-foreground text-xs">{g.email}{g.smsOptIn ? ' · SMS opted in' : ''} · portal {g.portal}</div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {l.payer && <Badge variant="secondary">Payer</Badge>}
                          {l.signer && <Badge variant="secondary">Signer</Badge>}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {perms.map(([k, lbl]) => (
                          <label key={k} className="bg-muted/50 flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs">
                            {lbl}
                            <Switch checked={!!l[k]} disabled={me.role === 'coach'} onCheckedChange={(v) => run(actions.updateGuardianLink(s.id, g.id, { [k]: v }, me.id), 'Permission updated')} />
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {s.independent && <p className="text-muted-foreground text-sm">Independent student — no parent account required.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Goals</CardTitle></CardHeader>
              <CardContent className="text-sm">{s.goals || <span className="text-muted-foreground">No goals recorded.</span>}</CardContent>
            </Card>
          </div>
          <div className="grid content-start gap-6">
            <Card>
              <CardHeader><CardTitle>Coaching</CardTitle></CardHeader>
              <CardContent>
                <KV items={[['Assigned coach', coach?.name ?? '—'], ['Coach pool', pool ? pool.name : 'None'], ['Source', s.source], ['Client since', date(s.createdAt)]]} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Why you can see this</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <div>{access.label}</div>
                {access.expires && <div className="text-muted-foreground mt-1 text-xs">Expires {date(access.expires)} (after the booked sessions and follow-up window)</div>}
                {me.role === 'admin' && <div className="text-muted-foreground mt-2 text-xs">Operational access only. Private coaching notes need an explicit grant.</div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sessions"><SessionsTab s={s} me={me} /></TabsContent>
        <TabsContent value="credits"><CreditsTab s={s} me={me} /></TabsContent>
        {canSeePricing(me) && <TabsContent value="billing"><BillingTab s={s} me={me} /></TabsContent>}
        <TabsContent value="work"><WorkTab s={s} onAssign={() => setHwOpen(true)} /></TabsContent>
        {me.role !== 'coach' && <TabsContent value="access"><AccessTab s={s} me={me} /></TabsContent>}
      </Tabs>

      <BookingDialog open={booking} onOpenChange={setBooking} fixedStudentId={s.id} students={[s]} actorKind="staff" actorLabel={me.name} allowRecurring />
      <HomeworkDialog open={hwOpen} onOpenChange={setHwOpen} student={s} me={me} />
    </>
  )
}

function SessionsTab({ s, me }: { s: Student; me: Staff }) {
  const db = useDB()
  const [cancel, setCancel] = React.useState<Appointment | null>(null)
  const [resched, setResched] = React.useState<Appointment | null>(null)
  const all = db.appointments.filter((a) => a.studentId === s.id)
  const upcoming = all.filter((a) => a.status === 'scheduled' && new Date(a.start) > new Date()).sort((a, b) => a.start.localeCompare(b.start))
  const past = all.filter((a) => !upcoming.includes(a)).sort((a, b) => b.start.localeCompare(a.start))
  const cache = new Map()
  const Row = ({ a, actions: showActions }: { a: Appointment; actions?: boolean }) => (
    <TableRow>
      <TableCell className="pl-5">
        <Link to={`/app/sessions/${a.id}`} className="font-medium hover:underline">{shortDate(a.start)}</Link>
        <div className="text-muted-foreground text-xs">{time(a.start)} · {a.minutes} min{a.isMakeup ? ' · makeup' : ''}{a.seriesId ? ' · recurring' : ''}</div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">{db.staff.find((x) => x.id === a.coachId)?.name}{a.viaPool && <span className="text-muted-foreground text-xs"> (pool)</span>}</TableCell>
      <TableCell><ApptStatusBadge status={a.status} /></TableCell>
      <TableCell><CoverageBadge coverage={apptCoverage(db, a, cache)} /></TableCell>
      <TableCell className="pr-5 text-right">
        {showActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Session actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><Link to={`/app/sessions/${a.id}`}>Open session</Link></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setResched(a)}>Reschedule</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setCancel(a)}>Cancel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          a.cancelReason && <span className="text-muted-foreground text-xs">{a.cancelReason}</span>
        )}
      </TableCell>
    </TableRow>
  )
  return (
    <div className="grid gap-6">
      <Card className="pb-0">
        <CardHeader><CardTitle>Upcoming</CardTitle></CardHeader>
        <CardContent className="px-0">
          {upcoming.length ? <Table><TableBody>{upcoming.map((a) => <Row key={a.id} a={a} actions />)}</TableBody></Table> : <div className="px-5 pb-5"><Empty title="Nothing booked" /></div>}
        </CardContent>
      </Card>
      <Card className="pb-0">
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent className="px-0">
          {past.length ? <Table><TableBody>{past.map((a) => <Row key={a.id} a={a} />)}</TableBody></Table> : <div className="px-5 pb-5"><Empty title="No history yet" /></div>}
        </CardContent>
      </Card>
      <CancelDialog appt={cancel} open={!!cancel} onOpenChange={(o) => !o && setCancel(null)} staff={me} actorLabel={me.name} />
      {resched && <BookingDialog open onOpenChange={(o) => !o && setResched(null)} reschedule={resched} actorKind="staff" actorLabel={me.name} />}
    </div>
  )
}

function CreditsTab({ s, me }: { s: Student; me: Staff }) {
  const db = useDB()
  const purchases = db.purchases.filter((p) => p.studentId === s.id)
  const [adj, setAdj] = React.useState<{ pid: string; credits: string; reason: string } | null>(null)
  if (!purchases.length) return <Empty icon={<CircleAlert />} title="No purchases yet">Coaching requires paid coverage before delivery.</Empty>
  return (
    <div className="grid gap-6">
      {purchases.map((p) => {
        const bal = purchaseBalance(db, p.id)
        return (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>{p.kind === 'monthly' ? 'Monthly arrangement' : 'Fixed-term program'} · {date(p.startDate)} – {date(p.endDate)}{p.status === 'completed' ? ' · completed' : ''}</CardDescription>
              {isFinancial(me) && p.status !== 'completed' && <CardAction><Button variant="outline" size="sm" onClick={() => setAdj({ pid: p.id, credits: '1', reason: '' })}>Adjust credits</Button></CardAction>}
            </CardHeader>
            <CardContent className="grid gap-6">
              <CreditSummary bal={bal} showMoney={canSeePricing(me)} />
              <div>
                <div className="mb-2 text-sm font-medium">Credit history</div>
                <ul className="divide-y rounded-md border text-sm">
                  {ledger(db, p, canSeePricing(me)).map((r, i) => (
                    <li key={i} className="flex items-center gap-3 px-3 py-2">
                      <span className="text-muted-foreground w-20 shrink-0 text-xs">{shortDate(r.at).split(', ')[1]}</span>
                      <span className="min-w-0 flex-1">
                        {r.label}
                        {r.detail && <span className="text-muted-foreground block text-xs">{r.detail}</span>}
                      </span>
                      <span className={cn('tabular-nums', r.delta && r.delta > 0 && 'text-success', r.delta && r.delta < 0 && 'text-muted-foreground')}>{r.delta === null ? '' : `${r.delta > 0 ? '+' : ''}${num(r.delta)}`}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )
      })}
      <Dialog open={!!adj} onOpenChange={(o) => !o && setAdj(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authorized credit adjustment</DialogTitle>
            <DialogDescription>Adjustments are recorded with your name and reason. They correct history rather than erasing it.</DialogDescription>
          </DialogHeader>
          {adj && (
            <div className="grid gap-4">
              <Field label="Credits (negative to remove)"><Input type="number" step="0.5" value={adj.credits} onChange={(e) => setAdj({ ...adj, credits: e.target.value })} /></Field>
              <Field label="Reason"><Textarea value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} placeholder="Goodwill credit after coach cancellation — approved by Eleni" /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdj(null)}>Cancel</Button>
            <Button onClick={() => adj && run(actions.addAdjustment(adj.pid, Number(adj.credits), adj.reason, me.id), 'Adjustment recorded') && setAdj(null)}>Record adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BillingTab({ s, me }: { s: Student; me: Staff }) {
  const db = useDB()
  const purchases = db.purchases.filter((p) => p.studentId === s.id)
  const offer = (pid: string) => db.offers.find((o) => o.purchaseId === pid)
  if (!purchases.length) return <Empty icon={<CreditCard />} title="No billing yet" />
  return (
    <div className="grid gap-6">
      <Alert variant="info">
        <CreditCard />
        <AlertTitle>Stripe test mode</AlertTitle>
        <AlertDescription>Use the actions to simulate verified Stripe events. Repeated events are ignored, so nothing is charged or funded twice.</AlertDescription>
      </Alert>
      {purchases.map((p) => {
        const o = offer(p.id)
        return (
          <Card key={p.id} className="pb-0">
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>
                {p.kind === 'monthly' ? `${money(p.priceCents)} per month` : `${money(p.priceCents)} total`} · {p.credits} credits{p.kind === 'monthly' ? ' per cycle' : ''}
                {o && ` · signed by ${o.signerName} on ${date(o.signedAt!)} (agreement v${o.version})`}
              </CardDescription>
            </CardHeader>
            {p.historical && (
              <CardContent>
                <div className="bg-muted/60 rounded-md p-3 text-sm">
                  <div className="font-medium">Historical paid coverage</div>
                  <div className="text-muted-foreground text-xs">{p.historical.note} · verified by {db.staff.find((x) => x.id === p.historical!.verifiedBy)?.name} {relative(p.historical.at)}. Recorded separately from Stripe charges.</div>
                </div>
              </CardContent>
            )}
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">{p.kind === 'monthly' ? 'Cycle starting' : 'Due'}</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Reference</TableHead>
                    <TableHead className="pr-5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.installments.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="pl-5">{date(i.dueDate)}</TableCell>
                      <TableCell className="tabular-nums">{money(i.amountCents)}</TableCell>
                      <TableCell>
                        <StatusBadge tone={i.status === 'paid' ? 'success' : i.status === 'failed' ? 'danger' : new Date(i.dueDate) < new Date() ? 'warning' : 'neutral'}>
                          {i.status === 'paid' ? (i.historical ? 'Paid (historical)' : 'Paid') : i.status === 'failed' ? 'Failed' : new Date(i.dueDate) < new Date() ? 'Overdue' : 'Scheduled'}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden font-mono text-xs sm:table-cell">{i.ref ?? '—'}</TableCell>
                      <TableCell className="pr-5 text-right">
                        {i.status !== 'paid' && isFinancial(me) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="outline" size="sm">Simulate</Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => run(actions.recordPayment(p.id, i.id, 'paid', me.id))}>Stripe: payment succeeded</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => run(actions.recordPayment(p.id, i.id, 'failed', me.id))}>Stripe: payment failed</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardContent className="text-muted-foreground border-t py-3 text-xs">
              Policy snapshot: cancel {p.policy.cancelNoticeHours}h ahead · late changes {p.policy.lateCancelOutcome === 'forfeit' ? 'use the credit' : 'keep the credit'} · makeups {p.policy.makeupWindowDays} days past end. Refunds and disputes are reconciled to this history (not part of this demo).
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function WorkTab({ s, onAssign }: { s: Student; onAssign: () => void }) {
  const db = useDB()
  const fus = db.followUps.filter((f) => f.studentId === s.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const hws = db.homework.filter((h) => h.studentId === s.id)
  const files = db.files.filter((f) => f.studentIds.includes(s.id))
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Follow-ups</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {fus.length ? fus.map((f) => (
            <Link key={f.id} to={`/app/sessions/${f.appointmentId}`} className="hover:bg-muted/50 flex items-center justify-between rounded-md border p-3 text-sm">
              <span>
                <span className="font-medium">{f.versions[0].subject}</span>
                <span className="text-muted-foreground block text-xs">{f.mode === 'shared' ? 'Shared version' : 'Student and parent versions'} · {relative(f.createdAt)}</span>
              </span>
              <StatusBadge tone={f.status === 'published' ? 'success' : 'info'}>{f.status === 'published' ? 'Published' : 'Draft'}</StatusBadge>
            </Link>
          )) : <Empty title="No follow-ups yet" />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Homework</CardTitle>
          <CardAction><Button variant="ghost" size="sm" onClick={onAssign}><Plus /> Assign</Button></CardAction>
        </CardHeader>
        <CardContent className="grid gap-2">
          {hws.length ? hws.map((h) => (
            <div key={h.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{h.title}</span>
                <StatusBadge tone={h.status === 'reviewed' ? 'neutral' : h.status === 'complete' ? 'success' : 'info'}>{h.status === 'assigned' ? 'Assigned' : h.status === 'complete' ? 'Done — review' : h.status === 'reviewed' ? 'Reviewed' : 'Draft'}</StatusBadge>
              </div>
              {h.due && <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs"><Clock className="size-3" /> Due {shortDate(h.due)}</div>}
              {h.response && <div className="bg-muted/60 mt-2 rounded px-2 py-1.5 text-xs">“{h.response}”</div>}
              {h.status === 'complete' && <Button size="sm" variant="outline" className="mt-2" onClick={() => run(actions.setHomeworkStatus(h.id, 'reviewed'), 'Marked reviewed')}>Mark reviewed</Button>}
            </div>
          )) : <Empty title="No homework yet" />}
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Shared files</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {files.length ? files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
              <FileText className="text-muted-foreground size-4" />
              <span className="flex-1">{f.name}</span>
              <span className="text-muted-foreground text-xs">{f.sizeKb} KB</span>
            </div>
          )) : <Empty title="No files shared" />}
        </CardContent>
      </Card>
    </div>
  )
}

function AccessTab({ s, me }: { s: Student; me: Staff }) {
  const db = useDB()
  const grants = db.grants.filter((g) => g.studentId === s.id)
  const staff = db.staff.filter((x) => x.status === 'active' && x.id !== s.assignedCoachId)
  const [g, setG] = React.useState({ staffId: staff[0]?.id ?? '', scope: 'client' as 'client' | 'private_notes', reason: '', days: '14' })
  const [coach, setCoach] = React.useState(s.assignedCoachId ?? '')
  const poolSeen = db.staff.filter((st) => st.role === 'coach' && st.id !== s.assignedCoachId).map((st) => ({ st, a: clientAccess(db, st, s) })).filter((x) => x.a)
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Who can see {s.name.split(' ')[0]}</CardTitle>
          <CardDescription>Coaches see assigned clients; others need a pool booking or an explicit, recorded grant.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex items-center justify-between rounded-md border p-3"><span>Owner and administrators</span><Badge variant="outline">Operational access</Badge></div>
          {s.assignedCoachId && <div className="flex items-center justify-between rounded-md border p-3"><span>{db.staff.find((x) => x.id === s.assignedCoachId)?.name}</span><Badge variant="outline">Assigned coach</Badge></div>}
          {poolSeen.map(({ st, a }) => (
            <div key={st.id} className="flex items-center justify-between rounded-md border p-3">
              <span>{st.name}<span className="text-muted-foreground block text-xs">{a!.label}{a!.expires ? ` · until ${date(a!.expires)}` : ''}</span></span>
              <Badge variant="accent">{a!.kind === 'pool' ? 'Pool booking' : 'Grant'}</Badge>
            </div>
          ))}
          {grants.filter((x) => x.scope === 'private_notes').map((x) => (
            <div key={x.id} className="flex items-center justify-between rounded-md border p-3">
              <span>{db.staff.find((st) => st.id === x.staffId)?.name}<span className="text-muted-foreground block text-xs">Private notes · {x.reason}</span></span>
              <Button variant="ghost" size="sm" onClick={() => run(actions.revokeGrant(x.id, me.id), 'Grant revoked')}>Revoke</Button>
            </div>
          ))}
          {grants.filter((x) => x.scope === 'client').map((x) => (
            <div key={x.id} className="flex items-center justify-end">
              <Button variant="ghost" size="sm" onClick={() => run(actions.revokeGrant(x.id, me.id), 'Grant revoked')}>Revoke {db.staff.find((st) => st.id === x.staffId)?.name.split(' ')[0]}’s client grant</Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid content-start gap-6">
        <Card>
          <CardHeader><CardTitle>Grant access</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Select value={g.staffId} onValueChange={(v) => setG({ ...g, staffId: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{staff.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={g.scope} onValueChange={(v) => setG({ ...g, scope: v as typeof g.scope })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client record (operational)</SelectItem>
                <SelectItem value="private_notes">Private notes and transcripts</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <Input placeholder="Reason" value={g.reason} onChange={(e) => setG({ ...g, reason: e.target.value })} />
              <Select value={g.days} onValueChange={(v) => setG({ ...g, days: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="7">7 days</SelectItem><SelectItem value="14">14 days</SelectItem><SelectItem value="30">30 days</SelectItem><SelectItem value="0">No expiry</SelectItem></SelectContent>
              </Select>
            </div>
            <Button size="sm" className="justify-self-start" onClick={() => run(actions.grant(g.staffId, s.id, g.scope, g.reason, Number(g.days) || null, me.id), 'Access granted and recorded')}><Eye /> Grant</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Reassign coach</CardTitle><CardDescription>Upcoming sessions move with the client. The allowance is shared, not duplicated.</CardDescription></CardHeader>
          <CardContent className="flex gap-2">
            <Select value={coach} onValueChange={setCoach}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{db.staff.filter((x) => x.coaches && x.status === 'active').map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" disabled={coach === s.assignedCoachId} onClick={() => run(actions.reassignClient(s.id, coach, me.id))}>Reassign</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function HomeworkDialog({ open, onOpenChange, student, me, appointmentId }: { open: boolean; onOpenChange: (o: boolean) => void; student: Student; me: Staff; appointmentId?: string }) {
  const db = useDB()
  const [title, setTitle] = React.useState('')
  const [instructions, setInstructions] = React.useState('')
  const [due, setDue] = React.useState('3')
  const [guardians, setGuardians] = React.useState(true)
  const [fileIds, setFileIds] = React.useState<string[]>([])
  React.useEffect(() => {
    if (open) {
      setTitle('')
      setInstructions('')
      setFileIds([])
    }
  }, [open])
  const myFiles = db.files.filter((f) => f.uploadedBy === me.id || f.studentIds.includes(student.id))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign homework to {student.name.split(' ')[0]}</DialogTitle>
          <DialogDescription>Written by you. Students can mark it complete with a short note.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Plan the week on Sunday" /></Field>
          <Field label="Instructions"><Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due">
              <Select value={due} onValueChange={setDue}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['1', '3', '5', '7', '14'].map((d) => <SelectItem key={d} value={d}>In {d} day{d === '1' ? '' : 's'}</SelectItem>)}<SelectItem value="0">No due date</SelectItem></SelectContent>
              </Select>
            </Field>
            {!student.independent && <Field label="Parents can see"><Switch checked={guardians} onCheckedChange={setGuardians} /></Field>}
          </div>
          {myFiles.length > 0 && (
            <Field label="Attach files">
              <div className="flex flex-wrap gap-1.5">
                {myFiles.map((f) => (
                  <button key={f.id} onClick={() => setFileIds((x) => (x.includes(f.id) ? x.filter((y) => y !== f.id) : [...x, f.id]))} className={cn('rounded-md border px-2 py-1 text-xs', fileIds.includes(f.id) && 'border-primary bg-accent')}>
                    {f.name}
                  </button>
                ))}
              </div>
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              const ok = run(actions.createHomework({ studentId: student.id, coachId: me.id, appointmentId, title, instructions, due: due !== '0' ? addDays(new Date(), Number(due)).toISOString() : undefined, guardiansCanSee: guardians, fileIds }, me.id), 'Homework assigned')
              if (ok) onOpenChange(false)
            }}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

