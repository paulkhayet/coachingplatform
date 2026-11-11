import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export const PROFILE_PHOTOS = 'profile-photos'
export const MAX_PROFILE_PHOTO_BYTES = 750 * 1024

export const profilePhotoUrl = cache(async (path: string | null) => {
  if (!path) return null
  const supabase = await createClient()
  const { data } = await supabase.storage.from(PROFILE_PHOTOS).createSignedUrl(path, 600)
  return data?.signedUrl ?? null
})

export function profilePhotoType(data: Buffer) {
  if (data.length < 12) return null
  if (data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return { extension: 'jpg', mime: 'image/jpeg' }
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { extension: 'png', mime: 'image/png' }
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return { extension: 'webp', mime: 'image/webp' }
  return null
}
