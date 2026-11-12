import Link from 'next/link'
import { cn } from '@/lib/utils'
import { layoutByDay, sameDay, toKey, visibleHours, weekday, type CalDate } from '@/lib/calendar-view'
import type { Interval } from '@/lib/slots'

// Week and month views of the Bookings page. Server-rendered; every control is a link.

export interface CalendarEvent extends Interval {
  id: string
  title: string
  detail: string
  /** Where clicking the event goes, if anywhere. */
  href?: string
  tone: 'call' | 'coaching' | 'unpaid'
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/**
 * On wider screens the week grid stretches to fill the space left in the window (the page lays itself
 * out as a full-height column), so a whole working day is visible without scrolling. Phones get a
 * fixed height, since the app's menu sits above the page there.
 */
const GRID_HEIGHT = 'h-[28rem] md:h-auto md:min-h-[16rem] md:flex-1'
const toneClass: Record<CalendarEvent['tone'], string> = {
  // Solid tints (mixed with the card colour) so Google busy stripes don't show through.
  call: 'bg-[color-mix(in_oklab,var(--primary)_14%,var(--card))] border-primary text-foreground hover:bg-[color-mix(in_oklab,var(--primary)_22%,var(--card))]',
  coaching: 'bg-[color-mix(in_oklab,var(--color-violet-500)_14%,var(--card))] border-violet-500 text-foreground hover:bg-[color-mix(in_oklab,var(--color-violet-500)_22%,var(--card))]',
  unpaid: 'bg-[color-mix(in_oklab,var(--color-amber-500)_16%,var(--card))] border-amber-500 text-foreground hover:bg-[color-mix(in_oklab,var(--color-amber-500)_24%,var(--card))]',
}
const busyClass = 'bg-[repeating-linear-gradient(135deg,var(--muted)_0_6px,transparent_6px_12px)] border border-dashed border-muted-foreground/30'

function EventChip({ event, className, style, children }: { event: CalendarEvent; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const cls = cn('block overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight transition-colors', toneClass[event.tone], className)
  const title = `${event.title} · ${event.detail}`
  return event.href
    ? <Link href={event.href} className={cls} style={style} title={title}>{children}</Link>
    : <div className={cls} style={style} title={title}>{children}</div>
}

export function WeekView({ days, events, busy, timeZone, today, now }: {
  days: CalDate[]; events: CalendarEvent[]; busy: Interval[]; timeZone: string; today: CalDate; now: Date
}) {
  const eventDays = layoutByDay(events, days, timeZone)
  const busyDays = layoutByDay(busy, days, timeZone)
  const { first, last } = visibleHours([...eventDays.values(), ...busyDays.values()].flat())
  const hours = last - first
  // Positions are percentages of the grid's height, so the whole day fits the window (see GRID_HEIGHT).
  const pct = (minute: number) => ((minute - first * 60) / (hours * 60)) * 100
  const top = (minute: number) => `${pct(minute)}%`
  const span = (start: number, end: number) => `max(${end - start < 30 ? 16 : 20}px, ${pct(end) - pct(start)}%)`
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  const hourLabel = (h: number) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, h)))
  const nowParts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now)
  const nowMinute = Number(nowParts.find((p) => p.type === 'hour')?.value) * 60 + Number(nowParts.find((p) => p.type === 'minute')?.value)

  return (
    <div className="bg-card flex flex-col overflow-x-auto rounded-xl border md:min-h-0 md:flex-1">
      <div className="flex min-w-[720px] flex-col md:h-full">
        <div className="grid shrink-0 grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b">
          <div />
          {days.map((d) => {
            const isToday = sameDay(d, today)
            return (
              <div key={toKey(d)} className="grid justify-items-center gap-0.5 border-l py-2 text-center">
                <span className="text-muted-foreground text-xs">{WEEKDAY_SHORT[weekday(d)]}</span>
                <span className={cn('grid size-7 place-items-center rounded-full text-sm font-medium', isToday && 'bg-primary text-primary-foreground')}>{d.day}</span>
              </div>
            )
          })}
        </div>
        <div className={cn('grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]', GRID_HEIGHT)}>
          <div className="relative">
            {Array.from({ length: hours }, (_, i) => (
              <span key={i} className="text-muted-foreground absolute right-2 -translate-y-1/2 text-[10px]" style={{ top: `${(i / hours) * 100}%` }}>{i === 0 ? '' : hourLabel(first + i)}</span>
            ))}
          </div>
          {days.map((d) => {
            const key = toKey(d)
            return (
              <div key={key} className="relative border-l" style={{ backgroundImage: 'linear-gradient(to bottom, var(--border) 1px, transparent 1px)', backgroundSize: `100% ${100 / hours}%` }}>
                {(busyDays.get(key) ?? []).map((s, i) => (
                  <div key={i} className={cn('absolute inset-x-0.5 overflow-hidden rounded-sm', busyClass)} style={{ top: top(s.start), height: `max(4px, ${pct(s.end) - pct(s.start)}%)` }}
                    title={`Busy on Google Calendar · ${time.format(s.item.start)} – ${time.format(s.item.end)}`}>
                    {s.end - s.start >= 30 && <span className="text-muted-foreground block px-1.5 pt-0.5 text-[10px]">Busy</span>}
                  </div>
                ))}
                {(eventDays.get(key) ?? []).map((s) => (
                  <EventChip key={s.item.id + key} event={s.item} className="absolute z-10 shadow-xs"
                    style={{ top: top(s.start), height: span(s.start, s.end), left: `calc(${(s.lane / s.lanes) * 100}% + 2px)`, width: `calc(${100 / s.lanes}% - 4px)` }}>
                    <span className="font-medium">{s.item.title}</span>
                    {s.end - s.start >= 45 && <span className="text-muted-foreground block">{time.format(s.item.start)} – {time.format(s.item.end)}</span>}
                  </EventChip>
                ))}
                {sameDay(d, today) && nowMinute >= first * 60 && nowMinute <= last * 60 && (
                  <div className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500" style={{ top: top(nowMinute) }}>
                    <span className="absolute -top-[5px] -left-[5px] size-2 rounded-full bg-red-500" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function MonthView({ days, month, events, busy, timeZone, today, dayHref }: {
  days: CalDate[]; month: number; events: CalendarEvent[]; busy: Interval[]; timeZone: string; today: CalDate; dayHref: (d: CalDate) => string
}) {
  const eventDays = layoutByDay(events, days, timeZone)
  const busyDays = layoutByDay(busy, days, timeZone)
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  const MAX = 3
  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <div className="grid grid-cols-7 border-b">
        {WEEKDAY_SHORT.map((w) => <div key={w} className="text-muted-foreground py-2 text-center text-xs">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = toKey(d)
          const items = eventDays.get(key) ?? []
          const busyCount = (busyDays.get(key) ?? []).length
          const outside = d.month !== month
          return (
            <div key={key} className={cn('min-h-24 min-w-0 border-b p-1 sm:min-h-28 sm:p-1.5', i % 7 !== 0 && 'border-l', outside && 'bg-muted/30')}>
              <Link href={dayHref(d)} className={cn('mb-1 grid size-6 place-items-center rounded-full text-xs hover:bg-muted',
                sameDay(d, today) && 'bg-primary text-primary-foreground hover:bg-primary', outside && !sameDay(d, today) && 'text-muted-foreground')}>{d.day}</Link>
              <div className="grid gap-0.5">
                {items.slice(0, MAX).map((s) => (
                  <EventChip key={s.item.id} event={s.item} className="truncate whitespace-nowrap">
                    <span className="hidden sm:inline">{time.format(s.item.start)} </span><span className="font-medium">{s.item.title}</span>
                  </EventChip>
                ))}
                {items.length > MAX && <Link href={dayHref(d)} className="text-muted-foreground px-1 text-[11px] hover:underline">+{items.length - MAX} more</Link>}
                {busyCount > 0 && (
                  <Link href={dayHref(d)} aria-label={`Busy on Google Calendar${busyCount > 1 ? ` (${busyCount} times)` : ''}`}
                    className={cn('text-muted-foreground block h-2.5 truncate rounded-sm text-[10px] sm:h-auto sm:px-1.5 sm:py-0.5', busyClass)}>
                    {/* Just the striped bar on phones; there's no room for words. */}
                    <span className="hidden sm:inline">Busy{busyCount > 1 ? ` ×${busyCount}` : ''}</span>
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
