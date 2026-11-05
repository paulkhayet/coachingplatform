// NEXT_PUBLIC_* values are inlined at build time, so they're safe to read anywhere.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3100').replace(/\/$/, '')

/** False until the Supabase keys are added, so the app can show setup instructions instead of crashing. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)
