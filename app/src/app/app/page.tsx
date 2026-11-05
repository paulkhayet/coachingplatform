import type { Metadata } from 'next'
import { CircleCheck, Circle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireWorkspace } from '@/lib/workspace'

export const metadata: Metadata = { title: 'Today' }

function greeting(tz: string) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date()))
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

export default async function TodayPage() {
  const { user, business } = await requireWorkspace()
  const steps = [
    { label: 'Create your business', done: true },
    { label: 'Connect Google Calendar', done: false, note: 'Coming in phase 2' },
    { label: 'Connect Stripe to take payments', done: false, note: 'Coming in phase 2' },
    { label: 'Publish your first booking page', done: false, note: 'Coming in phase 2' },
    { label: 'Invite your team', done: false, note: 'Coming soon' },
  ]
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting(business.timezone)}, {user.fullName.split(' ')[0]}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: business.timezone }).format(new Date())} · {business.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Get {business.name} ready</CardTitle>
          <CardDescription>Your workspace is live. The next features arrive phase by phase.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2.5">
          {steps.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 text-sm">
              {s.done ? <CircleCheck className="text-success size-4" /> : <Circle className="text-muted-foreground size-4" />}
              <span className={s.done ? 'text-muted-foreground line-through' : ''}>{s.label}</span>
              {s.note && <span className="text-muted-foreground ml-auto text-xs">{s.note}</span>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
