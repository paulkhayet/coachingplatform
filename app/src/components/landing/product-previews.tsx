import { CalendarCheck, CalendarClock, ChevronsUpDown, CircleCheck, Clock, CreditCard, Home, Link2, LogOut, Sun, UsersRound, Video } from 'lucide-react'
import { Logo } from '@/components/brand'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { ScaledPreview } from './scaled-preview'

// Real schedulefa.st screens for the landing page, built from the app's own components and layout classes
// with sample people (example.com addresses). Keep them in step when the screens they copy change:
// app/layout.tsx + nav.tsx + business-switcher.tsx, app/bookings, b/[business]/[page] (+ picker, time grid),
// b/[business]/[page]/booked, app/team, and the booking page form's price section.

/** A Button's look without a <button> element (the landing page styles real buttons its own way). */
function UiButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button asChild {...props}>
      <span>{children}</span>
    </Button>
  )
}

const BUSINESS = 'Willow Coaching'
const SLUG = 'willow-coaching'

// ── App shell ────────────────────────────────────────────────────────────────────────────────────────

const navItems = [
  { label: 'Today', icon: Home },
  { label: 'Bookings', icon: CalendarCheck },
  { label: 'Booking pages', icon: Link2 },
  { label: 'Availability', icon: CalendarClock },
  { label: 'Team', icon: UsersRound },
  { label: 'Business hours', icon: Clock },
  { label: 'Payments', icon: CreditCard },
]

function AppShell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground flex h-[700px] overflow-hidden text-left">
      <aside className="bg-sidebar border-sidebar-border flex h-full w-60 shrink-0 flex-col border-r p-3">
        <div className="mb-4 px-1 pt-1"><Logo /></div>
        <div className="flex w-full items-center gap-2.5 rounded-md px-1 py-1 text-left">
          <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold">W</div>
          <div className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-semibold">{BUSINESS}</span>
            <span className="text-muted-foreground truncate text-xs">schedulefa.st/b/{SLUG}</span>
          </div>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </div>
        <div className="mt-5 flex-1">
          <div className="grid gap-0.5">
            {navItems.map((it) => (
              <span key={it.label} className={cn('text-sidebar-foreground flex h-8 items-center gap-2.5 rounded-md px-2 text-sm', it.label === active && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium')}>
                <it.icon className="size-4" /> {it.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t pt-3">
          <Avatar name="Alex Morgan" className="size-7" />
          <div className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-medium">Alex Morgan</span>
            <span className="text-muted-foreground truncate text-xs">Owner</span>
          </div>
          <UiButton variant="ghost" size="icon-sm"><LogOut /></UiButton>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/90 flex h-14 shrink-0 items-center gap-2 border-b px-6">
          <span className="text-muted-foreground text-sm">{BUSINESS}</span>
          <div className="ml-auto"><UiButton variant="ghost" size="icon-sm"><Sun /></UiButton></div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  )
}

// ── Bookings (hero) ──────────────────────────────────────────────────────────────────────────────────

const bookings = [
  { day: 'Mon, Nov 9', time: '9:00 AM – 9:30 AM', title: 'Free intro call', guest: 'Jamie Lee', email: 'jamie.lee@example.com', answers: [['Which subject do you need help with?', 'Math']], badges: ['On Google Calendar', 'Zoom link sent'] },
  { day: 'Mon, Nov 9', time: '2:00 PM – 3:00 PM', title: 'Tutoring session', guest: 'Noah Carter', email: 'noah.carter@example.com', answers: [['Student’s name', 'Ava Carter'], ['Grade', '8']], paid: '$45', badges: ['On Google Calendar'] },
  { day: 'Tue, Nov 10', time: '4:30 PM – 5:30 PM', title: 'Weekly check-in', guest: 'Sophie Reynolds', email: 'sophie.reynolds@example.com', answers: [], note: 'Can we go over the essay outline?', paid: '$60', badges: ['On Google Calendar', 'Zoom link sent'] },
] as const

export function BookingsPreview() {
  return (
    <ScaledPreview width={1180} url={`schedulefa.st/app/bookings`} label="The schedulefa.st Bookings screen, listing upcoming calls with their answers, payments and calendar status.">
      <AppShell active="Bookings">
        <div className="grid gap-6">
          <div>
            <div className="text-2xl font-semibold tracking-tight">Bookings</div>
            <p className="text-muted-foreground mt-1 text-sm">Upcoming calls booked through {BUSINESS}’s booking pages. Times are in the business time zone (Pacific Standard Time).</p>
          </div>
          <div className="bg-muted flex w-fit gap-1 rounded-lg p-1 text-sm">
            <span className="bg-background rounded-md px-3 py-1.5 font-medium shadow-xs">{BUSINESS}</span>
            <span className="text-muted-foreground rounded-md px-3 py-1.5">All my calls</span>
          </div>
          <div className="grid gap-3">
            {bookings.map((b) => (
              <Card key={b.guest} className="py-4">
                <CardContent className="flex flex-wrap items-start gap-4">
                  <div className="w-28 shrink-0">
                    <p className="text-sm font-medium">{b.day}</p>
                    <p className="text-muted-foreground text-xs">{b.time}</p>
                  </div>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <p className="text-sm font-medium">{b.title} with {b.guest}</p>
                    <p className="text-muted-foreground truncate text-xs">{b.email}</p>
                    {b.answers.map(([q, a]) => <p key={q} className="text-xs"><span className="text-muted-foreground">{q}:</span> {a}</p>)}
                    {'note' in b && <p className="text-muted-foreground line-clamp-2 text-xs">“{b.note}”</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {'paid' in b && <Badge variant="accent">Paid {b.paid}</Badge>}
                      {b.badges.map((x) => <Badge key={x} variant="outline">{x}</Badge>)}
                    </div>
                  </div>
                  <UiButton variant="ghost" size="sm">{'paid' in b ? 'Cancel and refund' : 'Cancel'}</UiButton>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppShell>
    </ScaledPreview>
  )
}

// ── Public pages ─────────────────────────────────────────────────────────────────────────────────────

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 text-foreground grid text-left">
      <main className="mx-auto w-full max-w-3xl px-6 py-10">{children}</main>
      <footer className="grid justify-items-center gap-2 pb-6">
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">Scheduling by <Logo className="text-xs [&_svg]:size-4" /></span>
      </footer>
    </div>
  )
}

const days = ['Mon, Nov 9', 'Tue, Nov 10', 'Wed, Nov 11', 'Thu, Nov 12', 'Fri, Nov 13']
const times = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '1:00 PM', '1:30 PM', '2:00 PM', '3:30 PM', '4:00 PM']

export function BookingPagePreview() {
  return (
    <ScaledPreview width={780} url={`schedulefa.st/b/${SLUG}/intro-call`} label="A schedulefa.st booking page: the call's details beside the days and open times families choose from.">
      <PublicShell>
        <div className="grid grid-cols-[15rem_1fr] gap-6">
          <div className="grid content-start gap-3">
            <p className="text-muted-foreground text-sm">{BUSINESS}</p>
            <div className="text-2xl font-semibold tracking-tight">Free intro call</div>
            <div className="text-muted-foreground grid gap-1.5 text-sm">
              <span className="flex items-center gap-2"><Clock className="size-4" /> 30 minutes with Alex Morgan</span>
              <span className="flex items-center gap-2"><Video className="size-4" /> Zoom call (link sent when you book)</span>
            </div>
            <p className="text-sm">A short call to talk about your goals and see if we’re a good fit.</p>
          </div>
          <Card>
            <CardContent className="grid gap-4">
              <p className="text-muted-foreground text-xs">Times are in Pacific Standard Time.</p>
              <div className="flex gap-2 overflow-hidden pb-1">
                {days.map((d, i) => (
                  <span key={d} className={cn('shrink-0 rounded-md border px-3 py-2 text-sm', i === 0 ? 'border-primary bg-primary text-primary-foreground' : '')}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {times.map((t) => <UiButton key={t} variant="outline">{t}</UiButton>)}
              </div>
            </CardContent>
          </Card>
        </div>
      </PublicShell>
    </ScaledPreview>
  )
}

export function ConfirmationPreview() {
  return (
    <ScaledPreview width={780} url={`schedulefa.st/b/${SLUG}/tutoring/booked`} label="The confirmation families see after booking: the time, the payment and their Zoom link.">
      <PublicShell>
        <Card className="mx-auto w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CircleCheck className="text-success size-5" /> You’re booked</CardTitle>
            <CardDescription>Tutoring session with Alex Morgan ({BUSINESS}). A confirmation is on its way to noah.carter@example.com.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div>
              <p className="font-medium">Monday, November 9, 2026</p>
              <p className="text-muted-foreground">2:00 PM PST – 3:00 PM PST</p>
            </div>
            <p className="text-muted-foreground">$45 paid by card.</p>
            <div>
              <p className="text-muted-foreground text-xs">Join with</p>
              <span className="text-primary break-all">https://us06web.zoom.us/j/81234567890</span>
            </div>
            <UiButton variant="outline" className="justify-self-start">Reschedule or cancel</UiButton>
            <span className="text-primary text-xs">Back to {BUSINESS}</span>
          </CardContent>
        </Card>
      </PublicShell>
    </ScaledPreview>
  )
}

// ── Team ─────────────────────────────────────────────────────────────────────────────────────────────

const team = [
  { name: 'Alex Morgan', email: 'alex@willowcoaching.example', role: 'Owner', coaching: true },
  { name: 'Maya Patel', email: 'maya@willowcoaching.example', role: 'Administrator', coaching: false },
  { name: 'Jordan Lee', email: 'jordan@willowcoaching.example', role: 'Coach', coaching: false },
]

export function TeamPreview() {
  return (
    <ScaledPreview width={780} url="schedulefa.st/app/team" label="The schedulefa.st Team screen: owners, administrators and coaches, and when each coach is free.">
      <div className="bg-background text-foreground grid gap-4 p-6 text-left">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Team</div>
          <p className="text-muted-foreground mt-1 text-sm">Everyone with access to {BUSINESS}. Invite coaches and administrators by email.</p>
        </div>
        <Card className="pb-0">
          <CardHeader>
            <CardTitle>3 members</CardTitle>
            <CardDescription>Parents and students never use staff seats.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead className="pl-5">Name</TableHead><TableHead>Role</TableHead><TableHead className="pr-5 text-right">Status</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {team.map((m) => (
                  <TableRow key={m.name}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.name} />
                        <div>
                          <div className="font-medium">{m.name}</div>
                          <div className="text-muted-foreground text-xs">{m.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{m.role}{m.coaching && <span className="text-muted-foreground text-xs"> + coaching</span>}</TableCell>
                    <TableCell className="pr-5 text-right"><Badge variant="outline">Active</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Free times this week</CardTitle>
            <CardDescription>When each coach can take {BUSINESS} calls. Only free times are shown.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[['Jordan Lee', [['Mon, Nov 9', '9:00 AM – 12:00 PM, 1:00 PM – 5:00 PM'], ['Tue, Nov 10', '3:00 PM – 6:00 PM']]]].map(([name, rows]) => (
              <div key={name as string} className="grid gap-1.5">
                <p className="text-sm font-medium">{name as string}</p>
                <dl className="grid gap-1 text-xs">
                  {(rows as string[][]).map(([d, r]) => <div key={d} className="flex gap-3"><dt className="w-24 shrink-0">{d}</dt><dd className="text-muted-foreground">{r}</dd></div>)}
                </dl>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ScaledPreview>
  )
}

// ── Payments ─────────────────────────────────────────────────────────────────────────────────────────

export function PaymentsPreview() {
  return (
    <ScaledPreview width={620} url="schedulefa.st/app/booking-pages" label="Setting a price and refund cutoff on a schedulefa.st booking page, and a paid booking in the Bookings list.">
      <div className="bg-background text-foreground grid gap-4 p-6 text-left">
        <fieldset className="grid gap-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">Price</legend>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Price (USD)</span>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-sm">$</span>
                <span className="border-input flex h-9 w-full items-center rounded-md border px-3 text-sm shadow-xs">45</span>
              </div>
              <p className="text-muted-foreground text-xs">Leave blank for a free call. Paid calls are charged by card when booked.</p>
            </div>
            <div className="grid content-start gap-1.5">
              <span className="text-sm font-medium">Full refund if cancelled at least (hours before)</span>
              <span className="border-input flex h-9 w-full items-center rounded-md border px-3 text-sm shadow-xs">24</span>
              <p className="text-muted-foreground text-xs">Guests who cancel later aren’t refunded. If you cancel, they’re always refunded.</p>
            </div>
          </div>
        </fieldset>
        <Card className="py-4">
          <CardContent className="flex items-start gap-4">
            <div className="w-28 shrink-0">
              <p className="text-sm font-medium">Mon, Nov 9</p>
              <p className="text-muted-foreground text-xs">2:00 PM – 3:00 PM</p>
            </div>
            <div className="grid min-w-0 flex-1 gap-1">
              <p className="text-sm font-medium">Tutoring session with Noah Carter</p>
              <p className="text-muted-foreground truncate text-xs">noah.carter@example.com</p>
              <div className="flex flex-wrap gap-1.5"><Badge variant="accent">Paid $45</Badge><Badge variant="outline">On Google Calendar</Badge></div>
            </div>
            <UiButton variant="ghost" size="sm">Cancel and refund</UiButton>
          </CardContent>
        </Card>
      </div>
    </ScaledPreview>
  )
}
