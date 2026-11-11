import { z } from 'zod'
import { parseDollars } from '@/lib/booking/policy'

const sessionFormat = z.object({
  name: z.string().trim().min(1, 'Name each session format').max(80, 'Use at most 80 characters for a format name'),
  durationMinutes: z.number('Enter a duration for each format').int().min(1).max(480, 'Use a duration of at most 480 minutes'),
  creditUnits: z.number('Enter credits to two decimal places').int().min(1, 'Each format must use at least 0.01 credits'),
})

const packageSchema = z.object({
  name: z.string().trim().min(2, 'Enter a package name').max(100, 'Use at most 100 characters'),
  description: z.string().trim().max(1000, 'Use at most 1,000 characters'),
  kind: z.enum(['fixed', 'monthly']),
  termWeeks: z.number('Enter the length in whole weeks').int().min(1).max(260, 'Use at most 260 weeks').nullable(),
  creditUnits: z.number('Enter the allowance to two decimal places').int().min(1, 'Enter a positive credit allowance').max(100000, 'Use at most 1,000 credits'),
  sessionFormats: z.array(sessionFormat).min(1, 'Add at least one session format').max(10, 'Use at most 10 session formats'),
  priceCents: z.number('Enter a price in dollars and cents').int().min(1, 'Enter a price greater than zero').max(100000000, 'Use a price of at most $1,000,000'),
  installmentCount: z.number('Enter the number of installments').int().min(2, 'Use at least 2 installments').max(24, 'Use at most 24 installments').nullable(),
  installmentCadence: z.enum(['weekly', 'monthly']).nullable(),
  eligibleCoachIds: z.array(z.uuid()).min(1, 'Choose at least one coach').max(200, 'Choose at most 200 coaches').nullable(),
  cancellationNoticeHours: z.number('Enter the notice in whole hours').int().min(0).max(720, 'Use at most 720 hours').nullable(),
  lateCancellation: z.enum(['inherit', 'preserve', 'forfeit']),
  expiration: z.enum(['inherit', 'end_of_term']),
  makeupExtensionDays: z.number('Enter the extension in whole days').int().min(0).max(365, 'Use at most 365 days').nullable(),
}).superRefine((value, ctx) => {
  if (value.kind === 'fixed' && value.termWeeks === null) {
    ctx.addIssue({ code: 'custom', path: ['termWeeks'], message: 'Enter the length in weeks' })
  }
  if (value.sessionFormats.some((format) => format.creditUnits > value.creditUnits)) {
    ctx.addIssue({ code: 'custom', path: ['sessionFormats'], message: 'Each format must cost at most the package’s credit allowance' })
  }
  if (value.installmentCount !== null && value.priceCents < value.installmentCount) {
    ctx.addIssue({ code: 'custom', path: ['installmentCount'], message: 'Each installment needs at least one cent' })
  }
})

function text(value: FormDataEntryValue | null | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function whole(value: string) {
  return /^\d+$/.test(value) ? Number(value) : Number.NaN
}

function optionalWhole(value: string) {
  return value === '' ? null : whole(value)
}

function creditUnits(value: string) {
  return /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(value) ? Math.round(Number(value) * 100) : Number.NaN
}

export function readCoachingPackage(form: FormData) {
  const get = (name: string) => text(form.get(name))
  const kind = get('kind')
  const installments = kind === 'fixed' && get('installments') === 'on'
  const durations = form.getAll('formatDuration')
  const costs = form.getAll('formatCredits')
  return packageSchema.safeParse({
    name: get('name'),
    description: get('description'),
    kind,
    termWeeks: kind === 'fixed' ? optionalWhole(get('termWeeks')) : null,
    creditUnits: creditUnits(get('credits')),
    sessionFormats: form.getAll('formatName').map((name, index) => ({
      name: text(name),
      durationMinutes: whole(text(durations[index])),
      creditUnits: creditUnits(text(costs[index])),
    })),
    priceCents: parseDollars(get('price')) ?? Number.NaN,
    installmentCount: installments ? whole(get('installmentCount')) : null,
    installmentCadence: installments ? get('installmentCadence') : null,
    eligibleCoachIds: get('coachMode') === 'selected' ? [...new Set(form.getAll('coachId').map(text))] : null,
    cancellationNoticeHours: optionalWhole(get('cancellationNoticeHours')),
    lateCancellation: get('lateCancellation'),
    expiration: get('expiration'),
    makeupExtensionDays: optionalWhole(get('makeupExtensionDays')),
  })
}

export function formatCredits(units: number) {
  const credits = units / 100
  return `${credits} ${credits === 1 ? 'credit' : 'credits'}`
}
