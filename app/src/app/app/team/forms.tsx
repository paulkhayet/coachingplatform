'use client'

import { useActionState, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cancelInvitation, inviteMember, leaveBusiness, removeMember, resendInvitation, type InviteState, type TeamState } from './actions'

/** Remove a member, with a confirm step that says what happens to their bookings. */
export function RemoveMemberButton({ membershipId, name, businessName }: { membershipId: string; name: string; businessName: string }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(removeMember, {})
  const [confirming, setConfirming] = useState(false)
  if (state.ok) return <span className="text-muted-foreground text-xs">{state.message}</span>
  if (!confirming) return <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>Remove</Button>
  return (
    <form action={action} className="grid max-w-xs justify-items-end gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <p className="text-muted-foreground text-right text-xs">Remove {name} from {businessName}? Their upcoming bookings here are cancelled (paid guests refunded) and their booking pages turned off.</p>
      {state.message && <p className="text-destructive text-xs">{state.message}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>Keep</Button>
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>{pending ? 'Removing…' : 'Remove'}</Button>
      </div>
    </form>
  )
}

export function LeaveBusiness({ businessName }: { businessName: string }) {
  const [state, action, pending] = useActionState<TeamState>(leaveBusiness, {})
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="grid gap-3">
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      {confirming ? (
        <form action={action} className="grid gap-2">
          <p className="text-sm">Leave {businessName}? Your upcoming bookings with {businessName} are cancelled (paid guests refunded). Your hours, calendar and other businesses aren’t affected.</p>
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" disabled={pending}>{pending ? 'Leaving…' : `Leave ${businessName}`}</Button>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>Stay</Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" className="justify-self-start" onClick={() => setConfirming(true)}>Leave {businessName}</Button>
      )}
    </div>
  )
}

/** The invite link, with a copy button. Shown once after sending, since only its hash is stored. */
function InviteLink({ url, emailed }: { url: string; emailed?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="grid gap-1.5">
      <div className="flex gap-2">
        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Invitation link" className="font-mono text-xs" />
        <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy link'}</Button>
      </div>
      <p className="text-muted-foreground text-xs">{emailed ? 'You can also share this link yourself. ' : ''}It works once, only for that email address, and expires in 14 days.</p>
    </div>
  )
}

export function InviteForm({ businessName }: { businessName: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteMember, {})
  const [role, setRole] = useState(state.values?.role ?? 'coach')
  // A successful invite clears the form for the next one.
  const v = state.ok ? {} : (state.values ?? {})
  return (
    <form action={action} className="grid gap-4" key={state.ok ? state.url : 'form'}>
      {state.message && <Alert variant={state.ok ? 'success' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert>}
      {state.ok && state.url && <InviteLink url={state.url} emailed={state.emailed} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" name="email" type="email" autoComplete="off" required defaultValue={v.email} placeholder="name@example.com" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <select id="invite-role" name="role" value={role} onChange={(e) => setRole(e.target.value)} className="border-input bg-background h-9 rounded-md border px-3 text-sm">
            <option value="coach">Coach: takes calls, sees their own bookings</option>
            <option value="admin">Administrator: runs bookings for {businessName}</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="invite-title">Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input id="invite-title" name="title" maxLength={60} defaultValue={v.title} placeholder="e.g. Math tutor" />
        </div>
        {role === 'admin' && (
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="coaches" defaultChecked={v.coaches === 'on'} className="accent-primary size-4" />
            Also takes calls
          </label>
        )}
      </div>
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Sending…' : 'Send invitation'}</Button>
    </form>
  )
}

export function InvitationActions({ invitationId, email }: { invitationId: string; email: string }) {
  const [resent, resend, resending] = useActionState<InviteState, FormData>(resendInvitation, {})
  const [cancelled, cancel, cancelling] = useActionState<InviteState, FormData>(cancelInvitation, {})
  if (cancelled.ok) return <span className="text-muted-foreground text-xs">{cancelled.message}</span>
  return (
    <div className="grid justify-items-end gap-2">
      <div className="flex gap-1">
        <form action={resend}>
          <input type="hidden" name="invitationId" value={invitationId} />
          <Button type="submit" variant="ghost" size="sm" disabled={resending} aria-label={`Send ${email} a new link`}>{resending ? 'Sending…' : 'Send new link'}</Button>
        </form>
        <form action={cancel}>
          <input type="hidden" name="invitationId" value={invitationId} />
          <Button type="submit" variant="ghost" size="sm" disabled={cancelling} aria-label={`Cancel the invitation for ${email}`}>{cancelling ? 'Cancelling…' : 'Cancel'}</Button>
        </form>
      </div>
      {(resent.message || cancelled.message) && !resent.url && <p className={resent.ok ? 'text-muted-foreground text-xs' : 'text-destructive text-xs'}>{resent.message ?? cancelled.message}</p>}
      {resent.ok && resent.url && <div className="w-full max-w-md text-left"><p className="text-muted-foreground mb-1.5 text-xs">{resent.message}</p><InviteLink url={resent.url} emailed={resent.emailed} /></div>}
    </div>
  )
}
