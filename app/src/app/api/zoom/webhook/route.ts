import { eq } from 'drizzle-orm'
import { adminDb } from '@/db/server'
import { zoomConnections } from '@/db/schema'
import { urlValidationResponse, verifyZoomRequest } from '@/lib/zoom/webhook'

// Zoom tells us when someone removes schedulefa.st from their Zoom account (app_deauthorized). We then
// forget their connection and tokens, as Zoom requires (D-066). Every request must be signed by Zoom.

export async function POST(request: Request) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? ''
  if (!secret) return new Response('Zoom notifications are not configured', { status: 503 })
  // The signature covers the exact bytes Zoom sent, so read the raw body before parsing.
  const body = await request.text()
  if (!verifyZoomRequest(secret, { signature: request.headers.get('x-zm-signature'), timestamp: request.headers.get('x-zm-request-timestamp') }, body)) {
    return new Response('Invalid Zoom signature', { status: 401 })
  }
  let event: { event?: string; payload?: { plainToken?: string; user_id?: string } }
  try {
    event = JSON.parse(body)
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  if (event.event === 'endpoint.url_validation' && event.payload?.plainToken) {
    return Response.json(urlValidationResponse(secret, event.payload.plainToken))
  }
  if (event.event === 'app_deauthorized' && event.payload?.user_id) {
    // Tokens go with the connection (foreign key cascade). Meetings already created stay on their Zoom account.
    const removed = await adminDb().delete(zoomConnections).where(eq(zoomConnections.zoomUserId, event.payload.user_id)).returning({ userId: zoomConnections.userId })
    return Response.json({ received: true, removed: removed.length })
  }
  return Response.json({ received: true })
}
