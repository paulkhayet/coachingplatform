import type { Metadata } from 'next'
import { TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'
import { canManageBookings } from '@/lib/roles'
import { cancelBookingAction } from '../booking-pages/actions'

export const metadata: Metadata = { title: 'Bookings' }

type Row = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  guest_name: string
  guest_email: string
  guest_notes: string | null
  host_membership_id: string
  calendar_sync_error: string | null
  google_event_id: string | null
}

export default async function BookingsPage() {
  const { business, membership } = await requireWorkspace()
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('bookings')
    .select('id, title, starts_at, ends_at, guest_name, guest_email, guest_notes, host_membership_id, calendar_sync_error, google_event_id')
    .eq('business_id', business.id)
    .eq('status', 'confirmed')
    .gt('ends_at', new Date().toISOString())
    .order('starts_at')
    .limit(200)
    .returns<Row[]>()

  const day = new Intl.DateTimeFormat('en-US', { timeZone: business.timezone, weekday: 'short', month: 'short', day: 'numeric' })
  const time = new Intl.DateTimeFormat('en-US', { timeZone: business.timezone, hour: 'numeric', minute: '2-digit' })

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Upcoming calls booked through your booking pages. Times are in your business time zone.</p>
      </div>
      {!rows?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No upcoming bookings</CardTitle>
            <CardDescription>When someone books through one of your pages, it shows up here.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((b) => (
            <Card key={b.id} className="py-4">
              <CardContent className="flex flex-wrap items-start gap-4">
                <div className="w-28 shrink-0">
                  <p className="text-sm font-medium">{day.format(new Date(b.starts_at))}</p>
                  <p className="text-muted-foreground text-xs">{time.format(new Date(b.starts_at))} – {time.format(new Date(b.ends_at))}</p>
                </div>
                <div className="grid min-w-0 flex-1 gap-1">
                  <p className="text-sm font-medium">{b.title} with {b.guest_name}</p>
                  <p className="text-muted-foreground truncate text-xs">{b.guest_email}</p>
                  {b.guest_notes && <p className="text-muted-foreground line-clamp-2 text-xs whitespace-pre-line">“{b.guest_notes}”</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {b.google_event_id && <Badge variant="outline">On Google Calendar</Badge>}
                    {b.calendar_sync_error && <Badge variant="outline" className="text-warning"><TriangleAlert /> Not on Google Calendar</Badge>}
                  </div>
                </div>
                {canManageBookings(membership, b.host_membership_id) && (
                  <form action={cancelBookingAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <Button type="submit" variant="ghost" size="sm">Cancel</Button>
                  </form>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
