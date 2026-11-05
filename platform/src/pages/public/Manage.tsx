import * as React from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { format } from 'date-fns'
import { CircleCheck, CalendarX, CalendarClock, Video, CalendarPlus, TriangleAlert, Receipt } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { useDB, actions } from '@/lib/store'
import { money, date } from '@/lib/format'
import { run } from '@/components/run'
import { EventSummary, Shell, TimePicker } from './Book'

function icsHref(title: string, start: Date, minutes: number, where: string) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const end = new Date(start.getTime() + minutes * 60000)
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//schedulefa.st//EN', 'BEGIN:VEVENT', `DTSTART:${f(start)}`, `DTEND:${f(end)}`, `SUMMARY:${title}`, `LOCATION:${where}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`
}

export default function Manage() {
  const { token } = useParams()
  const [params, setParams] = useSearchParams()
  const db = useDB()
  const [mode, setMode] = React.useState<'view' | 'reschedule' | 'cancel'>('view')
  const [reason, setReason] = React.useState('')
  const a = db.appointments.find((x) => x.manageToken === token)
  const et = a && db.eventTypes.find((e) => e.id === a.eventTypeId)
  if (!a || !et) return <Shell><Alert variant="destructive"><TriangleAlert /><AlertTitle>We couldn’t find this booking</AlertTitle><AlertDescription>The link may be incomplete. Check your confirmation email.</AlertDescription></Alert></Shell>

  const start = new Date(a.start)
  const host = db.staff.find((s) => s.id === a.coachId)!
  const canceled = a.status.startsWith('canceled')
  const past = start < new Date()
  const hoursLeft = (start.getTime() - Date.now()) / 3600000
  const refundable = a.payment?.status === 'paid' && hoursLeft >= et.refundCutoffHours
  const justBooked = params.get('new') === '1'
  const where = a.meeting.url ?? a.meeting.location ?? 'Online'

  return (
    <Shell>
      <Card className="overflow-hidden py-0 md:grid md:grid-cols-[300px_minmax(0,1fr)]">
        <div className="border-b p-6 md:border-r md:border-b-0"><EventSummary et={et} start={start} hostId={a.coachId} /></div>
        <div className="grid content-start gap-5 p-6">
          {canceled ? (
            <div className="grid justify-items-start gap-2">
              <CalendarX className="text-muted-foreground size-8" />
              <h2 className="text-xl font-semibold">This booking was cancelled</h2>
              <p className="text-muted-foreground text-sm">{a.cancelReason}{a.canceledBy && ` · by ${a.canceledBy}`}</p>
              {a.payment && <p className="text-sm">{a.payment.status === 'refunded' ? `${money(a.payment.amountCents)} refunded to your card${a.payment.refundedAt ? ` on ${date(a.payment.refundedAt)}` : ''}.` : `Cancelled within ${et.refundCutoffHours} hours, so the ${money(a.payment.amountCents)} payment was kept.`}</p>}
              <Button asChild className="mt-2"><Link to={`/b/${db.business.slug}/${et.slug}`}>Book a new time</Link></Button>
            </div>
          ) : mode === 'reschedule' ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Pick a new time</h2>
                <Button variant="ghost" size="sm" onClick={() => setMode('view')}>Keep current time</Button>
              </div>
              <p className="text-muted-foreground text-sm">{a.payment ? 'Your payment carries over — no new charge.' : 'Free to change.'}</p>
              <TimePicker et={et} ignoreId={a.id} initialHost={a.coachId} onPick={(s, h) => { if (run(actions.guestReschedule(a.manageToken!, s, h))) { setMode('view'); setParams({}) } }} />
            </>
          ) : (
            <>
              {justBooked ? (
                <div className="grid gap-1">
                  <CircleCheck className="text-success size-8" />
                  <h2 className="text-xl font-semibold">You’re scheduled</h2>
                  <p className="text-muted-foreground text-sm">A confirmation is on its way to {a.guest?.email}{a.payment ? ' with your receipt' : ''}.</p>
                </div>
              ) : (
                <h2 className="text-xl font-semibold">{past ? 'This call has taken place' : 'Your booking'}</h2>
              )}
              <div className="grid gap-2 text-sm">
                <div className="font-medium">{format(start, "EEEE, MMMM d, yyyy 'at' h:mm a")}</div>
                <div className="text-muted-foreground">with {host.name} · {et.minutes} min</div>
                {a.meeting.url && <a href={a.meeting.url} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-1.5 hover:underline"><Video className="size-4" /> Join Zoom</a>}
                {a.meeting.location && <div>{a.meeting.location}</div>}
                {a.meeting.status === 'error' && <div className="text-warning">The meeting link is being set up. We’ll email it before the call.</div>}
              </div>
              {a.payment && (
                <div className="bg-muted/40 flex items-center gap-3 rounded-md border p-3 text-sm">
                  <Receipt className="text-muted-foreground size-4" />
                  <span className="flex-1">Paid {money(a.payment.amountCents)} · {date(a.payment.paidAt)}</span>
                  <span className="text-muted-foreground text-xs">{a.payment.ref}</span>
                </div>
              )}
              {a.answers && a.answers.length > 0 && (
                <details className="text-sm">
                  <summary className="text-muted-foreground cursor-pointer">Your answers</summary>
                  <dl className="mt-2 grid gap-2">
                    {a.answers.map((x) => <div key={x.questionId}><dt className="text-muted-foreground text-xs">{x.label}</dt><dd>{x.value}</dd></div>)}
                  </dl>
                </details>
              )}
              {!past && (
                <>
                  <Separator />
                  {mode === 'cancel' ? (
                    <div className="grid gap-3">
                      <Alert variant={a.payment && !refundable ? 'warning' : 'info'}>
                        <TriangleAlert />
                        <AlertTitle>{a.payment ? (refundable ? `You’ll be refunded ${money(a.payment.amountCents)}` : 'This payment won’t be refunded') : 'Cancel this call?'}</AlertTitle>
                        <AlertDescription>{a.payment ? (refundable ? `You’re cancelling more than ${et.refundCutoffHours} hours before the call.` : `Cancellations within ${et.refundCutoffHours} hours of the call aren’t refunded. You can reschedule instead at no cost.`) : 'Your host will be notified.'}</AlertDescription>
                      </Alert>
                      <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                      <div className="flex gap-2">
                        <Button variant="destructive" onClick={() => run(actions.guestCancel(a.manageToken!, reason)) && setMode('view')}>Cancel booking</Button>
                        <Button variant="ghost" onClick={() => setMode('view')}>Keep it</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" asChild><a href={icsHref(`${et.name} — ${db.business.name}`, start, et.minutes, where)} download="booking.ics"><CalendarPlus /> Add to calendar</a></Button>
                      <Button variant="outline" onClick={() => setMode('reschedule')}><CalendarClock /> Reschedule</Button>
                      <Button variant="ghost" onClick={() => setMode('cancel')}>Cancel</Button>
                    </div>
                  )}
                </>
              )}
              <p className="text-muted-foreground text-xs">Keep this page’s link — it’s how you change or cancel without an account.</p>
            </>
          )}
        </div>
      </Card>
    </Shell>
  )
}
