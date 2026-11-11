'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { MAX_PROFILE_PHOTO_BYTES, PROFILE_PHOTOS, profilePhotoType } from '@/lib/profile-photo'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'

export type ProfileState = { ok?: boolean; message?: string }

export async function saveProfileName(_state: ProfileState, form: FormData): Promise<ProfileState> {
  const { user } = await requireWorkspace()
  const name = z.string().trim().min(1).max(80).safeParse(form.get('name'))
  if (!name.success) return { message: 'Enter a name of 1 to 80 characters.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('profiles').update({ full_name: name.data }).eq('id', user.id).select('id')
  if (error || !data?.length) return { message: 'We couldn’t save your name. Try again.' }
  revalidatePath('/app', 'layout')
  return { ok: true, message: 'Name saved.' }
}

export async function saveProfilePhoto(previousPath: string | null, _state: ProfileState, form: FormData): Promise<ProfileState> {
  const { user } = await requireWorkspace()
  if (previousPath !== user.avatarPath) return { message: 'Your profile photo changed. Reload the page and try again.' }

  const supabase = await createClient()
  const photos = supabase.storage.from(PROFILE_PHOTOS)
  const remove = form.get('intent') === 'remove'
  let path: string | null = null
  if (!remove) {
    const file = form.get('photo')
    if (!(file instanceof File) || !file.size || file.size > MAX_PROFILE_PHOTO_BYTES) return { message: 'Choose an image up to 750 KB.' }
    const bytes = Buffer.from(await file.arrayBuffer())
    const type = profilePhotoType(bytes)
    if (!type) return { message: 'Choose a JPG, PNG, or WebP image.' }
    path = `${user.id}/${randomUUID()}.${type.extension}`
    const { error } = await photos.upload(path, bytes, { contentType: type.mime })
    if (error) return { message: 'We couldn’t upload the photo. Try again.' }
  }

  const update = supabase.from('profiles').update({ avatar_path: path }).eq('id', user.id)
  const scoped = previousPath ? update.eq('avatar_path', previousPath) : update.is('avatar_path', null)
  const { data, error } = await scoped.select('id')
  if (error || !data?.length) {
    // If the response was lost after committing, leave the upload intact for the saved profile.
    if (!error && path) await photos.remove([path])
    return { message: 'We couldn’t save the photo. Reload your profile and try again.' }
  }
  if (previousPath) await photos.remove([previousPath])
  revalidatePath('/app', 'layout')
  return { ok: true, message: remove ? 'Photo removed.' : 'Photo saved.' }
}
