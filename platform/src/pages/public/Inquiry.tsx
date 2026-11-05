import * as React from 'react'
import { format } from 'date-fns'
import { CircleCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from '@/components/page'
import { Logo } from '@/components/brand'
import { useDB, actions } from '@/lib/store'
import { nextDays, slotsForDay } from '@/lib/booking'
import { run } from '@/components/run'

export default function PublicInquiry() {
  const db = useDB()
  const [who, setWho] = React.useState<'parent' | 'student'>('parent')
  const [f, setF] = React.useState({ studentName: '', grade: '', school: '', guardianName: '', guardianEmail: '', studentEmail: '', goals: '', availability: '', source: 'Google search' })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [done, setDone] = React.useState<string | null>(null)
  const [booked, setBooked] = React.useState<Date | null>(null)
  const set = (k: keyof typeof f, v: string) => {
    setF((p) => ({ ...p, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!f.studentName.trim()) errs.studentName = 'Enter the student’s name'
    if (!f.grade.trim()) errs.grade = 'Enter a grade or stage'
    if (who === 'parent' && !f.guardianName.trim()) errs.guardianName = 'Enter your name'
    const email = who === 'parent' ? f.guardianEmail : f.studentEmail
    if (!/^\S+@\S+\.\S+$/.test(email)) errs[who === 'parent' ? 'guardianEmail' : 'studentEmail'] = 'Enter a valid email'
    if (f.goals.trim().length < 10) errs.goals = 'Tell us a little more'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const r = actions.submitInquiry({ ...f, independent: who === 'student', guardianName: who === 'parent' ? f.guardianName : f.studentName, guardianEmail: who === 'parent' ? f.guardianEmail : f.studentEmail, studentEmail: f.studentEmail || undefined })
    if (r.ok) setDone(r.value!)
  }
  const owner = db.staff.find((s) => s.role === 'owner')!
  const direct = db.business.policies.workflow === 'direct'
  const days = nextDays(8).slice(1)
  const [day, setDay] = React.useState(days[0])

  return (
    <div className="bg-muted/30 min-h-svh">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8 text-center">
          <div className="bg-primary text-primary-foreground mx-auto mb-3 flex size-12 items-center justify-center rounded-xl text-lg font-bold">W</div>
          <h1 className="font-serif text-4xl tracking-tight">{db.business.name}</h1>
          <p className="text-muted-foreground mt-1">Coaching for middle school, high school and college students.</p>
        </div>
        {done ? (
          <Card>
            <CardContent className="grid justify-items-center gap-3 py-6 text-center">
              <CircleCheck className="text-success size-10" />
              <h2 className="text-xl font-semibold">Thanks — we’ve got it.</h2>
              {direct ? (
                booked ? (
                  <p className="text-muted-foreground max-w-md">Your free fit call is booked for {format(booked, "EEEE, MMMM d 'at' h:mm a")}. A confirmation with the Zoom link is on its way.</p>
                ) : (
                  <div className="grid w-full gap-3">
                    <p className="text-muted-foreground">Book a free 20-minute fit call with {owner.name}:</p>
                    <div className="flex justify-center gap-1.5 overflow-x-auto">{days.map((d) => <Button key={d.toISOString()} size="sm" variant={d === day ? 'default' : 'outline'} onClick={() => setDay(d)}>{format(d, 'EEE d')}</Button>)}</div>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                      {slotsForDay(db, owner.id, day, 20).slice(0, 12).map((s) => (
                        <Button key={s.toISOString()} variant="outline" size="sm" onClick={() => run(actions.bookConsult(done, owner.id, s, f.guardianName || f.studentName)) && setBooked(s)}>{format(s, 'h:mm a')}</Button>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <p className="text-muted-foreground max-w-md">Our team will review your note, match {f.studentName.split(' ')[0] || 'your student'} with a coach, and email you to set up a free fit call. You don’t need an account.</p>
              )}
              <Button variant="ghost" size="sm" onClick={() => { setDone(null); setBooked(null); setF({ studentName: '', grade: '', school: '', guardianName: '', guardianEmail: '', studentEmail: '', goals: '', availability: '', source: 'Google search' }) }}>Submit another</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Tell us about your student</CardTitle>
              <CardDescription>Takes about two minutes. We only ask for what we need to find the right coach.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="grid gap-5" noValidate>
                <RadioGroup value={who} onValueChange={(v) => setWho(v as typeof who)} className="grid-cols-2">
                  <Label className="has-[[data-state=checked]]:border-primary rounded-md border p-3 font-normal"><RadioGroupItem value="parent" /> I’m a parent or guardian</Label>
                  <Label className="has-[[data-state=checked]]:border-primary rounded-md border p-3 font-normal"><RadioGroupItem value="student" /> I’m the student</Label>
                </RadioGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Student name" hint={errors.studentName && <span className="text-destructive">{errors.studentName}</span>}><Input value={f.studentName} onChange={(e) => set('studentName', e.target.value)} aria-invalid={!!errors.studentName} /></Field>
                  <Field label="Grade or stage" hint={errors.grade && <span className="text-destructive">{errors.grade}</span>}><Input value={f.grade} onChange={(e) => set('grade', e.target.value)} placeholder="10th grade" aria-invalid={!!errors.grade} /></Field>
                  <Field label="School (optional)" className="sm:col-span-2"><Input value={f.school} onChange={(e) => set('school', e.target.value)} /></Field>
                  {who === 'parent' && (
                    <>
                      <Field label="Your name" hint={errors.guardianName && <span className="text-destructive">{errors.guardianName}</span>}><Input value={f.guardianName} onChange={(e) => set('guardianName', e.target.value)} aria-invalid={!!errors.guardianName} /></Field>
                      <Field label="Your email" hint={errors.guardianEmail && <span className="text-destructive">{errors.guardianEmail}</span>}><Input type="email" value={f.guardianEmail} onChange={(e) => set('guardianEmail', e.target.value)} aria-invalid={!!errors.guardianEmail} /></Field>
                    </>
                  )}
                  <Field label={who === 'parent' ? 'Student email (optional)' : 'Your email'} className="sm:col-span-2" hint={errors.studentEmail && <span className="text-destructive">{errors.studentEmail}</span>}><Input type="email" value={f.studentEmail} onChange={(e) => set('studentEmail', e.target.value)} aria-invalid={!!errors.studentEmail} /></Field>
                </div>
                <Field label="What would you like help with?" hint={errors.goals && <span className="text-destructive">{errors.goals}</span>}><Textarea rows={4} value={f.goals} onChange={(e) => set('goals', e.target.value)} placeholder="Staying organized with a heavier course load…" aria-invalid={!!errors.goals} /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="When are you usually available?"><Input value={f.availability} onChange={(e) => set('availability', e.target.value)} placeholder="Weekdays after 4 p.m." /></Field>
                  <Field label="How did you hear about us?">
                    <Select value={f.source} onValueChange={(v) => set('source', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{['Google search', 'Referral', 'School counselor', 'Instagram', 'Other'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <Button type="submit" size="lg">Send inquiry</Button>
                <p className="text-muted-foreground text-center text-xs">No account needed. We’ll only use your details to respond to this inquiry.</p>
              </form>
            </CardContent>
          </Card>
        )}
        <div className="text-muted-foreground mt-8 flex justify-center text-xs">Powered by&nbsp;<Logo className="text-xs [&_svg]:size-3.5" /></div>
      </div>
    </div>
  )
}
