import { z } from 'zod'
import type { BookingAnswer, BookingQuestion } from '@/db/schema'

// Business-authored booking questions (D-056): short answer, paragraph, single and multiple choice.

export const QUESTION_TYPES = [
  { value: 'short', label: 'Short answer' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'single', label: 'One choice' },
  { value: 'multiple', label: 'Several choices' },
] as const

export const MAX_QUESTIONS = 10

const questionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]{6,24}$/),
    label: z.string().trim().min(1, 'Every question needs wording').max(200, 'Keep questions under 200 characters'),
    type: z.enum(['short', 'paragraph', 'single', 'multiple']),
    options: z.array(z.string().trim().min(1).max(100)).max(20, 'Use at most 20 choices'),
    required: z.boolean(),
  })
  .superRefine((q, ctx) => {
    const choice = q.type === 'single' || q.type === 'multiple'
    if (choice && q.options.length < 2) ctx.addIssue({ code: 'custom', message: `“${q.label}” needs at least two choices` })
    if (choice && new Set(q.options).size !== q.options.length) ctx.addIssue({ code: 'custom', message: `“${q.label}” has the same choice twice` })
  })

export const questionsSchema = z.array(questionSchema).max(MAX_QUESTIONS, `Use at most ${MAX_QUESTIONS} questions`)

/** Stored questions, dropping anything malformed rather than breaking the page. */
export function parseQuestions(value: unknown): BookingQuestion[] {
  const parsed = questionsSchema.safeParse(value)
  if (!parsed.success) return []
  // Choice questions keep options; text questions don't need them.
  return parsed.data.map((q) => ({ ...q, options: q.type === 'single' || q.type === 'multiple' ? q.options : [] }))
}

export function newQuestionId() {
  return Math.random().toString(36).slice(2, 12).padEnd(8, '0')
}

const LIMIT = { short: 200, paragraph: 2000 } as const

/**
 * Checks a guest's answers against the page's questions. `get` returns every submitted value for a
 * field name (FormData.getAll). Answers to choices must be one of the offered options.
 */
export function readAnswers(questions: BookingQuestion[], get: (name: string) => string[]): { answers: BookingAnswer[]; errors: Record<string, string> } {
  const answers: BookingAnswer[] = []
  const errors: Record<string, string> = {}
  for (const q of questions) {
    const field = `q_${q.id}`
    const raw = get(field).map((v) => v.trim()).filter(Boolean)
    if (q.type === 'short' || q.type === 'paragraph') {
      const value = raw[0] ?? ''
      if (!value) {
        if (q.required) errors[field] = 'Please answer this question'
        continue
      }
      if (value.length > LIMIT[q.type]) {
        errors[field] = `Keep this under ${LIMIT[q.type].toLocaleString()} characters`
        continue
      }
      answers.push({ questionId: q.id, label: q.label, value })
      continue
    }
    const chosen = [...new Set(raw)].filter((v) => q.options.includes(v))
    if (chosen.length !== new Set(raw).size) {
      errors[field] = 'Choose from the options given'
      continue
    }
    if (q.type === 'single' && chosen.length > 1) {
      errors[field] = 'Choose one option'
      continue
    }
    if (chosen.length === 0) {
      if (q.required) errors[field] = q.type === 'single' ? 'Choose an option' : 'Choose at least one option'
      continue
    }
    answers.push({ questionId: q.id, label: q.label, value: q.type === 'single' ? chosen[0] : chosen })
  }
  return { answers, errors }
}

export function formatAnswer(value: string | string[]) {
  return Array.isArray(value) ? value.join(', ') : value
}
