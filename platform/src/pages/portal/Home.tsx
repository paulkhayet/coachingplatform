import * as React from 'react'
import { Link } from 'react-router'
import { CalendarPlus, Video, MapPin, Sparkles, NotebookPen, ArrowRight, Clock } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Empty } from '@/components/page'
import { CreditSummary } from '@/components/credit-summary'
import { BookingDialog } from '@/components/booking-dialog'
import { CancelDialog } from '@/components/cancel-dialog'
import { CoverageBadge } from '@/components/status'
import { useDB, useViewer } from '@/lib/store'
import { activePurchases, apptCoverage, purchaseBalance } from '@/lib/credits'
import { dayLabel, shortDate, time } from '@/lib/format'
import { portalContext } from './context'
import type { Appointment } from '@/lib/types'
import { TriangleAlert } from 'lucide-react'

export function visibleFollowUps(db: ReturnType<typeof useDB>, ctx: ReturnType<typeof portalContext>) {
  return db.followUps
    .filter((f) => f.studentId === ctx.student.id && f.status === 'published')
    .map((f) => {
      const mine = f.deliveries.find((d) => d.recipient === ctx.name && d.status !== 'held')
      if (!mine) return null
      const v = f.versions.find((x) => x.audience === mine.version)
      return v ? { f, v } : null
    })
    .filter(Boolean) as { f: (typeof db.followUps)[number]; v: (typeof db.followUps)[number]['versions'][number] }[]
}

export default function PortalHome() {
  const db = useDB()
  const viewer = useViewer()
  const ctx = portalContext(db, viewer)
  const s = ctx.student
  const [book, setBook] = React.useState(false)
  const [cancel, setCancel] = React.useState<Appointment | null>(null)
  const [resched, setResched] = React.useState<Appointment | null>(null)
  const upcoming = db.appointments.filter((a) => a.studentId === s.id && a.status === 'scheduled' && new Date(a.start).getTime() > Date.now() - 3600000).sort((a, b) => a.start.localeCompare(b.start))
  const next = upcoming[0]
  const p = activePurchases(db, s.id)[0]
  const bal = p ? purchaseBalance(db, p.id) : null
  const fus = ctx.perms.followUps ? visibleFollowUps(db, ctx) : []
  const hw = ctx.perms.homework ? db.homework.filter((h) => h.studentId === s.id && h.status === 'assigned' && (ctx.isStudent || h.guardiansCanSee)) : []
  const coach = db.staff.find((x) => x.id === next?.coachId) ?? db.staff.find((x) => x.id === s.assignedCoachId)
  const unpaid = upcoming.filter((a) => apptCoverage(db, a) === 'payment_needed')

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Hi, {ctx.name.split(' ')[0]}.</h1>
        <p className="text-muted-foreground mt-1">{ctx.isStudent ? 'Here’s what’s coming up.' : `Here’s how ${s.name.split(' ')[0]}’s coaching is going.`}</p>
      </div>

      {unpaid.length > 0 && (ctx.perms.billing || ctx.link?.payer) && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>{unpaid.length} upcoming session{unpaid.length > 1 ? 's are' : ' is'} waiting for payment</AlertTitle>
          <AlertDescription>
            <span>Sessions need to be paid for before they happen. Unpaid reservations are released {db.business.policies.unpaidCutoffHours} hours before the session. <Link to="/portal/billing" className="text-primary font-medium hover:underline">Review billing</Link></span>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Next session</CardTitle>
          {ctx.perms.book && bal && <CardAction><Button size="sm" onClick={() => setBook(true)}><CalendarPlus /> Book</Button></CardAction>}
        </CardHeader>
        <CardContent>
          {next ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-2xl font-semibold tracking-tight">{dayLabel(next.start)} at {time(next.start)}</div>
                <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                  {next.meeting.type === 'in_person' ? <MapPin className="size-4" /> : <Video className="size-4" />}
                  {db.sessionTypes.find((t) => t.id === next.sessionTypeId)?.name} with {coach?.name} · {next.minutes} min
                </div>
                <div className="mt-2"><CoverageBadge coverage={apptCoverage(db, next)} /></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {next.meeting.url && <Button asChild><a href={next.meeting.url} target="_blank" rel="noreferrer"><Video /> Join Zoom</a></Button>}
                {next.meeting.location && <Button variant="outline" disabled><MapPin /> {next.meeting.location}</Button>}
                {ctx.perms.book && (
                  <>
                    <Button variant="outline" onClick={() => setResched(next)}>Reschedule</Button>
                    <Button variant="ghost" onClick={() => setCancel(next)}>Cancel</Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <Empty title="Nothing booked yet" action={ctx.perms.book && bal ? <Button size="sm" onClick={() => setBook(true)}>Book a session</Button> : undefined}>
              {ctx.perms.book ? 'Pick a time that works for you.' : 'Your coach or a parent with booking rights will schedule the next session.'}
            </Empty>
          )}
        </CardContent>
      </Card>

      {bal && (
        <Card>
          <CardHeader>
            <CardTitle>{bal.purchase.name}</CardTitle>
            <CardDescription>Sessions are counted in credits. A 60-minute session uses 1 credit; a 30-minute check-in uses ½.</CardDescription>
          </CardHeader>
          <CardContent><CreditSummary bal={bal} showMoney={ctx.perms.billing} /></CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {ctx.perms.followUps && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="text-primary size-4" /> Latest follow-up</CardTitle>
              <CardAction><Button variant="ghost" size="sm" asChild><Link to="/portal/follow-ups">All <ArrowRight /></Link></Button></CardAction>
            </CardHeader>
            <CardContent>
              {fus[0] ? (
                <div>
                  <div className="font-medium">{fus[0].v.subject}</div>
                  <p className="text-muted-foreground mt-1 line-clamp-4 text-sm whitespace-pre-line">{fus[0].v.body}</p>
                </div>
              ) : <p className="text-muted-foreground text-sm">Your coach’s session notes will appear here.</p>}
            </CardContent>
          </Card>
        )}
        {ctx.perms.homework && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><NotebookPen className="size-4" /> Homework</CardTitle>
              <CardAction><Button variant="ghost" size="sm" asChild><Link to="/portal/homework">All <ArrowRight /></Link></Button></CardAction>
            </CardHeader>
            <CardContent className="grid gap-2">
              {hw.length ? hw.map((h) => (
                <Link key={h.id} to="/portal/homework" className="hover:bg-muted/50 rounded-md border p-3 text-sm">
                  <div className="font-medium">{h.title}</div>
                  {h.due && <div className="text-muted-foreground flex items-center gap-1 text-xs"><Clock className="size-3" /> Due {shortDate(h.due)}</div>}
                </Link>
              )) : <p className="text-muted-foreground text-sm">Nothing due right now.</p>}
            </CardContent>
          </Card>
        )}
      </div>

      <BookingDialog open={book} onOpenChange={setBook} fixedStudentId={s.id} students={[s]} actorKind="family" actorLabel={ctx.actorLabel} />
      <CancelDialog appt={cancel} open={!!cancel} onOpenChange={(o) => !o && setCancel(null)} actorLabel={ctx.actorLabel} />
      {resched && <BookingDialog open onOpenChange={(o) => !o && setResched(null)} reschedule={resched} actorKind="family" actorLabel={ctx.actorLabel} />}
    </div>
  )
}
