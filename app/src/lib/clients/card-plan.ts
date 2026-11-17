import type { AssignedPackageTerms } from '@/db/schema'

// Paying for a package by card (D-076). Pure rules shared by the pay page, the staff screens and the server.

/** Stripe won't take a card payment under 50 cents. */
export const MIN_CARD_CENTS = 50

/**
 * Splits a price into equal instalments. Stripe charges the same amount every period, so any leftover
 * cents are added to the first payment: $1,000 in 3 is $333.34 now, then $333.33 twice.
 */
export function instalmentSplit(totalCents: number, count: number) {
  const each = Math.floor(totalCents / count)
  return { each, first: totalCents - each * (count - 1), extra: totalCents - each * count }
}

export type CardOption =
  | { kind: 'full'; amountCents: number }
  | { kind: 'instalments'; count: number; cadence: 'weekly' | 'monthly'; firstCents: number; eachCents: number }

/**
 * What a family can choose on the pay page: the rest of the balance in one payment, and instalments when
 * the package offers them, nothing has been paid yet, and the staff member allowed it on this link.
 */
export function cardOptions(input: { terms: AssignedPackageTerms; paidCents: number; allowInstalments: boolean }): CardOption[] {
  const remaining = Math.max(0, input.terms.priceCents - input.paidCents)
  if (remaining < MIN_CARD_CENTS) return []
  const options: CardOption[] = [{ kind: 'full', amountCents: remaining }]
  const { installmentCount: count, installmentCadence: cadence } = input.terms
  if (input.allowInstalments && input.paidCents === 0 && input.terms.kind === 'fixed' && count && cadence) {
    const split = instalmentSplit(input.terms.priceCents, count)
    if (split.each >= MIN_CARD_CENTS) options.push({ kind: 'instalments', count, cadence, firstCents: split.first, eachCents: split.each })
  }
  return options
}

export const cadenceWord = (cadence: 'weekly' | 'monthly') => (cadence === 'weekly' ? 'week' : 'month')

/** "4 monthly payments: $250.02 today, then $249.99 a month" */
export function describeInstalments(o: Extract<CardOption, { kind: 'instalments' }>, money: (cents: number) => string) {
  const rest = `${money(o.eachCents)} a ${cadenceWord(o.cadence)}`
  return o.firstCents === o.eachCents
    ? `${o.count} ${o.cadence} payments of ${money(o.eachCents)}`
    : `${o.count} ${o.cadence} payments: ${money(o.firstCents)} today, then ${rest}`
}
