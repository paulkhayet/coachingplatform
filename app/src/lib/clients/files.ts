// Rules for files kept on a client's record (D-070). Shared by the browser (to pick a type and fail
// fast) and the server (which checks the uploaded bytes before a file is shown to anyone).

export const CLIENT_FILES_BUCKET = 'client-files'
export const MAX_CLIENT_FILE_BYTES = 25 * 1024 * 1024
/** Total storage per business while plans have no storage tiers. */
export const BUSINESS_FILE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

/** Allowed types by extension. Must match the bucket's allowed_mime_types (drizzle/0027). */
export const CLIENT_FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic',
  docx: DOCX, xlsx: XLSX, pptx: PPTX,
  mp3: 'audio/mpeg', m4a: 'audio/mp4',
}
const ALLOWED = new Set([...Object.values(CLIENT_FILE_TYPES), 'audio/x-m4a'])

export const CLIENT_FILE_ACCEPT = Object.keys(CLIENT_FILE_TYPES).map((ext) => `.${ext}`).join(',')
export const CLIENT_FILE_HINT = 'PDF, Word, Excel, PowerPoint, images or audio, up to 25 MB.'

/** The type to upload as: the browser's type when allowed, else the one for the extension. */
export function clientFileType(fileName: string, browserType: string): string | null {
  if (ALLOWED.has(browserType)) return browserType
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  return CLIENT_FILE_TYPES[ext] ?? null
}

export function isAllowedClientFileType(mime: string) {
  return ALLOWED.has(mime)
}

/** Keeps a readable name without path separators or control characters. */
export function cleanFileName(name: string) {
  const cleaned = name.replace(/[\\/]/g, '-').replace(/[\u0000-\u001f\u007f]/g, '').trim()
  if (cleaned.length <= 200) return cleaned
  const dot = cleaned.lastIndexOf('.')
  const ext = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : ''
  return cleaned.slice(0, 200 - ext.length) + ext
}

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
const starts = (bytes: Uint8Array, sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b)

/**
 * Whether the first bytes of an upload match the type it was uploaded as. Needs at least 12 bytes.
 * Office files are zip archives, so any zip passes for those three types.
 */
export function matchesClientFileType(head: Uint8Array, mime: string): boolean {
  if (head.length < 12) return false
  const brand = ascii(head, 8, 12)
  const isoMedia = ascii(head, 4, 8) === 'ftyp'
  switch (mime) {
    case 'application/pdf': return ascii(head, 0, 5) === '%PDF-'
    case 'image/jpeg': return starts(head, [0xff, 0xd8, 0xff])
    case 'image/png': return starts(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/gif': return ascii(head, 0, 4) === 'GIF8'
    case 'image/webp': return ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP'
    case 'image/heic': return isoMedia && ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)
    case DOCX: case XLSX: case PPTX: return starts(head, [0x50, 0x4b, 0x03, 0x04])
    case 'audio/mpeg': return ascii(head, 0, 3) === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)
    case 'audio/mp4': case 'audio/x-m4a': return isoMedia && ['M4A ', 'M4B ', 'mp42', 'isom', 'iso2', 'dash'].includes(brand)
    default: return false
  }
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
