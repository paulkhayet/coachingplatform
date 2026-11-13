import { NextResponse, type NextRequest } from 'next/server'
import { PAY_METHOD_LABELS, csv, dollars, localDay, summarize } from '@/lib/insights/finance'
import { dashboardAccess, loadFinanceFacts } from '@/lib/insights/server'
import { readFinanceParams } from '../params'

/**
 * CSV downloads for Finances (D-074): the coach pay report, or the list of transactions. Owner only,
 * checked here before anything is loaded: a route handler doesn't pass through the page's guard.
 */
export async function GET(request: NextRequest) {
  const access = await dashboardAccess()
  if (!access.enabled || !access.owner) return new NextResponse('Not found', { status: 404 })
  const { business } = access
  const params = Object.fromEntries(request.nextUrl.searchParams)
  const now = new Date()
  const { period, since } = readFinanceParams(params, business.timezone, now)
  const summary = summarize(await loadFinanceFacts(business, since, now), period)
  const range = `${period.fromDay}_to_${period.toDay}`

  let name: string
  let rows: (string | number | null)[][]
  if (params.kind === 'transactions') {
    name = `transactions_${range}.csv`
    rows = [['Date', 'Client or guest', 'Coach', 'Type', 'Detail', 'Amount', 'Stripe fee'],
      ...summary.transactions.map((t) => [t.day, t.who, t.coach, t.type, t.detail, dollars(t.amountCents), t.feeCents === null ? '' : dollars(t.feeCents)])]
  } else {
    name = `coach_pay_${range}.csv`
    rows = [['Coach', 'Paid', 'Date', 'Session', 'With', 'Type', 'Minutes', 'Session worth', 'Pay', 'Note']]
    for (const c of summary.byCoach) {
      const method = c.method ? PAY_METHOD_LABELS[c.method] : 'No pay rate set'
      for (const l of c.lines) {
        rows.push([c.name, method, localDay(l.at, business.timezone), l.title, l.who, l.kind === 'forfeited' ? 'Late cancellation' : l.kind === 'call' ? 'Paid call' : l.kind === 'kept_call' ? 'Paid call cancelled late (payment kept)' : 'Session', l.minutes, dollars(l.revenueCents), dollars(l.payCents), ''])
      }
      if (c.salaryCents > 0) rows.push([c.name, method, period.toDay, 'Salary for the period', '', 'Salary', '', '', dollars(c.salaryCents), ''])
      rows.push([c.name, method, '', 'Total', '', '', c.minutes, dollars(c.deliveredCents), dollars(c.payCents), c.unratedSessions ? `${c.unratedSessions} sessions had no pay rate and count as 0` : ''])
    }
  }
  return new NextResponse(csv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'private, no-store',
    },
  })
}
