import * as React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Info, TriangleAlert } from 'lucide-react'
import { actions } from '@/lib/store'
import { cancelPreview } from '@/lib/booking'
import { dateTime } from '@/lib/format'
import { run } from '@/components/run'
import type { Appointment, Staff } from '@/lib/types'

export function CancelDialog({ appt, open, onOpenChange, staff, actorLabel }: { appt: Appointment | null; open: boolean; onOpenChange: (o: boolean) => void; staff?: Staff | null; actorLabel: string }) {
  const [by, setBy] = React.useState<'family' | 'business'>(staff ? 'business' : 'family')
  const [reason, setReason] = React.useState('')
  const [exception, setException] = React.useState(false)
  const [exReason, setExReason] = React.useState('')
  React.useEffect(() => {
    if (open) {
      setBy(staff ? 'business' : 'family')
      setReason('')
      setException(false)
      setExReason('')
    }
  }, [open, staff])
  if (!appt) return null
  const pv = cancelPreview(appt, by)
  const canException = staff && staff.role !== 'coach' && !pv.timely
  const submit = () => {
    if (staff && !reason.trim()) {
      run({ ok: false, error: 'Record the actual reason for the cancellation.' })
      return
    }
    if (exception && !exReason.trim()) {
      run({ ok: false, error: 'Explain the exception.' })
      return
    }
    const ok = run(actions.cancel(appt.id, by, actorLabel, reason || 'Family cancelled', exception && staff ? { by: staff.id, reason: exReason } : undefined))
    if (ok) onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel session</DialogTitle>
          <DialogDescription>{dateTime(appt.start)}</DialogDescription>
        </DialogHeader>
        {staff && appt.kind === 'coaching' && (
          <div className="grid gap-2">
            <div className="text-sm font-medium">Who is cancelling?</div>
            <RadioGroup value={by} onValueChange={(v) => setBy(v as 'family' | 'business')} className="grid-cols-2">
              <Label className="has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-md border p-3 font-normal">
                <RadioGroupItem value="business" /> Coach or business
              </Label>
              <Label className="has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-md border p-3 font-normal">
                <RadioGroupItem value="family" /> Family request
              </Label>
            </RadioGroup>
            <p className="text-muted-foreground text-xs">Staff cancelling for a family must record the real reason; acting as staff doesn’t change the policy outcome.</p>
          </div>
        )}
        <Alert variant={pv.timely || exception ? 'info' : 'warning'}>
          {pv.timely ? <Info /> : <TriangleAlert />}
          <AlertTitle>{pv.outcome}</AlertTitle>
          <AlertDescription>{exception ? 'Exception: credit preserved and recorded with your reason.' : pv.creditEffect}</AlertDescription>
        </Alert>
        <div className="grid gap-1.5">
          <Label htmlFor="reason">Reason{staff ? '' : ' (optional)'}</Label>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={staff ? 'Coach illness' : 'Doctor’s appointment'} />
        </div>
        {canException && (
          <div className="grid gap-2 rounded-md border p-3">
            <Label className="font-normal">
              <Checkbox checked={exception} onCheckedChange={(v) => setException(!!v)} /> Apply an authorized exception
            </Label>
            {exception && <Textarea value={exReason} onChange={(e) => setExReason(e.target.value)} placeholder="Family emergency — documented by phone" />}
            <p className="text-muted-foreground text-xs">Exceptions are recorded with your name. They don’t change the business policy.</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep session</Button>
          <Button variant="destructive" onClick={submit}>Cancel session</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
