import type { DB, Staff, Student, ID, Appointment } from './types'

export const isFinancial = (s: Staff) => s.role === 'owner' || (s.role === 'admin' && s.financial !== false)
export const canSeePricing = (s: Staff) => s.role === 'owner' || s.role === 'admin'
export const canManageTeam = (s: Staff) => s.role === 'owner'
export const canManageSaaS = (s: Staff) => s.role === 'owner'
export const canEditPolicies = (s: Staff) => s.role === 'owner'
export const canManageInquiries = (s: Staff) => s.role === 'owner' || s.role === 'admin'

export interface AccessReason {
  kind: 'all' | 'assigned' | 'pool' | 'grant'
  label: string
  expires?: string
}

/** Why (if at all) a staff member may see a client. Coaches see assigned or explicitly authorised clients only (D-028/D-030/D-031). */
export function clientAccess(db: DB, staff: Staff, student: Student, now = new Date()): AccessReason | null {
  if (staff.role === 'owner' || staff.role === 'admin') return { kind: 'all', label: staff.role === 'owner' ? 'Owner access' : 'Administrator operational access' }
  if (student.assignedCoachId === staff.id) return { kind: 'assigned', label: 'Assigned coach' }
  const grant = db.grants.find((g) => g.staffId === staff.id && g.studentId === student.id && g.scope === 'client' && (!g.expiresAt || new Date(g.expiresAt) > now))
  if (grant) return { kind: 'grant', label: `Granted: ${grant.reason}`, expires: grant.expiresAt }
  // Booking-created pool access: lasts through booked sessions plus the follow-up window.
  const windowMs = db.business.policies.poolAccessDays * 86400000
  const poolAppts = db.appointments.filter(
    (a) => a.coachId === staff.id && a.studentId === student.id && a.viaPool && !a.status.startsWith('canceled'),
  )
  if (poolAppts.length) {
    const last = Math.max(...poolAppts.map((a) => new Date(a.start).getTime()))
    const expires = new Date(last + windowMs)
    if (expires > now) return { kind: 'pool', label: 'Pool booking', expires: expires.toISOString() }
  }
  return null
}

export function visibleStudents(db: DB, staff: Staff) {
  return db.students.filter((s) => clientAccess(db, staff, s))
}

/** Private notes and raw sources: the session's coach or the assigned coach; owners/admins need an explicit grant (D-028). */
export function canReadPrivate(db: DB, staff: Staff, studentId: ID | null, appt?: Appointment) {
  if (!studentId) return appt ? appt.coachId === staff.id || staff.role !== 'coach' : false
  if (appt && appt.coachId === staff.id) return true
  const student = db.students.find((s) => s.id === studentId)
  if (student?.assignedCoachId === staff.id) return true
  return db.grants.some((g) => g.staffId === staff.id && g.studentId === studentId && g.scope === 'private_notes')
}

export function canAuthorFollowUp(db: DB, staff: Staff, appt: Appointment) {
  return canReadPrivate(db, staff, appt.studentId, appt)
}
