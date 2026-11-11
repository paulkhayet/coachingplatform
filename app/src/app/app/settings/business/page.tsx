import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { canManageTeam } from '@/lib/roles'
import { describeHours, parseWeeklyHours } from '@/lib/slots'
import { US_TIME_ZONES } from '@/lib/validation'
import { saveBusinessName, saveReservationSettings } from './actions'
import { BusinessNameForm, OpeningHoursForm, ReservationSettingsForm } from './form'

export const metadata: Metadata = { title: 'Business settings' }

export default async function BusinessSettingsPage() {
  const { business, membership } = await requireWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase.from('businesses').select('opening_hours, payment_reminder_hours, unpaid_cancellation_hours').eq('id', business.id)
    .maybeSingle<{ opening_hours: unknown; payment_reminder_hours: number | null; unpaid_cancellation_hours: number | null }>()
  const hours = data?.opening_hours ? parseWeeklyHours(data.opening_hours) : null
  const zone = US_TIME_ZONES.find((t) => t.value === business.timezone)?.label ?? business.timezone
  const owner = canManageTeam(membership.role)
  return (
    <div className="grid max-w-3xl gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>{zone} time zone</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {owner ? <BusinessNameForm name={business.name} save={saveBusinessName.bind(null, business.id)} /> : <p className="text-sm">{business.name}</p>}
          <Button asChild variant="outline" className="justify-self-start"><Link href="/app/team">{owner ? 'Manage team' : 'View team'}</Link></Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Opening hours</CardTitle>
          <CardDescription>In {business.name}’s time zone ({zone}). A time is bookable when both the business and the coach are open.</CardDescription>
        </CardHeader>
        <CardContent>
          {owner ? (
            <OpeningHoursForm initial={hours} businessName={business.name} />
          ) : (
            <p className="text-sm">{hours ? `${business.name} is open ${describeHours(hours)}.` : `${business.name} hasn’t limited its opening hours.`} Only the owner can change this.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Coaching reservations</CardTitle>
          <CardDescription>Hold times against a client’s package allowance. Meeting details go out once the session is covered by payment.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-sm">Couldn’t load the reservation settings. Refresh the page to try again.</p>
            : owner ? <ReservationSettingsForm save={saveReservationSettings.bind(null, business.id)}
              initial={{ enabled: business.allow_advance_reservations, reminder: data?.payment_reminder_hours ?? null, cutoff: data?.unpaid_cancellation_hours ?? null }} />
              : <p className="text-sm">Advance reservations are {business.allow_advance_reservations ? 'enabled' : 'disabled'}. Only the owner can change this.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
