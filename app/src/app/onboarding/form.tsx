'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { slugify, US_TIME_ZONES } from '@/lib/validation'
import { createBusiness, type OnboardingState } from './actions'

export function OnboardingForm() {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(createBusiness, {})
  const [name, setName] = useState(state.values?.name ?? '')
  const [slug, setSlug] = useState(state.values?.slug ?? '')
  const [slugEdited, setSlugEdited] = useState(false)
  const shownSlug = slugEdited ? slug : slugify(name)

  return (
    <form action={action} className="grid gap-5" noValidate>
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <div className="grid gap-1.5">
        <Label htmlFor="name">Business name</Label>
        <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Willow Coaching" aria-invalid={!!state.errors?.name} autoFocus />
        {state.errors?.name && <p className="text-destructive text-xs">{state.errors.name}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="slug">Your booking link</Label>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground shrink-0 text-sm">schedulefa.st/b/</span>
          <Input
            id="slug"
            name="slug"
            value={shownSlug}
            onChange={(e) => {
              setSlugEdited(true)
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
            }}
            placeholder="willow-coaching"
            aria-invalid={!!state.errors?.slug}
          />
        </div>
        {state.errors?.slug ? <p className="text-destructive text-xs">{state.errors.slug}</p> : <p className="text-muted-foreground text-xs">Families use this link to book with you. You can change it later.</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="timezone">Business time zone</Label>
        <select
          id="timezone"
          name="timezone"
          defaultValue={state.values?.timezone ?? 'America/New_York'}
          className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
        >
          {US_TIME_ZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {state.errors?.timezone && <p className="text-destructive text-xs">{state.errors.timezone}</p>}
      </div>
      <Button type="submit" size="lg" disabled={pending}>{pending ? 'Creating…' : 'Create business'}</Button>
    </form>
  )
}
