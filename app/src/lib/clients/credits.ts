/** Credits are hundredths and money is cents. Round cumulative funding down, never each payment. */
export function fundedCreditUnits(allowance: number, priceCents: number, paidCents: number) {
  return Math.floor(allowance * Math.min(Math.max(0, paidCents), priceCents) / priceCents)
}

type CreditBalance = {
  funded_units: number
  reserved_units: number
  used_units: number
  forfeited_units: number
  expired_units: number
  unpaid_reserved_units?: number
  waiting_reserved_units?: number
}

export function uncommittedPaidUnits(balance: CreditBalance) {
  return Math.max(0, balance.funded_units - balance.reserved_units + (balance.unpaid_reserved_units ?? 0)
    - balance.used_units - balance.forfeited_units - balance.expired_units)
}

export function availableCreditUnits(balance: CreditBalance) {
  return Math.max(0, uncommittedPaidUnits(balance) - (balance.waiting_reserved_units ?? 0))
}

export function availablePurchasedUnits(balance: CreditBalance & { credit_units: number }) {
  return Math.max(0, balance.credit_units - balance.reserved_units - balance.used_units - balance.forfeited_units - balance.expired_units)
}

export function unpaidDeadline(start: Date, hours: number) {
  return new Date(start.getTime() - hours * 3_600_000)
}

export function businessDate(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** Date-only service periods do not change length at a daylight saving transition. */
export function servicePeriodEnd(startsOn: string, termWeeks: number | null) {
  const end = new Date(`${startsOn}T00:00:00Z`)
  if (termWeeks !== null) {
    end.setUTCDate(end.getUTCDate() + termWeeks * 7)
  } else {
    const day = end.getUTCDate()
    end.setUTCMonth(end.getUTCMonth() + 1, 1)
    const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
    end.setUTCDate(Math.min(day, lastDay))
  }
  return end.toISOString().split('T')[0]
}

export function formatClientDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

export function formatServicePeriod(startsOn: string, endsOn: string) {
  const through = new Date(`${endsOn}T00:00:00Z`)
  through.setUTCDate(through.getUTCDate() - 1)
  return `${formatClientDate(startsOn)} – ${formatClientDate(through.toISOString().split('T')[0])}`
}
