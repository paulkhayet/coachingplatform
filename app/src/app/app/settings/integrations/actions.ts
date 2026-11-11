'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { listCalendars } from '@/lib/google/calendar'
import { disconnect, getConnection, updateCalendarChoices } from '@/lib/google/server'
import { INTEGRATIONS_PATH } from '@/lib/settings-paths'
import { requireWorkspace } from '@/lib/workspace'
import { disconnectZoom } from '@/lib/zoom/server'

export type IntegrationState = { ok?: boolean; message?: string }

/** Which calendars block bookings, and the owned calendar bookings go into by default. Only your own connection. */
export async function saveCalendarChoices(_prev: IntegrationState, formData: FormData): Promise<IntegrationState> {
  const { user } = await requireWorkspace()
  const connection = await getConnection(user.id)
  if (!connection) return { message: 'Connect Google Calendar first.' }
  let calendars: Awaited<ReturnType<typeof listCalendars>>
  try {
    calendars = await listCalendars(user.id)
  } catch {
    return { message: 'We couldn’t reach Google Calendar. Try again, or reconnect.' }
  }
  const known = new Set(calendars.map((c) => c.id))
  const busy = formData.getAll('busy').map(String).filter((id) => known.has(id))
  const destination = String(formData.get('destination') ?? '')
  if (busy.length === 0) return { message: 'Choose at least one calendar to check for conflicts.' }
  if (!calendars.some((c) => c.id === destination && c.owned)) return { message: 'Choose a calendar you own for new bookings.' }
  await updateCalendarChoices(user.id, busy, destination)
  revalidatePath('/app/availability')
  revalidatePath(INTEGRATIONS_PATH)
  return { ok: true, message: 'Calendar settings saved.' }
}

export async function disconnectCalendar() {
  const { user } = await requireWorkspace()
  await disconnect(user.id)
  revalidatePath('/app/availability')
  revalidatePath(INTEGRATIONS_PATH)
  redirect(`${INTEGRATIONS_PATH}?calendar=disconnected`)
}

/** Disconnects the person's Zoom account. Existing bookings keep the links already sent. */
export async function disconnectZoomAction() {
  const { user } = await requireWorkspace()
  await disconnectZoom(user.id)
  revalidatePath('/app/availability')
  revalidatePath(INTEGRATIONS_PATH)
  redirect(`${INTEGRATIONS_PATH}?zoom=disconnected`)
}
