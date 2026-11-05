import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { Check, CircleCheck, FileSignature, Lock, CreditCard, TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Logo } from '@/components/brand'
import { useDB, useStore, actions } from '@/lib/store'
import { money, date } from '@/lib/format'
import { run } from '@/components/run'
import { cn } from '@/lib/utils'

export default function GuestOffer() {
  const { token } = useParams()
  const db = useDB()
  const nav = useNavigate()
  const setViewer = useStore((s) => s.setViewer)
  const offer = db.offers.find((o) => o.token === token)
  const [signer, setSigner] = React.useState('')
  const [agree, setAgree] = React.useState(false)
  const [payError, setPayError] = React.useState<string | null>(null)
  const [paying, setPaying] = React.useState(false)

  const shell = (children: React.ReactNode) => (
    <div className="bg-muted/30 min-h-svh">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg font-bold">W</div>
          <div>
            <div className="font-semibold">{db.business.name}</div>
            <div className="text-muted-foreground flex items-center gap-1 text-xs"><Lock className="size-3" /> Secure link for this family only</div>
          </div>
        </div>
        {children}
        <div className="text-muted-foreground mt-8 flex justify-center text-xs">Powered by&nbsp;<Logo className="text-xs [&_svg]:size-3.5" /></div>
      </div>
    </div>
  )

  if (!offer) return shell(<Alert variant="destructive"><TriangleAlert /><AlertTitle>This link isn’t valid</AlertTitle><AlertDescription>Ask your coaching business to send a new one.</AlertDescription></Alert>)
  if (offer.status === 'voided') return shell(<Alert variant="warning"><TriangleAlert /><AlertTitle>This offer was replaced</AlertTitle><AlertDescription>A newer version was sent to your email. Only the latest offer can be accepted.</AlertDescription></Alert>)
  if (new Date(offer.expiresAt) < new Date() && offer.status !== 'paid') return shell(<Alert variant="warning"><TriangleAlert /><AlertTitle>This offer expired on {date(offer.expiresAt)}</AlertTitle><AlertDescription>Contact {db.business.name} for an updated offer.</AlertDescription></Alert>)

  const inq = db.inquiries.find((i) => i.id === offer.inquiryId)!
  const coach = db.staff.find((s) => s.id === offer.coachId)!
  const sel = offer.selected !== undefined ? offer.options[offer.selected] : null
  const step = offer.status === 'paid' ? 4 : offer.status === 'signed' ? 3 : offer.status === 'accepted' ? 2 : 1
  const first = sel ? (sel.kind === 'monthly' ? sel.priceCents : Math.round(sel.priceCents / sel.installments)) : 0
  const steps = ['Choose', 'Sign', 'Pay', 'Done']

  return shell(
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Coaching for {inq.studentName.split(' ')[0]}</h1>
        <p className="text-muted-foreground mt-1">With {coach.name}, {coach.title.toLowerCase()}. Offer v{offer.version} · valid until {date(offer.expiresAt)}.</p>
      </div>
      <ol className="flex gap-2 text-xs">
        {steps.map((s, i) => (
          <li key={s} className={cn('flex flex-1 items-center gap-1.5 rounded-full border px-3 py-1', i + 1 < step && 'bg-muted text-muted-foreground', i + 1 === step && 'border-primary bg-accent text-accent-foreground font-medium', i + 1 > step && 'text-muted-foreground')}>
            {i + 1 < step ? <Check className="size-3" /> : <span>{i + 1}</span>} {s}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="grid gap-3">
          {offer.options.map((o, i) => (
            <button key={i} onClick={() => run(actions.guestSelect(offer.id, i))} className="bg-card hover:border-primary flex items-center gap-4 rounded-xl border p-5 text-left transition-colors">
              <div className="flex-1">
                <div className="font-semibold">{o.name}</div>
                <div className="text-muted-foreground text-sm">{o.credits} sessions{o.kind === 'monthly' ? ' each month, renewing monthly' : ` over ${o.termWeeks} weeks`}</div>
                <div className="text-muted-foreground mt-1 text-xs">{o.kind === 'monthly' ? 'Billed monthly · stop renewing any time' : o.installments === 1 ? 'Paid in full today' : `${o.installments} payments of ${money(Math.round(o.priceCents / o.installments))}, every 4 weeks`}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold">{money(o.priceCents)}</div>
                <div className="text-muted-foreground text-xs">{o.kind === 'monthly' ? 'per month' : 'total'}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && sel && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSignature className="size-4" /> Coaching agreement</CardTitle>
            <CardDescription>{sel.name} · {money(sel.priceCents)}{sel.kind === 'monthly' ? '/month' : ''}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="bg-muted/40 max-h-64 overflow-y-auto rounded-md border p-4 text-sm leading-relaxed">
              <p className="font-medium">Agreement between {db.business.name} and {inq.independent ? inq.studentName : inq.guardianName}</p>
              <p className="mt-2">Coaching for {inq.studentName} with {coach.name}: {sel.credits} session credits{sel.kind === 'monthly' ? ' per monthly cycle' : ` over ${sel.termWeeks} weeks`}. A 60-minute session uses one credit; a 30-minute check-in uses half a credit.</p>
              <p className="mt-2">Payment: {sel.kind === 'monthly' ? `${money(sel.priceCents)} each month.` : sel.installments === 1 ? `${money(sel.priceCents)} today.` : `${sel.installments} payments of ${money(first)}. Each payment makes its share of sessions available.`} Sessions must be paid for before they take place.</p>
              <p className="mt-2">Cancellations: cancel at least {offer.policy.cancelNoticeHours} hours ahead to keep the session credit; it can be made up within {offer.policy.makeupWindowDays} days after the program ends. Later cancellations and no-shows {offer.policy.lateCancelOutcome === 'forfeit' ? 'use the credit' : 'keep the credit'}.</p>
              <p className="text-muted-foreground mt-2 text-xs">Sample terms for this prototype. Legal sufficiency and signing requirements are still under review.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="grid gap-1.5"><Label htmlFor="signer">Type your full name to sign</Label><Input id="signer" value={signer} onChange={(e) => setSigner(e.target.value)} placeholder={inq.guardianName} /></div>
            </div>
            <Label className="font-normal"><Checkbox checked={agree} onCheckedChange={(v) => setAgree(!!v)} /> I’m authorized to sign for this family and agree to these terms.</Label>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => run(actions.guestSelect(offer.id, -1))}>Choose a different option</Button>
            <Button disabled={signer.trim().length < 3 || !agree} onClick={() => run(actions.guestSign(offer.id, signer.trim()), 'Signed. A copy is on its way to your email.')}>Sign agreement</Button>
          </CardFooter>
        </Card>
      )}

      {step === 3 && sel && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="size-4" /> Payment</CardTitle>
            <CardDescription>Signed by {offer.signerName}. Pay securely with Stripe.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between"><span>{sel.name}{sel.kind === 'fixed' && sel.installments > 1 ? ` · payment 1 of ${sel.installments}` : ''}</span><span className="tabular-nums">{money(first)}</span></div>
              <Separator />
              <div className="flex justify-between font-semibold"><span>Due today</span><span className="tabular-nums">{money(first)}</span></div>
              {sel.kind === 'fixed' && sel.installments > 1 && <div className="text-muted-foreground text-xs">Then {sel.installments - 1} more payment{sel.installments > 2 ? 's' : ''} of {money(sel.priceCents - first)} total, every 4 weeks. Today’s payment makes {Math.floor((sel.credits / sel.installments) * 100) / 100} sessions available.</div>}
            </div>
            <div className="bg-muted/40 flex items-center gap-3 rounded-md border p-3 text-sm">
              <CreditCard className="text-muted-foreground size-4" /> Stripe test card •••• 4242 <span className="text-muted-foreground ml-auto text-xs">Test mode</span>
            </div>
            {payError && <Alert variant="destructive"><TriangleAlert /><AlertTitle>Payment didn’t go through</AlertTitle><AlertDescription>{payError}</AlertDescription></Alert>}
          </CardContent>
          <CardFooter className="flex-wrap justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => { const r = actions.guestPay(offer.id, 'decline'); if (!r.ok) setPayError(r.error) }}>Simulate a declined card</Button>
            <Button
              disabled={paying}
              onClick={() => {
                setPaying(true)
                setPayError(null)
                setTimeout(() => {
                  const r = actions.guestPay(offer.id, 'success')
                  setPaying(false)
                  if (!r.ok) setPayError(r.error)
                }, 700)
              }}
            >
              {paying ? 'Confirming with Stripe…' : `Pay ${money(first)}`}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardContent className="grid justify-items-center gap-3 py-8 text-center">
            <CircleCheck className="text-success size-12" />
            <h2 className="text-2xl font-semibold">You’re enrolled.</h2>
            <p className="text-muted-foreground max-w-md">Payment confirmed by Stripe. We’ve emailed {inq.independent ? 'you' : inq.guardianName.split(' ')[0]} an invitation to set up the family portal, where you can book sessions and see updates. {coach.name.split(' ')[0]} will reach out about a first session.</p>
            {inq.studentId && (
              <Button
                onClick={() => {
                  const s = db.students.find((x) => x.id === inq.studentId)!
                  const g = s.guardians[0]
                  setViewer(g ? { kind: 'guardian', id: g.guardianId, studentId: s.id } : { kind: 'student', id: s.id })
                  nav('/portal')
                }}
              >
                Open the portal
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>,
  )
}
