import type { DB, Viewer, Student, Guardian, GuardianLink } from '@/lib/types'

export interface PortalCtx {
  student: Student
  guardian: Guardian | null
  link: GuardianLink | null
  name: string
  actorLabel: string
  isStudent: boolean
  perms: { book: boolean; followUps: boolean; homework: boolean; billing: boolean }
}

export function portalContext(db: DB, v: Viewer): PortalCtx {
  if (v.kind === 'guardian') {
    const student = db.students.find((s) => s.id === v.studentId)!
    const guardian = db.guardians.find((g) => g.id === v.id)!
    const link = student.guardians.find((l) => l.guardianId === v.id)!
    return { student, guardian, link, name: guardian.name, actorLabel: `${guardian.name} (parent)`, isStudent: false, perms: { book: link.canBook, followUps: link.followUps, homework: link.homework, billing: link.billing } }
  }
  const student = db.students.find((s) => s.id === (v as { id: string }).id)!
  return { student, guardian: null, link: null, name: student.name, actorLabel: `${student.name} (student)`, isStudent: true, perms: { book: student.studentCanBook, followUps: true, homework: true, billing: student.independent } }
}
