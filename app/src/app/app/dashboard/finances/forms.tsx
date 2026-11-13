'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import type { SyncState } from './actions'

export function SyncFeesButton({ sync }: { sync: (state: SyncState, data: FormData) => Promise<SyncState> }) {
  const [state, action, pending] = useActionState(sync, {})
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Button type="submit" variant="outline" size="sm" disabled={pending}>{pending ? 'Asking Stripe…' : 'Sync Stripe fees'}</Button>
      {state.message && <span role="status" className={state.ok ? 'text-muted-foreground text-xs' : 'text-destructive text-xs'}>{state.message}</span>}
    </form>
  )
}
