'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { questionsSchema } from '@/lib/booking/questions'
import { createClient } from '@/lib/supabase/server'
import { actionAccess } from '../../dashboard/guard'

export interface IntakeSettingsState {
  ok?: boolean
  message?: string
}

const fields = z.object({
  enabled: z.boolean(),
  intro: z.string().trim().max(1000, 'Keep the introduction under 1,000 characters'),
  questions: questionsSchema,
  notify: z.array(z.uuid()).max(50),
})

/** Owners and administrators set up the public inquiry form (D-074). Saved through row-level security. */
export async function saveIntakeSettings(businessId: string, _state: IntakeSettingsState, form: FormData): Promise<IntakeSettingsState> {
  const access = await actionAccess(businessId, 'manager')
  if (!access.ok) return { message: access.message }
  let questions: unknown
  try {
    questions = JSON.parse(String(form.get('questions') ?? '[]'))
  } catch {
    return { message: 'The questions couldn’t be read. Reload the page and try again.' }
  }
  const parsed = fields.safeParse({
    enabled: form.get('enabled') === 'on', intro: String(form.get('intro') ?? ''), questions,
    notify: form.getAll('notify').filter((v): v is string => typeof v === 'string'),
  })
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  const { enabled, intro, notify } = parsed.data
  const supabase = await createClient()
  // "Everyone" is stored as null, so people who join later are included without another save.
  const everyone = form.get('notifyAll') === 'on' || notify.length === 0
  const { data, error } = await supabase.from('intake_settings').upsert({
    business_id: businessId, enabled, intro: intro || null, questions: parsed.data.questions,
    notify_membership_ids: everyone ? null : notify, updated_at: new Date().toISOString(),
  }).select('business_id')
  if (error || !data?.length) return { message: 'The form couldn’t be saved. Check your access and try again.' }
  revalidatePath('/app/settings/intake')
  return { ok: true, message: enabled ? 'Saved. Your inquiry form is live.' : 'Saved. The form is off.' }
}
