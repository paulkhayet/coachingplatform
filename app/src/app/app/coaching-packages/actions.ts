'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { readCoachingPackage } from '@/lib/coaching-packages'
import { canManageCoachingPackages } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { fieldErrors, type FieldErrors } from '@/lib/validation'
import { requireWorkspace } from '@/lib/workspace'

const catalog = '/app/coaching-packages'

export interface PackageFormState {
  errors?: FieldErrors
  message?: string
}

export async function savePackage(businessId: string, id: string | null, _state: PackageFormState, form: FormData): Promise<PackageFormState> {
  const { business, membership } = await requireWorkspace()
  if (business.id !== businessId) return { message: 'You switched businesses. Reopen the package in the correct business.' }
  if (!canManageCoachingPackages(membership)) return { message: 'You need financial permission to save packages.' }
  if (id !== null && !z.uuid().safeParse(id).success) return { message: 'This package could not be found.' }

  const parsed = readCoachingPackage(form)
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  const value = parsed.data
  const terms = {
    name: value.name,
    description: value.description || null,
    kind: value.kind,
    term_weeks: value.termWeeks,
    credit_units: value.creditUnits,
    session_formats: value.sessionFormats,
    price_cents: value.priceCents,
    installment_count: value.installmentCount,
    installment_cadence: value.installmentCadence,
    eligible_coach_ids: value.eligibleCoachIds,
    cancellation_notice_hours: value.cancellationNoticeHours,
    late_cancellation: value.lateCancellation,
    expiration: value.expiration,
    makeup_extension_days: value.makeupExtensionDays,
    updated_at: new Date().toISOString(),
  }

  const supabase = await createClient()
  const table = supabase.from('coaching_packages')
  const write = id === null
    ? table.insert({ ...terms, business_id: business.id })
    : table.update(terms).eq('business_id', business.id).eq('id', id)
  const { data, error } = await write.select('id').maybeSingle<{ id: string }>()
  if (error?.code === '22023') return { errors: { eligibleCoachIds: 'Choose active coaches from this business.' } }
  if (error || !data) return { message: 'The package could not be saved. Check your access and try again.' }

  revalidatePath(catalog)
  revalidatePath(`${catalog}/${data.id}`)
  redirect(`${catalog}/${data.id}?status=saved`)
}

export async function setPackageArchived(businessId: string, id: string, archive: boolean, _state: PackageFormState, _form: FormData): Promise<PackageFormState> {
  const { business, membership } = await requireWorkspace()
  if (business.id !== businessId) return { message: 'You switched businesses. Reopen the package in the correct business.' }
  if (!canManageCoachingPackages(membership)) return { message: 'You need financial permission to change package availability.' }
  if (!z.uuid().safeParse(id).success) return { message: 'This package could not be found.' }

  const supabase = await createClient()
  const now = new Date().toISOString()
  const write = supabase.from('coaching_packages').update({ archived_at: archive ? now : null, updated_at: now })
    .eq('id', id).eq('business_id', business.id)
  const { data, error } = await (archive ? write.is('archived_at', null) : write.not('archived_at', 'is', null))
    .select('id').maybeSingle<{ id: string }>()
  if (error?.code === '22023') return { message: 'Update the eligible coaches before restoring this package.' }
  if (error || !data) return { message: 'Package availability could not be changed. Refresh the page and try again.' }

  revalidatePath(catalog)
  revalidatePath(`${catalog}/${id}`)
  redirect(`${catalog}/${id}?status=${archive ? 'archived' : 'restored'}`)
}
