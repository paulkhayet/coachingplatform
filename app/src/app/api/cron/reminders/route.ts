import { timingSafeEqual } from 'node:crypto'
import { sendDueReminders } from '@/lib/booking/server'

// Sends booking reminders (D-056). Call it every 15 minutes with "Authorization: Bearer <CRON_SECRET>"
// (Supabase pg_cron + pg_net, or Vercel Cron, which sends that header itself). Safe to call often:
// each booking is claimed before its reminder is sent.

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  const given = request.headers.get('authorization') ?? ''
  if (!secret) return false
  const a = Buffer.from(given)
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function run(request: Request) {
  if (!authorized(request)) return new Response('Unauthorized', { status: 401 })
  const result = await sendDueReminders()
  return Response.json(result)
}

export const GET = run
export const POST = run
