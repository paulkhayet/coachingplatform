import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ExternalLink, Plus } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCents } from '@/lib/booking/policy'
import type { BookingPageInput } from '@/lib/booking/schemas'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { canAssignHosts } from '@/lib/roles'
import { coachOptions, sharedHosts } from './hosts'

export const metadata: Metadata = { title: 'Booking pages' }

type Row = {
  id: string
  title: string
  slug: string
  description: string | null
  duration_minutes: number
  location_type: BookingPageInput['locationType']
  price_cents: number | null
  active: boolean
  host_membership_id: string | null
}

const locationLabels = { video_link: 'Video call', zoom: 'Zoom', phone: 'Phone call', in_person: 'In person' } satisfies Record<Row['location_type'], string>

function BookingPageCard({ page, host, publicPath, canEdit }: { page: Row; host: string; publicPath: string; canEdit: boolean }) {
  const action = canEdit ? 'Edit page' : 'View details'
  return (
    <Card className="gap-4 pb-0">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-base leading-snug font-semibold break-words">{page.title}</h2>
          <StatusBadge tone={page.active ? 'success' : 'neutral'}>{page.active ? 'Live' : 'Off'}</StatusBadge>
        </div>
        {page.description && <CardDescription className="line-clamp-2 break-words">{page.description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4">
        {canEdit && (
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{page.price_cents === null ? 'Free' : formatCents(page.price_cents)}</span>
            {page.price_cents !== null && <span className="text-muted-foreground text-sm">/ booking</span>}
          </div>
        )}
        <dl className="bg-muted/60 grid grid-cols-2 gap-3 rounded-lg px-3 py-2.5">
          <div>
            <dt className="text-muted-foreground text-xs">Duration</dt>
            <dd className="mt-0.5 text-sm font-medium">{page.duration_minutes} min</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Meeting type</dt>
            <dd className="mt-0.5 text-sm font-medium">{locationLabels[page.location_type]}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground text-xs">Host</dt>
            <dd className="mt-0.5 text-sm font-medium break-words">{host}</dd>
          </div>
        </dl>
        <p className="text-muted-foreground font-mono text-xs break-all">schedulefa.st{publicPath}</p>
      </CardContent>
      <CardFooter className="mt-auto flex-wrap justify-between gap-2 border-t py-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/booking-pages/${page.id}`} aria-label={`${action}: ${page.title}`}>{action} <ArrowRight aria-hidden="true" /></Link>
        </Button>
        {page.active && (
          <Button asChild variant="ghost" size="sm">
            <a href={publicPath} target="_blank" rel="noreferrer" aria-label={`Open page: ${page.title}`}>Open page <ExternalLink aria-hidden="true" /></a>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

export default async function BookingPagesPage() {
  const { business, membership } = await requireWorkspace()
  const manager = canAssignHosts(membership.role)
  const supabase = await createClient()
  const [{ data: pages, error }, coaches, shared] = await Promise.all([
    supabase.from('booking_pages')
      .select('id, title, slug, description, duration_minutes, location_type, price_cents, active, host_membership_id')
      .eq('business_id', business.id)
      .order('created_at')
      .returns<Row[]>(),
    coachOptions(business.id),
    sharedHosts(business.id),
  ])
  const nameOf = new Map(coaches.map((c) => [c.id, c.name]))
  const hostLabel = (p: Row) => {
    if (p.host_membership_id) return p.host_membership_id === membership.id ? 'You' : nameOf.get(p.host_membership_id) ?? 'Former coach'
    const hosts = shared.get(p.id) ?? []
    if (hosts.length === 0) return 'No coaches chosen'
    if (hosts.length === 1) return hosts[0] === membership.id ? 'You' : nameOf.get(hosts[0]) ?? '1 selected coach'
    return `Any of ${hosts.length} coaches`
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Booking pages</h1>
          <p className="text-muted-foreground mt-1 text-sm">{manager ? 'Pages families use to book a call with you or your coaches, like a free intro call.' : 'Pages families use to book a call with you, like a free intro call.'}</p>
        </div>
        <Button asChild><Link href="/app/booking-pages/new"><Plus /> New booking page</Link></Button>
      </div>
      {error ? (
        <Alert variant="destructive"><AlertDescription>Couldn’t load booking pages. Refresh the page to try again.</AlertDescription></Alert>
      ) : !pages?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No booking pages yet</CardTitle>
            <CardDescription>Create one, share its link, and families can book times that fit your availability.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,21rem),1fr))] gap-4">
          {pages.map((page) => (
            <BookingPageCard key={page.id} page={page} host={hostLabel(page)} publicPath={`/b/${business.slug}/${page.slug}`} canEdit={manager || page.host_membership_id === membership.id} />
          ))}
        </div>
      )}
    </div>
  )
}
