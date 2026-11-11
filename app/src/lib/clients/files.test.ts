import { describe, expect, it } from 'vitest'
import { cleanFileName, clientFileType, formatFileSize, matchesClientFileType } from './files'

const bytes = (...parts: (string | number[])[]) => {
  const out: number[] = []
  for (const part of parts) out.push(...(typeof part === 'string' ? [...part].map((c) => c.charCodeAt(0)) : part))
  while (out.length < 16) out.push(0)
  return new Uint8Array(out)
}

describe('client files', () => {
  it('picks the upload type from the browser, or from the extension when the browser gives none', () => {
    expect(clientFileType('essay.pdf', 'application/pdf')).toBe('application/pdf')
    expect(clientFileType('IMG_0001.HEIC', '')).toBe('image/heic')
    expect(clientFileType('voice.m4a', 'audio/x-m4a')).toBe('audio/x-m4a')
    expect(clientFileType('page.html', 'text/html')).toBeNull()
    expect(clientFileType('logo.svg', 'image/svg+xml')).toBeNull()
    expect(clientFileType('setup.exe', '')).toBeNull()
  })

  it('accepts uploads only when their bytes match the type', () => {
    expect(matchesClientFileType(bytes('%PDF-1.7'), 'application/pdf')).toBe(true)
    expect(matchesClientFileType(bytes('<html><body>'), 'application/pdf')).toBe(false)
    expect(matchesClientFileType(bytes([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg')).toBe(true)
    expect(matchesClientFileType(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]), 'image/png')).toBe(true)
    expect(matchesClientFileType(bytes('RIFF', [0, 0, 0, 0], 'WEBP'), 'image/webp')).toBe(true)
    expect(matchesClientFileType(bytes([0, 0, 0, 24], 'ftypheic'), 'image/heic')).toBe(true)
    expect(matchesClientFileType(bytes([0, 0, 0, 24], 'ftypM4A '), 'audio/x-m4a')).toBe(true)
    expect(matchesClientFileType(bytes('PK', [3, 4]), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true)
    expect(matchesClientFileType(bytes('ID3'), 'audio/mpeg')).toBe(true)
    expect(matchesClientFileType(bytes('%PDF'), 'text/html')).toBe(false)
    expect(matchesClientFileType(new Uint8Array(4), 'application/pdf')).toBe(false)
  })

  it('cleans names and formats sizes', () => {
    expect(cleanFileName('../../etc/passwd')).toBe('..-..-etc-passwd')
    expect(cleanFileName(`${'a'.repeat(300)}.pdf`)).toMatch(/^a{196}\.pdf$/)
    expect(formatFileSize(900)).toBe('900 B')
    expect(formatFileSize(250 * 1024)).toBe('250 KB')
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})
