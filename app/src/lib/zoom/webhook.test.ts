import { describe, expect, it } from 'vitest'
import { urlValidationResponse, verifyZoomRequest, zoomSignature } from './webhook'

describe('Zoom notifications (D-066)', () => {
  const secret = 'test-secret-token'
  const body = '{"event":"app_deauthorized","payload":{"user_id":"abc"}}'
  const now = 1_800_000_000_000
  const timestamp = String(now)

  it('accepts a recent request signed with the secret', () => {
    expect(verifyZoomRequest(secret, { signature: zoomSignature(secret, timestamp, body), timestamp }, body, now)).toBe(true)
  })

  it('rejects a wrong signature, a changed body, a missing header or an old request', () => {
    const signature = zoomSignature(secret, timestamp, body)
    expect(verifyZoomRequest(secret, { signature: zoomSignature('other', timestamp, body), timestamp }, body, now)).toBe(false)
    expect(verifyZoomRequest(secret, { signature, timestamp }, body.replace('abc', 'xyz'), now)).toBe(false)
    expect(verifyZoomRequest(secret, { signature: null, timestamp }, body, now)).toBe(false)
    expect(verifyZoomRequest(secret, { signature, timestamp }, body, now + 10 * 60_000)).toBe(false)
    expect(verifyZoomRequest('', { signature, timestamp }, body, now)).toBe(false)
  })

  it('answers the address check with the token and its HMAC', () => {
    // Matches Zoom's documented example: HMAC-SHA256 of the plain token, hex.
    const r = urlValidationResponse(secret, 'qgg8vlvZRS6UYooatFL8Aw')
    expect(r.plainToken).toBe('qgg8vlvZRS6UYooatFL8Aw')
    expect(r.encryptedToken).toMatch(/^[0-9a-f]{64}$/)
  })
})
