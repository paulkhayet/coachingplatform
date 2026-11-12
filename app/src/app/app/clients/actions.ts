'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { z } from 'zod'
import { OFFLINE_PAYMENT_METHODS } from '@/db/schema'
import { adminDb } from '@/db/server'
import { parseDollars } from '@/lib/booking/policy'
import { syncCoachingConfirmations } from '@/lib/booking/server'
import { businessDate } from '@/lib/clients/credits'
import { assignClientPackage, ClientFinanceError, recordClientPayment } from '@/lib/clients/finance'
import { canManageClients, canManagePayments } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { fieldErrors, type FieldErrors } from '@/lib/validation'
import { requireWorkspace } from '@/lib/workspace'
import { checkFeature } from '@/lib/billing/server'

const clientsPath = '/app/clients'
const switched = 'You switched businesses. Reopen the client in the correct business.'
const uuid = z.uuid()
const name = z.string().trim().min(2, 'Enter a name').max(100, 'Use at most 100 characters')
const email = z.union([z.literal(''), z.email('Enter a valid email address').max(254)])
const clientFields = z.object({ name, email, coachId: z.union([z.literal(''), uuid]) })
const guardianFields = z.object({ name, email, phone: z.string().max(40, 'Use at most 40 characters'), relationship: z.string().max(80, 'Use at most 80 characters') })
  .refine((value) => value.email || value.phone, { path: ['email'], message: 'Enter an email address or a phone number' })
const assignmentFields = z.object({ packageId: uuid, packageVersion: z.iso.datetime({ offset: true }), startsOn: z.iso.date('Choose a valid start date') })
const paymentFields = z.object({
  amountCents: z.number('Enter an amount in dollars and cents').int().min(1, 'Enter an amount greater than zero').max(100000000),
  method: z.enum(OFFLINE_PAYMENT_METHODS),
  receivedOn: z.iso.date('Choose the date the payment was received'),
  reference: z.string().max(200, 'Use at most 200 characters'),
})

export interface ClientActionState {
  errors?: FieldErrors
  message?: string
}

function text(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function finish(clientId: string, status: string): never {
  const path = `${clientsPath}/${clientId}`
  revalidatePath(clientsPath)
  revalidatePath(path)
  return redirect(`${path}?status=${status}`)
}

export async function saveClient(businessId: string, clientId: string | null, _state: ClientActionState, form: FormData): Promise<ClientActionState> {
  const { business, membership } = await requireWorkspace()
  if (business.id !== businessId) return { message: switched }
  if (!canManageClients(membership.role)) return { message: 'Only owners and administrators can save client details.' }
  if (clientId !== null && !uuid.safeParse(clientId).success) return { message: 'This client could not be found.' }
  // New clients need a paid plan (D-072); existing ones stay editable after a downgrade.
  if (clientId === null) { const blocked = await checkFeature(business.id, 'clients'); if (blocked) return { message: blocked } }

  const parsed = clientFields.safeParse({ name: text(form, 'name'), email: text(form, 'email').toLowerCase(), coachId: text(form, 'coachId') })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  const value = parsed.data
  const fields = { name: value.name, email: value.email || null, coach_membership_id: value.coachId || null }
  const supabase = await createClient()
  const table = supabase.from('coaching_clients')
  const write = clientId === null ? table.insert({ ...fields, business_id: business.id })
    : table.update({ ...fields, updated_at: new Date().toISOString() }).eq('id', clientId).eq('business_id', business.id)
  const { data, error } = await write.select('id').maybeSingle<{ id: string }>()
  if (error?.code === '22023') return { errors: { coachId: 'Choose an active coach from this business.' } }
  if (error || !data) return { message: 'The client could not be saved. Check your access and try again.' }
  return finish(data.id, 'client')
}

export async function saveGuardian(businessId: string, clientId: string, guardianId: string | null, _state: ClientActionState, form: FormData): Promise<ClientActionState> {
  const { business, membership } = await requireWorkspace()
  if (business.id !== businessId) return { message: switched }
  if (!canManageClients(membership.role)) return { message: 'Only owners and administrators can save guardian contacts.' }
  if (!uuid.safeParse(clientId).success || (guardianId !== null && !uuid.safeParse(guardianId).success)) return { message: 'This contact could not be found.' }

  const parsed = guardianFields.safeParse({ name: text(form, 'name'), email: text(form, 'email').toLowerCase(), phone: text(form, 'phone'), relationship: text(form, 'relationship') })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  const value = parsed.data
  const fields = { name: value.name, email: value.email || null, phone: value.phone || null, relationship: value.relationship || null }
  const supabase = await createClient()
  const table = supabase.from('client_guardians')
  const write = guardianId === null ? table.insert({ ...fields, business_id: business.id, client_id: clientId })
    : table.update(fields).eq('id', guardianId).eq('business_id', business.id).eq('client_id', clientId)
  const { data, error } = await write.select('id').maybeSingle<{ id: string }>()
  if (error || !data) return { message: 'The contact could not be saved. Check your access and try again.' }
  return finish(clientId, 'guardian')
}

export async function saveClientPackage(businessId: string, clientId: string, requestId: string, _state: ClientActionState, form: FormData): Promise<ClientActionState> {
  const { business, membership, user } = await requireWorkspace()
  if (business.id !== businessId) return { message: switched }
  if (!canManagePayments(membership)) return { message: 'You need financial permission to assign a package.' }
  if (!uuid.safeParse(clientId).success || !uuid.safeParse(requestId).success) return { message: 'This client could not be found.' }
  const blocked = await checkFeature(business.id, 'clients')
  if (blocked) return { message: blocked }

  const parsed = assignmentFields.safeParse({ packageId: text(form, 'packageId'), packageVersion: text(form, 'packageVersion'), startsOn: text(form, 'startsOn') })
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error)
    return { errors: { packageId: errors.packageId || (errors.packageVersion ? 'Refresh the page and choose the package again.' : undefined), startsOn: errors.startsOn } }
  }
  try {
    await assignClientPackage(adminDb(), { businessId, clientId, userId: user.id }, { id: requestId, ...parsed.data })
  } catch (error) {
    if (!(error instanceof ClientFinanceError)) console.error('Could not assign client package', error instanceof Error ? error.name : 'unknown error')
    return { message: error instanceof ClientFinanceError ? error.message : 'The package could not be assigned. Try again.' }
  }
  return finish(clientId, 'package')
}

export async function saveOfflinePayment(businessId: string, clientId: string, periodId: string, requestId: string, _state: ClientActionState, form: FormData): Promise<ClientActionState> {
  const { business, membership, user } = await requireWorkspace()
  if (business.id !== businessId) return { message: switched }
  if (!canManagePayments(membership)) return { message: 'You need financial permission to record a payment.' }
  if (![clientId, periodId, requestId].every((id) => uuid.safeParse(id).success)) return { message: 'This credit period could not be found.' }

  const parsed = paymentFields.safeParse({
    amountCents: parseDollars(text(form, 'amount')) ?? Number.NaN,
    method: text(form, 'method'), receivedOn: text(form, 'receivedOn'), reference: text(form, 'reference'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  if (parsed.data.receivedOn > businessDate(business.timezone)) return { errors: { receivedOn: 'Choose today or an earlier date.' } }
  try {
    const coveredIds = await recordClientPayment(adminDb(), { businessId, clientId, userId: user.id }, {
      ...parsed.data, id: requestId, periodId, reference: parsed.data.reference || null,
    })
    if (coveredIds.length) {
      after(() => syncCoachingConfirmations(coveredIds))
      revalidatePath('/app/bookings', 'layout')
    }
  } catch (error) {
    if (!(error instanceof ClientFinanceError)) console.error('Could not record offline payment', error instanceof Error ? error.name : 'unknown error')
    return { message: error instanceof ClientFinanceError ? error.message : 'The payment could not be recorded. Try again.' }
  }
  return finish(clientId, 'payment')
}
