'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { adminDb } from '@/db/server'
import { memberships } from '@/db/schema'
import { parseSubjects } from '@/lib/intake/shared'
import { createClient } from '@/lib/supabase/server'
import { actionAccess } from '../guard'

export interface AssignmentState {
  message?: string
  done?: string
  errors?: Partial<Record<string, string>>
}

const uuid = z.uuid()

function text(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function refresh() {
  revalidatePath('/app/dashboard/assignments')
  revalidatePath('/app/dashboard')
  revalidatePath('/app/clients')
}

/**
 * Gives a client a coach, or moves them to another. Only the assignment changes: sessions already
 * booked stay with the coach who is hosting them. Saved through row-level security (owners and
 * administrators), and the database checks the coach is active in this business.
 */
export async function assignClientCoach(businessId: string, clientId: string, _state: AssignmentState, form: FormData): Promise<AssignmentState> {
  const access = await actionAccess(businessId, 'manager')
  if (!access.ok) return { message: access.message }
  const coachId = z.union([z.literal(''), uuid]).safeParse(text(form, 'coachId'))
  if (!uuid.safeParse(clientId).success || !coachId.success) return { message: 'Choose a coach from the list.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('coaching_clients').update({ coach_membership_id: coachId.data || null, updated_at: new Date().toISOString() })
    .eq('id', clientId).eq('business_id', businessId).select('id')
  if (error?.code === '22023') return { message: 'Choose an active coach from this business.' }
  if (error || !data?.length) return { message: 'The coach couldn’t be changed. Check your access and try again.' }
  refresh()
  revalidatePath(`/app/clients/${clientId}`)
  return { done: 'Saved.' }
}

/** Moves every client from one coach to another in one step, e.g. when a coach leaves. */
export async function moveAllClients(businessId: string, fromCoachId: string, _state: AssignmentState, form: FormData): Promise<AssignmentState> {
  const access = await actionAccess(businessId, 'manager')
  if (!access.ok) return { message: access.message }
  const to = z.union([z.literal(''), uuid]).safeParse(text(form, 'toCoachId'))
  if (!uuid.safeParse(fromCoachId).success || !to.success || to.data === fromCoachId) return { message: 'Choose a different coach to move the clients to.' }
  if (text(form, 'confirm') !== 'on') return { message: 'Tick the box to confirm.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('coaching_clients').update({ coach_membership_id: to.data || null, updated_at: new Date().toISOString() })
    .eq('business_id', businessId).eq('coach_membership_id', fromCoachId).select('id')
  if (error?.code === '22023') return { message: 'Choose an active coach from this business.' }
  if (error) return { message: 'The clients couldn’t be moved. Check your access and try again.' }
  refresh()
  return { done: `${data?.length ?? 0} ${data?.length === 1 ? 'client' : 'clients'} moved.` }
}

const profileFields = z.object({
  specialties: z.string().max(1500).transform(parseSubjects)
    .refine((list) => list.length <= 30, 'List at most 30 subjects').refine((list) => list.every((s) => s.length <= 40), 'Keep each subject under 40 characters'),
  maxClients: z.union([z.literal(''), z.string().regex(/^\d+$/, 'Enter a whole number').transform(Number).pipe(z.number().int().min(0).max(1000, 'Use 1,000 or fewer'))]),
})

/**
 * What a coach teaches and how many clients they take, used for match suggestions. Owners and
 * administrators set both for anyone; coaches set their own subjects. The membership policies only let
 * owners edit other people's rows, so this checks the role here and writes with the server connection.
 */
export async function saveCoachProfile(businessId: string, membershipId: string, _state: AssignmentState, form: FormData): Promise<AssignmentState> {
  const access = await actionAccess(businessId, 'member')
  if (!access.ok) return { message: access.message }
  const { manager, membership } = access.access
  if (!uuid.safeParse(membershipId).success) return { message: 'This coach could not be found.' }
  if (!manager && membershipId !== membership.id) return { message: 'You can only change your own subjects.' }
  // The limit is only on the managers' form; the Team page form (subjects only) must not clear it.
  const setsLimit = manager && form.has('maxClients')
  const parsed = profileFields.safeParse({ specialties: text(form, 'specialties'), maxClients: setsLimit ? text(form, 'maxClients') : '' })
  if (!parsed.success) return { errors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) }
  const updated = await adminDb().update(memberships)
    .set({ specialties: parsed.data.specialties, ...(setsLimit ? { maxClients: parsed.data.maxClients === '' ? null : parsed.data.maxClients } : {}) })
    .where(and(eq(memberships.id, membershipId), eq(memberships.businessId, businessId), eq(memberships.status, 'active'), eq(memberships.coaches, true)))
    .returning({ id: memberships.id })
  if (!updated.length) return { message: 'This coach could not be found.' }
  refresh()
  revalidatePath('/app/team')
  return { done: 'Saved.' }
}
