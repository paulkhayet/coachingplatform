'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, EyeOff, FileText, Loader2, Trash2, Upload, Users } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CLIENT_FILE_ACCEPT, CLIENT_FILE_HINT, MAX_CLIENT_FILE_BYTES, clientFileType, formatFileSize } from '@/lib/clients/files'
import { deleteClientFile, finishClientFileUpload, startClientFileUpload } from './file-actions'
import { setFileShared } from './family-actions'

export type ClientFileRow = { id: string; file_name: string; size_bytes: number; created_at: string; uploaded_by: string | null; shared_with_family: boolean; uploader: string; canDelete: boolean }

/** Sends the file straight to Storage with the one-time link (the same request supabase-js makes). */
async function putFile(url: string, file: File, type: string) {
  const body = new FormData()
  body.append('cacheControl', '3600')
  body.append('', new File([file], file.name, { type }))
  const res = await fetch(url, { method: 'PUT', body, headers: { 'x-upsert': 'false' } })
  return res.ok
}

export function ClientFiles({ businessId, clientId, files, timezone }: { businessId: string; clientId: string; files: ClientFileRow[]; timezone: string }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const date = new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric' })

  async function upload(list: FileList | null) {
    const chosen = Array.from(list ?? [])
    if (input.current) input.current.value = ''
    if (!chosen.length) return
    setError(null)
    const problems: string[] = []
    for (const file of chosen) {
      const type = clientFileType(file.name, file.type)
      if (!type) { problems.push(`${file.name}: this type of file can’t be uploaded.`); continue }
      if (file.size > MAX_CLIENT_FILE_BYTES) { problems.push(`${file.name}: files can be up to 25 MB.`); continue }
      setBusy(`Uploading ${file.name}…`)
      const started = await startClientFileUpload(businessId, clientId, { fileName: file.name, mimeType: type, size: file.size })
      if (!started.ok) { problems.push(`${file.name}: ${started.message}`); continue }
      const sent = await putFile(started.uploadUrl, file, type).catch(() => false)
      const finished = await finishClientFileUpload(businessId, started.fileId)
      if (!sent || !finished.ok) problems.push(`${file.name}: ${finished.ok ? 'the upload failed. Try again.' : finished.message}`)
    }
    setBusy(null)
    if (problems.length) setError(problems.join(' '))
    startTransition(() => router.refresh())
  }

  async function toggleShared(file: ClientFileRow) {
    setError(null)
    setBusy(file.shared_with_family ? `Unsharing ${file.file_name}…` : `Sharing ${file.file_name}…`)
    const result = await setFileShared(businessId, file.id, !file.shared_with_family)
    setBusy(null)
    if (result.message) setError(result.message)
    startTransition(() => router.refresh())
  }

  async function remove(file: ClientFileRow) {
    if (!window.confirm(`Delete “${file.file_name}”? This can’t be undone.`)) return
    setError(null)
    setBusy(`Deleting ${file.file_name}…`)
    const result = await deleteClientFile(businessId, file.id)
    setBusy(null)
    if (result.message) setError(result.message)
    startTransition(() => router.refresh())
  }

  return (
    <div className="grid gap-4">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {files.length ? (
        <ul className="divide-y">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <a href={`/app/files/${file.id}`} className="block truncate text-sm font-medium hover:underline">{file.file_name}</a>
                <p className="text-muted-foreground text-xs">{formatFileSize(file.size_bytes)} · {date.format(new Date(file.created_at))} · {file.uploader}
                  {file.shared_with_family && <span className="text-primary font-medium"> · Shared with family</span>}</p>
              </div>
              {file.canDelete && (
                <Button variant="ghost" size="sm" disabled={Boolean(busy)} onClick={() => toggleShared(file)}
                  aria-label={file.shared_with_family ? `Stop sharing ${file.file_name} with the family` : `Share ${file.file_name} with the family`}>
                  {file.shared_with_family ? <EyeOff /> : <Users />} <span className="hidden sm:inline">{file.shared_with_family ? 'Unshare' : 'Share with family'}</span>
                </Button>
              )}
              <Button asChild variant="ghost" size="icon-sm" aria-label={`Download ${file.file_name}`}>
                <a href={`/app/files/${file.id}`}><Download /></a>
              </Button>
              {file.canDelete && (
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${file.file_name}`} disabled={Boolean(busy)} onClick={() => remove(file)}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="text-muted-foreground text-sm">No files yet. Upload worksheets, notes or anything you want to keep with this client.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" multiple accept={CLIENT_FILE_ACCEPT} className="sr-only" id={`files-${clientId}`}
          onChange={(event) => upload(event.target.files)} disabled={Boolean(busy)} />
        <Button type="button" variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />} {busy ? 'Working…' : 'Upload files'}
        </Button>
        <p className="text-muted-foreground text-xs" aria-live="polite">{busy ?? CLIENT_FILE_HINT}</p>
      </div>
    </div>
  )
}
