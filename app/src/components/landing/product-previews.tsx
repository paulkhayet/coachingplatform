import { CalendarCheck, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, CircleCheck, Clock, CreditCard, Globe, Home, Link2, LogOut, Sun, UsersRound, Video } from 'lucide-react'
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
// app/layout.tsx + nav.tsx + business-switcher.tsx, app/bookings, b/[business]/[page] (+ picker.tsx),
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
      <main className="mx-auto w-full max-w-5xl px-6 py-10">{children}</main>
      <footer className="grid justify-items-center gap-2 pb-6">
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">Scheduling by <Logo className="text-xs [&_svg]:size-4" /></span>
      </footer>
    </div>
  )
}

// November 2026 as the booking calendar shows it: weekdays with open times are tinted, the 16th is chosen.
const NOV_2026_FIRST_WEEKDAY = 0 // Sunday
const openDays = new Set([11, 12, 13, 16, 17, 18, 19, 20, 23, 24, 25, 27, 30])
const times = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '1:00 PM', '1:30 PM']

export function BookingPagePreview() {
  const cells = [...Array(NOV_2026_FIRST_WEEKDAY).fill(null), ...Array.from({ length: 30 }, (_, i) => i + 1)]
  return (
    <ScaledPreview width={980} url={`schedulefa.st/b/${SLUG}/intro-call`} label="A schedulefa.st booking page: the call's details, a month calendar with open days highlighted and a time zone picker, and the chosen day's times.">
      <PublicShell>
        <div className="bg-card text-card-foreground grid grid-cols-[17rem_1fr] overflow-hidden rounded-xl border shadow-xs">
          <div className="grid content-start gap-3 border-r p-6">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-bold">W</div>
              <p className="text-muted-foreground text-sm font-medium">{BUSINESS}</p>
            </div>
            <div className="text-2xl font-semibold tracking-tight">Free intro call</div>
            <div className="text-muted-foreground grid gap-2 text-sm">
              <span className="flex items-start gap-2"><Clock className="mt-0.5 size-4 shrink-0" /> 30 minutes with Alex Morgan</span>
              <span className="flex items-start gap-2"><Video className="mt-0.5 size-4 shrink-0" /> Zoom call (link sent when you book)</span>
            </div>
            <p className="text-sm">A short call to talk about your goals and see if we’re a good fit.</p>
          </div>
          <div className="grid gap-5 p-6">
            <div className="text-lg font-semibold tracking-tight">Select a date & time</div>
            <div className="grid grid-cols-[minmax(0,1fr)_11rem] gap-6">
              <div className="grid content-start gap-5">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between text-sm"><ChevronLeft className="text-muted-foreground size-4" /><span className="font-medium">November 2026</span><ChevronRight className="size-4" /></div>
                  <div className="grid grid-cols-7 text-center text-[0.8rem]">
                    {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => <span key={d} className="text-muted-foreground py-1">{d}</span>)}
                    {cells.map((d, i) => (
                      <span key={i} className="flex h-10 items-center justify-center">
                        {d && (
                          <span className={cn('flex size-10 items-center justify-center rounded-full text-sm', d === 16 ? 'bg-primary text-primary-foreground font-semibold' : openDays.has(d) ? 'bg-accent text-accent-foreground font-semibold' : 'text-muted-foreground opacity-50')}>{d}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <span className="text-sm font-medium">Time zone</span>
                  <span className="border-input flex h-9 w-full max-w-sm items-center gap-2 rounded-md border px-3 text-sm shadow-xs"><Globe className="text-muted-foreground size-4" /> Pacific Time <span className="text-muted-foreground">(10:30am)</span><ChevronDown className="text-muted-foreground ml-auto size-4" /></span>
                </div>
              </div>
              <div className="grid content-start gap-3">
                <p className="text-sm font-medium">Monday, November 16</p>
                {times.map((t) => (
                  <span key={t} className="border-primary/40 text-primary flex h-11 items-center justify-center rounded-md border text-sm font-semibold">{t}</span>
                ))}
              </div>
            </div>
          </div>
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

// ── Team dashboard (D-074) ───────────────────────────────────────────────────────────────────────────

const pipeline = [
  { stage: 'New', hint: 'Just arrived. Review and reply.', cards: [{ student: 'Maya Rivers', contact: 'Dana Rivers', subjects: ['Algebra', 'SAT Math'], owner: 'Alex Morgan', coach: null, days: 'Today' }] },
  { stage: 'Matching', hint: 'Choose a coach for this family.', cards: [{ student: 'Leo Park', contact: 'Hana Park', subjects: ['Reading'], owner: 'Alex Morgan', coach: 'Jordan Lee', days: '1 day' }] },
  { stage: 'First call', hint: 'The coach meets the family.', cards: [{ student: 'Ava Carter', contact: 'Noah Carter', subjects: ['Chemistry'], owner: 'Priya Shah', coach: 'Sam Rivera', days: '2 days' }] },
  { stage: 'Offer', hint: 'Pricing and package discussed.', cards: [{ student: 'Ethan Brooks', contact: 'Mia Brooks', subjects: ['Essay writing'], owner: 'Priya Shah', coach: 'Jordan Lee', days: '3 days', next: 'Send pricing · due Nov 14' }] },
] as const

/** The Intake board: families move from first contact to enrolled, with a coach suggested for each. */
export function IntakePreview() {
  return (
    <ScaledPreview width={1080} url="schedulefa.st/app/dashboard/intake" label="The schedulefa.st team dashboard: an intake board with families at each stage, from new inquiry to offer.">
      <div className="bg-background text-foreground grid gap-5 p-6 text-left">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Dashboard</div>
          <p className="text-muted-foreground mt-1 text-sm">Intake, coaches and finances for {BUSINESS}.</p>
        </div>
        <div className="flex gap-5 border-b text-sm">
          {['Overview', 'Intake', 'Assignments', 'Finances'].map((t) => (
            <span key={t} className={cn('text-muted-foreground -mb-px border-b-2 border-transparent px-0.5 py-2.5', t === 'Intake' && 'border-primary text-foreground font-medium')}>{t}</span>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-3">
          {pipeline.map((col) => (
            <section key={col.stage} className="bg-muted/40 grid content-start gap-2 rounded-xl border p-2.5">
              <header className="px-1 pt-0.5">
                <p className="flex items-center gap-2 text-sm font-semibold">{col.stage} <Badge variant="secondary">{col.cards.length}</Badge></p>
                <p className="text-muted-foreground text-xs">{col.hint}</p>
              </header>
              {col.cards.map((c) => (
                <article key={c.student} className="bg-card grid gap-2 rounded-lg border p-3 shadow-xs">
                  <div>
                    <p className="font-medium">{c.student}</p>
                    <p className="text-muted-foreground text-xs">{c.contact}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">{c.subjects.map((x) => <Badge key={x} variant="accent">{x}</Badge>)}</div>
                  <div className="text-muted-foreground grid gap-0.5 text-xs">
                    <p>Handled by: <span className="text-foreground">{c.owner}</span></p>
                    <p>Coach: {c.coach ? <span className="text-foreground">{c.coach}</span> : <span className="text-warning font-medium">Not chosen</span>}</p>
                    <p>In this stage: <span className="text-foreground">{c.days}</span></p>
                  </div>
                  {'next' in c && <p className="text-muted-foreground text-xs">Next: {c.next}</p>}
                  <div className="border-input flex h-8 items-center justify-between rounded-md border px-3 text-xs">{col.stage}<ChevronDown className="size-3.5 opacity-50" /></div>
                </article>
              ))}
            </section>
          ))}
        </div>
        <Card className="gap-3 py-4">
          <CardHeader><CardTitle>Suggested coaches for Maya Rivers</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            {[
              ['Jordan Lee', ['Teaches Algebra, SAT Math', '18 free times in the next 2 weeks', 'Room for 3 more (5 of 8)']],
              ['Sam Rivera', ['Teaches Algebra', '9 free times in the next 2 weeks', '6 of 8 clients']],
              ['Priya Shah', ['No matching subjects', '24 free times in the next 2 weeks', '2 clients']],
            ].map(([name, reasons], i) => (
              <div key={name as string} className="flex items-start justify-between gap-2 rounded-md border p-2.5">
                <div>
                  <p className="text-sm font-medium">{name as string}</p>
                  <ul className="mt-1 grid gap-0.5 text-xs">{(reasons as string[]).map((r, j) => <li key={r} className={i < 2 && j < 2 ? 'text-success' : 'text-muted-foreground'}>{r}</li>)}</ul>
                </div>
                <UiButton variant="outline" size="sm">Propose</UiButton>
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
