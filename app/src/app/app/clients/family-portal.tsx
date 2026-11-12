'use client'

import { useActionState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { FamilyActionState } from './family-actions'

export type PortalAccessRow = {
  id: string
  email: string
  invited_at: string
  expires_at: string | null
  accepted_at: string | null
  revoked_at: string | null
  can_view_sessions: boolean
  can_view_credits: boolean
  can_reschedule: boolean
  can_book: boolean
}
type Action = (state: FamilyActionState, form: FormData) => Promise<FamilyActionState>

const PERMISSIONS = [
  ['canViewSessions', 'can_view_sessions', 'See sessions and meeting links'],
  ['canViewCredits', 'can_view_credits', 'See credits and payments due'],
  ['canReschedule', 'can_reschedule', 'Reschedule or cancel sessions'],
  ['canBook', 'can_book', 'Book sessions from credits'],
] as const

function Message({ state }: { state: FamilyActionState }) {
  if (!state.message) return null
  return (
    <Alert variant={state.ok ? 'success' : 'destructive'}>
      <AlertDescription>
        {state.message}
        {state.url && <input readOnly value={state.url} onFocus={(e) => e.currentTarget.select()} className="bg-background mt-2 block w-full rounded border px-2 py-1 font-mono text-xs" />}
      </AlertDescription>
    </Alert>
  )
}

/** Portal access for one guardian contact (D-073): status, invite or turn off, and what they can do. */
export function GuardianPortal({ access, hasEmail, invite, revoke, savePermissions }: {
  access: PortalAccessRow | null
  hasEmail: boolean
  invite: Action
  revoke: Action | null
  savePermissions: Action | null
}) {
  const [inviteState, inviteAction, inviting] = useActionState(invite, {})
  const [revokeState, revokeAction, revoking] = useActionState(revoke ?? (async () => ({})), {})
  const [permState, permAction, saving] = useActionState(savePermissions ?? (async () => ({})), {})
  const now = Date.now()
  const status = !access || access.revoked_at ? (access?.revoked_at ? 'off' : 'none')
    : access.accepted_at ? 'active'
      : access.expires_at && new Date(access.expires_at).getTime() > now ? 'invited' : 'expired'
  const label = { none: 'Not invited', off: 'Access turned off', active: 'Portal active', invited: 'Invited', expired: 'Invitation expired' }[status]
  const tone = status === 'active' ? 'success' : status === 'invited' ? 'info' : status === 'expired' ? 'warning' : 'neutral'
  const busy = inviting || revoking || saving

  return (
    <div className="bg-muted/30 grid gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">Family portal</span>
        <StatusBadge tone={tone}>{label}</StatusBadge>
        {status === 'invited' && access?.expires_at && (
          <span className="text-muted-foreground text-xs">until {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(access.expires_at))}</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {status !== 'active' && (
            hasEmail
              ? <form action={inviteAction}><Button type="submit" size="sm" variant={status === 'none' ? 'default' : 'outline'} disabled={busy}>{inviting ? 'Sending…' : status === 'none' ? 'Invite to portal' : 'Send a new invitation'}</Button></form>
              : <span className="text-muted-foreground text-xs">Add an email to invite them.</span>
          )}
          {(status === 'active' || status === 'invited') && revoke && (
            <form action={revokeAction}><Button type="submit" size="sm" variant="ghost" disabled={busy}>{revoking ? 'Turning off…' : 'Turn off access'}</Button></form>
          )}
        </div>
      </div>
      <Message state={inviteState} />
      <Message state={revokeState} />
      {access && (status === 'active' || status === 'invited') && savePermissions && (
        <details>
          <summary className="cursor-pointer text-xs font-medium">What they can do</summary>
          <form action={permAction} className="mt-2 grid gap-2">
            {PERMISSIONS.map(([field, column, text]) => (
              <label key={field} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={field} defaultChecked={access[column]} className="accent-primary size-4" /> {text}
              </label>
            ))}
            <p className="text-muted-foreground text-xs">Rescheduling and booking from the portal are coming soon; these switches will apply when they arrive.</p>
            <Message state={permState} />
            <Button type="submit" size="sm" variant="outline" className="justify-self-start" disabled={busy}>{saving ? 'Saving…' : 'Save'}</Button>
          </form>
        </details>
      )}
    </div>
  )
}
