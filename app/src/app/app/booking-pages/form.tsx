'use client'

import { useActionState, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LOCATION_TYPES, pageSlugify } from '@/lib/booking/schemas'
import { MAX_QUESTIONS, QUESTION_TYPES, newQuestionId } from '@/lib/booking/questions'
import type { BookingQuestion } from '@/db/schema'
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
  /** Dollars as typed, e.g. "45"; blank means free. */
  price: string
  refundCutoffHours: number
  questions: BookingQuestion[]
  askNotes: boolean
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
  price: '',
  refundCutoffHours: 24,
  questions: [],
  askNotes: true,
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

/** Who takes the page's calls (D-061): shown to owners and administrators only. */
export interface HostChoice {
  options: { id: string; name: string }[]
  mode: 'one' | 'shared'
  hostId: string
  pool: string[]
  businessName: string
}

function HostPicker({ choice, values, error }: { choice: HostChoice; values?: Record<string, string>; error?: string }) {
  const [mode, setMode] = useState<'one' | 'shared'>((values?.hostMode as 'one' | 'shared' | undefined) ?? choice.mode)
  const [pool, setPool] = useState<string[]>(values?.poolHost !== undefined ? values.poolHost.split(',').filter(Boolean) : choice.pool)
  const hostId = values?.hostMembershipId || choice.hostId || choice.options[0]?.id || ''
  return (
    <fieldset className="grid gap-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-medium">Who takes these calls?</legend>
      <input type="hidden" name="hostMode" value={mode} />
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" checked={mode === 'one'} onChange={() => setMode('one')} className="accent-primary size-4" />
        One coach
      </label>
      {mode === 'one' && (
        <select name="hostMembershipId" defaultValue={hostId} aria-label="Coach" className={`${selectClass} ml-6 max-w-xs`}>
          {choice.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" checked={mode === 'shared'} onChange={() => setMode('shared')} className="accent-primary size-4" />
        Any available coach from a group
      </label>
      {mode === 'shared' && (
        <div className="ml-6 grid gap-2">
          <p className="text-muted-foreground text-xs">Families see every time at least one of these coaches is free. Each call goes to a free coach, spreading calls evenly; it stays with that coach if it’s moved.</p>
          {choice.options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="poolHost" value={o.id} checked={pool.includes(o.id)} onChange={(ev) => setPool(ev.target.checked ? [...pool, o.id] : pool.filter((x) => x !== o.id))} className="accent-primary size-4" />
              {o.name}
            </label>
          ))}
        </div>
      )}
      {choice.options.length <= 1 && <p className="text-muted-foreground text-xs">Only people who take calls can host. Invite coaches from Team.</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </fieldset>
  )
}

export function BookingPageForm({ action, defaults, businessSlug, submitLabel, paymentsReady, hostChoice, zoomAvailable }: { action: (prev: BookingPageState, fd: FormData) => Promise<BookingPageState>; defaults: PageDefaults; businessSlug: string; submitLabel: string; paymentsReady: boolean; hostChoice?: HostChoice; zoomAvailable: boolean }) {
  const [state, formAction, pending] = useActionState<BookingPageState, FormData>(action, {})
  const v = (k: Exclude<keyof PageDefaults, 'questions'>) => state.values?.[k] ?? String(defaults[k])
  const [price, setPrice] = useState(v('price'))
  const [questions, setQuestions] = useState<BookingQuestion[]>(() => {
    try {
      return state.values?.questions ? JSON.parse(state.values.questions) : defaults.questions
    } catch {
      return defaults.questions
    }
  })
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
      {hostChoice && <HostPicker choice={hostChoice} values={state.values} error={e.host} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="durationMinutes" label="Length (minutes)" type="number" min={5} max={480} step={5} defaultValue={v('durationMinutes')} error={e.durationMinutes} />
        <div className="grid gap-1.5">
          <Label htmlFor="locationType">Where</Label>
          <select id="locationType" name="locationType" value={locationType} onChange={(ev) => setLocationType(ev.target.value)} className={selectClass}>
            {LOCATION_TYPES.filter((l) => l.value !== 'zoom' || zoomAvailable || defaults.locationType === 'zoom').map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </div>
      {locationType === 'zoom' ? (
        <p className="text-muted-foreground -mt-2 text-xs">Each booking gets its own meeting on the host’s Zoom account, sent with the confirmation. Hosts connect Zoom on their Availability page.</p>
      ) : (
        <Field id="locationDetail" label="Location details" defaultValue={v('locationDetail')} hint={locationHint[locationType]} error={e.locationDetail} />
      )}
      <fieldset className="grid gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Scheduling rules</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="minNoticeMinutes" label="Minimum notice (minutes)" type="number" min={0} step={15} defaultValue={v('minNoticeMinutes')} hint="240 = guests must book at least 4 hours ahead." error={e.minNoticeMinutes} />
          <Field id="windowDays" label="Booking window (days)" type="number" min={1} max={365} defaultValue={v('windowDays')} hint="How far ahead guests can book." error={e.windowDays} />
          <Field id="bufferBeforeMinutes" label="Buffer before (minutes)" type="number" min={0} max={240} step={5} defaultValue={v('bufferBeforeMinutes')} hint="Free time needed before each call." error={e.bufferBeforeMinutes} />
          <Field id="bufferAfterMinutes" label="Buffer after (minutes)" type="number" min={0} max={240} step={5} defaultValue={v('bufferAfterMinutes')} hint="Free time needed after each call." error={e.bufferAfterMinutes} />
        </div>
      </fieldset>
      <fieldset className="grid gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Price</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="price">Price (USD)</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-sm">$</span>
              <Input id="price" name="price" inputMode="decimal" value={price} onChange={(ev) => setPrice(ev.target.value)} placeholder="Free" aria-invalid={!!e.priceCents} />
            </div>
            {e.priceCents ? <p className="text-destructive text-xs">{e.priceCents}</p> : <p className="text-muted-foreground text-xs">Leave blank for a free call. Paid calls are charged by card when booked.</p>}
          </div>
          <Field id="refundCutoffHours" label="Full refund if cancelled at least (hours before)" type="number" min={0} max={720} defaultValue={v('refundCutoffHours')} hint="Guests who cancel later aren’t refunded. If you cancel, they’re always refunded." error={e.refundCutoffHours} />
        </div>
        {price.trim() !== '' && !paymentsReady && (
          <Alert variant="warning"><AlertDescription>Guests can’t book a paid call until Stripe is connected and ready in Payments.</AlertDescription></Alert>
        )}
      </fieldset>
      <fieldset className="grid gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Questions for guests</legend>
        <p className="text-muted-foreground -mt-1 text-xs">Guests always give their name and email. Ask anything else you need here.</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="askNotes" defaultChecked={state.values ? state.values.askNotes === 'on' : defaults.askNotes} className="accent-primary size-4" />
          Let guests add an optional note (“Anything else you’d like to share?”)
        </label>
        <input type="hidden" name="questions" value={JSON.stringify(questions)} />
        <QuestionsEditor questions={questions} onChange={setQuestions} />
        {e.questions && <p className="text-destructive text-xs">{e.questions}</p>}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={state.values ? state.values.active === 'on' : defaults.active} className="accent-primary size-4" />
        Page is live (guests can book)
      </label>
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>
    </form>
  )
}

function QuestionsEditor({ questions, onChange }: { questions: BookingQuestion[]; onChange: (q: BookingQuestion[]) => void }) {
  const update = (i: number, patch: Partial<BookingQuestion>) => onChange(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  return (
    <div className="grid gap-3">
      {questions.map((q, i) => {
        const choice = q.type === 'single' || q.type === 'multiple'
        return (
          <div key={q.id} className="bg-muted/40 grid gap-3 rounded-md border p-3">
            <div className="flex items-start gap-2">
              <Input aria-label={`Question ${i + 1}`} value={q.label} maxLength={200} placeholder="What would you like to work on?" onChange={(ev) => update(i, { label: ev.target.value })} />
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove question" onClick={() => onChange(questions.filter((_, j) => j !== i))}><Trash2 /></Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select aria-label="Answer type" value={q.type} className={selectClass} onChange={(ev) => update(i, { type: ev.target.value as BookingQuestion['type'], options: ev.target.value === 'single' || ev.target.value === 'multiple' ? (q.options.length ? q.options : ['', '']) : [] })}>
                {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={q.required} onChange={(ev) => update(i, { required: ev.target.checked })} className="accent-primary size-4" />
                Required
              </label>
            </div>
            {choice && (
              <div className="grid gap-2">
                {q.options.map((o, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <Input aria-label={`Choice ${k + 1}`} value={o} maxLength={100} placeholder={`Choice ${k + 1}`} onChange={(ev) => update(i, { options: q.options.map((x, m) => (m === k ? ev.target.value : x)) })} />
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove choice" disabled={q.options.length <= 2} onClick={() => update(i, { options: q.options.filter((_, m) => m !== k) })}><Trash2 /></Button>
                  </div>
                ))}
                {q.options.length < 20 && <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => update(i, { options: [...q.options, ''] })}><Plus /> Add choice</Button>}
              </div>
            )}
          </div>
        )
      })}
      {questions.length < MAX_QUESTIONS && (
        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...questions, { id: newQuestionId(), label: '', type: 'short', options: [], required: false }])}>
          <Plus /> Add a question
        </Button>
      )}
    </div>
  )
}
