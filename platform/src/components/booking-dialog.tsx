import * as React from 'react'
import { format, isSameDay } from 'date-fns'
import { CalendarClock, Check, CircleAlert, Repeat, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Field } from '@/components/page'
import { useDB, actions } from '@/lib/store'
import { eligibleCoaches, nextDays, slotsForDay, validateBooking, previewSeries } from '@/lib/booking'
import { activePurchases, purchaseBalance } from '@/lib/credits'
import { credits, num, tzLabel } from '@/lib/format'
import { run } from '@/components/run'
import type { Appointment, ID, Student } from '@/lib/types'
import { cn } from '@/lib/utils'

export function BookingDialog({
  open,
  onOpenChange,
  students,
  fixedStudentId,
  actorKind,
  actorLabel,
  allowRecurring,
  reschedule,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  students?: Student[]
  fixedStudentId?: ID
  actorKind: 'staff' | 'family'
  actorLabel: string
  allowRecurring?: boolean
  reschedule?: Appointment
}) {
  const realDb = useDB()
  // In reschedule mode, evaluate as if the original hold were released.
  const db = React.useMemo(
    () => (reschedule ? { ...realDb, appointments: realDb.appointments.map((a) => (a.id === reschedule.id ? { ...a, status: 'canceled_timely' as const } : a)) } : realDb),
    [realDb, reschedule],
  )
  const bookable = (students ?? []).filter((s) => activePurchases(db, s.id).length)
  const [studentId, setStudentId] = React.useState<ID>(reschedule?.studentId ?? fixedStudentId ?? bookable[0]?.id ?? '')
  const purchases = studentId ? activePurchases(db, studentId) : []
  const [purchaseId, setPurchaseId] = React.useState<ID>(reschedule?.purchaseId ?? purchases[0]?.id ?? '')
  const purchase = db.purchases.find((p) => p.id === purchaseId)
  const types = db.sessionTypes.filter((t) => purchase?.sessionTypeIds.includes(t.id))
  const [typeId, setTypeId] = React.useState<ID>(reschedule?.sessionTypeId ?? types[0]?.id ?? '')
  const coaches = studentId ? eligibleCoaches(db, studentId) : []
  const student = db.students.find((s) => s.id === studentId)
  const [coachId, setCoachId] = React.useState<ID>(reschedule?.coachId ?? student?.assignedCoachId ?? coaches[0]?.id ?? '')
  const days = nextDays(21).slice(actorKind === 'family' ? 0 : 0)
  const [day, setDay] = React.useState<Date>(days[1])
  const [slot, setSlot] = React.useState<Date | null>(null)
  const [weeks, setWeeks] = React.useState(1)

  React.useEffect(() => {
    if (!open) return
    const sid = reschedule?.studentId ?? fixedStudentId ?? bookable[0]?.id ?? ''
    setStudentId(sid)
    setWeeks(1)
    setSlot(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  React.useEffect(() => {
    if (reschedule) return
    const ps = studentId ? activePurchases(db, studentId) : []
    setPurchaseId(ps[0]?.id ?? '')
    const s = db.students.find((x) => x.id === studentId)
    setCoachId(s?.assignedCoachId ?? eligibleCoaches(db, studentId)[0]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])
  React.useEffect(() => {
    if (reschedule) return
    if (!types.some((t) => t.id === typeId)) setTypeId(types[0]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId])

  const st = db.sessionTypes.find((t) => t.id === typeId)
  const slots = coachId && st ? slotsForDay(db, coachId, day, st.minutes, new Date(), { ignoreNotice: actorKind === 'staff' }) : []
  const daySlotCounts = React.useMemo(
    () => days.map((d) => (coachId && st ? slotsForDay(db, coachId, d, st.minutes, new Date(), { ignoreNotice: actorKind === 'staff' }).length : 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, coachId, typeId, actorKind],
  )
  const input = slot && purchase && st ? { studentId, coachId, sessionTypeId: st.id, purchaseId: purchase.id, start: slot, actorKind: actorKind === 'staff' ? ('staff' as const) : ('family' as const) } : null
  const result = input ? validateBooking(db, input) : null
  const series = input && weeks > 1 ? previewSeries(db, input, weeks) : null
  const bal = purchase ? purchaseBalance(db, purchase.id) : null

  const confirm = () => {
    if (!input) return
    if (reschedule) {
      if (run(actions.reschedule(reschedule.id, input.start, actorKind, actorLabel))) onOpenChange(false)
      return
    }
    const r = actions.book(input, weeks, actorLabel)
    if (r.ok) {
      const v = r.value!
      run({ ok: true, message: v.created > 1 ? `Booked ${v.created} sessions${v.skipped ? ` · ${v.skipped} skipped` : ''}` : 'Session booked. Confirmation sent.' })
      onOpenChange(false)
    } else run(r)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{reschedule ? 'Reschedule session' : 'Book a session'}</DialogTitle>
          <DialogDescription>Times shown in {tzLabel()}. Availability, credits and funding are checked together before confirming.</DialogDescription>
        </DialogHeader>

        {actorKind === 'staff' && !fixedStudentId && !reschedule && (
          <Field label="Client">
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="Choose a client" /></SelectTrigger>
              <SelectContent>
                {bookable.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        )}

        {!purchase ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">This client has no active paid arrangement to book against.</div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {purchases.length > 1 && !reschedule && (
                <Field label="Arrangement">
                  <Select value={purchaseId} onValueChange={setPurchaseId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{purchases.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Session type">
                <Select value={typeId} onValueChange={(v) => { setTypeId(v); setSlot(null) }} disabled={!!reschedule}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {t.minutes} min · {num(t.credits)} cr</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Coach">
                <Select value={coachId} onValueChange={(v) => { setCoachId(v); setSlot(null) }} disabled={!!reschedule}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {coaches.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.id === student?.assignedCoachId ? ' (assigned)' : ' (pool)'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              {bal && (
                <div className="bg-muted/60 grid content-center rounded-md px-3 py-2 text-xs sm:col-span-1">
                  <span className="text-muted-foreground">Available to book</span>
                  <span className="font-medium">{credits(bal.makeup && bal.ended ? bal.makeup.available : bal.remainingEntitlement)} · {num(bal.usableFunded)} funded</span>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Day</div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {days.map((d, i) => (
                  <button
                    key={d.toISOString()}
                    onClick={() => { setDay(d); setSlot(null) }}
                    className={cn(
                      'flex w-14 shrink-0 flex-col items-center rounded-md border px-2 py-1.5 text-xs transition-colors',
                      isSameDay(d, day) ? 'border-primary bg-accent text-accent-foreground' : 'hover:bg-muted',
                      daySlotCounts[i] === 0 && 'opacity-45',
                    )}
                  >
                    <span className="text-muted-foreground">{format(d, 'EEE')}</span>
                    <span className="text-base font-semibold">{format(d, 'd')}</span>
                    <span className="text-muted-foreground text-[10px]">{daySlotCounts[i] ? `${daySlotCounts[i]} open` : '—'}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Time</div>
              {slots.length ? (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {slots.map((s) => (
                    <Button key={s.toISOString()} size="sm" variant={slot && s.getTime() === slot.getTime() ? 'default' : 'outline'} onClick={() => setSlot(s)}>
                      {format(s, 'h:mm a')}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">{db.staff.find((c) => c.id === coachId)?.calendarHealthy === false ? `${db.staff.find((c) => c.id === coachId)?.name.split(' ')[0]}’s calendar sync is stale, so times can’t be confirmed. Choose another coach or try again later.` : 'No open times this day. Unknown calendar time is never offered as free.'}</div>
              )}
            </div>

            {allowRecurring && !reschedule && (
              <div className="flex flex-wrap items-center gap-3">
                <Repeat className="text-muted-foreground size-4" />
                <span className="text-sm">Repeat weekly</span>
                <Select value={String(weeks)} onValueChange={(v) => setWeeks(Number(v))}>
                  <SelectTrigger className="w-40" size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 4, 6, 8, 12].map((w) => <SelectItem key={w} value={String(w)}>{w === 1 ? 'Does not repeat' : `${w} weeks`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {result && !series && (
              <div className="rounded-lg border">
                <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 font-medium"><CalendarClock className="size-4" /> {format(slot!, "EEEE, MMM d 'at' h:mm a")}</span>
                  <span className="text-muted-foreground text-xs">{st!.minutes} min · {num(st!.credits)} credit{st!.credits === 1 ? '' : 's'}</span>
                </div>
                <ul className="grid gap-1.5 p-3 text-sm">
                  {result.checks.map((c) => (
                    <li key={c.label} className="flex gap-2">
                      {c.ok ? <Check className="text-success mt-0.5 size-4 shrink-0" /> : <X className="text-destructive mt-0.5 size-4 shrink-0" />}
                      <span>
                        {c.label}
                        {c.detail && <span className="text-muted-foreground block text-xs">{c.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="text-muted-foreground border-t px-3 py-2 text-xs">
                  Cancellation terms: cancel at least {purchase.policy.cancelNoticeHours} hours ahead to keep the credit. Later changes {purchase.policy.lateCancelOutcome === 'forfeit' ? 'use the credit' : 'keep the credit'}.
                </div>
              </div>
            )}

            {series && (
              <div className="rounded-lg border">
                <div className="border-b px-3 py-2 text-sm font-medium">Series preview · {series.filter((s) => s.ok).length} of {weeks} can be booked</div>
                <ul className="max-h-56 divide-y overflow-y-auto text-sm">
                  {series.map((s) => (
                    <li key={s.start.toISOString()} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="flex items-center gap-2">
                        {s.ok ? <Check className="text-success size-4" /> : <CircleAlert className="text-destructive size-4" />}
                        {format(s.start, 'EEE, MMM d · h:mm a')}
                      </span>
                      {s.ok ? (
                        <Badge variant="outline">{s.funded ? 'Funded' : 'Awaiting payment'}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">{s.checks.find((c) => !c.ok)?.detail ?? s.checks.find((c) => !c.ok)?.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="text-muted-foreground border-t px-3 py-2 text-xs">Conflicting occurrences are skipped, never confirmed silently. Local time is preserved across daylight-saving changes.</div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={confirm} disabled={!input || (series ? !series.some((s) => s.ok) : !result?.ok)}>
            {reschedule ? 'Confirm new time' : series ? `Book ${series.filter((s) => s.ok).length} sessions` : 'Confirm booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
