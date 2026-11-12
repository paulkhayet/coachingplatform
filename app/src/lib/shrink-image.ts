// Shrinks a chosen photo or logo in the browser before it's uploaded. Server actions accept at most
// 1 MB, and a phone photo is often several MB; a profile photo or logo never needs more than this.

const MAX_SIDE = 512
/** What the profile-photo and logo actions accept (they check again on the server). */
export const IMAGE_UPLOAD_MAX_BYTES = 750 * 1024

/** Checks a chosen image and shrinks it to fit the upload limit; returns a message when it can't be used. */
export async function prepareImage(file: File, keepAlpha = false): Promise<File | string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return 'Choose a JPG, PNG, or WebP image.'
  const small = await shrinkImage(file, IMAGE_UPLOAD_MAX_BYTES, keepAlpha)
  return small ?? 'This image couldn’t be read. Try a different JPG, PNG, or WebP file.'
}

function encode(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Returns a copy at most 512 px on its longest side, as WebP (or PNG/JPEG where the browser can't
 * encode WebP), under `maxBytes`. Keeps transparency when `keepAlpha` is set (logos).
 * Returns null if the image can't be read, so the caller can show a message.
 */
export async function shrinkImage(file: File, maxBytes: number, keepAlpha = false): Promise<File | null> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return null
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  if (!keepAlpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  for (const quality of [0.86, 0.75, 0.6]) {
    let blob = await encode(canvas, 'image/webp', quality)
    // Older Safari returns PNG when asked for WebP; use PNG for logos (transparency) or JPEG for photos.
    if (blob && blob.type !== 'image/webp') blob = keepAlpha ? await encode(canvas, 'image/png') : await encode(canvas, 'image/jpeg', quality)
    if (blob && blob.size <= maxBytes) {
      const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
      return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.${ext}`, { type: blob.type })
    }
  }
  return null
}
