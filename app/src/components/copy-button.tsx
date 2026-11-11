'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Copies `text` and confirms for a moment. */
export function CopyButton({ text, label = 'Copy link' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked: the link is still visible to copy by hand */
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={`${label}: ${text}`}>
      {copied ? <Check /> : <Copy />} {copied ? 'Copied' : label}
    </Button>
  )
}
