import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'

export const metadata: Metadata = { title: 'Booking pages' }

type Row = { id: string; title: string; slug: string; duration_minutes: number; active: boolean; host_membership_id: string }

export default async function BookingPagesPage() {
  const { business } = await requireWorkspace()
  const supabase = await createClient()
  const { data: pages } = await supabase
    .from('booking_pages')
    .select('id, title, slug, duration_minutes, active, host_membership_id')
    .eq('business_id', business.id)
    .order('created_at')
    .returns<Row[]>()

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Booking pages</h1>
          <p className="text-muted-foreground mt-1 text-sm">Pages families use to book a call with you, like a free intro call.</p>
        </div>
        <Button asChild><Link href="/app/booking-pages/new"><Plus /> New booking page</Link></Button>
      </div>
      {!pages?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No booking pages yet</CardTitle>
            <CardDescription>Create one, share its link, and families can book times that fit your availability.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {pages.map((p) => (
            <Card key={p.id} className="py-4">
              <CardContent className="flex flex-wrap items-center gap-3">
                <div className="grid min-w-0 flex-1">
                  <Link href={`/app/booking-pages/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                  <span className="text-muted-foreground truncate text-xs">{p.duration_minutes} min · schedulefa.st/b/{business.slug}/{p.slug}</span>
                </div>
                {p.active ? <Badge variant="accent">Live</Badge> : <Badge variant="outline">Off</Badge>}
                {p.active && (
                  <Button asChild variant="outline" size="sm"><a href={`/b/${business.slug}/${p.slug}`} target="_blank" rel="noreferrer">Open <ExternalLink /></a></Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
