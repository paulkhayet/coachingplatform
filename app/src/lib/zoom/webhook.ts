import { createHmac, timingSafeEqual } from 'node:crypto'

// Zoom event notifications (D-066). Zoom signs each request with the app's secret token:
//   x-zm-signature = "v0=" + HMAC-SHA256(secret, "v0:" + x-zm-request-timestamp + ":" + raw body), hex.
// When the endpoint is saved, Zoom first sends an endpoint.url_validation event whose plainToken must be
// echoed back with its HMAC.

const MAX_AGE_SECONDS = 5 * 60

export function zoomSignature(secret: string, timestamp: string, body: string) {
  return `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`
}

/** True when the request really came from Zoom, recently (old requests can't be replayed). */
export function verifyZoomRequest(secret: string, headers: { signature: string | null; timestamp: string | null }, body: string, now = Date.now()) {
  if (!secret || !headers.signature || !headers.timestamp || !/^\d+$/.test(headers.timestamp)) return false
  const ts = Number(headers.timestamp)
  // Zoom sends milliseconds; accept seconds too.
  const ms = ts > 1e12 ? ts : ts * 1000
  if (Math.abs(now - ms) > MAX_AGE_SECONDS * 1000) return false
  const expected = Buffer.from(zoomSignature(secret, headers.timestamp, body))
  const given = Buffer.from(headers.signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** The answer to Zoom's endpoint.url_validation challenge. */
export function urlValidationResponse(secret: string, plainToken: string) {
  return { plainToken, encryptedToken: createHmac('sha256', secret).update(plainToken).digest('hex') }
}
