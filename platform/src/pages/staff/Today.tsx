import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { isToday, addDays, startOfDay } from 'date-fns'
import { CalendarPlus, Check, CircleCheck, Circle, Play, Video, MapPin, ArrowRight } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Avatar } from '@/components/ui/avatar'
import { PageHeader, Stat, Empty } from '@/components/page'
import { CoverageBadge, ApptStatusBadge } from '@/components/status'
import { BookingDialog } from '@/components/booking-dialog'
import { useDB, useStaffViewer, actions } from '@/lib/store'
import { apptCoverage, type PurchaseBalance } from '@/lib/credits'
import { visibleStudents } from '@/lib/permissions'
import { time, relative, shortDate } from '@/lib/format'
import { run } from '@/components/run'
import type { Appointment, DB } from '@/lib/types'

export function apptTitle(db: DB, a: Appointment) {
  if (a.studentId) return db.students.find((s) => s.id === a.studentId)!.name
  const inq = db.inquiries.find((i) => i.id === a.inquiryId)
  const et = a.eventTypeId ? db.eventTypes.find((e) => e.id === a.eventTypeId) : null
  const label = et ? et.name.toLowerCase() : 'fit call'
  return inq ? `${inq.studentName} (${label})` : a.guest ? `${a.guest.name} (${label})` : 'Fit call'
}

export function MeetingIcon({ a }: { a: Appointment }) {
  if (a.meeting.type === 'in_person') return <MapPin className="text-muted-foreground size-3.5" />
  return <Video className={a.meeting.status === 'ready' ? 'text-muted-foreground size-3.5' : 'text-destructive size-3.5'} />
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function Today() {
  const db = useDB()
  const me = useStaffViewer()!
  const nav = useNavigate()
  const [scope, setScope] = React.useState<'mine' | 'team'>(me.role === 'admin' ? 'team' : 'mine')
  const [booking, setBooking] = React.useState(false)
  const students = visibleStudents(db, me)
  const visible = new Set(students.map((s) => s.id))
  const cache = new Map<string, PurchaseBalance>()

  const inScope = (a: Appointment) => (scope === 'mine' ? a.coachId === me.id : a.studentId ? visible.has(a.studentId) : true)
  const today = db.appointments.filter((a) => isToday(new Date(a.start)) && inScope(a) && a.status !== 'canceled_timely').sort((a, b) => a.start.localeCompare(b.start))
  const week = db.appointments
    .filter((a) => a.status === 'scheduled' && inScope(a) && new Date(a.start) >= addDays(startOfDay(new Date()), 1) && new Date(a.start) < addDays(startOfDay(new Date()), 8))
    .sort((a, b) => a.start.localeCompare(b.start))
  const tasks = db.tasks.filter((t) => t.assigneeId === me.id && t.status === 'open')
  const drafts = db.followUps.filter((f) => f.status === 'draft' && visible.has(f.studentId) && (me.role !== 'coach' || f.coachId === me.id))
  const inquiries = db.inquiries.filter((i) => !['enrolled', 'declined'].includes(i.stage) && (me.role !== 'coach' || i.matchedCoachId === me.id))
  const unfunded = db.appointments.filter((a) => a.status === 'scheduled' && a.kind === 'coaching' && a.studentId && visible.has(a.studentId) && new Date(a.start) > new Date() && apptCoverage(db, a, cache) === 'payment_needed')
  const issues = db.issues.filter((i) => i.status === 'open' && (me.role !== 'coach' || i.ownerId === me.id))

  const setup = [
    { label: 'Create your business', done: true },
    { label: 'Invite your team', done: db.staff.length > 1 },
    { label: 'Connect Stripe', done: db.business.integrations.stripe.status === 'connected' },
    { label: 'Connect Zoom', done: db.business.integrations.zoom.status === 'connected' },
    { label: 'Every coach connects Google Calendar', done: db.staff.filter((s) => s.coaches && s.status === 'active').every((s) => s.googleConnected && s.calendarHealthy) },
    { label: 'Publish an offering with cancellation terms', done: db.offerings.some((o) => o.active) },
    { label: 'Add existing clients', done: db.students.some((s) => s.manualEntry) },
  ]
  const setupDone = setup.filter((s) => s.done).length

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${me.name.split(' ')[0]}`}
        description={`${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · ${me.role === 'coach' ? 'Your coaching day' : 'Your business at a glance'}`}
        actions={
          <>
            {me.role !== 'coach' && (
              <Button variant="outline" size="sm" onClick={() => run(actions.runScheduledJobs())}>
                <Play /> Run scheduled jobs
              </Button>
            )}
            <Button size="sm" onClick={() => setBooking(true)}>
              <CalendarPlus /> New booking
            </Button>
          </>
        }
      />

      {me.role === 'owner' && setupDone < setup.length && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Finish setting up {db.business.name}</CardTitle>
            <CardDescription>{setupDone} of {setup.length} complete</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Progress value={(setupDone / setup.length) * 100} />
            <div className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {setup.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  {s.done ? <CircleCheck className="text-success size-4" /> : <Circle className="text-muted-foreground size-4" />}
                  <span className={s.done ? 'text-muted-foreground' : ''}>{s.label}</span>
                  {!s.done && s.label.includes('Google') && <Link to="/app/settings?tab=integrations" className="text-primary ml-auto text-xs">Fix</Link>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={scope === 'mine' ? 'Your sessions today' : 'Team sessions today'} value={today.filter((a) => !a.status.startsWith('canceled')).length} hint={today.find((a) => a.status === 'scheduled' && new Date(a.start) > new Date()) ? `Next at ${time(today.find((a) => a.status === 'scheduled' && new Date(a.start) > new Date())!.start)}` : 'No more today'} />
        <Stat label={me.role === 'coach' ? 'Your inquiries' : 'Open inquiries'} value={inquiries.length} hint={`${inquiries.filter((i) => i.stage === 'new').length} new`} />
        <Stat label="Follow-ups to review" value={drafts.length} hint={drafts[0] ? db.students.find((s) => s.id === drafts[0].studentId)?.name : 'All caught up'} />
        <Stat label="Sessions awaiting payment" value={unfunded.length} hint={me.role === 'coach' ? 'Admin is notified' : `Released ${db.business.policies.unpaidCutoffHours}h before if unpaid`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Today’s sessions</CardTitle>
              <CardDescription>Coverage shows whether a session is paid for, without amounts.</CardDescription>
              {me.role !== 'coach' && me.coaches && (
                <CardAction>
                  <Tabs value={scope} onValueChange={(v) => setScope(v as 'mine' | 'team')}>
                    <TabsList className="h-8">
                      <TabsTrigger value="mine" className="text-xs">Mine</TabsTrigger>
                      <TabsTrigger value="team" className="text-xs">Team</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="px-0">
              {today.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Time</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead className="pr-5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {today.map((a) => {
                      const st = db.sessionTypes.find((s) => s.id === a.sessionTypeId)!
                      return (
                        <TableRow key={a.id} className="cursor-pointer" onClick={() => nav(`/app/sessions/${a.id}`)}>
                          <TableCell className="text-muted-foreground pl-5 tabular-nums">{time(a.start)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar name={apptTitle(db, a)} className="size-7 text-[10px]" />
                              <div className="min-w-0">
                                <div className="truncate font-medium">{apptTitle(db, a)}</div>
                                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                                  <MeetingIcon a={a} /> {st.name}
                                  {scope === 'team' && ` · ${db.staff.find((s) => s.id === a.coachId)?.name.split(' ')[0]}`}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell"><ApptStatusBadge status={a.status} /></TableCell>
                          <TableCell><CoverageBadge coverage={apptCoverage(db, a, cache)} /></TableCell>
                          <TableCell className="pr-5 text-right"><ArrowRight className="text-muted-foreground ml-auto size-4" /></TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="px-5"><Empty title="No sessions today">Enjoy the quiet, or book something new.</Empty></div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next 7 days</CardTitle>
              <CardAction><Button variant="ghost" size="sm" asChild><Link to="/app/calendar">Calendar <ArrowRight /></Link></Button></CardAction>
            </CardHeader>
            <CardContent>
              {week.length ? (
                <ul className="divide-y text-sm">
                  {week.slice(0, 8).map((a) => (
                    <li key={a.id}>
                      <Link to={`/app/sessions/${a.id}`} className="hover:bg-muted/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2">
                        <span className="text-muted-foreground w-28 shrink-0 text-xs">{shortDate(a.start)} · {time(a.start)}</span>
                        <span className="min-w-0 flex-1 truncate">{apptTitle(db, a)}</span>
                        <CoverageBadge coverage={apptCoverage(db, a, cache)} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="Nothing booked this week" />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Your tasks</CardTitle>
              <CardDescription>{tasks.length ? `${tasks.length} open` : 'Nothing assigned to you'}</CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.length ? (
                <ul className="grid gap-1">
                  {tasks.map((t) => (
                    <li key={t.id} className="group hover:bg-muted/50 -mx-2 flex items-start gap-2.5 rounded-md px-2 py-2">
                      <button onClick={() => actions.setTask(t.id, 'done')} className="text-muted-foreground hover:text-success mt-0.5" aria-label="Mark done">
                        <Circle className="size-4 group-hover:hidden" />
                        <Check className="hidden size-4 group-hover:block" />
                      </button>
                      <Link to={t.link ?? '#'} className="min-w-0 flex-1">
                        <div className="text-sm leading-snug font-medium">{t.title}</div>
                        <div className="text-muted-foreground mt-0.5 text-xs leading-snug">{t.detail}</div>
                        <div className="text-muted-foreground mt-1 text-[11px]">{relative(t.createdAt)}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon={<CircleCheck />} title="You’re all caught up" />
              )}
            </CardContent>
          </Card>

          {issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Needs attention</CardTitle>
                <CardAction><Button variant="ghost" size="sm" asChild><Link to="/app/issues">All</Link></Button></CardAction>
              </CardHeader>
              <CardContent className="grid gap-2">
                {issues.slice(0, 4).map((i) => (
                  <Link key={i.id} to={i.link ?? '/app/issues'} className="hover:bg-muted/50 -mx-2 flex gap-2.5 rounded-md px-2 py-1.5">
                    <span className="bg-warning mt-1.5 size-2 shrink-0 rounded-full" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{i.title}</span>
                      <span className="text-muted-foreground block text-xs">{i.detail}</span>
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {drafts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Follow-ups ready</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {drafts.map((f) => (
                  <Link key={f.id} to={`/app/sessions/${f.appointmentId}`} className="hover:bg-muted/50 -mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm">
                    <Avatar name={db.students.find((s) => s.id === f.studentId)!.name} className="size-7 text-[10px]" />
                    <span className="flex-1">{db.students.find((s) => s.id === f.studentId)!.name}</span>
                    <span className="text-primary text-xs">Review</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <BookingDialog open={booking} onOpenChange={setBooking} students={students} actorKind="staff" actorLabel={me.name} allowRecurring />
    </>
  )
}

