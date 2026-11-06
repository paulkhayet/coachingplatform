'use client'

import { useActionState, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LOCATION_TYPES, pageSlugify } from '@/lib/booking/schemas'
import type { BookingPageState } from './actions'

const selectClass =
  'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

export interface PageDefaults {
  title: string
  slug: string
  description: string
  durationMinutes: number
  locationType: string
  locationDetail: string
  minNoticeMinutes: number
  windowDays: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  active: boolean
}

export const NEW_PAGE: PageDefaults = {
  title: '',
  slug: '',
  description: '',
  durationMinutes: 30,
  locationType: 'video_link',
  locationDetail: '',
  minNoticeMinutes: 240,
  windowDays: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  active: true,
}

const locationHint: Record<string, string> = {
  video_link: 'Your Zoom or Google Meet link. Guests see it once they’ve booked. (Automatic Zoom links come later.)',
  phone: 'How the call happens, e.g. “I’ll call you at the number you give me.”',
  in_person: 'The address. Guests see it once they’ve booked.',
}

function Field({ id, label, error, hint, ...props }: { id: string; label: string; error?: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} aria-invalid={!!error} {...props} />
      {error ? <p className="text-destructive text-xs">{error}</p> : hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}

export function BookingPageForm({ action, defaults, businessSlug, submitLabel }: { action: (prev: BookingPageState, fd: FormData) => Promise<BookingPageState>; defaults: PageDefaults; businessSlug: string; submitLabel: string }) {
  const [state, formAction, pending] = useActionState<BookingPageState, FormData>(action, {})
  const v = (k: keyof PageDefaults) => state.values?.[k] ?? String(defaults[k])
  const [title, setTitle] = useState(v('title'))
  const [slug, setSlug] = useState(v('slug'))
  const [slugEdited, setSlugEdited] = useState(Boolean(defaults.slug))
  const [locationType, setLocationType] = useState(v('locationType'))
  const shownSlug = slugEdited ? slug : pageSlugify(title)
  const e = state.errors ?? {}

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <Field id="title" label="Name" value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="Free intro call" error={e.title} autoFocus={!defaults.title} />
      <div className="grid gap-1.5">
        <Label htmlFor="slug">Link</Label>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground shrink-0 text-sm">schedulefa.st/b/{businessSlug}/</span>
          <Input id="slug" name="slug" value={shownSlug} aria-invalid={!!e.slug} placeholder="intro-call" onChange={(ev) => { setSlugEdited(true); setSlug(ev.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')) }} />
        </div>
        {e.slug && <p className="text-destructive text-xs">{e.slug}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <textarea id="description" name="description" defaultValue={v('description')} rows={3} maxLength={1000} placeholder="A short call to talk about your goals and see if we’re a good fit." className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]" />
        {e.description && <p className="text-destructive text-xs">{e.description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="durationMinutes" label="Length (minutes)" type="number" min={5} max={480} step={5} defaultValue={v('durationMinutes')} error={e.durationMinutes} />
        <div className="grid gap-1.5">
          <Label htmlFor="locationType">Where</Label>
          <select id="locationType" name="locationType" value={locationType} onChange={(ev) => setLocationType(ev.target.value)} className={selectClass}>
            {LOCATION_TYPES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </div>
      <Field id="locationDetail" label="Location details" defaultValue={v('locationDetail')} hint={locationHint[locationType]} error={e.locationDetail} />
      <fieldset className="grid gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Scheduling rules</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="minNoticeMinutes" label="Minimum notice (minutes)" type="number" min={0} step={15} defaultValue={v('minNoticeMinutes')} hint="240 = guests must book at least 4 hours ahead." error={e.minNoticeMinutes} />
          <Field id="windowDays" label="Booking window (days)" type="number" min={1} max={365} defaultValue={v('windowDays')} hint="How far ahead guests can book." error={e.windowDays} />
          <Field id="bufferBeforeMinutes" label="Buffer before (minutes)" type="number" min={0} max={240} step={5} defaultValue={v('bufferBeforeMinutes')} hint="Free time needed before each call." error={e.bufferBeforeMinutes} />
          <Field id="bufferAfterMinutes" label="Buffer after (minutes)" type="number" min={0} max={240} step={5} defaultValue={v('bufferAfterMinutes')} hint="Free time needed after each call." error={e.bufferAfterMinutes} />
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={state.values ? state.values.active === 'on' : defaults.active} className="accent-primary size-4" />
        Page is live (guests can book)
      </label>
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>
    </form>
  )
}
