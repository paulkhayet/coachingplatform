'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarDays, Globe } from 'lucide-react'
import type { DayButton } from 'react-day-picker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGuestTimezone, zoneName } from '@/components/booking/time-grid'
import { groupByDay } from '@/lib/booking/schemas'
import { US_TIME_ZONES } from '@/lib/validation'
import { cn } from '@/lib/utils'
import type { BookingQuestion } from '@/db/schema'
import type { GuestBookingState } from './actions'

// The public booking flow (Calendly-style): the call's details stay on the left; on the right a month
// calendar (days with open times highlighted) and a time zone picker, then that day's times beside it,
// then the guest's details form in place of the calendar once a time is chosen.

const textareaClass =
  'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

const WORLD_ZONES = [
  { value: 'America/Halifax', label: 'Atlantic Time' },
  { value: 'America/Mexico_City', label: 'Mexico City' },
  { value: 'America/Sao_Paulo', label: 'Brasília' },
  { value: 'Europe/London', label: 'UK & Ireland' },
  { value: 'Europe/Paris', label: 'Central Europe' },
  { value: 'Europe/Athens', label: 'Eastern Europe' },
  { value: 'Asia/Dubai', label: 'Gulf' },
  { value: 'Asia/Kolkata', label: 'India' },
  { value: 'Asia/Singapore', label: 'Singapore & China' },
  { value: 'Asia/Tokyo', label: 'Japan & Korea' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'Pacific/Auckland', label: 'New Zealand' },
  { value: 'UTC', label: 'UTC' },
]

/** "2026-11-09" for a calendar day as react-day-picker hands it over (midnight, browser-local). */
const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** The calendar cell (browser-local date) for a "2026-11-09" day key in the chosen time zone. */
const keyToDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function TimeZonePicker({ value, onChange, detected }: { value: string; onChange: (tz: string) => void; detected: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const clock = (tz: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(now).toLowerCase().replace(' ', '')
  const known = [...US_TIME_ZONES, ...WORLD_ZONES].some((z) => z.value === detected)
  const option = (z: { value: string; label: string }) => (
    <SelectItem key={z.value} value={z.value}>{z.label} <span className="text-muted-foreground">({clock(z.value)})</span></SelectItem>
  )
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="booking-timezone" className="text-sm font-medium">Time zone</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="booking-timezone" className="w-full max-w-sm justify-start *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:text-left">
          <Globe className="size-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {!known && (
            <SelectGroup>
              <SelectLabel>Your time zone</SelectLabel>
              {option({ value: detected, label: zoneName(detected) })}
            </SelectGroup>
          )}
          <SelectGroup>
            <SelectLabel>United States</SelectLabel>
            {US_TIME_ZONES.map(option)}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Rest of the world</SelectLabel>
            {WORLD_ZONES.map(option)}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export function BookingFlow({ info, starts, durationMinutes, questions, askNotes, priceLabel, notice, action }: {
  info: React.ReactNode
  starts: string[]
  durationMinutes: number
  questions: BookingQuestion[]
  askNotes: boolean
  priceLabel?: string
  /** Shown above the calendar, e.g. "payment wasn't completed". */
  notice?: React.ReactNode
  action: (prev: GuestBookingState, fd: FormData) => Promise<GuestBookingState>
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<GuestBookingState, FormData>(action, {})
  const detected = useGuestTimezone()
  const [chosenZone, setChosenZone] = useState<string | null>(null)
  const tz = chosenZone ?? detected
  const [day, setDay] = useState<string | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const timesRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  // On phones the form replaces the calendar further down the page; bring it into view.
  useEffect(() => {
    if (chosen && window.matchMedia('(max-width: 767px)').matches) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [chosen])

  // Open times grouped by day in the chosen time zone.
  const days = useMemo(() => (tz ? groupByDay(starts, tz) : new Map<string, string[]>()), [starts, tz])
  const keys = useMemo(() => [...days.keys()].sort(), [days])
  const [month, setMonth] = useState<Date | undefined>(undefined)
  const shownMonth = month ?? (keys[0] ? keyToDate(keys[0]) : new Date())

  // A day can vanish when the time zone changes; drop the choice if so.
  useEffect(() => {
    if (day && !days.has(day)) setDay(null)
  }, [day, days])

  // If the time was taken meanwhile, reload the open times and go back to picking.
  useEffect(() => {
    if (state.taken) {
      setChosen(null)
      router.refresh()
    }
  }, [state, router])

  const pickDay = (d: Date | undefined) => {
    if (!d) return
    setDay(localKey(d))
    // On phones the times appear below the calendar; bring them into view.
    requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 767px)').matches) timesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const longDay = tz ? new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }) : null
  const fullDay = tz ? new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : null
  const timeLabel = tz ? new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }) : null

  const start = chosen ? new Date(chosen) : null
  const end = start ? new Date(start.getTime() + durationMinutes * 60_000) : null

  return (
    <div className="bg-card text-card-foreground grid overflow-hidden rounded-xl border shadow-xs md:grid-cols-[19rem_1fr]">
      <div className="grid content-start gap-3 border-b p-6 md:border-r md:border-b-0">
        {info}
        {start && end && fullDay && timeLabel && tz && (
          <div className="text-muted-foreground grid gap-1.5 border-t pt-4 text-sm">
            <span className="text-foreground flex items-start gap-2 font-medium"><CalendarDays className="mt-0.5 size-4 shrink-0" /> {timeLabel.format(start)} – {timeLabel.format(end)}, {fullDay.format(start)}</span>
            <span className="flex items-center gap-2"><Globe className="size-4 shrink-0" /> {zoneName(tz)}</span>
          </div>
        )}
      </div>

      <div ref={formRef} className="min-w-0 scroll-mt-4 p-6">
        {!tz || !longDay || !timeLabel ? (
          <p className="text-muted-foreground text-sm">Loading times…</p>
        ) : !chosen || !start ? (
          <div className="grid gap-5">
            <h2 className="text-lg font-semibold tracking-tight">Select a date & time</h2>
            {notice}
            {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
            <div className={cn('grid gap-6', day && 'md:grid-cols-[minmax(0,1fr)_12rem]')}>
              <div className="grid content-start gap-5">
                <Calendar
                  mode="single"
                  className="mx-auto w-full max-w-md p-0 [--cell-size:--spacing(11)]"
                  classNames={{ root: 'w-full', today: 'font-semibold', week: 'mt-1.5 flex w-full', day: 'group/day relative flex h-(--cell-size) w-full items-center justify-center p-0 text-center select-none' }}
                  showOutsideDays={false}
                  month={shownMonth}
                  onMonthChange={setMonth}
                  startMonth={keys[0] ? keyToDate(keys[0]) : undefined}
                  endMonth={keys.at(-1) ? keyToDate(keys.at(-1)!) : undefined}
                  selected={day ? keyToDate(day) : undefined}
                  onSelect={pickDay}
                  disabled={(d) => !days.has(localKey(d))}
                  formatters={{ formatWeekdayName: (d) => d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() }}
                  components={{ DayButton: AvailableDayButton }}
                />
                {keys.length === 0 && <p className="text-muted-foreground text-center text-sm">No open times in this time zone.</p>}
                <TimeZonePicker value={tz} onChange={setChosenZone} detected={detected ?? tz} />
              </div>
              {day && (
                <div ref={timesRef} className="grid content-start gap-3 scroll-mt-4">
                  <p className="text-sm font-medium">{longDay.format(new Date(days.get(day)?.[0] ?? Date.now()))}</p>
                  <div className="grid max-h-[26rem] gap-2 overflow-y-auto pr-1">
                    {(days.get(day) ?? []).map((s) => (
                      <Button key={s} type="button" variant="outline" className="border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground h-11 w-full font-semibold" onClick={() => setChosen(s)}>
                        {timeLabel.format(new Date(s))}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <DetailsForm
            state={state}
            formAction={formAction}
            pending={pending}
            chosen={chosen}
            tz={tz}
            questions={questions}
            askNotes={askNotes}
            priceLabel={priceLabel}
            onBack={() => setChosen(null)}
          />
        )}
      </div>
    </div>
  )
}

/** Days with open times read as choosable: tinted and bold, like Calendly; the chosen day is filled. */
function AvailableDayButton(props: React.ComponentProps<typeof DayButton>) {
  const { modifiers } = props
  const open = !modifiers.disabled && !modifiers.outside && !modifiers.selected
  return (
    <CalendarDayButton
      {...props}
      className={cn(
        'mx-auto size-(--cell-size) rounded-full text-sm',
        open && 'bg-accent text-accent-foreground hover:bg-primary/15 font-semibold',
        modifiers.selected && 'font-semibold',
        props.className,
      )}
    />
  )
}

function DetailsForm({ state, formAction, pending, chosen, tz, questions, askNotes, priceLabel, onBack }: {
  state: GuestBookingState
  formAction: (fd: FormData) => void
  pending: boolean
  chosen: string
  tz: string
  questions: BookingQuestion[]
  askNotes: boolean
  priceLabel?: string
  onBack: () => void
}) {
  const e = state.errors ?? {}
  const val = (k: string) => {
    const x = state.values?.[k]
    return typeof x === 'string' ? x : ''
  }
  const picked = (k: string, option: string) => {
    const x = state.values?.[k]
    return Array.isArray(x) ? x.includes(option) : false
  }
  const err = (k: string) => e[k] && <p className="text-destructive text-xs">{e[k]}</p>
  return (
    <form action={formAction} className="grid max-w-lg gap-4" noValidate>
      <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground flex items-center gap-1 justify-self-start text-sm"><ArrowLeft className="size-4" /> Back</button>
      <h2 className="text-lg font-semibold tracking-tight">Enter details</h2>
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <input type="hidden" name="start" value={chosen} />
      <input type="hidden" name="timezone" value={tz} />
      {/* Hidden from people; bots that fill every field are rejected. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div className="grid gap-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" defaultValue={val('name')} aria-invalid={!!e.name} autoFocus />
        {err('name')}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={val('email')} aria-invalid={!!e.email} />
        {e.email ? err('email') : <p className="text-muted-foreground text-xs">Your confirmation and calendar invitation go here.</p>}
      </div>
      {questions.map((q) => {
        const field = `q_${q.id}`
        const label = <>{q.label} {!q.required && <span className="text-muted-foreground font-normal">(optional)</span>}</>
        if (q.type === 'short' || q.type === 'paragraph') {
          return (
            <div key={q.id} className="grid gap-1.5">
              <Label htmlFor={field}>{label}</Label>
              {q.type === 'short' ? (
                <Input id={field} name={field} maxLength={200} defaultValue={(state.values?.[field] as string[] | undefined)?.[0] ?? ''} aria-invalid={!!e[field]} />
              ) : (
                <textarea id={field} name={field} rows={3} maxLength={2000} defaultValue={(state.values?.[field] as string[] | undefined)?.[0] ?? ''} className={textareaClass} aria-invalid={!!e[field]} />
              )}
              {err(field)}
            </div>
          )
        }
        return (
          <fieldset key={q.id} className="grid gap-1.5">
            <legend className="mb-1 text-sm font-medium">{label}</legend>
            {q.options.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input type={q.type === 'single' ? 'radio' : 'checkbox'} name={field} value={o} defaultChecked={picked(field, o)} className="accent-primary size-4" />
                {o}
              </label>
            ))}
            {err(field)}
          </fieldset>
        )
      })}
      {askNotes && (
        <div className="grid gap-1.5">
          <Label htmlFor="notes">Anything else you’d like to share? <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <textarea id="notes" name="notes" rows={3} maxLength={2000} defaultValue={val('notes')} className={textareaClass} />
        </div>
      )}
      <Button type="submit" className="justify-self-start" size="lg" disabled={pending}>
        {pending ? (priceLabel ? 'Opening payment…' : 'Booking…') : priceLabel ? `Continue to pay ${priceLabel}` : 'Schedule call'}
      </Button>
    </form>
  )
}
