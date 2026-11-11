import type { Metadata } from 'next'
import { requireWorkspace } from '@/lib/workspace'
import { CalendarCard } from './calendar-card'
import { StripeCard } from './stripe-card'
import { ZoomCard } from './zoom-card'

export const metadata: Metadata = { title: 'Integrations' }

export default async function IntegrationsPage({ searchParams }: {
  searchParams: Promise<{ calendar?: string; zoom?: string; returned?: string; error?: string }>
}) {
  const [{ user }, { calendar, zoom, returned, error }] = await Promise.all([requireWorkspace(), searchParams])
  return (
    <div className="grid gap-6">
      <section className="grid gap-3" aria-labelledby="personal-integrations">
        <h2 id="personal-integrations" className="text-base font-semibold">Your connections</h2>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <CalendarCard userId={user.id} email={user.email} outcome={calendar} />
          <ZoomCard userId={user.id} outcome={zoom} />
        </div>
      </section>
      <StripeCard returned={returned} error={error} />
    </div>
  )
}
