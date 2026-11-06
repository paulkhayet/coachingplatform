import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret } from './crypto'

const key = randomBytes(32).toString('base64')

describe('encryptSecret', () => {
  it('round-trips and never repeats a ciphertext', () => {
    const a = encryptSecret('1//refresh-token', key)
    const b = encryptSecret('1//refresh-token', key)
    expect(a).not.toBe(b)
    expect(a).not.toContain('refresh-token')
    expect(decryptSecret(a, key)).toBe('1//refresh-token')
  })

  it('rejects tampering and the wrong key', () => {
    const sealed = encryptSecret('secret', key)
    const parts = sealed.split('.')
    parts[3] = Buffer.from('tampered').toString('base64url')
    expect(() => decryptSecret(parts.join('.'), key)).toThrow()
    expect(() => decryptSecret(sealed, randomBytes(32).toString('base64'))).toThrow()
  })

  it('refuses a key of the wrong size', () => {
    expect(() => encryptSecret('x', Buffer.from('short').toString('base64'))).toThrow(/32 bytes/)
  })
})
