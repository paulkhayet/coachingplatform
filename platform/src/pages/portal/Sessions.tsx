import * as React from 'react'
import { CalendarPlus, Video, MapPin } from 'lucide-react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/page'
import { ApptStatusBadge, CoverageBadge } from '@/components/status'
import { BookingDialog } from '@/components/booking-dialog'
import { CancelDialog } from '@/components/cancel-dialog'
import { useDB, useViewer } from '@/lib/store'
import { activePurchases, apptCoverage } from '@/lib/credits'
import { shortDate, time, tzLabel } from '@/lib/format'
import { portalContext } from './context'
import type { Appointment } from '@/lib/types'

export default function PortalSessions() {
  const db = useDB()
  const ctx = portalContext(db, useViewer())
  const s = ctx.student
  const [book, setBook] = React.useState(false)
  const [cancel, setCancel] = React.useState<Appointment | null>(null)
  const [resched, setResched] = React.useState<Appointment | null>(null)
  const all = db.appointments.filter((a) => a.studentId === s.id)
  const upcoming = all.filter((a) => a.status === 'scheduled' && new Date(a.start) > new Date()).sort((a, b) => a.start.localeCompare(b.start))
  const past = all.filter((a) => !upcoming.includes(a)).sort((a, b) => b.start.localeCompare(a.start))
  const canBook = ctx.perms.book && activePurchases(db, s.id).length > 0
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
        <p className="text-muted-foreground text-sm">Times in {tzLabel()}.{!ctx.perms.book && ' You can view sessions; booking changes are handled by someone with booking rights.'}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
          {canBook && <CardAction><Button size="sm" onClick={() => setBook(true)}><CalendarPlus /> Book</Button></CardAction>}
        </CardHeader>
        <CardContent className="grid gap-2">
          {upcoming.length ? upcoming.map((a) => (
            <div key={a.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="font-medium">{shortDate(a.start)} · {time(a.start)}</div>
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  {a.meeting.type === 'in_person' ? <MapPin className="size-3" /> : <Video className="size-3" />}
                  {db.sessionTypes.find((t) => t.id === a.sessionTypeId)?.name} with {db.staff.find((x) => x.id === a.coachId)?.name}{a.isMakeup ? ' · makeup' : ''}
                </div>
              </div>
              <CoverageBadge coverage={apptCoverage(db, a)} />
              {ctx.perms.book && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setResched(a)}>Reschedule</Button>
                  <Button size="sm" variant="ghost" onClick={() => setCancel(a)}>Cancel</Button>
                </div>
              )}
            </div>
          )) : <Empty title="No upcoming sessions" />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Past</CardTitle></CardHeader>
        <CardContent className="grid gap-1">
          {past.length ? past.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
              <span>{shortDate(a.start)} · {time(a.start)}</span>
              <ApptStatusBadge status={a.status} />
            </div>
          )) : <Empty title="No past sessions" />}
        </CardContent>
      </Card>
      <BookingDialog open={book} onOpenChange={setBook} fixedStudentId={s.id} students={[s]} actorKind="family" actorLabel={ctx.actorLabel} />
      <CancelDialog appt={cancel} open={!!cancel} onOpenChange={(o) => !o && setCancel(null)} actorLabel={ctx.actorLabel} />
      {resched && <BookingDialog open onOpenChange={(o) => !o && setResched(null)} reschedule={resched} actorKind="family" actorLabel={ctx.actorLabel} />}
    </div>
  )
}
