import { NextResponse } from 'next/server'
import { z } from 'zod'
import { CLIENT_FILES_BUCKET } from '@/lib/clients/files'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/workspace'

/**
 * Opens a client file (D-070). Row-level security decides whether the signed-in person may see it;
 * they are then sent to a one-minute Storage link that downloads the file as an attachment, so a
 * file is never rendered as a page on our domain.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()
  if (!user) return NextResponse.redirect(new URL('/sign-in', _req.url))
  if (!z.uuid().safeParse(id).success) return new NextResponse('Not found', { status: 404 })
  const supabase = await createClient()
  const { data: file } = await supabase.from('client_files').select('path, file_name').eq('id', id).eq('status', 'ready')
    .maybeSingle<{ path: string; file_name: string }>()
  if (!file) return new NextResponse('Not found', { status: 404 })
  const { data } = await supabase.storage.from(CLIENT_FILES_BUCKET).createSignedUrl(file.path, 60, { download: file.file_name })
  if (!data) return new NextResponse('This file is unavailable right now. Try again in a moment.', { status: 503 })
  return NextResponse.redirect(data.signedUrl, { headers: { 'Cache-Control': 'no-store' } })
}
