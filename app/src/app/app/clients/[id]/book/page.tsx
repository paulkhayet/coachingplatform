import { randomUUID } from 'node:crypto'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { coachOptions } from '@/app/app/booking-pages/hosts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { availableCreditUnits, availablePurchasedUnits, businessDate } from '@/lib/clients/credits'
import { formatCredits } from '@/lib/coaching-packages'
import { canManageClients } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { isZoomConfigured } from '@/lib/zoom/server'
import { bookCoachingAction } from '../../coaching-actions'
import { CoachingBookingForm } from '../../coaching-forms'
import type { AssignmentRow, ClientRow, CreditBalanceRow } from '../../data'

export const metadata: Metadata = { title: 'Book coaching session' }

export default async function BookCoachingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  const { business, membership } = await requireWorkspace()
  const [{ id }, { period: periodId }] = await Promise.all([params, searchParams])
  if (!z.uuid().safeParse(id).success || !periodId || !z.uuid().safeParse(periodId).success) notFound()
  if (!canManageClients(membership.role)) redirect(`/app/clients/${id}`)

  const supabase = await createClient()
  const [client, balances, guardians, team] = await Promise.all([
    supabase.from('coaching_clients').select('id, name, email, coach_membership_id').eq('id', id).eq('business_id', business.id).maybeSingle<ClientRow>(),
    supabase.rpc('client_credit_balances', { p_business_id: business.id, p_client_id: id }).returns<CreditBalanceRow[]>(),
    supabase.from('client_guardians').select('id, name, email').eq('client_id', id).eq('business_id', business.id).returns<{ id: string; name: string; email: string | null }[]>(),
    coachOptions(business.id),
  ])
  if (client.error || balances.error || guardians.error) return <Alert variant="destructive"><AlertDescription>Couldn’t load the booking details. Refresh the page to try again.</AlertDescription></Alert>
  const periods: CreditBalanceRow[] = Array.isArray(balances.data) ? balances.data : []
  const period = periods.find((item) => item.id === periodId)
  if (!client.data || !period) notFound()
  const { data: assignment, error } = await supabase.from('client_packages').select('id, terms').eq('id', period.client_package_id)
    .eq('business_id', business.id).eq('client_id', id).maybeSingle<AssignmentRow>()
  if (error || !assignment) return <Alert variant="destructive"><AlertDescription>Couldn’t load the package terms.</AlertDescription></Alert>

  const terms = assignment.terms
  const coaches = team.filter((coach) => !terms.eligibleCoachIds || terms.eligibleCoachIds.includes(coach.id))
  const balance = availableCreditUnits(period)
  const allowance = business.allow_advance_reservations ? availablePurchasedUnits(period) : balance
  const formats = terms.sessionFormats.flatMap((format, index) => format.creditUnits <= allowance ? [{ id: String(index), name: `${format.name} · ${format.durationMinutes} min · ${formatCredits(format.creditUnits)}` }] : [])
  const contacts = [
    ...(client.data.email ? [{ id: 'client', name: `${client.data.name} · ${client.data.email}` }] : []),
    ...(guardians.data ?? []).flatMap((guardian) => guardian.email ? [{ id: guardian.id, name: `${guardian.name} · ${guardian.email}` }] : []),
  ]
  const now = new Date()
  const today = businessDate(business.timezone, now)
  const firstDate = today > period.starts_on ? today : period.starts_on
  const through = new Date(new Date(`${period.ends_on}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10)
  const horizon = businessDate(business.timezone, new Date(now.getTime() + 60 * 86400000))
  const lastDate = through < horizon ? through : horizon
  const defaultCoach = coaches.find((coach) => coach.id === client.data?.coach_membership_id)?.id

  return (
    <div className="grid max-w-2xl gap-5">
      <div>
        <Link href={`/app/clients/${id}`} className="text-muted-foreground text-sm hover:underline">← {client.data.name}</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Book coaching session</h1>
      </div>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">{period.name}</h2>
          <CardDescription>{formatCredits(balance)} funded and available{business.allow_advance_reservations && ` · ${formatCredits(allowance)} available to reserve`}</CardDescription>
        </CardHeader>
        <CardContent>
          {firstDate > lastDate ? <p className="text-muted-foreground text-sm">There are no dates in this credit period within the booking window.</p>
            : !formats.length ? <p className="text-muted-foreground text-sm">{business.allow_advance_reservations ? 'This package has insufficient allowance to reserve a session.' : 'This package needs more funded credits to book a session.'}</p>
              : !coaches.length ? <p className="text-muted-foreground text-sm">There are no active coaches eligible for this package.</p>
                : <CoachingBookingForm action={bookCoachingAction.bind(null, business.id, id, periodId, randomUUID())} formats={formats} coaches={coaches}
                  contacts={contacts} firstDate={firstDate} lastDate={lastDate} timezone={business.timezone} noticeHours={terms.cancellationNoticeHours}
                  lateCancellation={terms.lateCancellation} zoomAvailable={isZoomConfigured} defaultCoach={defaultCoach} />}
        </CardContent>
      </Card>
    </div>
  )
}
