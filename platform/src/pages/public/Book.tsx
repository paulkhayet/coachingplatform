import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { format, addDays, startOfDay } from 'date-fns'
import { ArrowLeft, Clock, CreditCard, Globe, Lock, TriangleAlert } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar } from '@/components/ui/avatar'
import { MonthCalendar } from '@/components/month-calendar'
import { Logo } from '@/components/brand'
import { useDB, actions } from '@/lib/store'
import { eventSlots } from '@/lib/booking'
import { money, tzLabel } from '@/lib/format'
import { LocationIcon, locationLabel } from '@/pages/staff/BookingPages'
import { BusinessMark } from './Profile'
import NotFound from '@/pages/NotFound'
import type { Answer, EventType, ID } from '@/lib/types'


/** Calendar + time list shared by booking and rescheduling. */
export function TimePicker({ et, onPick, ignoreId, initialHost }: { et: EventType; onPick: (start: Date, hostId: ID) => void; ignoreId?: ID; initialHost?: ID }) {
  const db = useDB()
  const hosts = db.staff.filter((s) => et.hostIds.includes(s.id) && s.status === 'active')
  const choose = et.hostMode === 'choose' && hosts.length > 1
  const [hostId, setHostId] = React.useState<ID | null>(choose ? initialHost ?? hosts[0]?.id ?? null : et.hostIds.length === 1 ? et.hostIds[0] : null)
  const now = new Date()
  const maxDate = addDays(startOfDay(now), et.bookingWindowDays)
  const cache = React.useMemo(() => new Map<number, { start: Date; hostId: ID }[]>(), [db, hostId, et]) // eslint-disable-line react-hooks/exhaustive-deps
  const slotsFor = (d: Date) => {
    const k = startOfDay(d).getTime()
    if (!cache.has(k)) cache.set(k, d > maxDate ? [] : eventSlots(db, et, d, hostId, now, ignoreId))
    return cache.get(k)!
  }
  const firstOpen = React.useMemo(() => {
    for (let i = 0; i <= et.bookingWindowDays; i++) {
      const d = addDays(startOfDay(now), i)
      if (slotsFor(d).length) return d
    }
    return null
  }, [cache]) // eslint-disable-line react-hooks/exhaustive-deps
  const [day, setDay] = React.useState<Date | null>(firstOpen)
  React.useEffect(() => setDay((d) => (d && slotsFor(d).length ? d : firstOpen)), [firstOpen]) // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = React.useState<number | null>(null)
  const slots = day ? slotsFor(day) : []

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_200px]">
      <div className="grid content-start gap-4">
        {choose && (
          <Select value={hostId ?? ''} onValueChange={(v) => { setHostId(v); setPicked(null) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{hosts.map((h) => <SelectItem key={h.id} value={h.id}>With {h.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <MonthCalendar selected={day} onSelect={(d) => { setDay(d); setPicked(null) }} available={(d) => slotsFor(d).length > 0} maxDate={maxDate} />
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs"><Globe className="size-3.5" /> {tzLabel()}</div>
      </div>
      <div className="grid content-start gap-2">
        {day ? (
          <>
            <div className="text-sm font-medium">{format(day, 'EEEE, MMMM d')}</div>
            <div className="grid max-h-[22rem] gap-2 overflow-y-auto pr-1">
              {slots.map((s) => {
                const sel = picked === s.start.getTime()
                return sel ? (
                  <div key={s.start.getTime()} className="grid grid-cols-2 gap-1.5">
                    <div className="bg-muted flex items-center justify-center rounded-md text-sm font-medium">{format(s.start, 'h:mm a')}</div>
                    <Button onClick={() => onPick(s.start, s.hostId)}>Next</Button>
                  </div>
                ) : (
                  <Button key={s.start.getTime()} variant="outline" className="border-primary/40 text-primary hover:border-primary font-semibold" onClick={() => setPicked(s.start.getTime())}>
                    {format(s.start, 'h:mm a')}
                  </Button>
                )
              })}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">No open times in the next {et.bookingWindowDays} days.</p>
        )}
      </div>
    </div>
  )
}

export function EventSummary({ et, start, hostId }: { et: EventType; start?: Date | null; hostId?: ID | null }) {
  const db = useDB()
  const hosts = db.staff.filter((s) => (hostId ? s.id === hostId : et.hostIds.includes(s.id)))
  return (
    <div className="grid content-start gap-4">
      <div className="flex items-center gap-2.5">
        <BusinessMark />
        <div className="text-muted-foreground text-sm font-medium">{db.business.name}</div>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{et.name}</h1>
      <div className="text-muted-foreground grid gap-2.5 text-sm">
        <span className="flex items-center gap-2"><Clock className="size-4" /> {et.minutes} min</span>
        <span className="flex items-center gap-2"><LocationIcon l={et.location} className="size-4" /> {locationLabel[et.location].split(' (')[0]}</span>
        {et.priceCents > 0 && <span className="flex items-center gap-2"><CreditCard className="size-4" /> {money(et.priceCents)}</span>}
        {start && <span className="text-foreground flex items-center gap-2 font-medium"><Clock className="size-4" /> {format(start, "h:mm a, EEEE, MMMM d")}</span>}
        <span className="flex items-center gap-2">
          <span className="flex -space-x-2">{hosts.slice(0, 4).map((h) => <Avatar key={h.id} name={h.name} className="ring-card size-6 text-[10px] ring-2" />)}</span>
          {hosts.length === 1 ? hosts[0].name : `${hosts.length} coaches`}
        </span>
      </div>
      {et.description && <p className="text-muted-foreground text-sm leading-relaxed">{et.description}</p>}
    </div>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 min-h-svh">
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-14">
        {children}
        <div className="text-muted-foreground mt-8 flex justify-center text-xs">Powered by&nbsp;<Logo className="text-xs [&_svg]:size-3.5" /></div>
      </div>
    </div>
  )
}

type Values = Record<string, string | string[]>

export default function Book() {
  const { slug, event } = useParams()
  const db = useDB()
  const nav = useNavigate()
  const et = db.eventTypes.find((e) => e.slug === event)
  const [step, setStep] = React.useState<'time' | 'details' | 'pay'>('time')
  const [start, setStart] = React.useState<Date | null>(null)
  const [hostId, setHostId] = React.useState<ID | null>(null)
  const [f, setF] = React.useState({ name: '', email: '', studentName: '', grade: '', forSelf: false })
  const [vals, setVals] = React.useState<Values>({})
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [payError, setPayError] = React.useState<string | null>(null)
  const [paying, setPaying] = React.useState(false)
  if (slug !== db.business.slug || !et) return <NotFound />
  if (!et.active)
    return <Shell><Alert variant="warning"><TriangleAlert /><AlertTitle>This booking page isn’t taking bookings right now</AlertTitle><AlertDescription><Link to={`/b/${slug}`} className="text-primary hover:underline">See other ways to book</Link></AlertDescription></Alert></Shell>

  const validate = () => {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = 'Enter your name'
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email'
    if (et.askStudent && !f.forSelf && !f.studentName.trim()) e.studentName = 'Enter the student’s name'
    for (const q of et.questions) {
      const v = vals[q.id]
      const empty = !v || (Array.isArray(v) ? v.length === 0 : !v.trim())
      if (q.required && empty) e[q.id] = 'This question is required'
      else if (q.type === 'phone' && !empty && (v as string).replace(/\D/g, '').length < 10) e[q.id] = 'Enter a 10-digit phone number'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }
  const answers = (): Answer[] => et.questions.filter((q) => vals[q.id] && (Array.isArray(vals[q.id]) ? (vals[q.id] as string[]).length : true)).map((q) => ({ questionId: q.id, label: q.label, value: Array.isArray(vals[q.id]) ? (vals[q.id] as string[]).join(', ') : (vals[q.id] as string) }))
  const book = (outcome: 'success' | 'decline') => {
    const phoneQ = et.questions.find((q) => q.type === 'phone')
    const r = actions.guestBook({
      eventTypeId: et.id, hostId: hostId!, start: start!, outcome, answers: answers(),
      guest: { name: f.name.trim(), email: f.email.trim(), phone: phoneQ ? (vals[phoneQ.id] as string) || undefined : undefined },
      student: et.askStudent ? { name: f.forSelf ? f.name.trim() : f.studentName.trim(), grade: f.grade.trim(), independent: f.forSelf } : undefined,
    })
    if (r.ok) nav(`/booking/${r.value}?new=1`)
    else {
      setPayError(r.error)
      if (r.error.includes('just taken')) { setStep('time'); setStart(null) }
    }
  }
  const setV = (id: string, v: string | string[]) => {
    setVals({ ...vals, [id]: v })
    setErrors({ ...errors, [id]: '' })
  }
  const err = (k: string) => errors[k] && <span className="text-destructive text-xs">{errors[k]}</span>

  return (
    <Shell>
      <Card className="overflow-hidden py-0 md:grid md:grid-cols-[300px_minmax(0,1fr)]">
        <div className="border-b p-6 md:border-r md:border-b-0">
          {step !== 'time' && <Button variant="ghost" size="icon-sm" className="mb-3 -ml-2" onClick={() => { setStep(step === 'pay' ? 'details' : 'time'); setPayError(null) }} aria-label="Back"><ArrowLeft /></Button>}
          <EventSummary et={et} start={step !== 'time' ? start : null} hostId={step !== 'time' ? hostId : null} />
        </div>
        <div className="p-6">
          {step === 'time' && (
            <>
              <h2 className="mb-4 text-lg font-semibold">Select a date and time</h2>
              {payError && <Alert variant="warning" className="mb-4"><TriangleAlert /><AlertDescription>{payError}</AlertDescription></Alert>}
              <TimePicker et={et} onPick={(s, h) => { setStart(s); setHostId(h); setStep('details'); setPayError(null) }} />
            </>
          )}

          {step === 'details' && (
            <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); if (validate()) et.priceCents ? setStep('pay') : book('success') }}>
              <h2 className="text-lg font-semibold">Enter details</h2>
              <div className="grid gap-1.5"><Label htmlFor="g-name">Your name *</Label><Input id="g-name" value={f.name} onChange={(e) => (setF({ ...f, name: e.target.value }), setErrors({ ...errors, name: '' }))} aria-invalid={!!errors.name} />{err('name')}</div>
              <div className="grid gap-1.5"><Label htmlFor="g-email">Email *</Label><Input id="g-email" type="email" value={f.email} onChange={(e) => (setF({ ...f, email: e.target.value }), setErrors({ ...errors, email: '' }))} aria-invalid={!!errors.email} />{err('email')}</div>
              {et.askStudent && (
                <div className="bg-muted/40 grid gap-3 rounded-lg border p-3">
                  <Label className="font-normal"><Switch checked={f.forSelf} onCheckedChange={(v) => setF({ ...f, forSelf: v })} /> I’m the student</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {!f.forSelf && <div className="grid gap-1.5"><Label htmlFor="g-sname">Student’s name *</Label><Input id="g-sname" value={f.studentName} onChange={(e) => (setF({ ...f, studentName: e.target.value }), setErrors({ ...errors, studentName: '' }))} aria-invalid={!!errors.studentName} />{err('studentName')}</div>}
                    <div className="grid gap-1.5"><Label htmlFor="g-grade">Grade or stage</Label><Input id="g-grade" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} placeholder="10th grade" /></div>
                  </div>
                </div>
              )}
              {et.questions.map((q) => (
                <div key={q.id} className="grid gap-1.5">
                  <Label htmlFor={q.id}>{q.label}{q.required && ' *'}</Label>
                  {q.type === 'text' && <Input id={q.id} value={(vals[q.id] as string) ?? ''} onChange={(e) => setV(q.id, e.target.value)} aria-invalid={!!errors[q.id]} />}
                  {q.type === 'phone' && <Input id={q.id} type="tel" value={(vals[q.id] as string) ?? ''} onChange={(e) => setV(q.id, e.target.value)} placeholder="(617) 555-0100" aria-invalid={!!errors[q.id]} />}
                  {q.type === 'textarea' && <Textarea id={q.id} rows={3} value={(vals[q.id] as string) ?? ''} onChange={(e) => setV(q.id, e.target.value)} aria-invalid={!!errors[q.id]} />}
                  {q.type === 'single' && (
                    <RadioGroup value={(vals[q.id] as string) ?? ''} onValueChange={(v) => setV(q.id, v)} className="gap-2">
                      {q.options.map((o) => <Label key={o} className="font-normal"><RadioGroupItem value={o} /> {o}</Label>)}
                    </RadioGroup>
                  )}
                  {q.type === 'multi' && (
                    <div className="grid gap-2">
                      {q.options.map((o) => {
                        const cur = (vals[q.id] as string[]) ?? []
                        return <Label key={o} className="font-normal"><Checkbox checked={cur.includes(o)} onCheckedChange={(v) => setV(q.id, v ? [...cur, o] : cur.filter((x) => x !== o))} /> {o}</Label>
                      })}
                    </div>
                  )}
                  {err(q.id)}
                </div>
              ))}
              {payError && <Alert variant="destructive"><TriangleAlert /><AlertDescription>{payError}</AlertDescription></Alert>}
              <p className="text-muted-foreground text-xs">Your answers go to {db.business.name} to prepare for the call.{et.priceCents > 0 && ` Full refund if you cancel at least ${et.refundCutoffHours} hours before.`}</p>
              <Button type="submit" className="justify-self-start" size="lg">{et.priceCents ? `Continue to payment` : 'Schedule event'}</Button>
            </form>
          )}

          {step === 'pay' && (
            <div className="grid gap-4">
              <h2 className="text-lg font-semibold">Payment</h2>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between"><span>{et.name} · {format(start!, 'MMM d, h:mm a')}</span><span className="tabular-nums">{money(et.priceCents)}</span></div>
                <Separator />
                <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">{money(et.priceCents)}</span></div>
              </div>
              <div className="bg-muted/40 flex items-center gap-3 rounded-md border p-3 text-sm"><CreditCard className="text-muted-foreground size-4" /> Stripe test card •••• 4242 <span className="text-muted-foreground ml-auto text-xs">Test mode</span></div>
              <p className="text-muted-foreground flex items-start gap-1.5 text-xs"><Lock className="mt-0.5 size-3 shrink-0" /> Paid to {db.business.name} through Stripe. Full refund if you cancel at least {et.refundCutoffHours} hours before the call{et.refundCutoffHours === 0 ? '' : '; after that, the payment is kept'}.</p>
              {payError && <Alert variant="destructive"><TriangleAlert /><AlertTitle>Payment didn’t go through</AlertTitle><AlertDescription>{payError}</AlertDescription></Alert>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={() => book('decline')}>Simulate a declined card</Button>
                <Button size="lg" disabled={paying} onClick={() => { setPaying(true); setPayError(null); setTimeout(() => { setPaying(false); book('success') }, 700) }}>
                  {paying ? 'Confirming with Stripe…' : `Pay ${money(et.priceCents)} and book`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </Shell>
  )
}

