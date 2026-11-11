'use client'

import { useActionState, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveProfileName, type ProfileState } from './actions'

function Feedback({ state }: { state: ProfileState }) {
  return state.message ? <Alert variant={state.ok ? 'success' : 'destructive'}><AlertDescription>{state.message}</AlertDescription></Alert> : null
}

export function ProfileNameForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(saveProfileName, {})
  const [displayName, setDisplayName] = useState(name)
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="profile-name">Display name</Label>
          <Input id="profile-name" name="name" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="profile-email">Sign-in email</Label>
          <Input id="profile-email" value={email} readOnly className="bg-muted/50" />
        </div>
      </div>
      <Feedback state={state} />
      <Button type="submit" className="justify-self-start" disabled={pending || name === displayName}>{pending ? 'Saving…' : 'Save name'}</Button>
    </form>
  )
}

export function ProfilePhotoForm({ save, hasPhoto }: {
  save: (state: ProfileState, form: FormData) => Promise<ProfileState>
  hasPhoto: boolean
}) {
  const [state, action, pending] = useActionState(save, {})
  return (
    <form action={action} className="grid min-w-0 gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="profile-photo">Choose a photo</Label>
        <Input id="profile-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="profile-photo-formats" required />
        <p id="profile-photo-formats" className="text-muted-foreground text-xs">JPG, PNG, or WebP, up to 750 KB.</p>
      </div>
      <Feedback state={state} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={pending}>{pending ? 'Saving…' : 'Upload photo'}</Button>
        {hasPhoto && <Button type="submit" name="intent" value="remove" variant="ghost" formNoValidate disabled={pending}>Remove photo</Button>}
      </div>
    </form>
  )
}
