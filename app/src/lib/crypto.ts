import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// AES-256-GCM for secrets we must store (Google refresh tokens). The key comes from the environment
// and never touches the database, so a database leak alone doesn't expose the tokens.
// Format: "v1.<iv>.<tag>.<ciphertext>", each part base64url.

const VERSION = 'v1'

function key(base64Key: string) {
  const k = Buffer.from(base64Key, 'base64')
  if (k.length !== 32) throw new Error('The encryption key must be 32 bytes, base64-encoded (openssl rand -base64 32).')
  return k
}

export function encryptSecret(plaintext: string, base64Key: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(base64Key), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptSecret(sealed: string, base64Key: string): string {
  const [version, iv, tag, ciphertext] = sealed.split('.')
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error('Unrecognized encrypted value')
  const decipher = createDecipheriv('aes-256-gcm', key(base64Key), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8')
}
