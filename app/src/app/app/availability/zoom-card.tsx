import { TriangleAlert, Video } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getZoomConnection, isZoomConfigured } from '@/lib/zoom/server'
import { disconnectZoomAction } from './actions'

const outcomes: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'Zoom connected. Bookings on Zoom pages now get their own meeting link.' },
  disconnected: { ok: true, text: 'Zoom disconnected, and schedulefa.st’s access was removed. Links already sent still work.' },
  denied: { ok: false, text: 'Zoom wasn’t connected because access wasn’t allowed.' },
  expired: { ok: false, text: 'That connection attempt expired. Try again.' },
  error: { ok: false, text: 'We couldn’t connect Zoom. Try again in a moment.' },
  not_configured: { ok: false, text: 'Zoom isn’t set up on this server yet.' },
}

/** D-038: each coach connects their own Zoom account; Zoom booking pages create a meeting per booking. */
export async function ZoomCard({ userId, outcome }: { userId: string; outcome?: string }) {
  if (!isZoomConfigured) return null
  const message = outcome ? outcomes[outcome] : undefined
  let connection: Awaited<ReturnType<typeof getZoomConnection>> | undefined
  let failed = false
  try {
    connection = await getZoomConnection(userId)
  } catch (error) {
    console.error('Looking up the Zoom connection failed', error)
    failed = true
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Video className="size-5" /> Zoom</CardTitle>
        <CardDescription>Give every booking its own Zoom meeting link, created on your Zoom account. One connection works for every business you’re in.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {message && <Alert variant={message.ok ? 'success' : 'destructive'}><AlertDescription>{message.text}</AlertDescription></Alert>}
        {failed ? (
          <Alert variant="warning"><TriangleAlert /><AlertDescription>We couldn’t check your Zoom connection just now. Refresh to try again.</AlertDescription></Alert>
        ) : !connection ? (
          <>
            <ul className="text-muted-foreground grid gap-1.5 text-sm">
              <li>• We create, move and delete meetings for your bookings, and nothing else.</li>
              <li>• Use it on booking pages set to “Zoom”.</li>
              <li>• You can disconnect at any time, here or in Zoom’s App Marketplace.</li>
            </ul>
            <Button asChild className="justify-self-start"><a href="/api/zoom/connect">Connect Zoom</a></Button>
          </>
        ) : connection.status !== 'active' ? (
          <>
            <Alert variant="warning"><TriangleAlert /><AlertDescription>{connection.lastError ?? 'Zoom needs to be reconnected.'} Until then, new bookings on Zoom pages won’t get a meeting link.</AlertDescription></Alert>
            <div className="flex flex-wrap gap-2">
              <Button asChild><a href="/api/zoom/connect">Reconnect Zoom</a></Button>
              <form action={disconnectZoomAction}><Button type="submit" variant="ghost">Disconnect</Button></form>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">Connected as <span className="font-medium">{connection.zoomEmail}</span></p>
            <form action={disconnectZoomAction}><Button type="submit" variant="ghost">Disconnect Zoom</Button></form>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
