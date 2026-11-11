import { CalendarDays, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { listCalendars, type CalendarSummary } from '@/lib/google/calendar'
import { calendarAllowed, isGoogleCalendarConfigured, lookupConnection } from '@/lib/google/server'
import { disconnectCalendar } from './actions'
import { CalendarChoicesForm } from './forms'

const outcomes: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'Google Calendar connected. Your busy times now block bookings.' },
  disconnected: { ok: true, text: 'Google Calendar disconnected, and schedulefa.st’s access was revoked.' },
  denied: { ok: false, text: 'Google Calendar wasn’t connected because access wasn’t allowed.' },
  missing_scopes: { ok: false, text: 'Please tick all three calendar permissions on Google’s screen. Without them we can’t check conflicts or add bookings.' },
  expired: { ok: false, text: 'That connection attempt expired. Try again.' },
  error: { ok: false, text: 'We couldn’t connect Google Calendar. Try again in a moment.' },
  not_available: { ok: false, text: 'Connecting Google Calendar isn’t available for your account yet.' },
  not_configured: { ok: false, text: 'Google Calendar isn’t set up on this server yet.' },
}

export async function CalendarCard({ userId, email, outcome }: { userId: string; email: string; outcome?: string }) {
  const message = outcome && Object.hasOwn(outcomes, outcome) ? outcomes[outcome] : undefined
  const allowed = isGoogleCalendarConfigured && calendarAllowed(email)
  const { connection, failed } = allowed ? await lookupConnection(userId) : { connection: undefined, failed: false }
  if (failed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays className="size-5" /> Google Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="warning"><TriangleAlert /><AlertDescription>We couldn’t check your Google Calendar connection just now. Refresh to try again.</AlertDescription></Alert>
        </CardContent>
      </Card>
    )
  }
  let calendars: CalendarSummary[] | null = null
  if (connection?.status === 'active') {
    try {
      calendars = await listCalendars(userId)
    } catch (e) {
      console.error('Listing Google calendars failed', e)
    }
  }
  // "primary" is Google's alias for the coach's main calendar; show it as that calendar.
  const primaryId = calendars?.find((c) => c.primary)?.id
  const resolve = (id: string) => (id === 'primary' && primaryId ? primaryId : id)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarDays className="size-5" /> Google Calendar</CardTitle>
        <CardDescription>Keep bookings off your busy times, and add each booking to your calendar. One connection works for every business you’re in.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {message && <Alert variant={message.ok ? 'success' : 'destructive'}><AlertDescription>{message.text}</AlertDescription></Alert>}

        {!allowed ? (
          <p className="text-muted-foreground text-sm">Connecting Google Calendar is coming soon. Until then, add time off for anything that should block bookings.</p>
        ) : !connection ? (
          <>
            <ul className="text-muted-foreground grid gap-1.5 text-sm">
              <li>• We check when you’re busy, without seeing what your events are.</li>
              <li>• We add bookings to a calendar you choose, and only ever change events we created.</li>
              <li>• You can disconnect at any time, here or in your Google account.</li>
            </ul>
            <Button asChild className="justify-self-start"><a href="/api/google/connect">Connect Google Calendar</a></Button>
          </>
        ) : connection.status !== 'active' ? (
          <>
            <Alert variant="warning"><TriangleAlert /><AlertDescription>{connection.lastError ?? 'Google Calendar needs to be reconnected.'} Until then, bookings can’t see your busy times.</AlertDescription></Alert>
            <div className="flex flex-wrap gap-2">
              <Button asChild><a href="/api/google/connect">Reconnect Google Calendar</a></Button>
              <form action={disconnectCalendar}><Button type="submit" variant="ghost">Disconnect</Button></form>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm">Connected as <span className="font-medium">{connection.googleEmail}</span></p>
            {calendars ? (
              <CalendarChoicesForm
                calendars={calendars}
                busy={connection.busyCalendarIds.map(resolve)}
                destination={connection.destinationCalendarId ? resolve(connection.destinationCalendarId) : (primaryId ?? '')}
              />
            ) : (
              <Alert variant="warning"><TriangleAlert /><AlertDescription>We couldn’t load your calendars from Google just now. Refresh to try again.</AlertDescription></Alert>
            )}
            <form action={disconnectCalendar}><Button type="submit" variant="outline" size="sm">Disconnect Google Calendar</Button></form>
          </>
        )}
      </CardContent>
    </Card>
  )
}
