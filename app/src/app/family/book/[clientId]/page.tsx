import { randomUUID } from 'node:crypto'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { adminDb } from '@/db/server'
import { checkFeature } from '@/lib/billing/server'
import { businessDate } from '@/lib/clients/credits'
import { familyBookingContext } from '@/lib/clients/sessions'
import { formatCredits } from '@/lib/coaching-packages'
import { familyLinks } from '@/lib/family/access'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/workspace'
import { familyBook } from '../../actions'
import { FamilyBookForm } from '../../forms'

export const metadata: Metadata = { title: 'Book a session' }
export const dynamic = 'force-dynamic'

/** A parent or guardian books a session with the student's coach, from credits already paid for. */
export default async function FamilyBookPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [{ clientId }, user] = await Promise.all([params, getUser()])
  if (!user) notFound()
  const link = (await familyLinks(user.id)).find((l) => l.client_id === clientId)
  if (!link || !link.can_book) notFound()
  const supabase = await createClient()
  const [{ data: client }, blocked] = await Promise.all([
    supabase.from('coaching_clients').select('name').eq('id', clientId).maybeSingle<{ name: string }>(),
    checkFeature(link.business_id, 'clients'),
  ])
  const context = blocked ? { reason: 'Booking from the portal isn’t available right now. Contact the coaching business.' }
    : await familyBookingContext(adminDb(), { businessId: link.business_id, userId: user.id, family: true }, clientId)
  return (
    <div className="grid gap-6">
      <Link href="/family" className="text-muted-foreground text-sm hover:underline">← Family portal</Link>
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Book a session{client ? ` for ${client.name}` : ''}</CardTitle>
          <CardDescription>
            {'reason' in context ? context.reason : `With the same coach and meeting details as before. Uses credits you’ve already paid for. Times are at least 12 hours from now.`}
          </CardDescription>
        </CardHeader>
        {!('reason' in context) && (
          <CardContent>
            <FamilyBookForm action={familyBook.bind(null, clientId, randomUUID())} timeZone={context.timezone} today={businessDate(context.timezone)}
              periods={context.periods.map((p) => ({ id: p.id, name: p.name, startsOn: p.startsOn, endsOn: p.endsOn, availableLabel: `${formatCredits(p.availableUnits)} available`,
                formats: p.formats.map((f) => ({ index: f.index, label: `${f.name} · ${f.durationMinutes} min · ${formatCredits(f.creditUnits)}` })) }))} />
          </CardContent>
        )}
      </Card>
    </div>
  )
}
