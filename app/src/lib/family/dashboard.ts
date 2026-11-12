import 'server-only'
import { eq } from 'drizzle-orm'
import { adminDb } from '@/db/server'
import { memberships, profiles, type AssignedPackageTerms } from '@/db/schema'
import { createClient } from '@/lib/supabase/server'
import type { FamilyLink } from './access'

// D-073: everything a guardian sees is read as the guardian, so row-level security decides what comes
// back (their linked clients only, and only what each permission allows). The one exception is the
// coach's name, which guardians can't read directly; it's looked up for the client already returned.

export type FamilySession = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  status: string
  location_type: 'video_link' | 'phone' | 'in_person' | 'zoom'
  location_detail: string | null
  credit_covered_at: string | null
  attended_at: string | null
  unpaid_cancelled: boolean
}
export type FamilyCredit = {
  id: string; client_package_id: string; name: string; kind: 'fixed' | 'monthly'; starts_on: string; ends_on: string
  credit_units: number; funded_units: number; reserved_units: number; used_units: number; forfeited_units: number
  expired_units: number; unpaid_reserved_units: number; waiting_reserved_units: number; paid_cents: number | null
}
export type FamilyFile = { id: string; file_name: string; size_bytes: number; created_at: string }

export interface FamilyStudent {
  link: FamilyLink
  client: { id: string; name: string }
  business: { id: string; name: string; timezone: string; logo_path: string | null; contact_email: string | null }
  coachName: string | null
  upcoming: FamilySession[]
  past: FamilySession[]
  credits: (FamilyCredit & { priceCents: number | null })[]
  files: FamilyFile[]
  failed: boolean
}

const SESSION_COLUMNS = 'id, title, starts_at, ends_at, status, location_type, location_detail, credit_covered_at, attended_at, unpaid_cancelled'

export async function loadFamilyStudent(link: FamilyLink): Promise<FamilyStudent | null> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const [client, business, upcoming, past, credits, terms, files] = await Promise.all([
    supabase.from('coaching_clients').select('id, name, coach_membership_id').eq('id', link.client_id).maybeSingle<{ id: string; name: string; coach_membership_id: string | null }>(),
    supabase.from('businesses').select('id, name, timezone, logo_path, contact_email').eq('id', link.business_id).maybeSingle<FamilyStudent['business']>(),
    link.can_view_sessions
      ? supabase.from('bookings').select(SESSION_COLUMNS).eq('coaching_client_id', link.client_id).eq('status', 'confirmed').gt('ends_at', now).order('starts_at').limit(20).returns<FamilySession[]>()
      : { data: [], error: null },
    link.can_view_sessions
      ? supabase.from('bookings').select(SESSION_COLUMNS).eq('coaching_client_id', link.client_id).in('status', ['confirmed', 'cancelled']).lte('starts_at', now).order('starts_at', { ascending: false }).limit(10).returns<FamilySession[]>()
      : { data: [], error: null },
    link.can_view_credits
      ? supabase.rpc('client_credit_balances', { p_business_id: link.business_id, p_client_id: link.client_id }).returns<FamilyCredit[]>()
      : { data: [], error: null },
    link.can_view_credits
      ? supabase.from('client_packages').select('id, terms').eq('client_id', link.client_id).returns<{ id: string; terms: AssignedPackageTerms }[]>()
      : { data: [], error: null },
    supabase.from('client_files').select('id, file_name, size_bytes, created_at').eq('client_id', link.client_id).order('created_at', { ascending: false }).limit(100).returns<FamilyFile[]>(),
  ])
  if (!client.data || !business.data) return null
  const coach = client.data.coach_membership_id
    ? (await adminDb().select({ name: profiles.fullName }).from(memberships).innerJoin(profiles, eq(profiles.id, memberships.userId))
      .where(eq(memberships.id, client.data.coach_membership_id)))[0]?.name ?? null
    : null
  const priceByPackage = new Map((terms.data ?? []).map((t) => [t.id, t.terms.priceCents ?? null]))
  return {
    link,
    client: { id: client.data.id, name: client.data.name },
    business: business.data,
    coachName: coach,
    upcoming: upcoming.data ?? [],
    past: past.data ?? [],
    credits: (Array.isArray(credits.data) ? credits.data : []).map((c) => ({ ...c, priceCents: priceByPackage.get(c.client_package_id) ?? null })),
    files: files.data ?? [],
    failed: Boolean(upcoming.error || past.error || credits.error || terms.error || files.error),
  }
}
