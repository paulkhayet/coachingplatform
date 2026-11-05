import * as React from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { ArrowLeft, Check, Lock, Sparkles, Video, MapPin, Download, Send, UserX, CalendarClock, X, Mail, MessageSquare, NotebookPen, RefreshCw, TriangleAlert } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Empty, KV } from '@/components/page'
import { ApptStatusBadge, CoverageBadge } from '@/components/status'
import { CancelDialog } from '@/components/cancel-dialog'
import { BookingDialog } from '@/components/booking-dialog'
import { HomeworkDialog } from './ClientDetail'
import { apptTitle } from './Today'
import { useDB, useStaffViewer, actions } from '@/lib/store'
import { canAuthorFollowUp, canReadPrivate, canSeePricing, clientAccess } from '@/lib/permissions'
import { apptCoverage } from '@/lib/credits'
import { reminderPlan } from '@/lib/booking'
import { plannedDeliveries } from '@/lib/followups'
import { dateTime, money, num, relative, shortDate, time } from '@/lib/format'
import { run } from '@/components/run'
import type { Appointment, FollowUp, Staff } from '@/lib/types'

export default function Session() {
  const { id } = useParams()
  const db = useDB()
  const me = useStaffViewer()!
  const [cancel, setCancel] = React.useState(false)
  const [resched, setResched] = React.useState(false)
  const [hw, setHw] = React.useState(false)
  const a = db.appointments.find((x) => x.id === id)
  if (!a) return <Navigate to="/app" replace />
  const student = a.studentId ? db.students.find((s) => s.id === a.studentId)! : null
  if (student && !clientAccess(db, me, student) && a.coachId !== me.id) return <Empty icon={<Lock />} title="You don’t have access to this session" />
  const st = db.sessionTypes.find((s) => s.id === a.sessionTypeId)!
  const coach = db.staff.find((s) => s.id === a.coachId)!
  const coverage = apptCoverage(db, a)
  const started = new Date(a.start) <= new Date()
  const privateOk = canReadPrivate(db, me, a.studentId, a)
  const fu = db.followUps.filter((f) => f.appointmentId === a.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0]
  const homework = db.homework.filter((h) => h.appointmentId === a.id)

  return (
    <>
      <Link to={student ? `/app/clients/${student.id}?tab=sessions` : '/app/inquiries'} className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"><ArrowLeft className="size-4" /> {student ? student.name : 'Inquiries'}</Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{apptTitle(db, a)}</h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
            {dateTime(a.start)} · {a.minutes} min with {coach.name}
            <ApptStatusBadge status={a.status} />
            <CoverageBadge coverage={coverage} />
          </div>
        </div>
        {a.status === 'scheduled' && (
          <div className="flex gap-2">
            {a.kind === 'coaching' && !started && <Button variant="outline" size="sm" onClick={() => setResched(true)}><CalendarClock /> Reschedule</Button>}
            <Button variant="outline" size="sm" onClick={() => setCancel(true)}><X /> Cancel</Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {a.status === 'scheduled' && (
            <Card>
              <CardHeader>
                <CardTitle>Attendance</CardTitle>
                <CardDescription>{started ? 'Record what happened. Completing a session uses its reserved credit.' : `Starts ${relative(a.start)}.`}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {coverage === 'payment_needed' && (
                  <Alert variant="warning">
                    <TriangleAlert />
                    <AlertTitle>Payment needed before this session can be delivered</AlertTitle>
                    <AlertDescription>
                      {me.role === 'coach' ? 'An administrator has been notified. Amounts are only visible to owners and administrators.' : <span>Resolve it from <Link className="text-primary hover:underline" to={`/app/clients/${a.studentId}?tab=billing`}>billing</Link>, or the reservation is released {db.business.policies.unpaidCutoffHours}h before if automatic cancellation is on.</span>}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => run(actions.markAttendance(a.id, 'attended', me.id), 'Marked attended')} disabled={!started}><Check /> Mark attended</Button>
                  <Button size="sm" variant="outline" onClick={() => run(actions.markAttendance(a.id, 'no_show', me.id), a.policy.noShowOutcome === 'forfeit' ? 'No-show recorded; credit used under policy' : 'No-show recorded; credit preserved')} disabled={!started}><UserX /> No-show</Button>
                </div>
                {!started && <p className="text-muted-foreground text-xs">Attendance opens once the session starts.</p>}
              </CardContent>
            </Card>
          )}

          {a.kind === 'consultation' && <BookingDetails a={a} me={me} />}

          {a.kind === 'coaching' && (a.status === 'attended' || a.source) && (privateOk ? <SourceCard a={a} me={me} /> : <LockedCard />)}
          {a.kind === 'coaching' && a.status === 'attended' && privateOk && <FollowUpCard a={a} me={me} fu={fu} />}
          {a.kind === 'coaching' && a.status === 'attended' && !privateOk && fu && <PublishedOnly fu={fu} />}

          {a.kind === 'coaching' && student && (
            <Card>
              <CardHeader>
                <CardTitle>Homework from this session</CardTitle>
                {canAuthorFollowUp(db, me, a) && <CardAction><Button variant="ghost" size="sm" onClick={() => setHw(true)}><NotebookPen /> Assign</Button></CardAction>}
              </CardHeader>
              <CardContent className="grid gap-2">
                {homework.length ? homework.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <span>{h.title}{h.due && <span className="text-muted-foreground block text-xs">Due {shortDate(h.due)}</span>}</span>
                    <StatusBadge tone={h.status === 'complete' ? 'success' : 'info'}>{h.status}</StatusBadge>
                  </div>
                )) : <p className="text-muted-foreground text-sm">Homework is written by the coach. A follow-up mentioning next steps doesn’t create an assignment by itself.</p>}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <KV
                items={[
                  ['Session type', st.name],
                  ['Credit cost', a.kind === 'consultation' ? 'None (not coaching)' : num(a.credits)],
                  ['Coach', `${coach.name}${a.viaPool ? ' (pool)' : ''}`],
                  ['Series', a.seriesId ? 'Weekly recurring' : 'One-time'],
                  ['Booked by', a.createdBy === 'seed' ? 'Imported' : a.createdBy],
                ]}
              />
              <div className="rounded-md border p-3 text-sm">
                {a.meeting.type === 'in_person' || a.meeting.type === 'phone' ? (
                  <div className="flex items-center gap-2"><MapPin className="size-4" /> {a.meeting.location}</div>
                ) : a.meeting.status === 'ready' ? (
                  <a href={a.meeting.url} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-2 hover:underline"><Video className="size-4" /> Zoom meeting ready</a>
                ) : (
                  <div className="text-destructive flex items-center gap-2"><Video className="size-4" /> Zoom link failed — confirmations hold until a link exists</div>
                )}
              </div>
              {a.kind === 'coaching' && (
                <div className="text-muted-foreground text-xs">Policy snapshot: {a.policy.noticeHours}h notice · late cancel {a.policy.lateOutcome === 'forfeit' ? 'uses credit' : 'keeps credit'} · no-show {a.policy.noShowOutcome === 'forfeit' ? 'uses credit' : 'keeps credit'}</div>
              )}
              {a.cancelReason && <div className="bg-muted/60 rounded-md p-2 text-xs">Cancelled by {a.canceledBy}: {a.cancelReason}{a.exception && ` · Exception: ${a.exception.reason}`}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Reminders</CardTitle>
              <CardDescription>Recalculated whenever the appointment changes.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm">
                {reminderPlan(db, a).map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    {r.channel === 'email' ? <Mail className="text-muted-foreground mt-0.5 size-3.5" /> : <MessageSquare className="text-muted-foreground mt-0.5 size-3.5" />}
                    <span className="min-w-0 flex-1">
                      <span className="block">{r.to}</span>
                      <span className="text-muted-foreground block text-xs">{shortDate(r.at.toISOString())} {time(r.at.toISOString())}{r.reason ? ` · ${r.reason}` : ''}</span>
                    </span>
                    <Badge variant="outline" className="text-[10px]">{r.state}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <CancelDialog appt={a} open={cancel} onOpenChange={setCancel} staff={me} actorLabel={me.name} />
      {resched && <BookingDialog open onOpenChange={setResched} reschedule={a} actorKind="staff" actorLabel={me.name} />}
      {student && <HomeworkDialog open={hw} onOpenChange={setHw} student={student} me={me} appointmentId={a.id} />}
    </>
  )
}

function LockedCard() {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 text-sm">
        <Lock className="text-muted-foreground mt-0.5 size-4" />
        <div>
          <div className="font-medium">Private notes and source material are restricted</div>
          <div className="text-muted-foreground">Only the session’s coach, the assigned coach, or staff with an explicit private-notes grant can read them. Operational access doesn’t include coaching content.</div>
        </div>
      </CardContent>
    </Card>
  )
}

function SourceCard({ a, me }: { a: Appointment; me: Staff }) {
  const [notes, setNotes] = React.useState(a.privateNotes ?? '')
  const [manual, setManual] = React.useState('')
  const [tab, setTab] = React.useState(a.source?.kind === 'manual' || a.source?.kind === 'transcript' ? a.source.kind : 'zoom')
  const src = a.source
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session source and notes</CardTitle>
        <CardDescription>The original source stays private to authorised staff and is never forwarded to families.</CardDescription>
        <CardAction>
          {src?.status === 'ready' ? <StatusBadge tone="success">Source ready</StatusBadge> : src?.status === 'unavailable' ? <StatusBadge tone="warning">Summary unavailable</StatusBadge> : <StatusBadge tone="neutral">Waiting for source</StatusBadge>}
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="zoom">Zoom summary</TabsTrigger>
            <TabsTrigger value="manual">Manual notes</TabsTrigger>
            <TabsTrigger value="transcript">Paste transcript</TabsTrigger>
          </TabsList>
          <TabsContent value="zoom" className="grid gap-3">
            {src?.status === 'ready' && src.kind === 'zoom' ? (
              <div className="bg-muted/50 rounded-md p-3 text-sm leading-relaxed">{src.text}</div>
            ) : (
              <div className="text-muted-foreground text-sm">{src?.status === 'unavailable' ? 'Zoom didn’t produce a summary for this meeting instance. Use manual notes or a transcript instead.' : 'Import the authorised Zoom meeting summary for this meeting instance.'}</div>
            )}
            {(!src || src.status !== 'ready' || src.kind !== 'zoom') && (
              <Button variant="outline" size="sm" className="justify-self-start" onClick={() => run(actions.importZoom(a.id), 'Zoom summary imported')}>
                {src?.status === 'unavailable' ? <RefreshCw /> : <Download />} {src?.status === 'unavailable' ? 'Retry import' : 'Import Zoom summary'}
              </Button>
            )}
          </TabsContent>
          {(['manual', 'transcript'] as const).map((k) => (
            <TabsContent key={k} value={k} className="grid gap-3">
              {src?.kind === k && src.status === 'ready' && <div className="bg-muted/50 rounded-md p-3 text-sm leading-relaxed">{src.text}</div>}
              <Textarea rows={5} value={manual} onChange={(e) => setManual(e.target.value)} placeholder={k === 'manual' ? 'What you worked on, what went well, what the student agreed to next…' : 'Paste an existing transcript'} />
              <Button size="sm" variant="outline" className="justify-self-start" onClick={() => run(actions.setSource(a.id, k, manual, me.id), 'Source saved')}>Use as source</Button>
            </TabsContent>
          ))}
        </Tabs>
        <div className="grid gap-2">
          <div className="flex items-center gap-2 text-sm font-medium"><Lock className="size-3.5" /> Private coach notes</div>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => actions.saveNotes(a.id, notes)} placeholder="Only you and authorised staff see these. Excluded from family follow-up drafts." />
        </div>
      </CardContent>
    </Card>
  )
}

function FollowUpCard({ a, me, fu }: { a: Appointment; me: Staff; fu?: FollowUp }) {
  const db = useDB()
  const [mode, setMode] = React.useState<'separate' | 'shared'>(fu?.mode ?? 'separate')
  const [active, setActive] = React.useState(fu?.versions[0]?.audience ?? 'student')
  React.useEffect(() => {
    if (fu && !fu.versions.some((v) => v.audience === active)) setActive(fu.versions[0].audience)
  }, [fu, active])
  const ready = a.source?.status === 'ready'
  const auto = db.business.policies.followUpMode === 'automatic'

  if (!fu || fu.status !== 'published') {
    const planned = fu ? plannedDeliveries(db, fu) : []
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="text-primary size-4" /> Follow-up</CardTitle>
          <CardDescription>{auto ? 'Automatic sending is on for this business.' : 'Manual approval: nothing is sent until you publish.'} Drafting is simulated — the text-generation provider isn’t selected yet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!ready ? (
            <Empty title="Add a source first">Import the Zoom summary or add manual notes. A missing source never produces invented content.</Empty>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                  <SelectTrigger className="w-60" size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="separate">Student and parent versions</SelectItem>
                    <SelectItem value="shared">One shared version</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant={fu ? 'outline' : 'default'} onClick={() => run(actions.generateFollowUp(a.id, mode, me.id), 'Drafts prepared from the permitted source')}>
                  <Sparkles /> {fu ? 'Redraft' : 'Prepare drafts'}
                </Button>
              </div>
              {fu && (
                <>
                  <Tabs value={active} onValueChange={(v) => setActive(v as typeof active)}>
                    <TabsList>
                      {fu.versions.map((v) => <TabsTrigger key={v.audience} value={v.audience}>{v.audience === 'student' ? 'Student version' : v.audience === 'parent' ? 'Parent version' : 'Shared version'}</TabsTrigger>)}
                    </TabsList>
                    {fu.versions.map((v) => (
                      <TabsContent key={v.audience} value={v.audience} className="grid gap-2">
                        <Input value={v.subject} onChange={(e) => actions.updateFollowUpVersion(fu.id, v.audience, { subject: e.target.value })} />
                        <Textarea rows={11} value={v.body} onChange={(e) => actions.updateFollowUpVersion(fu.id, v.audience, { body: e.target.value })} className="font-[inherit] leading-relaxed" />
                      </TabsContent>
                    ))}
                  </Tabs>
                  <div>
                    <div className="mb-2 text-sm font-medium">Recipients</div>
                    <ul className="grid gap-1.5 text-sm">
                      {planned.map((d) => (
                        <li key={d.recipient} className="flex items-center justify-between rounded-md border px-3 py-2">
                          <span>{d.recipient} <span className="text-muted-foreground text-xs">· {d.recipientKind} · {d.version} version</span></span>
                          {d.status === 'held' ? <span className="text-muted-foreground text-xs">Held — {d.reason}</span> : <Badge variant="outline">Portal + email</Badge>}
                        </li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground mt-2 text-xs">Each person receives only the version their own permissions allow. Recipients aren’t combined in a visible email list. SMS never carries follow-ups.</p>
                  </div>
                  <Button className="justify-self-start" onClick={() => run(actions.publishFollowUp(fu.id, me.id))}><Send /> Approve and publish</Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    )
  }
  return <PublishedOnly fu={fu} />
}

function PublishedOnly({ fu }: { fu: FollowUp }) {
  const db = useDB()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="text-primary size-4" /> Follow-up published</CardTitle>
        <CardDescription>{fu.publishedAt && `${relative(fu.publishedAt)} by ${db.staff.find((s) => s.id === fu.publishedBy)?.name ?? 'automatic sending'}`}. Repeated events won’t send it again.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {fu.versions.map((v) => (
          <details key={v.audience} className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">{v.subject} <span className="text-muted-foreground font-normal">· {v.audience}</span></summary>
            <pre className="text-muted-foreground mt-2 font-[inherit] whitespace-pre-wrap">{v.body}</pre>
          </details>
        ))}
        <ul className="grid gap-1.5 text-sm">
          {fu.deliveries.map((d) => (
            <li key={d.recipient} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>{d.recipient} <span className="text-muted-foreground text-xs">· {d.version} version</span></span>
              <StatusBadge tone={d.status === 'held' ? 'neutral' : 'success'}>{d.status === 'held' ? `Held — ${d.reason}` : d.status === 'delivered' ? 'Delivered' : 'Sent'}</StatusBadge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function BookingDetails({ a, me }: { a: Appointment; me: Staff }) {
  const db = useDB()
  const et = db.eventTypes.find((e) => e.id === a.eventTypeId)
  const p = a.payment
  return (
    <Card>
      <CardHeader>
        <CardTitle>{et ? et.name : 'Fit call'}</CardTitle>
        <CardDescription>{et ? 'Booked from a public booking page.' : 'Free fit call booked by staff.'} Separate from coaching: it doesn’t enroll anyone or use credits.</CardDescription>
        {a.inquiryId && <CardAction><Button variant="outline" size="sm" asChild><Link to={`/app/inquiries?open=${a.inquiryId}`}>Open inquiry</Link></Button></CardAction>}
      </CardHeader>
      <CardContent className="grid gap-4">
        {a.guest && <KV items={[['Booked by', a.guest.name], ['Email', a.guest.email], ...(a.guest.phone ? [['Phone', a.guest.phone] as [string, string]] : [])]} />}
        {p && (
          <div className="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2 text-sm">
            <span>{canSeePricing(me) ? `${money(p.amountCents)} via Stripe` : 'Paid call'}</span>
            <StatusBadge tone={p.status === 'paid' ? 'success' : p.status === 'refunded' ? 'neutral' : 'warning'}>{p.status === 'paid' ? 'Paid' : p.status === 'refunded' ? 'Refunded' : 'Kept (late cancellation)'}</StatusBadge>
          </div>
        )}
        {a.answers && a.answers.length > 0 ? (
          <div>
            <div className="mb-2 text-sm font-medium">Questionnaire</div>
            <dl className="grid gap-3 text-sm">
              {a.answers.map((x) => (
                <div key={x.questionId}>
                  <dt className="text-muted-foreground text-xs">{x.label}</dt>
                  <dd>{x.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : a.guest ? <p className="text-muted-foreground text-sm">No optional questions were answered.</p> : null}
        {p?.status === 'paid' && a.status === 'scheduled' && <p className="text-muted-foreground text-xs">Cancelling from this page refunds the guest automatically.</p>}
      </CardContent>
    </Card>
  )
}
