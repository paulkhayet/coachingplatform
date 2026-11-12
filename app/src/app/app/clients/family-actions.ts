'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { clientFiles } from '@/db/schema'
import { adminDb } from '@/db/server'
import { checkFeature } from '@/lib/billing/server'
import { revokeFamilyAccess, sendFamilyInvite, setFamilyPermissions } from '@/lib/family/invitations'
import { canManageClients } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspace } from '@/lib/workspace'

// D-073: owners and administrators manage family portal access from the client page. Coaches can share
// files they uploaded; owners and administrators can share any.

export type FamilyActionState = { ok?: boolean; message?: string; url?: string }
const uuid = z.uuid()

async function manager(businessId: string) {
  const ws = await requireWorkspace()
  if (ws.business.id !== businessId) return { error: 'You switched businesses. Reload the page and try again.' } as const
  if (!canManageClients(ws.membership.role)) return { error: 'Only owners and administrators can manage family portal access.' } as const
  return { ws } as const
}

export async function inviteGuardianToPortal(businessId: string, clientId: string, guardianId: string, _state: FamilyActionState, _form: FormData): Promise<FamilyActionState> {
  const m = await manager(businessId)
  if ('error' in m) return { message: m.error }
  if (!uuid.safeParse(guardianId).success) return { message: 'This contact could not be found.' }
  const blocked = await checkFeature(businessId, 'clients')
  if (blocked) return { message: blocked }
  const { user } = m.ws
  const sent = await sendFamilyInvite({ businessId, guardianId, inviter: { id: user.id, name: user.fullName, email: user.email } })
  if ('error' in sent) return { message: sent.error }
  revalidatePath(`/app/clients/${clientId}`)
  return sent.emailed
    ? { ok: true, message: 'Invitation sent.' }
    : { ok: true, message: 'Invitation created. Email isn’t set up here, so send them this link yourself:', url: sent.url }
}

export async function revokeGuardianPortal(businessId: string, clientId: string, accessId: string, _state: FamilyActionState, _form: FormData): Promise<FamilyActionState> {
  const m = await manager(businessId)
  if ('error' in m) return { message: m.error }
  if (!uuid.safeParse(accessId).success || !(await revokeFamilyAccess(businessId, accessId))) return { message: 'Portal access could not be turned off. Refresh and try again.' }
  revalidatePath(`/app/clients/${clientId}`)
  return { ok: true, message: 'Portal access turned off.' }
}

export async function saveGuardianPermissions(businessId: string, clientId: string, accessId: string, _state: FamilyActionState, form: FormData): Promise<FamilyActionState> {
  const m = await manager(businessId)
  if ('error' in m) return { message: m.error }
  if (!uuid.safeParse(accessId).success) return { message: 'This contact could not be found.' }
  const on = (name: string) => form.get(name) === 'on'
  const saved = await setFamilyPermissions(businessId, accessId, {
    canViewSessions: on('canViewSessions'), canViewCredits: on('canViewCredits'), canReschedule: on('canReschedule'), canBook: on('canBook'),
  })
  if (!saved) return { message: 'The permissions could not be saved. Refresh and try again.' }
  revalidatePath(`/app/clients/${clientId}`)
  return { ok: true, message: 'Permissions saved.' }
}

/** Shares a client file with the family (or stops sharing it). */
export async function setFileShared(businessId: string, fileId: string, shared: boolean): Promise<{ message?: string }> {
  const { business, membership, user } = await requireWorkspace()
  if (business.id !== businessId || !uuid.safeParse(fileId).success) return { message: 'This file could not be found.' }
  const supabase = await createClient()
  const { data: file } = await supabase.from('client_files').select('id, client_id, uploaded_by')
    .eq('id', fileId).eq('business_id', businessId).maybeSingle<{ id: string; client_id: string; uploaded_by: string | null }>()
  if (!file) return { message: 'This file could not be found.' }
  if (file.uploaded_by !== user.id && !canManageClients(membership.role)) return { message: 'Only the person who uploaded this file, or an owner or administrator, can share it.' }
  await adminDb().update(clientFiles).set({ sharedWithFamily: shared }).where(and(eq(clientFiles.id, fileId), eq(clientFiles.businessId, businessId)))
  revalidatePath(`/app/clients/${file.client_id}`)
  return {}
}
