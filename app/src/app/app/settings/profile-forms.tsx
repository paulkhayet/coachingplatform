'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import { imageFormData } from '@/lib/shrink-image'
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
  const [problem, setProblem] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => { if (state.ok) formRef.current?.reset() }, [state])
  // The photo is shrunk in the browser first: server actions refuse bodies over 1 MB, and phone
  // photos are usually bigger, which used to crash the page.
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    setProblem(null)
    setPreparing(true)
    const data = await imageFormData(event.currentTarget, submitter, 'photo')
    setPreparing(false)
    if (typeof data === 'string') setProblem(data)
    else startTransition(() => action(data))
  }
  const busy = pending || preparing
  return (
    <form ref={formRef} onSubmit={submit} className="grid min-w-0 gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="profile-photo">Choose a photo</Label>
        <Input id="profile-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="profile-photo-formats" required />
        <p id="profile-photo-formats" className="text-muted-foreground text-xs">JPG, PNG, or WebP. Large photos are resized automatically.</p>
      </div>
      {problem ? <Alert variant="destructive"><AlertDescription>{problem}</AlertDescription></Alert> : <Feedback state={state} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={busy}>{busy ? 'Saving…' : 'Upload photo'}</Button>
        {hasPhoto && <Button type="submit" name="intent" value="remove" variant="ghost" formNoValidate disabled={busy}>Remove photo</Button>}
      </div>
    </form>
  )
}
