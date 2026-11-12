'use server'

import { randomUUID } from 'node:crypto'
import { and, eq, lt, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { clientFiles } from '@/db/schema'
import { adminDb } from '@/db/server'
import {
  BUSINESS_FILE_QUOTA_BYTES, CLIENT_FILES_BUCKET, MAX_CLIENT_FILE_BYTES, cleanFileName, isAllowedClientFileType, matchesClientFileType,
} from '@/lib/clients/files'
import { checkFeature } from '@/lib/billing/server'
import { canManageClients } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'

// D-070. The browser never writes client_files: these actions check access through row-level
// security (the signed-in user's Supabase client), then write the row with the server connection.
// File bytes go straight from the browser to Storage with a one-time upload link, so large files
// never pass through a Vercel function.

export type StartUpload = { ok: true; fileId: string; uploadUrl: string } | { ok: false; message: string }
export type FinishUpload = { ok: true } | { ok: false; message: string }

const uuid = z.uuid()
const request = z.object({
  fileName: z.string().transform(cleanFileName).pipe(z.string().min(1, 'This file needs a name.')),
  mimeType: z.string().refine(isAllowedClientFileType, 'This type of file can’t be uploaded.'),
  size: z.number().int().min(1, 'This file is empty.').max(MAX_CLIENT_FILE_BYTES, 'Files can be up to 25 MB.'),
})
const STALE_PENDING = 3 * 60 * 60 * 1000

export async function startClientFileUpload(businessId: string, clientId: string, input: { fileName: string; mimeType: string; size: number }): Promise<StartUpload> {
  const { business, user } = await requireWorkspace()
  if (business.id !== businessId) return { ok: false, message: 'You switched businesses. Reload the page and try again.' }
  if (!uuid.safeParse(clientId).success) return { ok: false, message: 'This client could not be found.' }
  const parsed = request.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'This file can’t be uploaded.' }

  const supabase = await createClient()
  const { data: client } = await supabase.from('coaching_clients').select('id').eq('id', clientId).eq('business_id', businessId).maybeSingle()
  if (!client) return { ok: false, message: 'You don’t have access to this client.' }
  const blocked = await checkFeature(businessId, 'clients')
  if (blocked) return { ok: false, message: blocked }

  const db = adminDb()
  await clearStalePending(user.id)
  const [{ used }] = await db.select({ used: sql<number>`coalesce(sum(${clientFiles.sizeBytes}), 0)::bigint` })
    .from(clientFiles).where(eq(clientFiles.businessId, businessId))
  if (Number(used) + parsed.data.size > BUSINESS_FILE_QUOTA_BYTES) return { ok: false, message: 'This business has used its 5 GB of file storage. Delete some files first.' }

  const id = randomUUID()
  const path = `${businessId}/${clientId}/${id}`
  // The declared size counts toward the quota until the upload is checked.
  await db.insert(clientFiles).values({ id, businessId, clientId, uploadedBy: user.id, fileName: parsed.data.fileName, path, mimeType: parsed.data.mimeType, sizeBytes: parsed.data.size })
  const { data, error } = await supabase.storage.from(CLIENT_FILES_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    await db.delete(clientFiles).where(eq(clientFiles.id, id))
    return { ok: false, message: 'The upload couldn’t start. Try again.' }
  }
  return { ok: true, fileId: id, uploadUrl: data.signedUrl }
}

/** Checks the uploaded bytes against the declared type and records the real size. */
export async function finishClientFileUpload(businessId: string, fileId: string): Promise<FinishUpload> {
  const { business, user } = await requireWorkspace()
  if (business.id !== businessId || !uuid.safeParse(fileId).success) return { ok: false, message: 'This upload could not be found.' }
  const supabase = await createClient()
  const { data: file } = await supabase.from('client_files').select('id, client_id, path, mime_type, status, uploaded_by')
    .eq('id', fileId).eq('business_id', businessId).maybeSingle<{ id: string; client_id: string; path: string; mime_type: string; status: string; uploaded_by: string | null }>()
  if (!file || file.uploaded_by !== user.id || file.status !== 'pending') return { ok: false, message: 'This upload could not be found.' }

  const bucket = supabase.storage.from(CLIENT_FILES_BUCKET)
  const reject = async (message: string) => {
    await bucket.remove([file.path])
    await adminDb().delete(clientFiles).where(eq(clientFiles.id, fileId))
    return { ok: false as const, message }
  }
  const { data: link } = await bucket.createSignedUrl(file.path, 60)
  if (!link) return reject('The upload didn’t arrive. Try again.')
  const res = await fetch(link.signedUrl, { headers: { Range: 'bytes=0-31' }, cache: 'no-store' })
  if (!res.ok) return reject('The upload didn’t arrive. Try again.')
  const head = new Uint8Array(await res.arrayBuffer())
  const size = Number(res.headers.get('content-range')?.split('/')[1] ?? (res.status === 200 ? head.length : NaN))
  if (!Number.isInteger(size) || size < 1 || size > MAX_CLIENT_FILE_BYTES) return reject('Files can be up to 25 MB.')
  if (!matchesClientFileType(head, file.mime_type)) return reject('This file’s contents don’t match its type, so it wasn’t saved.')

  await adminDb().update(clientFiles).set({ status: 'ready', sizeBytes: size })
    .where(and(eq(clientFiles.id, fileId), eq(clientFiles.status, 'pending')))
  revalidatePath(`/app/clients/${file.client_id}`)
  return { ok: true }
}

/** The uploader, or an owner or administrator, can delete a file. Storage policies enforce the same. */
export async function deleteClientFile(businessId: string, fileId: string): Promise<{ message?: string }> {
  const { business, membership, user } = await requireWorkspace()
  if (business.id !== businessId || !uuid.safeParse(fileId).success) return { message: 'This file could not be found.' }
  const supabase = await createClient()
  const { data: file } = await supabase.from('client_files').select('id, client_id, path, uploaded_by')
    .eq('id', fileId).eq('business_id', businessId).maybeSingle<{ id: string; client_id: string; path: string; uploaded_by: string | null }>()
  if (!file) return { message: 'This file could not be found.' }
  if (file.uploaded_by !== user.id && !canManageClients(membership.role)) return { message: 'Only the person who uploaded this file, or an owner or administrator, can delete it.' }
  const { error } = await supabase.storage.from(CLIENT_FILES_BUCKET).remove([file.path])
  if (error) return { message: 'The file couldn’t be deleted. Try again.' }
  await adminDb().delete(clientFiles).where(eq(clientFiles.id, fileId))
  revalidatePath(`/app/clients/${file.client_id}`)
  return {}
}

/** Uploads someone started and never finished: remove the object (if any) and the row. */
async function clearStalePending(userId: string) {
  const db = adminDb()
  const stale = await db.select({ id: clientFiles.id, path: clientFiles.path }).from(clientFiles)
    .where(and(eq(clientFiles.uploadedBy, userId), eq(clientFiles.status, 'pending'), lt(clientFiles.createdAt, new Date(Date.now() - STALE_PENDING))))
  if (!stale.length) return
  const supabase = await createClient()
  await supabase.storage.from(CLIENT_FILES_BUCKET).remove(stale.map((f) => f.path))
  for (const f of stale) await db.delete(clientFiles).where(eq(clientFiles.id, f.id))
}
