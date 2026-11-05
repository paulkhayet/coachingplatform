import * as React from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader, Field, KV } from '@/components/page'
import { useDB, useStaffViewer, actions } from '@/lib/store'
import { money, num } from '@/lib/format'
import { uid } from '@/lib/format'
import { run } from '@/components/run'
import type { Offering } from '@/lib/types'

export default function Offerings() {
  const db = useDB()
  const me = useStaffViewer()!
  const [edit, setEdit] = React.useState<Offering | null>(null)
  const blank: Offering = { id: uid('off'), name: '', kind: 'fixed', description: '', credits: 8, priceCents: 80000, installmentOptions: [1], termWeeks: 8, sessionTypeIds: ['stype_60'], cancelNoticeHours: db.business.policies.cancelNoticeHours, active: true, poolId: null }
  return (
    <>
      <PageHeader
        title="Offerings"
        description="Reusable services. Accepted agreements keep a versioned snapshot — changes here apply to new offers only."
        actions={<Button size="sm" onClick={() => setEdit(blank)}><Plus /> New offering</Button>}
      />
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {db.offerings.map((o) => (
          <Card key={o.id}>
            <CardHeader>
              <CardTitle>{o.name}</CardTitle>
              <CardDescription>{o.description}</CardDescription>
              <CardAction><Button variant="ghost" size="icon-sm" onClick={() => setEdit(o)} aria-label={`Edit ${o.name}`}><Pencil /></Button></CardAction>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="text-3xl font-semibold tracking-tight">{money(o.priceCents)}<span className="text-muted-foreground text-sm font-normal">{o.kind === 'monthly' ? ' / month' : ' total'}</span></div>
              <KV
                items={[
                  ['Credits', `${o.credits}${o.kind === 'monthly' ? ' per month' : ''}`],
                  ['Term', o.kind === 'monthly' ? 'Renews monthly' : `${o.termWeeks} weeks`],
                  ['Payment', o.kind === 'monthly' ? 'Monthly' : o.installmentOptions.map((n) => (n === 1 ? 'In full' : `${n} installments`)).join(' or ')],
                  ['Cancellation', `${o.cancelNoticeHours}h notice`],
                  ['Coaches', o.poolId ? db.pools.find((p) => p.id === o.poolId)?.name : 'Assigned coach'],
                ]}
              />
              <div className="flex flex-wrap gap-1">
                {o.sessionTypeIds.map((id) => <Badge key={id} variant="secondary">{db.sessionTypes.find((s) => s.id === id)?.name}</Badge>)}
                {!o.active && <Badge variant="outline">Inactive</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Session types</CardTitle>
          <CardDescription>Credit cost is set per type — duration alone doesn’t decide it.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader><TableRow><TableHead className="pl-5">Name</TableHead><TableHead>Length</TableHead><TableHead>Credit cost</TableHead><TableHead className="pr-5">Meeting</TableHead></TableRow></TableHeader>
            <TableBody>
              {db.sessionTypes.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="pl-5 font-medium">{s.name}</TableCell>
                  <TableCell>{s.minutes} min</TableCell>
                  <TableCell>{s.consultation ? 'Free (fit call)' : num(s.credits)}</TableCell>
                  <TableCell className="pr-5">{s.meeting === 'zoom' ? 'Automatic Zoom link' : s.meeting === 'in_person' ? 'In person' : 'Manual link'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {edit && <OfferingDialog o={edit} onClose={() => setEdit(null)} actorId={me.id} />}
    </>
  )
}

function OfferingDialog({ o, onClose, actorId }: { o: Offering; onClose: () => void; actorId: string }) {
  const db = useDB()
  const [f, setF] = React.useState({ ...o, price: String(o.priceCents / 100) })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{o.name ? `Edit ${o.name}` : 'New offering'}</DialogTitle>
          <DialogDescription>Cancellation and expiry terms must be chosen before families can accept this offering.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2"><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Type">
            <Select value={f.kind} onValueChange={(v) => set('kind', v as Offering['kind'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="fixed">Fixed-term bundle</SelectItem><SelectItem value="monthly">Ongoing monthly</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label={f.kind === 'monthly' ? 'Price per month (USD)' : 'Total price (USD)'}><Input type="number" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
          <Field label={f.kind === 'monthly' ? 'Credits per month' : 'Credits'}><Input type="number" step="0.5" value={f.credits} onChange={(e) => set('credits', Number(e.target.value))} /></Field>
          {f.kind === 'fixed' && <Field label="Term (weeks)"><Input type="number" value={f.termWeeks} onChange={(e) => set('termWeeks', Number(e.target.value))} /></Field>}
          {f.kind === 'fixed' && (
            <Field label="Payment options" className="sm:col-span-2">
              <div className="flex gap-3">
                {[1, 2, 3, 4].map((n) => (
                  <Label key={n} className="font-normal"><Checkbox checked={f.installmentOptions.includes(n)} onCheckedChange={(v) => set('installmentOptions', v ? [...f.installmentOptions, n].sort() : f.installmentOptions.filter((x) => x !== n))} /> {n === 1 ? 'In full' : `${n} installments`}</Label>
                ))}
              </div>
            </Field>
          )}
          <Field label="Session types" className="sm:col-span-2">
            <div className="flex flex-wrap gap-3">
              {db.sessionTypes.filter((s) => !s.consultation).map((s) => (
                <Label key={s.id} className="font-normal"><Checkbox checked={f.sessionTypeIds.includes(s.id)} onCheckedChange={(v) => set('sessionTypeIds', v ? [...f.sessionTypeIds, s.id] : f.sessionTypeIds.filter((x) => x !== s.id))} /> {s.name}</Label>
              ))}
            </div>
          </Field>
          <Field label="Cancellation notice (hours)"><Input type="number" value={f.cancelNoticeHours} onChange={(e) => set('cancelNoticeHours', Number(e.target.value))} /></Field>
          <Field label="Coach pool">
            <Select value={f.poolId ?? 'none'} onValueChange={(v) => set('poolId', v === 'none' ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Assigned coach only</SelectItem>{db.pools.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Label className="font-normal"><Switch checked={f.active} onCheckedChange={(v) => set('active', v)} /> Available for new offers</Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { const { price, ...rest } = f; if (run(actions.saveOffering({ ...rest, priceCents: Math.round(Number(price) * 100), installmentOptions: rest.kind === 'monthly' ? [1] : rest.installmentOptions.length ? rest.installmentOptions : [1] }, actorId), 'Offering saved')) onClose() }}>Save offering</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
