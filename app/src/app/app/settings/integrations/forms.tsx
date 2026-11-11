'use client'

import { useActionState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { saveCalendarChoices, type IntegrationState } from './actions'

const selectClass =
  'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

export function CalendarChoicesForm({ calendars, busy, destination }: { calendars: { id: string; name: string; primary: boolean; owned: boolean }[]; busy: string[]; destination: string }) {
  const [state, action, pending] = useActionState<IntegrationState, FormData>(saveCalendarChoices, {})
  return (
    <form action={action} className="grid gap-4">
      {state.message && <Alert variant={state.ok ? 'success' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert>}
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Check these calendars for conflicts (for all your businesses)</legend>
        {calendars.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="busy" value={c.id} defaultChecked={busy.includes(c.id)} className="accent-primary size-4" />
            {c.name}{c.primary && <span className="text-muted-foreground text-xs">(main)</span>}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-1.5 sm:max-w-sm">
        <Label htmlFor="destination">Add bookings to (default)</Label>
        <select id="destination" name="destination" defaultValue={destination} className={selectClass}>
          {calendars.filter((c) => c.owned).map((c) => <option key={c.id} value={c.id}>{c.name}{c.primary ? ' (main)' : ''}</option>)}
        </select>
      </div>
      <Button type="submit" variant="outline" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : 'Save calendar settings'}</Button>
    </form>
  )
}
