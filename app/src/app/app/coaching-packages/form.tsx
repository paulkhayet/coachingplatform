'use client'

import { useActionState, useRef, useState, type ComponentProps } from 'react'
import { Archive, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PackageFormState } from './actions'
import type { PackageDetails } from './data'

type FormAction = (state: PackageFormState, form: FormData) => Promise<PackageFormState>
type Coach = { id: string; name: string }
type FormatDraft = { key: number; name: string; durationMinutes: string; credits: string }

const selectClass = 'bg-background border-input focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60'
const newFormat = { name: '', durationMinutes: '60', credits: '1' }

function Field({ id, label, error, hint, ...props }: ComponentProps<typeof Input> & { id: string; label: string; error?: string; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input name={id} id={id} aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${id}-help` : undefined} {...props} />
      {(error || hint) && <p id={`${id}-help`} className={error ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>{error || hint}</p>}
    </div>
  )
}

function initialValues(pkg?: PackageDetails) {
  return {
    name: pkg?.name ?? '',
    description: pkg?.description ?? '',
    kind: pkg?.kind ?? 'fixed',
    termWeeks: pkg?.term_weeks?.toString() ?? '',
    credits: pkg ? String(pkg.credit_units / 100) : '',
    price: pkg ? (pkg.price_cents / 100).toFixed(2) : '',
    installments: Boolean(pkg?.installment_count),
    installmentCount: pkg?.installment_count?.toString() ?? '3',
    installmentCadence: pkg?.installment_cadence ?? 'monthly',
    coachMode: pkg?.eligible_coach_ids ? 'selected' : 'any',
    cancellationNoticeHours: pkg?.cancellation_notice_hours?.toString() ?? '',
    lateCancellation: pkg?.late_cancellation ?? 'inherit',
    expiration: pkg?.expiration ?? 'inherit',
    makeupExtensionDays: pkg?.makeup_extension_days?.toString() ?? '',
  }
}

export function PackageForm({ action, pkg, coaches, readOnly = false }: { action: FormAction; pkg?: PackageDetails; coaches: Coach[]; readOnly?: boolean }) {
  const [state, submit, pending] = useActionState(action, {})
  const [values, setValues] = useState(() => initialValues(pkg))
  const [formats, setFormats] = useState<FormatDraft[]>(() => pkg?.session_formats.map((format, key) => ({
    key, name: format.name, durationMinutes: String(format.durationMinutes), credits: String(format.creditUnits / 100),
  })) ?? [{ key: 0, ...newFormat, name: 'Coaching session' }])
  const nextFormat = useRef(formats.length)
  const [selectedCoaches, setSelectedCoaches] = useState(pkg?.eligible_coach_ids ?? [])
  const missingCoaches = selectedCoaches.filter((id) => !coaches.some((coach) => coach.id === id))
  const monthly = values.kind === 'monthly'
  const errors = state.errors ?? {}

  function set<K extends keyof typeof values>(name: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [name]: value }))
  }

  function changeFormat(key: number, change: Partial<Omit<FormatDraft, 'key'>>) {
    setFormats((current) => current.map((format) => format.key === key ? { ...format, ...change } : format))
  }

  function addFormat() {
    const key = nextFormat.current++
    setFormats((current) => [...current, { key, ...newFormat }])
  }

  function toggleCoach(id: string, checked: boolean) {
    setSelectedCoaches((current) => checked ? [...current, id] : current.filter((coach) => coach !== id))
  }

  return (
    <form action={submit} className="grid gap-5">
      <fieldset disabled={readOnly || pending} className="grid min-w-0 gap-5">
        <Card>
          <CardHeader><CardTitle>Package details</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Field id="name" label="Name" value={values.name} onChange={(e) => set('name', e.target.value)} maxLength={100} placeholder="Eight-week coaching bundle" error={errors.name} required />
            <div className="grid gap-1.5">
              <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea id="description" name="description" value={values.description} onChange={(e) => set('description', e.target.value)} rows={3} maxLength={1000} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'description-error' : undefined} className="bg-background border-input focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60" />
              {errors.description && <p id="description-error" className="text-destructive text-xs">{errors.description}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="kind">Package type</Label>
                <select id="kind" name="kind" value={values.kind} onChange={(e) => set('kind', e.target.value as typeof values.kind)} className={selectClass}>
                  <option value="fixed">Fixed-term bundle</option>
                  <option value="monthly">Ongoing monthly plan</option>
                </select>
              </div>
              {!monthly && <Field id="termWeeks" label="Length in weeks" type="number" min={1} max={260} step={1} placeholder="8" value={values.termWeeks} onChange={(e) => set('termWeeks', e.target.value)} error={errors.termWeeks} required />}
              <Field id="credits" label={monthly ? 'Credits per month' : 'Credits in the bundle'} inputMode="decimal" maxLength={8} placeholder={monthly ? '4' : '8'} value={values.credits} onChange={(e) => set('credits', e.target.value)} error={errors.creditUnits} required />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session formats</CardTitle>
            <CardDescription>Choose the session lengths clients can book and how many credits each uses.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {formats.map((format, index) => (
              <fieldset key={format.key} aria-label={`Session format ${index + 1}`} className="grid min-w-0 gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <Field id={`format-name-${format.key}`} name="formatName" label="Format name" value={format.name} onChange={(e) => changeFormat(format.key, { name: e.target.value })} maxLength={80} required />
                <Field id={`format-duration-${format.key}`} name="formatDuration" label="Minutes" type="number" min={1} max={480} step={1} value={format.durationMinutes} onChange={(e) => changeFormat(format.key, { durationMinutes: e.target.value })} required />
                <Field id={`format-credits-${format.key}`} name="formatCredits" label="Credit cost" inputMode="decimal" maxLength={8} value={format.credits} onChange={(e) => changeFormat(format.key, { credits: e.target.value })} required />
                {!readOnly && <Button type="button" variant="ghost" size="icon" aria-label={`Remove session format ${index + 1}`} disabled={formats.length <= 1} onClick={() => setFormats((current) => current.filter((row) => row.key !== format.key))}><Trash2 /></Button>}
              </fieldset>
            ))}
            {errors.sessionFormats && <p className="text-destructive text-sm" role="alert">{errors.sessionFormats}</p>}
            {!readOnly && <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={formats.length >= 10} onClick={addFormat}><Plus /> Add format</Button>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing and payment</CardTitle>
            <CardDescription>{monthly ? 'Set the price for each month of coaching.' : 'Set the total price. Clients can pay in full or choose installments if you offer them.'}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field id="price" label={monthly ? 'Monthly price (USD)' : 'Total price (USD)'} inputMode="decimal" maxLength={16} placeholder={monthly ? '400.00' : '1200.00'} value={values.price} onChange={(e) => set('price', e.target.value)} error={errors.priceCents} required />
            {!monthly && <>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="installments" checked={values.installments} onChange={(e) => set('installments', e.target.checked)} className="accent-primary size-4" /> Offer installments</label>
              {values.installments && <div className="grid gap-4 sm:grid-cols-2">
                <Field id="installmentCount" label="Number of payments" type="number" min={2} max={24} step={1} value={values.installmentCount} onChange={(e) => set('installmentCount', e.target.value)} error={errors.installmentCount} required />
                <div className="grid gap-1.5">
                  <Label htmlFor="installmentCadence">Payment frequency</Label>
                  <select id="installmentCadence" name="installmentCadence" value={values.installmentCadence} onChange={(e) => set('installmentCadence', e.target.value as typeof values.installmentCadence)} className={selectClass}>
                    <option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>}
            </>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Eligible coaches</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Label htmlFor="coachMode">Who can deliver this package?</Label>
            <select id="coachMode" name="coachMode" value={values.coachMode} onChange={(e) => set('coachMode', e.target.value)} className={selectClass} aria-invalid={Boolean(errors.eligibleCoachIds)} aria-describedby={errors.eligibleCoachIds ? 'coach-error' : undefined}>
              <option value="any">Any active coach in this business</option><option value="selected">Selected coaches</option>
            </select>
            {values.coachMode === 'selected' && <fieldset className="grid gap-2" aria-label="Select eligible coaches">
              {coaches.length === 0 && <p className="text-muted-foreground text-sm">There are no active coaches to select.</p>}
              {[...coaches, ...missingCoaches.map((id) => ({ id, name: 'Unavailable coach' }))].map((coach) => (
                <label key={coach.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="coachId" value={coach.id} checked={selectedCoaches.includes(coach.id)} onChange={(e) => toggleCoach(coach.id, e.target.checked)} className="accent-primary size-4" /> {coach.name}
                </label>
              ))}
              {missingCoaches.length > 0 && <p className="text-muted-foreground text-xs">Remove unavailable coaches before using this package.</p>}
            </fieldset>}
            {errors.eligibleCoachIds && <p id="coach-error" className="text-destructive text-xs">{errors.eligibleCoachIds}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cancellation and expiration</CardTitle>
            <CardDescription>Set terms for this package or use the business policy when enrolling a client.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="cancellationNoticeHours" label="Cancellation notice in hours" type="number" min={0} max={720} step={1} placeholder="Use business policy" value={values.cancellationNoticeHours} onChange={(e) => set('cancellationNoticeHours', e.target.value)} error={errors.cancellationNoticeHours} />
            <div className="grid gap-1.5">
              <Label htmlFor="lateCancellation">Late cancellation</Label>
              <select id="lateCancellation" name="lateCancellation" value={values.lateCancellation} onChange={(e) => set('lateCancellation', e.target.value as typeof values.lateCancellation)} className={selectClass}>
                <option value="inherit">Use business policy</option><option value="preserve">Preserve the session credits</option><option value="forfeit">Forfeit the session credits</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="expiration">Unused credits</Label>
              <select id="expiration" name="expiration" value={values.expiration} onChange={(e) => set('expiration', e.target.value as typeof values.expiration)} className={selectClass}>
                <option value="inherit">Use business policy</option><option value="end_of_term">Expire at the end of {monthly ? 'each month' : 'the bundle'}</option>
              </select>
            </div>
            <Field id="makeupExtensionDays" label="Extra days for eligible makeups" type="number" min={0} max={365} step={1} placeholder="Use business policy" hint={`Days after the ${monthly ? 'monthly period' : 'bundle'} ends. Enter 0 to keep makeups within the term.`} value={values.makeupExtensionDays} onChange={(e) => set('makeupExtensionDays', e.target.value)} error={errors.makeupExtensionDays} />
          </CardContent>
        </Card>
      </fieldset>
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      {Object.keys(errors).length > 0 && <p className="text-destructive text-sm" role="alert">Review the highlighted fields and try again.</p>}
      {!readOnly && <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? 'Saving…' : pkg ? 'Save changes' : 'Create package'}</Button>}
    </form>
  )
}

export function PackageArchiveForm({ action, archived }: { action: FormAction; archived: boolean }) {
  const [state, submit, pending] = useActionState(action, {})
  return (
    <form action={submit} className="grid gap-3">
      {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <Button type="submit" variant="outline" className="justify-self-start" disabled={pending}>
        {archived ? <RotateCcw /> : <Archive />}
        {pending ? 'Updating…' : archived ? 'Restore package' : 'Archive package'}
      </Button>
    </form>
  )
}
