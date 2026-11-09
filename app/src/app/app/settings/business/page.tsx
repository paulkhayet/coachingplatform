import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { canManageTeam } from '@/lib/roles'
import { describeHours, parseWeeklyHours } from '@/lib/slots'
import { US_TIME_ZONES } from '@/lib/validation'
import { OpeningHoursForm } from './form'

export const metadata: Metadata = { title: 'Business hours' }

export default async function BusinessHoursPage() {
  const { business, membership } = await requireWorkspace()
  const supabase = await createClient()
  const { data } = await supabase.from('businesses').select('opening_hours').eq('id', business.id).maybeSingle<{ opening_hours: unknown }>()
  const hours = data?.opening_hours ? parseWeeklyHours(data.opening_hours) : null
  const zone = US_TIME_ZONES.find((t) => t.value === business.timezone)?.label ?? business.timezone
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Business hours</h1>
        <p className="text-muted-foreground mt-1 text-sm">When {business.name} takes bookings, for everyone who works here. Each person also sets their own hours; families can book only when both are open.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Opening hours</CardTitle>
          <CardDescription>In {business.name}’s time zone ({zone}).</CardDescription>
        </CardHeader>
        <CardContent>
          {canManageTeam(membership.role) ? (
            <OpeningHoursForm initial={hours} businessName={business.name} />
          ) : (
            <p className="text-sm">{hours ? `${business.name} is open ${describeHours(hours)}.` : `${business.name} hasn’t limited its opening hours.`} Only the owner can change this.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
