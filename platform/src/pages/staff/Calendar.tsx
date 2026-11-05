import * as React from 'react'
import { useNavigate } from 'react-router'
import { addDays, addWeeks, format, isSameDay, isToday, startOfWeek } from 'date-fns'
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, Empty } from '@/components/page'
import { CoverageBadge } from '@/components/status'
import { BookingDialog } from '@/components/booking-dialog'
import { apptTitle } from './Today'
import { useDB, useStaffViewer } from '@/lib/store'
import { visibleStudents } from '@/lib/permissions'
import { apptCoverage, isCanceled } from '@/lib/credits'
import { time, tzLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Appointment } from '@/lib/types'

const START = 8
const END = 21
const HOUR = 44

export default function Calendar() {
  const db = useDB()
  const me = useStaffViewer()!
  const nav = useNavigate()
  const [week, setWeek] = React.useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [coach, setCoach] = React.useState<string>(me.role === 'coach' || (me.role === 'owner' && me.coaches) ? me.id : 'all')
  const [booking, setBooking] = React.useState(false)
  const visible = new Set(visibleStudents(db, me).map((s) => s.id))
  const coaches = db.staff.filter((s) => s.coaches && s.status === 'active')
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const cache = new Map()
  const appts = db.appointments.filter(
    (a) => !isCanceled(a) && (coach === 'all' ? true : a.coachId === coach) && (me.role !== 'coach' || a.coachId === me.id || (a.studentId && visible.has(a.studentId))) && new Date(a.start) >= week && new Date(a.start) < addDays(week, 7),
  )
  const blocks = db.calendarBlocks.filter((b) => (coach === 'all' ? me.role !== 'coach' || b.coachId === me.id : b.coachId === coach) && new Date(b.start) >= week && new Date(b.start) < addDays(week, 7))
  const color = (a: Appointment) => {
    if (a.kind === 'consultation') return 'bg-muted border-muted-foreground/30'
    const c = apptCoverage(db, a, cache)
    if (a.status === 'attended') return 'bg-secondary border-border text-muted-foreground'
    return c === 'payment_needed' ? 'bg-warning/15 border-warning/50' : 'bg-accent border-primary/40'
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        description={`Times in ${tzLabel()}. Google Calendar busy times block availability; schedulefa.st owns coaching appointments.`}
        actions={
          <>
            {me.role !== 'coach' && (
              <Select value={coach} onValueChange={setCoach}>
                <SelectTrigger size="sm" className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All coaches</SelectItem>
                  {coaches.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" onClick={() => setBooking(true)}><CalendarPlus /> New booking</Button>
          </>
        }
      />
      <div className="mb-3 flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => setWeek(addWeeks(week, -1))} aria-label="Previous week"><ChevronLeft /></Button>
        <Button variant="outline" size="sm" onClick={() => setWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</Button>
        <Button variant="outline" size="icon-sm" onClick={() => setWeek(addWeeks(week, 1))} aria-label="Next week"><ChevronRight /></Button>
        <span className="ml-2 text-sm font-medium">{format(week, 'MMM d')} – {format(addDays(week, 6), 'MMM d, yyyy')}</span>
        <div className="text-muted-foreground ml-auto hidden items-center gap-3 text-xs sm:flex">
          <span className="flex items-center gap-1.5"><span className="bg-accent border-primary/40 size-3 rounded-sm border" /> Funded</span>
          <span className="flex items-center gap-1.5"><span className="bg-warning/15 border-warning/50 size-3 rounded-sm border" /> Awaiting payment</span>
          <span className="flex items-center gap-1.5"><span className="bg-muted size-3 rounded-sm border border-dashed" /> Busy (Google)</span>
        </div>
      </div>

      <Card className="hidden overflow-hidden py-0 md:block">
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b">
          <div />
          {days.map((d) => (
            <div key={d.toISOString()} className={cn('border-l px-2 py-2 text-center text-xs', isToday(d) && 'bg-accent/50')}>
              <div className="text-muted-foreground">{format(d, 'EEE')}</div>
              <div className={cn('text-base font-semibold', isToday(d) && 'text-primary')}>{format(d, 'd')}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
          <div>
            {Array.from({ length: END - START }, (_, i) => (
              <div key={i} className="text-muted-foreground pr-2 text-right text-[10px]" style={{ height: HOUR }}>{format(new Date(2026, 0, 1, START + i), 'h a')}</div>
            ))}
          </div>
          {days.map((d) => (
            <div key={d.toISOString()} className="relative border-l" style={{ height: HOUR * (END - START) }}>
              {Array.from({ length: END - START }, (_, i) => <div key={i} className="border-b border-dashed" style={{ height: HOUR }} />)}
              {blocks.filter((b) => isSameDay(new Date(b.start), d)).map((b) => {
                const s = new Date(b.start)
                const e = new Date(b.end)
                return (
                  <div key={b.id} className="bg-muted/80 text-muted-foreground absolute inset-x-1 rounded border border-dashed px-1 text-[10px]" style={{ top: (s.getHours() + s.getMinutes() / 60 - START) * HOUR, height: ((e.getTime() - s.getTime()) / 3600000) * HOUR }}>
                    Busy{coach === 'all' ? ` · ${db.staff.find((x) => x.id === b.coachId)?.name.split(' ')[0]}` : ''}
                  </div>
                )
              })}
              {appts.filter((a) => isSameDay(new Date(a.start), d)).map((a) => {
                const s = new Date(a.start)
                return (
                  <button key={a.id} onClick={() => nav(`/app/sessions/${a.id}`)} className={cn('absolute inset-x-1 overflow-hidden rounded border px-1.5 py-0.5 text-left text-[11px] leading-tight hover:z-10 hover:shadow-md', color(a))} style={{ top: (s.getHours() + s.getMinutes() / 60 - START) * HOUR, height: Math.max(20, (a.minutes / 60) * HOUR - 2) }}>
                    <div className="truncate font-medium">{apptTitle(db, a)}</div>
                    <div className="text-muted-foreground truncate">{time(a.start)}{coach === 'all' ? ` · ${db.staff.find((x) => x.id === a.coachId)?.name.split(' ')[0]}` : ''}</div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:hidden">
        {days.map((d) => {
          const list = appts.filter((a) => isSameDay(new Date(a.start), d)).sort((a, b) => a.start.localeCompare(b.start))
          return (
            <div key={d.toISOString()}>
              <div className={cn('mb-1.5 text-sm font-medium', isToday(d) && 'text-primary')}>{format(d, 'EEEE, MMM d')}</div>
              {list.length ? (
                <div className="grid gap-1.5">
                  {list.map((a) => (
                    <button key={a.id} onClick={() => nav(`/app/sessions/${a.id}`)} className="bg-card flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm">
                      <span><span className="font-medium">{apptTitle(db, a)}</span><span className="text-muted-foreground block text-xs">{time(a.start)}</span></span>
                      <CoverageBadge coverage={apptCoverage(db, a, cache)} />
                    </button>
                  ))}
                </div>
              ) : <div className="text-muted-foreground text-xs">Nothing booked</div>}
            </div>
          )
        })}
        {!appts.length && <Empty title="No sessions this week" />}
      </div>
      <BookingDialog open={booking} onOpenChange={setBooking} students={visibleStudents(db, me)} actorKind="staff" actorLabel={me.name} allowRecurring />
    </>
  )
}
