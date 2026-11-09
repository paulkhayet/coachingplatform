'use client'

import { useActionState, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { WeeklyWindow } from '@/db/schema'
import { DayRows, useDays } from '../../availability/forms'
import { saveOpeningHours, type OpeningHoursState } from './actions'

const WEEKDAYS_9_TO_5: WeeklyWindow[] = [1, 2, 3, 4, 5].map((day) => ({ day, start: 540, end: 1020 }))

export function OpeningHoursForm({ initial, businessName }: { initial: WeeklyWindow[] | null; businessName: string }) {
  const [state, action, pending] = useActionState<OpeningHoursState, FormData>(saveOpeningHours, {})
  const [mode, setMode] = useState<'none' | 'some'>(initial ? 'some' : 'none')
  const { days, update, weekly } = useDays(initial ?? WEEKDAYS_9_TO_5)
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="weekly" value={JSON.stringify(weekly)} />
      {state.message && <Alert variant={state.ok ? 'success' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert>}
      <fieldset className="grid gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" value="none" checked={mode === 'none'} onChange={() => setMode('none')} className="accent-primary size-4" />
          No limit: each person’s own hours decide
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" value="some" checked={mode === 'some'} onChange={() => setMode('some')} className="accent-primary size-4" />
          {businessName} is only open at these times
        </label>
      </fieldset>
      {mode === 'some' && <DayRows days={days} update={update} offLabel="Closed" />}
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : 'Save opening hours'}</Button>
    </form>
  )
}
