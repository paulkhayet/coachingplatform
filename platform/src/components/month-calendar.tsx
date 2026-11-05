import * as React from 'react'
import { addDays, addMonths, endOfMonth, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function MonthCalendar({ selected, onSelect, available, maxDate }: { selected: Date | null; onSelect: (d: Date) => void; available: (d: Date) => boolean; maxDate: Date }) {
  const [month, setMonth] = React.useState(startOfMonth(selected ?? new Date()))
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i)).filter((d, i) => i < 35 || d <= endOfMonth(month))
  const canPrev = month > startOfMonth(new Date())
  const canNext = startOfMonth(addMonths(month, 1)) <= maxDate
  return (
    <div className="select-none">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-medium">{format(month, 'MMMM yyyy')}</div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" disabled={!canPrev} onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft /></Button>
          <Button variant="ghost" size="icon-sm" disabled={!canNext} onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight /></Button>
        </div>
      </div>
      <div className="text-muted-foreground mb-1 grid grid-cols-7 text-center text-xs">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = isSameMonth(d, month)
          const ok = inMonth && available(d)
          const sel = selected && isSameDay(d, selected)
          return (
            <button
              key={d.toISOString()}
              disabled={!ok}
              onClick={() => onSelect(d)}
              aria-label={format(d, 'EEEE, MMMM d')}
              aria-pressed={!!sel}
              className={cn(
                'relative mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-full text-sm transition-colors',
                !inMonth && 'invisible',
                ok ? 'bg-accent text-accent-foreground hover:bg-primary/20 font-semibold' : 'text-muted-foreground/50',
                sel && 'bg-primary text-primary-foreground hover:bg-primary',
              )}
            >
              {format(d, 'd')}
              {isToday(d) && <span className={cn('absolute bottom-1 size-1 rounded-full', sel ? 'bg-primary-foreground' : 'bg-primary')} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
