'use client'

import { useActionState, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { TimeGrid, useGuestTimezone, zoneName } from '@/components/booking/time-grid'
import type { ManageState } from './actions'

export function RescheduleForm({ starts, action }: { starts: string[]; action: (prev: ManageState, fd: FormData) => Promise<ManageState> }) {
  const [state, formAction, pending] = useActionState<ManageState, FormData>(action, {})
  const tz = useGuestTimezone()
  const [chosen, setChosen] = useState<string | null>(null)
  if (!tz) return <p className="text-muted-foreground text-sm">Loading times…</p>
  if (starts.length === 0) return <p className="text-muted-foreground text-sm">There are no other open times right now.</p>
  if (!chosen) {
    return (
      <div className="grid gap-4">
        {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
        <TimeGrid starts={starts} tz={tz} onPick={setChosen} />
      </div>
    )
  }
  const d = new Date(chosen)
  return (
    <form action={formAction} className="grid gap-3">
      <button type="button" onClick={() => setChosen(null)} className="text-muted-foreground flex items-center gap-1 justify-self-start text-sm hover:underline"><ArrowLeft className="size-4" /> Pick a different time</button>
      <p className="text-sm">
        Move to <span className="font-medium">{new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)}</span> ({zoneName(tz)})?
      </p>
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <input type="hidden" name="start" value={chosen} />
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Moving…' : 'Confirm new time'}</Button>
    </form>
  )
}

export function CancelForm({ action, refundNote }: { action: (prev: ManageState) => Promise<ManageState>; refundNote: string }) {
  const [state, formAction, pending] = useActionState<ManageState>(action, {})
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="grid gap-3">
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      {refundNote && <p className="text-muted-foreground text-sm">{refundNote}</p>}
      {confirming ? (
        <form action={formAction} className="flex flex-wrap gap-2">
          <Button type="submit" variant="destructive" disabled={pending}>{pending ? 'Cancelling…' : 'Yes, cancel my call'}</Button>
          <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>Keep it</Button>
        </form>
      ) : (
        <Button type="button" variant="outline" className="justify-self-start" onClick={() => setConfirming(true)}>Cancel this call</Button>
      )}
    </div>
  )
}
