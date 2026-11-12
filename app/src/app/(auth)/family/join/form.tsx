'use client'

import { useActionState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { joinFamilyPortal, type FamilyJoinState } from './actions'

export function FamilyJoinButton({ token, accessId, label, variant }: { token?: string; accessId?: string; label: string; variant?: 'default' | 'outline' }) {
  const [state, action, pending] = useActionState<FamilyJoinState, FormData>(joinFamilyPortal, {})
  return (
    <form action={action} className="grid gap-3">
      {token && <input type="hidden" name="token" value={token} />}
      {accessId && <input type="hidden" name="accessId" value={accessId} />}
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <Button type="submit" variant={variant} disabled={pending}>{pending ? 'Opening…' : label}</Button>
    </form>
  )
}
