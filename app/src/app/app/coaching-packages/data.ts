import 'server-only'

import { redirect } from 'next/navigation'
import type { PackageSessionFormat } from '@/db/schema'
import { canSeePricing } from '@/lib/roles'
import { requireWorkspace } from '@/lib/workspace'

export async function requirePackageAccess() {
  const workspace = await requireWorkspace()
  if (!canSeePricing(workspace.membership.role)) redirect('/app')
  return workspace
}

export type PackageSummary = {
  id: string
  name: string
  kind: 'fixed' | 'monthly'
  term_weeks: number | null
  credit_units: number
  price_cents: number
  archived_at: string | null
}

export type PackageDetails = PackageSummary & {
  description: string | null
  session_formats: PackageSessionFormat[]
  installment_count: number | null
  installment_cadence: 'weekly' | 'monthly' | null
  eligible_coach_ids: string[] | null
  cancellation_notice_hours: number | null
  late_cancellation: 'inherit' | 'preserve' | 'forfeit'
  expiration: 'inherit' | 'end_of_term'
  makeup_extension_days: number | null
}
