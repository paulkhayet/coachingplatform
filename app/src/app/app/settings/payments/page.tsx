import { redirect } from 'next/navigation'
import { INTEGRATIONS_PATH } from '@/lib/settings-paths'

export default async function LegacyPaymentsPage({ searchParams }: { searchParams: Promise<{ returned?: string; error?: string }> }) {
  const { returned, error } = await searchParams
  const query = new URLSearchParams()
  if (typeof returned === 'string') query.set('returned', returned)
  if (typeof error === 'string') query.set('error', error)
  redirect(`${INTEGRATIONS_PATH}${query.size ? `?${query}` : ''}#stripe-connect`)
}
