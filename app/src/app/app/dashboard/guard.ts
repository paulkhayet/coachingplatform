import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { UPGRADE_MESSAGES } from '@/lib/billing/plans'
import { dashboardAccess } from '@/lib/insights/server'

// Who may open what on the team dashboard (D-074). Pages call requireDashboard; server actions call
// actionAccess. The database enforces the same rules for the tables themselves.

export type DashboardLevel = 'owner' | 'manager' | 'member'

/**
 * For pages. `owner`: finances and coach pay. `manager`: owners and administrators. `member`: anyone
 * in the business (coaches then see only their own inquiries, through row-level security).
 * Off the Team plan everything goes back to the dashboard's front page, which explains the upgrade.
 */
export async function requireDashboard(level: DashboardLevel) {
  const access = await dashboardAccess()
  if (!access.enabled) {
    if (access.manager) redirect('/app/dashboard')
    notFound()
  }
  if ((level === 'owner' && !access.owner) || (level === 'manager' && !access.manager)) notFound()
  return access
}

/** For server actions: the same checks, as a message instead of a page. */
export async function actionAccess(businessId: string, level: DashboardLevel) {
  const access = await dashboardAccess()
  if (access.business.id !== businessId) return { ok: false as const, message: 'You switched businesses. Reload the page and try again.' }
  if (!access.enabled) return { ok: false as const, message: UPGRADE_MESSAGES.teamDashboard }
  if (level === 'owner' && !access.owner) return { ok: false as const, message: 'Only the owner can do this.' }
  if (level === 'manager' && !access.manager) return { ok: false as const, message: 'Only owners and administrators can do this.' }
  return { ok: true as const, access, actor: { businessId: access.business.id, userId: access.user.id } }
}
