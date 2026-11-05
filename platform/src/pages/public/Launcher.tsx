import { useNavigate } from 'react-router'
import { ArrowRight, Building2, Users, Globe } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Logo } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'
import { useDB, useStore } from '@/lib/store'
import type { Viewer } from '@/lib/types'

export default function Launcher() {
  const db = useDB()
  const setViewer = useStore((s) => s.setViewer)
  const nav = useNavigate()
  const go = (v: Viewer | null, path: string) => {
    if (v) setViewer(v)
    nav(path)
  }
  const offer = db.offers.find((o) => o.status !== 'paid' && o.status !== 'voided')
  const staff: { v: Viewer; name: string; role: string; note: string }[] = [
    { v: { kind: 'staff', id: 'st_eleni' }, name: 'Eleni Morgan', role: 'Owner who also coaches', note: 'Setup, pricing, policies, plan, a follow-up to review' },
    { v: { kind: 'staff', id: 'st_marcus' }, name: 'Marcus Hale', role: 'Administrator', note: 'Inquiry queue, offers, failed payment, makeups' },
    { v: { kind: 'staff', id: 'st_priya' }, name: 'Priya Shah', role: 'Coach', note: 'No prices anywhere; a session awaiting payment' },
    { v: { kind: 'staff', id: 'st_ava' }, name: 'Ava Thompson', role: 'Coach', note: 'Pool and granted access; missing Zoom summary' },
  ]
  const families: { v: Viewer; name: string; role: string; note: string }[] = [
    { v: { kind: 'guardian', id: 'g_rachel', studentId: 's_sophie' }, name: 'Rachel Reynolds', role: 'Parent · full access', note: 'Parent follow-up, billing, booking' },
    { v: { kind: 'guardian', id: 'g_tom', studentId: 's_sophie' }, name: 'Tom Reynolds', role: 'Parent · limited', note: 'Separate login, no billing or booking' },
    { v: { kind: 'student', id: 's_sophie' }, name: 'Sophie Reynolds', role: 'Student', note: 'Self-booking, homework, student follow-up' },
    { v: { kind: 'student', id: 's_ethan' }, name: 'Ethan Brooks', role: 'Student', note: 'Program ended — book a preserved makeup' },
  ]
  const Person = ({ p }: { p: (typeof staff)[number] }) => (
    <button onClick={() => go(p.v, p.v.kind === 'staff' ? '/app' : '/portal')} className="hover:bg-muted/60 group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors">
      <Avatar name={p.name} className="size-9" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{p.name} <span className="text-muted-foreground font-normal">· {p.role}</span></span>
        <span className="text-muted-foreground block text-xs">{p.note}</span>
      </span>
      <ArrowRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
  return (
    <div className="min-h-svh">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><Logo /><ThemeToggle /></header>
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-16">
        <div className="bg-accent text-accent-foreground mb-4 inline-flex rounded-full px-3 py-1 text-xs font-medium">Product prototype · sample data</div>
        <h1 className="max-w-2xl font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">The whole coaching journey, <span className="text-primary italic">clickable.</span></h1>
        <p className="text-muted-foreground mt-4 max-w-2xl">Inquiry → fit call → offer and signature → payment → portal → scheduling → coaching → follow-up. Pick a person below to see the product from their side. Everything runs in your browser; Stripe, Zoom, Google, e-signing, SMS and AI drafting are simulated.</p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-4" /> Staff workspace</CardTitle><CardDescription>{db.business.name} · 5 staff</CardDescription></CardHeader>
            <CardContent className="grid gap-2">{staff.map((p) => <Person key={p.name} p={p} />)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-4" /> Family portal</CardTitle><CardDescription>Each guardian has their own login and permissions</CardDescription></CardHeader>
            <CardContent className="grid gap-2">{families.map((p) => <Person key={p.name} p={p} />)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="size-4" /> Guest pages</CardTitle><CardDescription>No account needed before payment</CardDescription></CardHeader>
            <CardContent className="grid gap-2">
              <button onClick={() => go(null, `/b/${db.business.slug}`)} className="hover:bg-muted/60 rounded-lg border p-3 text-left">
                <span className="block text-sm font-medium">Public booking page</span>
                <span className="text-muted-foreground block text-xs">Calendly-style: free fit call, paid strategy session, essay review — each with a questionnaire</span>
              </button>
              <button onClick={() => go(null, '/booking/grace-kim-strategy')} className="hover:bg-muted/60 rounded-lg border p-3 text-left">
                <span className="block text-sm font-medium">Manage a paid booking</span>
                <span className="text-muted-foreground block text-xs">The guest’s link to reschedule or cancel (with refund rules)</span>
              </button>
              {offer && (
                <button onClick={() => go(null, `/offer/${offer.token}`)} className="hover:bg-muted/60 rounded-lg border p-3 text-left">
                  <span className="block text-sm font-medium">Guest offer for {db.inquiries.find((i) => i.id === offer.inquiryId)?.studentName}</span>
                  <span className="text-muted-foreground block text-xs">Choose → sign → pay → portal invitation</span>
                </button>
              )}
              <div className="text-muted-foreground mt-2 rounded-lg border border-dashed p-3 text-xs">Use “Reset demo data” in the account menu any time. Your changes are saved in this browser only.</div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
