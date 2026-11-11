import { supabaseUrl } from '@/lib/env'

// Business logos (D-071) live in the public `business-logos` bucket at `{business_id}/{uuid}.{ext}`.
// Each upload gets a new name, so the public URL can be cached for as long as the logo is in use.

export const BUSINESS_LOGOS = 'business-logos'
export const MAX_LOGO_BYTES = 750 * 1024 // under the 1 MB server-action body limit

export function businessLogoUrl(path: string | null | undefined) {
  return path ? `${supabaseUrl}/storage/v1/object/public/${BUSINESS_LOGOS}/${path}` : null
}
