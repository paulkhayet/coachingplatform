import * as React from 'react'
import { Link } from 'react-router'
import { Plus, Pencil, Copy, ExternalLink, Trash2, ArrowUp, ArrowDown, Video, MapPin, Phone, Clock, Users, ListChecks, Lock } from 'lucide-react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar } from '@/components/ui/avatar'
import { PageHeader, Field, Empty } from '@/components/page'
import { useDB, useStaffViewer, actions } from '@/lib/store'
import { canSeePricing } from '@/lib/permissions'
import { money, uid } from '@/lib/format'
import { run } from '@/components/run'
import { toast } from 'sonner'
import type { EventType, Question } from '@/lib/types'
import { cn } from '@/lib/utils'

export const etColor: Record<EventType['color'], string> = {
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
}
export const LocationIcon = ({ l, className }: { l: EventType['location']; className?: string }) =>
  l === 'zoom' ? <Video className={className} /> : l === 'phone' ? <Phone className={className} /> : <MapPin className={className} />
export const locationLabel = { zoom: 'Zoom (link created automatically)', in_person: 'In person', phone: 'Phone call' }

const QTYPES: { v: Question['type']; l: string }[] = [
  { v: 'text', l: 'Short answer' },
  { v: 'textarea', l: 'Paragraph' },
  { v: 'single', l: 'One choice' },
  { v: 'multi', l: 'Multiple choice' },
  { v: 'phone', l: 'Phone number' },
]

export default function BookingPages() {
  const db = useDB()
  const me = useStaffViewer()!
  const manage = canSeePricing(me)
  const [edit, setEdit] = React.useState<EventType | null>(null)
  const list = db.eventTypes.filter((e) => manage || e.hostIds.includes(me.id))
  const url = (et: EventType) => `${location.origin}/b/${db.business.slug}/${et.slug}`
  const copy = (et: EventType) => {
    navigator.clipboard?.writeText(url(et)).catch(() => {})
    toast.success('Link copied')
  }
  const blank = (): EventType => ({
    id: uid('et'), slug: '', name: '', description: '', minutes: 30, location: 'zoom', hostIds: [me.id], hostMode: 'choose', priceCents: 0, refundCutoffHours: 24,
    minNoticeHours: db.business.policies.minNoticeHours, bookingWindowDays: 30, bufferMinutes: 10, askStudent: true, active: true, color: 'blue',
    questions: [{ id: uid('q'), label: 'What would you like to cover?', type: 'textarea', required: true, options: [] }],
  })
  const upcoming = (id: string) => db.appointments.filter((a) => a.eventTypeId === id && a.status === 'scheduled' && new Date(a.start) > new Date()).length

  return (
    <>
      <PageHeader
        title="Booking pages"
        description="Calls anyone can book from a link, like Calendly. Free or paid, with your own questions. Bookings become inquiries automatically."
        actions={
          <>
            <Button variant="outline" size="sm" asChild><Link to={`/b/${db.business.slug}`}><ExternalLink /> Your public page</Link></Button>
            {manage && <Button size="sm" onClick={() => setEdit(blank())}><Plus /> New booking page</Button>}
          </>
        }
      />
      {list.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((et) => (
            <Card key={et.id} className={cn('overflow-hidden pt-0', !et.active && 'opacity-60')}>
              <div className={cn('h-1.5', etColor[et.color])} />
              <CardContent className="grid gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{et.name}</div>
                    <div className="text-muted-foreground text-xs">/{db.business.slug}/{et.slug}</div>
                  </div>
                  {manage ? <Switch checked={et.active} onCheckedChange={(v) => run(actions.saveEventType({ ...et, active: v }, me.id), v ? 'Booking page on' : 'Booking page off — the link stops taking bookings')} aria-label="Accept bookings" /> : !et.active && <Badge variant="outline">Off</Badge>}
                </div>
                <div className="text-muted-foreground grid gap-1.5 text-sm">
                  <span className="flex items-center gap-2"><Clock className="size-3.5" /> {et.minutes} min</span>
                  <span className="flex items-center gap-2"><LocationIcon l={et.location} className="size-3.5" /> {locationLabel[et.location].split(' (')[0]}</span>
                  <span className="flex items-center gap-2"><Users className="size-3.5" /> {et.hostIds.length === 1 ? db.staff.find((s) => s.id === et.hostIds[0])?.name : `${et.hostIds.length} hosts · ${et.hostMode === 'any' ? 'any available' : 'guest chooses'}`}</span>
                  <span className="flex items-center gap-2"><ListChecks className="size-3.5" /> {et.questions.length} question{et.questions.length === 1 ? '' : 's'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={et.priceCents ? 'accent' : 'secondary'}>{et.priceCents ? money(et.priceCents) : 'Free'}</Badge>
                  {upcoming(et.id) > 0 && <span className="text-muted-foreground text-xs">{upcoming(et.id)} upcoming</span>}
                </div>
              </CardContent>
              <CardFooter className="gap-2 border-t pt-4">
                <Button variant="outline" size="sm" onClick={() => copy(et)}><Copy /> Copy link</Button>
                <Button variant="ghost" size="sm" asChild><Link to={`/b/${db.business.slug}/${et.slug}`}><ExternalLink /> View</Link></Button>
                {manage && <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setEdit(et)} aria-label={`Edit ${et.name}`}><Pencil /></Button>}
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Empty title="No booking pages yet">An owner or administrator can create one.</Empty>
      )}
      <Sheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <SheetContent className="sm:max-w-2xl">{edit && <Editor key={edit.id} initial={edit} onDone={() => setEdit(null)} />}</SheetContent>
      </Sheet>
    </>
  )
}

function Editor({ initial, onDone }: { initial: EventType; onDone: () => void }) {
  const db = useDB()
  const me = useStaffViewer()!
  const isNew = !db.eventTypes.some((e) => e.id === initial.id)
  const [f, setF] = React.useState<EventType>(initial)
  const [price, setPrice] = React.useState(initial.priceCents ? String(initial.priceCents / 100) : '')
  const set = <K extends keyof EventType>(k: K, v: EventType[K]) => setF((p) => ({ ...p, [k]: v }))
  const setQ = (i: number, patch: Partial<Question>) => set('questions', f.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  const move = (i: number, d: -1 | 1) => {
    const qs = [...f.questions]
    ;[qs[i], qs[i + d]] = [qs[i + d], qs[i]]
    set('questions', qs)
  }
  const hosts = db.staff.filter((s) => s.coaches && s.status === 'active')
  const paid = f.priceCents > 0 || price !== ''
  const save = () => {
    const cents = Math.round(Number(price || 0) * 100)
    if (price !== '' && (!Number.isFinite(cents) || cents < 100)) return run({ ok: false, error: 'Enter a price of at least $1, or switch the call to free.' })
    if (run(actions.saveEventType({ ...f, slug: f.slug || f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), priceCents: price === '' ? 0 : cents }, me.id), isNew ? 'Booking page created' : 'Booking page saved')) onDone()
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{isNew ? 'New booking page' : `Edit ${initial.name}`}</SheetTitle>
        <SheetDescription>Changes apply to new bookings. Existing bookings keep their time, price and answers.</SheetDescription>
      </SheetHeader>
      <div className="grid gap-6 p-5">
        <section className="grid gap-4">
          <div className="text-sm font-semibold">Details</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2"><Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Free consultation" /></Field>
            <Field label="Link" className="sm:col-span-2" hint="Lowercase letters, numbers and dashes.">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground shrink-0 text-sm">/b/{db.business.slug}/</span>
                <Input value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder={f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'consultation'} />
              </div>
            </Field>
            <Field label="Description" className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="What the call covers and who it's for." /></Field>
            <Field label="Duration">
              <Select value={String(f.minutes)} onValueChange={(v) => set('minutes', Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[15, 20, 30, 45, 60, 90].map((m) => <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Location">
              <Select value={f.location} onValueChange={(v) => set('location', v as EventType['location'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(locationLabel) as EventType['location'][]).map((l) => <SelectItem key={l} value={l}>{locationLabel[l]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Color">
              <div className="flex gap-2">
                {(Object.keys(etColor) as EventType['color'][]).map((c) => (
                  <button key={c} onClick={() => set('color', c)} className={cn('size-7 rounded-full ring-offset-2 ring-offset-background', etColor[c], f.color === c && 'ring-ring ring-2')} aria-label={c} />
                ))}
              </div>
            </Field>
          </div>
        </section>
        <Separator />

        <section className="grid gap-3">
          <div className="text-sm font-semibold">Hosts</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {hosts.map((h) => (
              <Label key={h.id} className="has-[[data-state=checked]]:border-primary flex items-center gap-2.5 rounded-md border p-2.5 font-normal">
                <Checkbox checked={f.hostIds.includes(h.id)} onCheckedChange={(v) => set('hostIds', v ? [...f.hostIds, h.id] : f.hostIds.filter((x) => x !== h.id))} />
                <Avatar name={h.name} className="size-6 text-[10px]" /> {h.name}
                {!h.calendarHealthy && <span className="text-warning ml-auto text-xs">Sync stale</span>}
              </Label>
            ))}
          </div>
          {f.hostIds.length > 1 && (
            <RadioGroup value={f.hostMode} onValueChange={(v) => set('hostMode', v as EventType['hostMode'])} className="sm:grid-cols-2">
              <Label className="font-normal"><RadioGroupItem value="any" /> Any available host (balances bookings)</Label>
              <Label className="font-normal"><RadioGroupItem value="choose" /> Guest chooses a host</Label>
            </RadioGroup>
          )}
          <p className="text-muted-foreground text-xs">Times come from each host’s availability, minus Google Calendar busy time and existing sessions.</p>
        </section>
        <Separator />

        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Payment</div>
            <Label className="font-normal">Charge for this call <Switch checked={paid} onCheckedChange={(v) => { setPrice(v ? '50' : ''); set('priceCents', v ? 5000 : 0) }} /></Label>
          </div>
          {paid ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price (USD)"><Input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
              <Field label="Full refund if cancelled at least">
                <Select value={String(f.refundCutoffHours)} onValueChange={(v) => set('refundCutoffHours', Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 12, 24, 48, 72].map((h) => <SelectItem key={h} value={String(h)}>{h === 0 ? 'Any time before the call' : `${h} hours before`}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <p className="text-muted-foreground text-xs sm:col-span-2">Guests pay with Stripe when they book. The money goes to your Stripe account and schedulefa.st takes no fee. A paid call doesn’t enroll anyone or create session credits. If you cancel, the guest is refunded automatically.</p>
            </div>
          ) : <p className="text-muted-foreground text-sm">Free to book.</p>}
        </section>
        <Separator />

        <section className="grid gap-3">
          <div className="text-sm font-semibold">Limits</div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Minimum notice">
              <Select value={String(f.minNoticeHours)} onValueChange={(v) => set('minNoticeHours', Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 4, 12, 24, 48].map((h) => <SelectItem key={h} value={String(h)}>{h} hour{h === 1 ? '' : 's'}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Bookable up to">
              <Select value={String(f.bookingWindowDays)} onValueChange={(v) => set('bookingWindowDays', Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[7, 14, 21, 30, 45, 60].map((d) => <SelectItem key={d} value={String(d)}>{d} days ahead</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Buffer after">
              <Select value={String(f.bufferMinutes)} onValueChange={(v) => set('bufferMinutes', Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[0, 5, 10, 15, 30].map((m) => <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
        </section>
        <Separator />

        <section className="grid gap-3">
          <div className="text-sm font-semibold">Questionnaire</div>
          <div className="bg-muted/50 grid gap-1 rounded-md p-3 text-sm">
            <div className="flex items-center gap-2"><Lock className="text-muted-foreground size-3.5" /> Name <span className="text-muted-foreground text-xs">· always asked</span></div>
            <div className="flex items-center gap-2"><Lock className="text-muted-foreground size-3.5" /> Email <span className="text-muted-foreground text-xs">· always asked</span></div>
            <Label className="mt-1 font-normal"><Switch checked={f.askStudent} onCheckedChange={(v) => set('askStudent', v)} /> Ask for the student’s name and grade</Label>
          </div>
          {f.questions.map((q, i) => (
            <div key={q.id} className="grid gap-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground w-5 text-xs">{i + 1}.</span>
                <Input className="min-w-48 flex-1" value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} placeholder="Question" />
                <Select value={q.type} onValueChange={(v) => setQ(i, { type: v as Question['type'], options: (v === 'single' || v === 'multi') && q.options.length < 2 ? ['', ''] : q.options })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{QTYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {(q.type === 'single' || q.type === 'multi') && (
                <div className="grid gap-1.5 pl-7">
                  {q.options.map((o, k) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className={cn('border-muted-foreground/50 size-3.5 shrink-0 border', q.type === 'single' ? 'rounded-full' : 'rounded-[3px]')} />
                      <Input className="h-8" value={o} onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} placeholder={`Option ${k + 1}`} />
                      <Button variant="ghost" size="icon-sm" onClick={() => setQ(i, { options: q.options.filter((_, j) => j !== k) })} aria-label="Remove option"><Trash2 /></Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setQ(i, { options: [...q.options, ''] })}><Plus /> Add option</Button>
                </div>
              )}
              <div className="flex items-center gap-1 pl-7">
                <Label className="text-xs font-normal"><Switch checked={q.required} onCheckedChange={(v) => setQ(i, { required: v })} /> Required</Label>
                <div className="ml-auto flex">
                  <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp /></Button>
                  <Button variant="ghost" size="icon-sm" disabled={i === f.questions.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => set('questions', f.questions.filter((_, j) => j !== i))} aria-label="Delete question"><Trash2 /></Button>
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="justify-self-start" onClick={() => set('questions', [...f.questions, { id: uid('q'), label: '', type: 'text', required: false, options: [] }])}><Plus /> Add question</Button>
          <p className="text-muted-foreground text-xs">Answers go to the host and to the inquiry record. Only ask for what you need.</p>
        </section>

        <div className="flex items-center gap-2 border-t pt-4">
          {!isNew && <Button variant="ghost" className="text-destructive" onClick={() => run(actions.deleteEventType(f.id, me.id), 'Booking page deleted') && onDone()}><Trash2 /> Delete</Button>}
          <Button variant="outline" className="ml-auto" onClick={onDone}>Cancel</Button>
          <Button onClick={save}>{isNew ? 'Create booking page' : 'Save changes'}</Button>
        </div>
      </div>
    </>
  )
}
