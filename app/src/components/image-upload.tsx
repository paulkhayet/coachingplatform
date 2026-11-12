'use client'

import { startTransition, useActionState, useId, useRef, useState } from 'react'
import { Camera, Loader2, Upload } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { prepareImage } from '@/lib/shrink-image'
import { cn } from '@/lib/utils'

export type ImageUploadState = { ok?: boolean; message?: string }

/**
 * One-step image picker for a profile photo or logo: the button (or the image itself) opens the file
 * picker, and choosing a file uploads it straight away. You can also drop an image onto the preview.
 * The image is shrunk in the browser first, since server actions refuse bodies over 1 MB.
 */
export function ImageUpload({ preview, field, hasImage, save, keepAlpha = false, label, hint, rounded = 'full' }: {
  /** The current image (or its placeholder), shown at the size it should appear. */
  preview: React.ReactNode
  /** Form field the server action reads the file from. */
  field: string
  hasImage: boolean
  save: (state: ImageUploadState, form: FormData) => Promise<ImageUploadState>
  keepAlpha?: boolean
  /** Noun used on the buttons, e.g. "photo" or "logo". */
  label: string
  hint: string
  rounded?: 'full' | 'lg'
}) {
  const [state, action, pending] = useActionState(save, {})
  const [problem, setProblem] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const busy = pending || preparing

  async function upload(file: File | undefined) {
    if (input.current) input.current.value = ''
    if (!file) return
    setProblem(null)
    setPreparing(true)
    const small = await prepareImage(file, keepAlpha)
    setPreparing(false)
    if (typeof small === 'string') return setProblem(small)
    const data = new FormData()
    data.set(field, small)
    startTransition(() => action(data))
  }

  function remove() {
    setProblem(null)
    const data = new FormData()
    data.set('intent', 'remove')
    startTransition(() => action(data))
  }

  const pick = () => input.current?.click()
  const message = problem ?? state.message
  return (
    <div className="flex flex-wrap items-start gap-4">
      <button type="button" onClick={pick} disabled={busy} aria-label={hasImage ? `Change ${label}` : `Upload ${label}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files[0]) }}
        className={cn('group focus-visible:ring-ring relative shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait',
          rounded === 'full' ? 'rounded-full' : 'rounded-lg', dragging && 'ring-primary ring-2 ring-offset-2')}>
        {preview}
        <span className={cn('absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
          rounded === 'full' ? 'rounded-full' : 'rounded-lg', (busy || dragging) && 'opacity-100')}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </span>
      </button>
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={pick} disabled={busy} aria-describedby={hintId}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />}
            {busy ? 'Saving…' : hasImage ? `Change ${label}` : `Upload ${label}`}
          </Button>
          {hasImage && <Button type="button" variant="ghost" onClick={remove} disabled={busy}>Remove</Button>}
        </div>
        <p id={hintId} className="text-muted-foreground text-xs">{hint}</p>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true"
          onChange={(e) => upload(e.target.files?.[0])} />
        {message && <Alert variant={problem || !state.ok ? 'destructive' : 'success'}><AlertDescription>{message}</AlertDescription></Alert>}
      </div>
    </div>
  )
}
