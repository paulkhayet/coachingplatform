import { z } from 'zod'
import type { InquiryStage } from '@/db/schema'

// Intake (D-074): the stages an inquiry moves through and the fields the form collects. Shared by the
// public form, the dashboard and the server.

export const STAGE_LABELS: Record<InquiryStage, string> = { new: 'New', matching: 'Matching', first_call: 'First call', offer: 'Offer', enrolled: 'Enrolled', lost: 'Lost' }
/** The board's columns, in order. Enrolled and Lost are where an inquiry ends. */
export const OPEN_STAGES = ['new', 'matching', 'first_call', 'offer'] as const satisfies readonly InquiryStage[]
export type OpenStage = (typeof OPEN_STAGES)[number]
export const isOpenStage = (stage: string): stage is OpenStage => (OPEN_STAGES as readonly string[]).includes(stage)

export const STAGE_HINTS: Record<OpenStage, string> = {
  new: 'Just arrived. Review and reply.',
  matching: 'Choose a coach for this family.',
  first_call: 'The coach meets the family.',
  offer: 'Pricing and package discussed.',
}

export const LOST_REASONS = ['No response', 'Chose someone else', 'Price', 'Schedule didn’t work', 'Not a fit', 'Other'] as const
export const RELATIONSHIPS = ['Parent', 'Guardian', 'Grandparent', 'Self', 'Other'] as const
/** The student is the person getting in touch, so there's no separate guardian contact. */
export const isSelf = (relationship: string | null | undefined) => relationship?.trim().toLowerCase() === 'self'

export const FIRST_CALL_OUTCOMES = [
  { value: 'good_fit', label: 'Good fit' },
  { value: 'not_a_fit', label: 'Not a fit' },
  { value: 'no_show', label: 'No-show' },
] as const
export type FirstCallOutcome = (typeof FIRST_CALL_OUTCOMES)[number]['value']
export const outcomeLabel = (value: unknown) => FIRST_CALL_OUTCOMES.find((o) => o.value === value)?.label ?? 'Recorded'

export const FIRST_CALL_MINUTES = [15, 20, 30, 45, 60] as const

export const MAX_SUBJECTS = 20

/** "SAT Math, reading; essays" → ["SAT Math", "reading", "essays"]: trimmed, without repeats. */
export function parseSubjects(text: string): string[] {
  const seen = new Set<string>()
  const subjects: string[] = []
  for (const raw of text.split(/[,;\n]/)) {
    const subject = raw.trim().replace(/\s+/g, ' ')
    if (!subject || seen.has(subject.toLowerCase())) continue
    seen.add(subject.toLowerCase())
    subjects.push(subject)
  }
  return subjects
}

const subjects = z.string().max(600, 'Keep this under 600 characters').transform(parseSubjects)
  .refine((list) => list.length <= MAX_SUBJECTS, `List at most ${MAX_SUBJECTS} subjects`)
  .refine((list) => list.every((s) => s.length <= 60), 'Keep each subject under 60 characters')

export const inquirySchema = z.object({
  contactName: z.string().trim().min(1, 'Enter your name').max(120, 'Keep the name under 120 characters'),
  contactEmail: z.email('Enter a valid email address').max(254),
  contactPhone: z.string().trim().max(40, 'Keep the phone number under 40 characters'),
  relationship: z.string().trim().max(80, 'Keep this under 80 characters'),
  studentName: z.string().trim().max(100, 'Keep the name under 100 characters'),
  studentGrade: z.string().trim().max(40, 'Keep this under 40 characters'),
  subjects,
  goals: z.string().trim().max(2000, 'Keep this under 2,000 characters'),
  availabilityNotes: z.string().trim().max(1000, 'Keep this under 1,000 characters'),
  timezone: z.string().trim().max(64),
}).transform((v, ctx) => {
  // An adult student writes in for themself: one name is enough.
  const studentName = v.studentName || (isSelf(v.relationship) ? v.contactName : '')
  if (studentName.length < 2) ctx.addIssue({ code: 'custom', path: ['studentName'], message: 'Enter the student’s name' })
  return { ...v, studentName }
})
export type InquiryInput = z.infer<typeof inquirySchema>

/**
 * Checks a submitted inquiry and reports every problem in one pass. (The schema's cross-field check for
 * the student's name only runs once the other fields are valid, so it's repeated here.)
 */
export function checkInquiry(raw: Record<string, string>): { data: InquiryInput } | { errors: Partial<Record<string, string>> } {
  const parsed = inquirySchema.safeParse({ ...raw, contactEmail: (raw.contactEmail ?? '').trim().toLowerCase() })
  if (parsed.success) return { data: parsed.data }
  const errors: Partial<Record<string, string>> = {}
  for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? 'form')] ??= issue.message
  if (!isSelf(raw.relationship) && (raw.studentName ?? '').trim().length < 2) errors.studentName ??= 'Enter the student’s name'
  return { errors }
}

export const INQUIRY_FIELDS = ['contactName', 'contactEmail', 'contactPhone', 'relationship', 'studentName', 'studentGrade', 'subjects', 'goals', 'availabilityNotes', 'timezone'] as const

/** Days since a date, for "5 days in this stage". */
export function daysSince(date: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000))
}

export function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Pipeline numbers for the overview: how many at each stage, this month against last, and how inquiries end. */
export function pipelineStats(rows: { stage: InquiryStage; createdAt: Date; stageChangedAt: Date }[], months: { thisFrom: Date; lastFrom: Date }, now: Date) {
  const counts = Object.fromEntries(OPEN_STAGES.map((s) => [s, 0])) as Record<OpenStage, number>
  let thisMonth = 0
  let lastMonth = 0
  let enrolled = 0
  let closed = 0
  const daysToEnrol: number[] = []
  const since = now.getTime() - 90 * 86_400_000
  for (const r of rows) {
    if (isOpenStage(r.stage)) counts[r.stage]++
    if (r.createdAt >= months.thisFrom) thisMonth++
    else if (r.createdAt >= months.lastFrom) lastMonth++
    if ((r.stage === 'enrolled' || r.stage === 'lost') && r.stageChangedAt.getTime() >= since) {
      closed++
      if (r.stage === 'enrolled') {
        enrolled++
        daysToEnrol.push((r.stageChangedAt.getTime() - r.createdAt.getTime()) / 86_400_000)
      }
    }
  }
  return { counts, thisMonth, lastMonth, enrolled, closed, conversion: closed ? enrolled / closed : null, medianDaysToEnrol: median(daysToEnrol) }
}
