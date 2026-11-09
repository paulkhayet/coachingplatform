'use client'

import { useActionState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { joinBusiness, type JoinState } from './actions'

export function JoinButton({ token, invitationId, businessName, variant }: { token?: string; invitationId?: string; businessName: string; variant?: 'default' | 'outline' }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinBusiness, {})
  return (
    <form action={action} className="grid gap-3">
      {token && <input type="hidden" name="token" value={token} />}
      {invitationId && <input type="hidden" name="invitationId" value={invitationId} />}
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <Button type="submit" variant={variant} disabled={pending}>{pending ? 'Joining…' : `Join ${businessName}`}</Button>
    </form>
  )
}
