'use client'

import { useActionState, useState } from 'react'
import { ImageUpload } from '@/components/image-upload'
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

export function ProfilePhotoForm({ save, hasPhoto, preview }: {
  save: (state: ProfileState, form: FormData) => Promise<ProfileState>
  hasPhoto: boolean
  preview: React.ReactNode
}) {
  return (
    <ImageUpload preview={preview} field="photo" hasImage={hasPhoto} save={save} label="photo"
      hint="Click the photo or the button to choose an image. JPG, PNG, or WebP; large photos are resized automatically." />
  )
}
