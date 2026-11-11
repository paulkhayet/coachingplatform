import { randomUUID } from 'node:crypto'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { coachOptions } from '@/app/app/booking-pages/hosts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { formatCents } from '@/lib/booking/policy'
import { businessDate } from '@/lib/clients/credits'
import { formatCredits } from '@/lib/coaching-packages'
import { canManageClients, canManagePayments } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { saveClient, saveClientPackage, saveGuardian } from '../actions'
import { CreditPeriod } from '../credit-period'
import type { AssignmentRow, ClientRow, CreditBalanceRow, CreditEventRow, CreditPaymentRow, GuardianRow, PackageOption } from '../data'
import { AssignPackageForm, ClientForm, GuardianForm } from '../forms'

export const metadata: Metadata = { title: 'Client' }

const messages: Record<string, string> = {
  client: 'Client saved.', guardian: 'Guardian contact saved.', package: 'Package assigned.', payment: 'Payment recorded.',
}
const empty = { data: [], error: null }
type SessionSummary = { id: string; title: string; starts_at: string; status: string; attended_at: string | null }

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const { business, membership } = await requireWorkspace()
  const [{ id }, { status }] = await Promise.all([params, searchParams])
  if (!z.uuid().safeParse(id).success) notFound()

  const supabase = await createClient()
  const { data: client, error } = await supabase.from('coaching_clients').select('id, name, email, coach_membership_id')
    .eq('id', id).eq('business_id', business.id).maybeSingle<ClientRow>()
  if (error) return <Alert variant="destructive"><AlertDescription>Couldn’t load this client. Refresh the page to try again.</AlertDescription></Alert>
  if (!client) notFound()

  const manager = canManageClients(membership.role)
  const finance = canManagePayments(membership)
  const today = businessDate(business.timezone)
  const [coaches, guardians, balances, events, assignments, payments, packages, sessions] = await Promise.all([
    coachOptions(business.id),
    manager ? supabase.from('client_guardians').select('id, name, relationship, email, phone')
      .eq('business_id', business.id).eq('client_id', id).order('created_at').returns<GuardianRow[]>() : empty,
    supabase.rpc('client_credit_balances', { p_business_id: business.id, p_client_id: id }).returns<CreditBalanceRow[]>(),
    supabase.from('client_credit_events').select('id, period_id, kind, credit_units, created_at')
      .eq('business_id', business.id).eq('client_id', id).order('created_at', { ascending: false }).limit(100).returns<CreditEventRow[]>(),
    manager ? supabase.from('client_packages').select('id, terms')
      .eq('business_id', business.id).eq('client_id', id).returns<AssignmentRow[]>() : empty,
    manager ? supabase.from('client_credit_payments').select('id, period_id, amount_cents, method, received_on, reference')
      .eq('business_id', business.id).eq('client_id', id).order('recorded_at', { ascending: false }).limit(100).returns<CreditPaymentRow[]>() : empty,
    finance ? supabase.from('coaching_packages').select('id, name, kind, price_cents, credit_units, updated_at')
      .eq('business_id', business.id).is('archived_at', null).order('name').returns<PackageOption[]>() : empty,
    supabase.from('bookings').select('id, title, starts_at, status, attended_at')
      .eq('business_id', business.id).eq('coaching_client_id', id).order('starts_at', { ascending: false }).limit(30).returns<SessionSummary[]>(),
  ])

  const coach = client.coach_membership_id ? coaches.find((item) => item.id === client.coach_membership_id)?.name ?? 'Unavailable coach' : 'Unassigned'
  const message = status && Object.hasOwn(messages, status) ? messages[status] : null
  const packageOptions = (packages.data ?? []).map((pkg) => ({
    id: pkg.id, version: pkg.updated_at, name: `${pkg.name} · ${formatCents(pkg.price_cents)}${pkg.kind === 'monthly' ? '/month' : ''} · ${formatCredits(pkg.credit_units)}`,
  }))
  const termsByAssignment = new Map((assignments.data ?? []).map((row) => [row.id, row.terms]))
  const periods = Array.isArray(balances.data) ? balances.data : []
  const creditError = balances.error || !Array.isArray(balances.data) || events.error || assignments.error || payments.error
  const sessionTime = new Intl.DateTimeFormat('en-US', { timeZone: business.timezone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })

  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <Link href="/app/clients" className="text-muted-foreground text-sm hover:underline">← Clients</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight break-words">{client.name}</h1>
      </div>
      {message && <Alert variant="success"><AlertDescription>{message}</AlertDescription></Alert>}
      <Card className="gap-4">
        <CardHeader><h2 className="font-semibold">Client details</h2></CardHeader>
        <CardContent className="grid gap-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="text-muted-foreground text-xs">Email</dt><dd className="mt-0.5 text-sm break-all">{client.email ?? 'No email on file'}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Assigned coach</dt><dd className="mt-0.5 text-sm break-words">{coach}</dd></div>
          </dl>
          {manager && <details className="border-t pt-3">
            <summary className="cursor-pointer text-sm font-medium">Edit client details</summary>
            <div className="mt-3 max-w-md"><ClientForm action={saveClient.bind(null, business.id, id)} client={client} coaches={coaches} /></div>
          </details>}
        </CardContent>
      </Card>

      {manager && <Card className="gap-4">
        <CardHeader>
          <h2 className="font-semibold">Guardian contacts</h2>
          <CardDescription>Add a parent or guardian when the client has one.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {guardians.error ? <Alert variant="destructive"><AlertDescription>Couldn’t load guardian contacts.</AlertDescription></Alert> : <>
            {!guardians.data?.length && <p className="text-muted-foreground text-sm">No guardian contacts yet.</p>}
            {(guardians.data ?? []).map((guardian) => (
              <div key={guardian.id} className="grid gap-2 border-b pb-3 text-sm">
                <p className="font-medium break-words">{guardian.name}{guardian.relationship && <span className="text-muted-foreground font-normal"> · {guardian.relationship}</span>}</p>
                <p className="text-muted-foreground break-words">{[guardian.email, guardian.phone].filter(Boolean).join(' · ')}</p>
                <details>
                  <summary className="cursor-pointer font-medium">Edit contact</summary>
                  <div className="mt-3"><GuardianForm action={saveGuardian.bind(null, business.id, id, guardian.id)} guardian={guardian} /></div>
                </details>
              </div>
            ))}
            <details>
              <summary className="cursor-pointer text-sm font-medium">Add guardian contact</summary>
              <div className="mt-3"><GuardianForm key={guardians.data?.length ?? 0} action={saveGuardian.bind(null, business.id, id, null)} /></div>
            </details>
          </>}
        </CardContent>
      </Card>}

      {(sessions.error || Boolean(sessions.data?.length)) && <Card className="gap-4">
        <CardHeader><h2 className="font-semibold">Coaching sessions</h2></CardHeader>
        <CardContent>
          {sessions.error ? <Alert variant="destructive"><AlertDescription>Couldn’t load coaching sessions.</AlertDescription></Alert> : (
            <ul className="divide-y">
              {(sessions.data ?? []).map((session) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-words">{session.title}</p>
                    <p className="text-muted-foreground text-xs">{sessionTime.format(new Date(session.starts_at))}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={session.status === 'cancelled' ? 'neutral' : 'success'}>{session.status === 'cancelled' ? 'Cancelled' : session.attended_at ? 'Attended' : 'Scheduled'}</StatusBadge>
                    <Button asChild variant="ghost" size="sm"><Link href={`/app/bookings/coaching/${session.id}`}>View session</Link></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>}

      <section className="grid gap-4" aria-labelledby="client-credits">
        <div>
          <h2 id="client-credits" className="text-lg font-semibold tracking-tight">Packages and credits</h2>
          <p className="text-muted-foreground mt-1 text-sm">Credit balances and activity by service period.</p>
        </div>
        {creditError ? <Alert variant="destructive"><AlertDescription>Couldn’t load credit balances. Refresh the page to try again.</AlertDescription></Alert> : <>
          {periods.map((period) => (
            <CreditPeriod key={period.id} period={period} terms={termsByAssignment.get(period.client_package_id)}
              events={(events.data ?? []).filter((event) => event.period_id === period.id)}
              payments={(payments.data ?? []).filter((payment) => payment.period_id === period.id)}
              canBook={manager} canRecord={finance} businessId={business.id} clientId={id} today={today} timezone={business.timezone} />
          ))}
          {!periods.length && <p className="text-muted-foreground text-sm">No coaching package has been assigned.</p>}
          {finance && <Card className="gap-4">
            <CardHeader>
              <h3 className="font-semibold">Assign a package</h3>
              <CardDescription>Save the package terms for this client. Monthly packages start with their first service period.</CardDescription>
            </CardHeader>
            <CardContent>
              {packages.error ? <Alert variant="destructive"><AlertDescription>Couldn’t load available packages.</AlertDescription></Alert> : packageOptions.length ? (
                <AssignPackageForm key={periods.length} action={saveClientPackage.bind(null, business.id, id, randomUUID())} packages={packageOptions} today={today} />
              ) : <Button asChild variant="outline" size="sm"><Link href="/app/coaching-packages/new">Create a coaching package</Link></Button>}
            </CardContent>
          </Card>}
        </>}
      </section>
    </div>
  )
}
