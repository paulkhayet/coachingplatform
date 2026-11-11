import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '@/db/schema'
import { assignClientPackage, recordClientPayment } from '@/lib/clients/finance'
import { cancelCoachingForDepartedHost, cancelUnpaidReservation, finishCoachingSession, moveCoachingSession, reserveCoachingSeries, reserveCoachingSession } from '@/lib/clients/sessions'
import { acceptInvitation, findInvitation, hashToken, sendInvitation } from '@/lib/team/invitations'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB_URL, as, createUser, resetDatabase } from './helpers'

// Runs only when TEST_DATABASE_URL points at a disposable Postgres database (CI provides one).
describe.skipIf(!DB_URL)('row-level security', () => {
  let sql: postgres.Sql
  let financeSql: postgres.Sql
  let eleni: string
  let marcus: string
  let outsider: string
  let willow: string

  beforeAll(async () => {
    sql = postgres(DB_URL!, { max: 1, onnotice: () => {} })
    await resetDatabase(sql)
    eleni = await createUser(sql, 'eleni@example.com', 'Eleni Morgan')
    marcus = await createUser(sql, 'marcus@example.com', 'Marcus Hale')
    outsider = await createUser(sql, 'other@example.com', 'Other Owner')
    willow = await as(sql, eleni, async (tx) => {
      const [r] = await tx<{ id: string }[]>`SELECT public.create_business('Willow Coaching', 'willow-coaching') AS id`
      return r.id
    })
  })
  afterAll(async () => {
    await financeSql?.end()
    await sql?.end()
  })

  it('creates a profile for every new user', async () => {
    const [p] = await sql`SELECT full_name, email FROM public.profiles WHERE id = ${eleni}`
    expect(p).toEqual({ full_name: 'Eleni Morgan', email: 'eleni@example.com' })
  })

  it('keeps profile photos private and restricts each profile to its own folder', async () => {
    const path = `${eleni}/photo.png`
    await as(sql, eleni, (tx) => tx`INSERT INTO storage.objects (bucket_id, name) VALUES ('profile-photos', ${path})`)
    expect(await as(sql, eleni, (tx) => tx`UPDATE profiles SET avatar_path = ${path} WHERE id = ${eleni} RETURNING avatar_path`)).toEqual([{ avatar_path: path }])
    expect(await as(sql, eleni, (tx) => tx`SELECT name FROM storage.objects`)).toEqual([{ name: path }])
    expect(await as(sql, outsider, (tx) => tx`SELECT name FROM storage.objects`)).toEqual([])
    expect(await as(sql, null, (tx) => tx`SELECT name FROM storage.objects`)).toEqual([])
    expect(await as(sql, outsider, (tx) => tx`DELETE FROM storage.objects WHERE name = ${path} RETURNING name`)).toEqual([])
    await expect(as(sql, outsider, (tx) => tx`INSERT INTO storage.objects (bucket_id, name) VALUES ('profile-photos', ${eleni + '/other.png'})`)).rejects.toThrow(/row-level security/)
    await expect(as(sql, outsider, (tx) => tx`UPDATE profiles SET avatar_path = ${path} WHERE id = ${outsider}`)).rejects.toThrow(/profiles_avatar_path_owner/)
    expect(await as(sql, eleni, (tx) => tx`DELETE FROM storage.objects WHERE name = ${path} RETURNING name`)).toEqual([{ name: path }])
    await as(sql, eleni, (tx) => tx`UPDATE profiles SET avatar_path = null WHERE id = ${eleni}`)
  })

  it('keeps platform billing customer links off the data API', async () => {
    await sql`INSERT INTO workspace_billing_customers (business_id, livemode, stripe_customer_id)
      VALUES (${willow}, false, 'cus_testWorkspace'), (${willow}, true, 'cus_liveWorkspace')`
    await expect(as(sql, eleni, (tx) => tx`SELECT stripe_customer_id FROM workspace_billing_customers`)).rejects.toThrow(/permission denied/)
    await expect(as(sql, eleni, (tx) => tx`UPDATE workspace_billing_customers SET stripe_customer_id = 'cus_other'`)).rejects.toThrow(/permission denied/)
    await expect(as(sql, null, (tx) => tx`SELECT stripe_customer_id FROM workspace_billing_customers`)).rejects.toThrow(/permission denied/)
  })

  it('makes the creator the owner of their new business', async () => {
    const rows = await as(sql, eleni, (tx) => tx`SELECT role, status, coaches, financial FROM public.memberships WHERE business_id = ${willow}`)
    expect(rows).toEqual([{ role: 'owner', status: 'active', coaches: true, financial: true }])
  })

  it('hides everything from anonymous visitors', async () => {
    expect(await as(sql, null, (tx) => tx`SELECT id FROM public.businesses`)).toHaveLength(0)
    expect(await as(sql, null, (tx) => tx`SELECT id FROM public.memberships`)).toHaveLength(0)
    expect(await as(sql, null, (tx) => tx`SELECT id FROM public.profiles`)).toHaveLength(0)
    await expect(as(sql, null, (tx) => tx`SELECT public.create_business('Sneaky', 'sneaky')`)).rejects.toThrow(/permission denied/)
  })

  it('keeps one business invisible to members of another', async () => {
    await as(sql, outsider, (tx) => tx`SELECT public.create_business('Other Coaching', 'other-coaching')`)
    const seen = await as(sql, outsider, (tx) => tx<{ name: string }[]>`SELECT name FROM public.businesses`)
    expect(seen.map((b) => b.name)).toEqual(['Other Coaching'])
    expect(await as(sql, outsider, (tx) => tx`SELECT id FROM public.memberships WHERE business_id = ${willow}`)).toHaveLength(0)
    expect(await as(sql, outsider, (tx) => tx`SELECT id FROM public.profiles WHERE id = ${eleni}`)).toHaveLength(0)
  })

  it('stops outsiders from joining or editing a business', async () => {
    await expect(as(sql, outsider, (tx) => tx`INSERT INTO public.memberships (business_id, user_id, role) VALUES (${willow}, ${outsider}, 'coach')`)).rejects.toThrow(/row-level security/)
    const updated = await as(sql, outsider, (tx) => tx`UPDATE public.businesses SET name = 'Hijacked' WHERE id = ${willow} RETURNING id`)
    expect(updated).toHaveLength(0)
  })

  it('lets the owner add staff, who then see colleagues but cannot manage the team', async () => {
    await as(sql, eleni, (tx) => tx`INSERT INTO public.memberships (business_id, user_id, role, title) VALUES (${willow}, ${marcus}, 'admin', 'Operations')`)
    const team = await as(sql, marcus, (tx) => tx`SELECT user_id FROM public.memberships WHERE business_id = ${willow}`)
    expect(team).toHaveLength(2)
    const colleague = await as(sql, marcus, (tx) => tx`SELECT full_name FROM public.profiles WHERE id = ${eleni}`)
    expect(colleague).toEqual([{ full_name: 'Eleni Morgan' }])
    expect(await as(sql, marcus, (tx) => tx`UPDATE public.businesses SET name = 'Renamed' WHERE id = ${willow} RETURNING id`)).toHaveLength(0)
    await expect(as(sql, marcus, (tx) => tx`INSERT INTO public.memberships (business_id, user_id, role) VALUES (${willow}, ${outsider}, 'coach')`)).rejects.toThrow(/row-level security/)
  })

  it('lets only the owner set opening hours for everyone (D-059)', async () => {
    const weekdays = [1, 2, 3, 4, 5].map((day) => ({ day, start: 540, end: 1020 }))
    expect(await as(sql, marcus, (tx) => tx`UPDATE public.businesses SET opening_hours = ${tx.json(weekdays)} WHERE id = ${willow} RETURNING id`)).toHaveLength(0)
    expect(await as(sql, eleni, (tx) => tx`UPDATE public.businesses SET opening_hours = ${tx.json(weekdays)} WHERE id = ${willow} RETURNING id`)).toHaveLength(1)
    const seen = await as(sql, marcus, (tx) => tx`SELECT opening_hours FROM public.businesses WHERE id = ${willow}`)
    expect(seen[0]?.opening_hours).toHaveLength(5)
    await expect(sql`UPDATE public.businesses SET opening_hours = '{"day":1}'::jsonb WHERE id = ${willow}`).rejects.toThrow(/businesses_opening_hours_array/)
    await sql`UPDATE public.businesses SET opening_hours = NULL WHERE id = ${willow}`
  })

  it('never lets anyone become an owner or remove themselves through the API', async () => {
    await expect(as(sql, eleni, (tx) => tx`INSERT INTO public.memberships (business_id, user_id, role) VALUES (${willow}, ${outsider}, 'owner')`)).rejects.toThrow(/row-level security/)
    await expect(as(sql, eleni, (tx) => tx`UPDATE public.memberships SET role = 'owner' WHERE business_id = ${willow} AND user_id = ${marcus}`)).rejects.toThrow(/row-level security/)
    expect(await as(sql, eleni, (tx) => tx`DELETE FROM public.memberships WHERE user_id = ${eleni} RETURNING id`)).toHaveLength(0)
  })

  it('removes access as soon as a member is made inactive', async () => {
    await as(sql, eleni, (tx) => tx`UPDATE public.memberships SET status = 'inactive' WHERE business_id = ${willow} AND user_id = ${marcus}`)
    expect(await as(sql, marcus, (tx) => tx`SELECT id FROM public.businesses WHERE id = ${willow}`)).toHaveLength(0)
  })

  it('protects package prices and restricts changes to financial staff in the business', async () => {
    const operator = await createUser(sql, 'package-admin@example.com', 'Package Administrator')
    const coach = await createUser(sql, 'package-coach@example.com', 'Package Coach')
    await sql`INSERT INTO public.memberships (business_id, user_id, role, coaches) VALUES
      (${willow}, ${operator}, 'admin', false), (${willow}, ${coach}, 'coach', true)`
    const formats = [{ name: 'Standard', durationMinutes: 60, creditUnits: 100 }, { name: 'Short', durationMinutes: 30, creditUnits: 50 }]
    const insert = (tx: postgres.TransactionSql) => tx<{ id: string }[]>`
      INSERT INTO public.coaching_packages (business_id, name, kind, term_weeks, credit_units, price_cents, session_formats)
      VALUES (${willow}, 'Eight-week bundle', 'fixed', 8, 800, 120000, ${tx.json(formats)}) RETURNING id`
    const [pkg] = await as(sql, eleni, insert)
    expect(await as(sql, operator, (tx) => tx`SELECT price_cents FROM public.coaching_packages WHERE id = ${pkg.id}`)).toEqual([{ price_cents: 120000 }])
    expect(await as(sql, coach, (tx) => tx`SELECT price_cents FROM public.coaching_packages WHERE id = ${pkg.id}`)).toEqual([])
    expect(await as(sql, outsider, (tx) => tx`SELECT price_cents FROM public.coaching_packages WHERE id = ${pkg.id}`)).toEqual([])
    await expect(as(sql, null, (tx) => tx`SELECT price_cents FROM public.coaching_packages`)).rejects.toThrow(/permission denied/)
    await expect(as(sql, operator, insert)).rejects.toThrow(/row-level security/)
    await expect(as(sql, outsider, insert)).rejects.toThrow(/row-level security/)
    expect(await as(sql, operator, (tx) => tx`UPDATE public.coaching_packages SET price_cents = 1 WHERE id = ${pkg.id} RETURNING id`)).toEqual([])
    await sql`UPDATE public.memberships SET financial = true WHERE business_id = ${willow} AND user_id = ${operator}`
    expect(await as(sql, operator, (tx) => tx`UPDATE public.coaching_packages SET price_cents = 125000 WHERE id = ${pkg.id} RETURNING price_cents`)).toEqual([{ price_cents: 125000 }])
    await expect(as(sql, eleni, (tx) => tx`UPDATE public.coaching_packages SET business_id = ${willow} WHERE id = ${pkg.id}`)).rejects.toThrow(/permission denied/)
    await expect(as(sql, eleni, (tx) => tx`DELETE FROM public.coaching_packages WHERE id = ${pkg.id}`)).rejects.toThrow(/permission denied/)
  })

  it('saves valid session formats and keeps archived packages when a selected coach leaves', async () => {
    const coach = await createUser(sql, 'package-selected@example.com', 'Selected Coach')
    const [member] = await sql<{ id: string }[]>`
      INSERT INTO public.memberships (business_id, user_id, role, coaches) VALUES (${willow}, ${coach}, 'coach', true) RETURNING id`
    const [other] = await sql<{ id: string }[]>`SELECT id FROM public.memberships WHERE user_id = ${outsider} AND business_id <> ${willow} LIMIT 1`
    const [pkg] = await as(sql, eleni, (tx) => tx<{ id: string }[]>`
      INSERT INTO public.coaching_packages (business_id, name, kind, credit_units, price_cents, session_formats, eligible_coach_ids)
      VALUES (${willow}, 'Monthly coaching', 'monthly', 400, 40000,
        ${tx.json([{ name: 'Short', durationMinutes: 30, creditUnits: 50 }])}, ARRAY[${member.id}::uuid]) RETURNING id`)
    await expect(as(sql, eleni, (tx) => tx`UPDATE public.coaching_packages SET eligible_coach_ids = ARRAY[${other.id}::uuid] WHERE id = ${pkg.id}`)).rejects.toThrow(/Choose active coaches/)
    await expect(as(sql, eleni, (tx) => tx`UPDATE public.coaching_packages SET credit_units = 25 WHERE id = ${pkg.id}`)).rejects.toThrow(/coaching_packages_formats/)
    await expect(as(sql, eleni, (tx) => tx`UPDATE public.coaching_packages SET session_formats = '[{}]'::jsonb WHERE id = ${pkg.id}`)).rejects.toThrow(/coaching_packages_formats/)
    await expect(as(sql, eleni, (tx) => tx`UPDATE public.coaching_packages SET installment_count = 3, installment_cadence = 'monthly' WHERE id = ${pkg.id}`)).rejects.toThrow(/coaching_packages_installments/)
    await sql`UPDATE public.memberships SET status = 'inactive' WHERE id = ${member.id}`
    expect(await as(sql, eleni, (tx) => tx`UPDATE public.coaching_packages SET archived_at = now() WHERE id = ${pkg.id} RETURNING id`)).toEqual([{ id: pkg.id }])
    await expect(as(sql, eleni, (tx) => tx`UPDATE public.coaching_packages SET archived_at = null WHERE id = ${pkg.id}`)).rejects.toThrow(/Choose active coaches/)
    expect(await as(sql, eleni, (tx) => tx`UPDATE public.coaching_packages SET archived_at = null, eligible_coach_ids = null WHERE id = ${pkg.id} RETURNING archived_at, price_cents`)).toEqual([{ archived_at: null, price_cents: 40000 }])
  })

  it('keeps the reminder trigger away from the API', async () => {
    await expect(as(sql, eleni, (tx) => tx`SELECT private.request_reminders()`)).rejects.toThrow(/permission denied/)
    await expect(as(sql, null, (tx) => tx`SELECT private.request_reminders()`)).rejects.toThrow(/permission denied/)
  })

  it('scopes client contacts and coach assignments to authorized staff', async () => {
    const assigned = await createUser(sql, 'client-assigned@example.com', 'Assigned Coach')
    const unassigned = await createUser(sql, 'client-unassigned@example.com', 'Unassigned Coach')
    const [coach] = await sql<{ id: string }[]>`INSERT INTO public.memberships (business_id, user_id, role, coaches) VALUES (${willow}, ${assigned}, 'coach', true) RETURNING id`
    await sql`INSERT INTO public.memberships (business_id, user_id, role, coaches) VALUES (${willow}, ${unassigned}, 'coach', true)`
    const [other] = await sql<{ id: string }[]>`SELECT id FROM public.memberships WHERE user_id = ${outsider} AND business_id <> ${willow} LIMIT 1`
    const [client] = await as(sql, eleni, (tx) => tx<{ id: string }[]>`
      INSERT INTO public.coaching_clients (business_id, name, coach_membership_id) VALUES (${willow}, 'Test Client', ${coach.id}) RETURNING id`)
    const [guardian] = await as(sql, eleni, (tx) => tx<{ id: string }[]>`
      INSERT INTO public.client_guardians (business_id, client_id, name, email) VALUES (${willow}, ${client.id}, 'Guardian Contact', 'guardian@example.com') RETURNING id`)
    expect(await as(sql, assigned, (tx) => tx`SELECT id FROM public.coaching_clients WHERE id = ${client.id}`)).toEqual([{ id: client.id }])
    expect(await as(sql, assigned, (tx) => tx`SELECT id FROM public.client_guardians WHERE id = ${guardian.id}`)).toEqual([])
    expect(await as(sql, unassigned, (tx) => tx`SELECT id FROM public.coaching_clients WHERE id = ${client.id}`)).toEqual([])
    expect(await as(sql, outsider, (tx) => tx`SELECT id FROM public.coaching_clients WHERE id = ${client.id}`)).toEqual([])
    expect(await as(sql, assigned, (tx) => tx`UPDATE public.coaching_clients SET name = 'Changed' WHERE id = ${client.id} RETURNING id`)).toEqual([])
    await expect(as(sql, eleni, (tx) => tx`UPDATE public.coaching_clients SET coach_membership_id = ${other.id} WHERE id = ${client.id}`)).rejects.toThrow(/Choose an active coach/)
    await as(sql, eleni, (tx) => tx`UPDATE public.coaching_clients SET coach_membership_id = null WHERE id = ${client.id}`)
    expect(await as(sql, assigned, (tx) => tx`SELECT id FROM public.coaching_clients WHERE id = ${client.id}`)).toEqual([])
  })

  it('snapshots package terms and funds credits once per verified offline payment', async () => {
    // Drizzle configures JSON encoding on its connection. Keep the raw SQL test client separate.
    financeSql = postgres(DB_URL!, { max: 1, prepare: false, onnotice: () => {} })
    const db = drizzle(financeSql, { schema })
    const coachUser = await createUser(sql, 'credit-coach@example.com', 'Credit Coach')
    const [coach] = await sql<{ id: string }[]>`INSERT INTO public.memberships (business_id, user_id, role, coaches) VALUES (${willow}, ${coachUser}, 'coach', true) RETURNING id`
    const [client] = await as(sql, eleni, (tx) => tx<{ id: string }[]>`
      INSERT INTO public.coaching_clients (business_id, name, coach_membership_id) VALUES (${willow}, 'Credit Client', ${coach.id}) RETURNING id`)
    const formats = [{ name: 'Standard', durationMinutes: 60, creditUnits: 100 }]
    const [source] = await sql<{ id: string }[]>`
      INSERT INTO public.coaching_packages (business_id, name, kind, term_weeks, credit_units, price_cents, session_formats, updated_at)
      VALUES (${willow}, 'Test package', 'fixed', 12, 1200, 120000, ${sql.json(formats)}, '2026-11-11T12:00:00.123456Z') RETURNING id`
    const actor = { businessId: willow, clientId: client.id, userId: eleni }
    const input = { id: randomUUID(), packageId: source.id, packageVersion: '2026-11-11T12:00:00.123456Z', startsOn: '2026-11-11' }
    const periodId = await assignClientPackage(db, actor, input)
    expect(await assignClientPackage(db, actor, input)).toBe(periodId)
    expect(await as(sql, coachUser, (tx) => tx`SELECT funded_units, paid_cents FROM public.client_credit_balances(${willow}, ${client.id})`)).toEqual([{ funded_units: 0, paid_cents: null }])
    await sql`UPDATE public.coaching_packages SET price_cents = 180000, updated_at = now() WHERE id = ${source.id}`
    await expect(assignClientPackage(db, actor, { ...input, id: randomUUID() })).rejects.toThrow(/changed or is unavailable/)
    const payment = { id: randomUUID(), periodId, amountCents: 40000, method: 'check' as const, receivedOn: '2026-11-11', reference: 'Test receipt' }
    await expect(recordClientPayment(db, { ...actor, userId: coachUser }, payment)).rejects.toThrow(/financial permission/)
    await recordClientPayment(db, actor, payment)
    await recordClientPayment(db, actor, payment)
    await expect(recordClientPayment(db, actor, { ...payment, id: randomUUID(), amountCents: 90000 })).rejects.toThrow(/remaining balance/)
    await expect(as(sql, eleni, (tx) => tx`UPDATE public.client_credit_payments SET amount_cents = 1 WHERE id = ${payment.id}`)).rejects.toThrow(/permission denied/)
    await expect(as(sql, eleni, (tx) => tx`INSERT INTO public.client_credit_events (business_id, client_id, period_id, kind, credit_units) VALUES (${willow}, ${client.id}, ${periodId}, 'used', 100)`)).rejects.toThrow(/permission denied/)
    await sql`INSERT INTO public.client_credit_events (business_id, client_id, period_id, kind, credit_units) VALUES
      (${willow}, ${client.id}, ${periodId}, 'reserved', 100), (${willow}, ${client.id}, ${periodId}, 'used', 50)`
    expect(await as(sql, eleni, (tx) => tx`SELECT paid_cents, funded_units FROM public.client_credit_balances(${willow}, ${client.id})`)).toEqual([{ paid_cents: 40000, funded_units: 400 }])
    expect(await as(sql, coachUser, (tx) => tx`SELECT paid_cents, funded_units, reserved_units, used_units FROM public.client_credit_balances(${willow}, ${client.id})`)).toEqual([{ paid_cents: null, funded_units: 400, reserved_units: 100, used_units: 50 }])
    expect(await as(sql, coachUser, (tx) => tx`SELECT terms FROM public.client_packages WHERE id = ${input.id}`)).toEqual([])
    expect(await as(sql, outsider, (tx) => tx`SELECT * FROM public.client_credit_balances(${willow}, ${client.id})`)).toEqual([])

    const [monthly] = await sql<{ id: string }[]>`
      INSERT INTO public.coaching_packages (business_id, name, kind, credit_units, price_cents, session_formats, updated_at)
      VALUES (${willow}, 'Monthly test package', 'monthly', 400, 40000, ${sql.json(formats)}, '2026-11-11T12:00:00.123456Z') RETURNING id`
    const monthlyPeriod = await assignClientPackage(db, actor, { ...input, id: randomUUID(), packageId: monthly.id, startsOn: '2026-01-31' })
    await expect(recordClientPayment(db, actor, { ...payment, id: randomUUID(), periodId: monthlyPeriod, amountCents: 20000 })).rejects.toThrow(/full payment/)
    await recordClientPayment(db, actor, { ...payment, id: randomUUID(), periodId: monthlyPeriod })
    expect(await as(sql, eleni, (tx) => tx`SELECT funded_units, ends_on::text AS ends_on FROM public.client_credit_balances(${willow}, ${client.id}) WHERE id = ${monthlyPeriod}`)).toEqual([{ funded_units: 400, ends_on: '2026-02-28' }])
  })

  it('keeps contact requests away from the API (D-067)', async () => {
    await sql`INSERT INTO public.contact_requests (name, email, organization, team_size) VALUES ('Sam', 'sam@corp.example', 'Corp', '26–50')`
    await expect(as(sql, eleni, (tx) => tx`SELECT 1 FROM public.contact_requests`)).rejects.toThrow(/permission denied/)
    await expect(as(sql, null, (tx) => tx`INSERT INTO public.contact_requests (name, email, organization, team_size) VALUES ('x', 'x@x', 'x', 'x')`)).rejects.toThrow(/permission denied/)
    await expect(sql`INSERT INTO public.contact_requests (name, email, organization, team_size) VALUES (${'n'.repeat(200)}, 'a@b', 'c', 'd')`).rejects.toThrow(/contact_requests_lengths/)
  })

  it('holds funded credits for coaching and settles each session outcome once', async () => {
    financeSql ??= postgres(DB_URL!, { max: 1, prepare: false, onnotice: () => {} })
    const db = drizzle(financeSql, { schema })
    const hostUser = await createUser(sql, 'session-host@example.com', 'Session Host')
    const otherUser = await createUser(sql, 'session-other@example.com', 'Other Coach')
    const [host, other] = await sql<{ id: string }[]>`
      INSERT INTO public.memberships (business_id, user_id, role, coaches)
      VALUES (${willow}, ${hostUser}, 'coach', true), (${willow}, ${otherUser}, 'coach', true) RETURNING id`
    const [client] = await as(sql, eleni, (tx) => tx<{ id: string }[]>`
      INSERT INTO public.coaching_clients (business_id, name) VALUES (${willow}, 'Session Client') RETURNING id`)
    const [pkg] = await sql<{ id: string }[]>`
      INSERT INTO public.coaching_packages (business_id, name, kind, term_weeks, credit_units, price_cents, session_formats, cancellation_notice_hours, late_cancellation, updated_at)
      VALUES (${willow}, 'Coaching Sessions', 'fixed', 12, 1200, 120000,
        ${sql.json([{ name: 'Standard', durationMinutes: 60, creditUnits: 100 }])}, 24, 'forfeit', '2026-11-11T12:00:00Z') RETURNING id`
    const actor = { businessId: willow, clientId: client.id, userId: eleni }
    const periodId = await assignClientPackage(db, actor, { id: randomUUID(), packageId: pkg.id, packageVersion: '2026-11-11T12:00:00Z', startsOn: '2026-11-11' })
    const scope = { ...actor, periodId }
    const now = new Date('2026-11-11T12:00:00Z')
    const session = { id: randomUUID(), coachId: host.id, formatIndex: 0, startsAt: new Date('2026-11-12T16:00:00Z'),
      locationType: 'phone' as const, locationDetail: 'Coach calls the client', contact: 'none', noticeHours: null, lateCancellation: null }
    await expect(reserveCoachingSession(db, scope, session, now)).rejects.toThrow(/funded credits/)
    await recordClientPayment(db, actor, { id: randomUUID(), periodId, amountCents: 40000, method: 'check', receivedOn: '2026-11-11', reference: null })
    expect(await reserveCoachingSession(db, scope, session, now)).toEqual({ id: session.id, coveredIds: [session.id], created: true })
    expect(await reserveCoachingSession(db, scope, session, now)).toEqual({ id: session.id, coveredIds: [], created: false })
    await expect(reserveCoachingSession(db, scope, { ...session, id: randomUUID(), coachId: other.id }, now)).rejects.toMatchObject({ cause: { code: '23P01' } })
    expect(await as(sql, hostUser, (tx) => tx`SELECT id FROM public.bookings WHERE id = ${session.id}`)).toEqual([{ id: session.id }])
    expect(await as(sql, otherUser, (tx) => tx`SELECT id FROM public.bookings WHERE id = ${session.id}`)).toEqual([])
    expect(await as(sql, eleni, (tx) => tx`SELECT reserved_units, used_units FROM public.client_credit_balances(${willow}, ${client.id})`)).toEqual([{ reserved_units: 100, used_units: 0 }])
    await expect(finishCoachingSession(db, { ...actor, userId: otherUser }, session.id, { action: 'attend' }, now)).rejects.toThrow(/access to manage/)
    await expect(finishCoachingSession(db, actor, session.id, { action: 'attend' }, now)).rejects.toThrow(/after the session ends/)
    const newStart = new Date('2026-11-12T18:00:00Z')
    await expect(moveCoachingSession(db, { ...actor, userId: otherUser }, session.id, session.startsAt, newStart, now)).rejects.toThrow(/access to manage/)
    await sql`UPDATE public.bookings SET reminder_sent_at = now() WHERE id = ${session.id}`
    const moved = await moveCoachingSession(db, { ...actor, userId: hostUser }, session.id, session.startsAt, newStart, now)
    expect(moved).toMatchObject({ startsAt: newStart, endsAt: new Date('2026-11-12T19:00:00Z'), reminderSentAt: null, creditUnits: 100 })
    await expect(moveCoachingSession(db, actor, session.id, session.startsAt, new Date('2026-11-12T20:00:00Z'), now)).rejects.toThrow(/session changed/)
    expect(await sql`SELECT kind, credit_units FROM public.client_credit_events WHERE booking_id = ${session.id}`).toEqual([{ kind: 'reserved', credit_units: 100 }])
    const afterSession = new Date('2026-11-12T19:01:00Z')
    await finishCoachingSession(db, { ...actor, userId: hostUser }, session.id, { action: 'attend' }, afterSession)
    await expect(finishCoachingSession(db, actor, session.id, { action: 'attend' }, afterSession)).rejects.toThrow(/already has an outcome/)

    const late = { ...session, id: randomUUID(), startsAt: new Date('2026-11-13T16:00:00Z') }
    await reserveCoachingSession(db, scope, late, now)
    const lateTime = new Date('2026-11-13T12:00:00Z')
    await expect(finishCoachingSession(db, actor, late.id, { action: 'cancel', by: 'guest', expectedOutcome: 'released' }, lateTime)).rejects.toThrow(/notice cutoff/)
    const cancelled = await finishCoachingSession(db, actor, late.id, { action: 'cancel', by: 'guest', expectedOutcome: 'forfeited' }, lateTime)
    expect(cancelled.creditCancellationOutcome).toBe('forfeited')
    const departure = { ...session, id: randomUUID(), startsAt: new Date('2026-11-16T16:00:00Z') }
    await reserveCoachingSession(db, scope, departure, now)
    expect((await cancelCoachingForDepartedHost(db, departure.id, host.id, now))?.creditCancellationOutcome).toBe('released')
    expect(await as(sql, eleni, (tx) => tx`SELECT funded_units, reserved_units, used_units, forfeited_units FROM public.client_credit_balances(${willow}, ${client.id})`))
      .toEqual([{ funded_units: 400, reserved_units: 0, used_units: 100, forfeited_units: 100 }])

    const starts = ['2026-11-16T16:00:00Z', '2026-11-23T16:00:00Z', '2026-11-30T16:00:00Z'].map((day) => new Date(day))
    const seriesId = randomUUID()
    await expect(reserveCoachingSeries(db, scope, { ...session, id: seriesId, starts }, now)).rejects.toThrow(/funded credits/)
    await sql`INSERT INTO public.bookings (business_id, host_membership_id, host_user_id, title, starts_at, ends_at, guest_name, guest_email, location_type)
      VALUES (${willow}, ${host.id}, ${hostUser}, 'Existing consultation', ${starts[1]}, '2026-11-23T17:00:00Z', 'Guest', 'guest@example.com', 'phone')`
    await expect(reserveCoachingSeries(db, scope, { ...session, id: seriesId, starts: starts.slice(0, 2) }, now)).rejects.toMatchObject({ cause: { code: '23P01' } })
    expect(await sql`SELECT id FROM public.bookings WHERE coaching_series_id = ${seriesId}`).toEqual([])
    const selected = [starts[0], starts[2]]
    const series = await reserveCoachingSeries(db, scope, { ...session, id: seriesId, starts: selected }, now)
    expect(series.created).toBe(true)
    expect(series.ids).toHaveLength(2)
    expect((await reserveCoachingSeries(db, scope, { ...session, id: seriesId, starts: selected }, now)).created).toBe(false)
    const movedOccurrence = await moveCoachingSession(db, actor, series.ids[0], starts[0], new Date('2026-11-16T17:00:00Z'), now)
    expect(movedOccurrence.coachingSeriesId).toBe(seriesId)
    expect(await sql`SELECT starts_at FROM public.bookings WHERE id = ${series.ids[1]}`).toEqual([{ starts_at: starts[2] }])
    expect(await as(sql, eleni, (tx) => tx`SELECT reserved_units, used_units, forfeited_units FROM public.client_credit_balances(${willow}, ${client.id})`))
      .toEqual([{ reserved_units: 200, used_units: 100, forfeited_units: 100 }])
  })

  it('holds package capacity, keeps details private, and settles advance reservations in order', async () => {
    financeSql ??= postgres(DB_URL!, { max: 1, prepare: false, onnotice: () => {} })
    const db = drizzle(financeSql, { schema })
    const [business] = await as(sql, eleni, (tx) => tx<{ id: string }[]>`
      SELECT public.create_business('Advance Coaching', 'advance-coaching') AS id`)
    const coachUser = await createUser(sql, 'advance-coach@example.com', 'Advance Coach')
    const [coach] = await sql<{ id: string }[]>`
      INSERT INTO memberships (business_id, user_id, role, coaches) VALUES (${business.id}, ${coachUser}, 'coach', true) RETURNING id`
    expect(await as(sql, coachUser, (tx) => tx`UPDATE businesses SET allow_advance_reservations = true WHERE id = ${business.id} RETURNING id`)).toHaveLength(0)
    expect(await as(sql, eleni, (tx) => tx`UPDATE businesses SET allow_advance_reservations = true,
      payment_reminder_hours = 48, unpaid_cancellation_hours = 24 WHERE id = ${business.id} RETURNING id`)).toHaveLength(1)
    await expect(sql`UPDATE businesses SET payment_reminder_hours = 24 WHERE id = ${business.id}`).rejects.toThrow(/businesses_reservation_hours/)

    const [client] = await sql<{ id: string }[]>`INSERT INTO coaching_clients (business_id, name) VALUES (${business.id}, 'Advance Client') RETURNING id`
    const [pkg] = await sql<{ id: string }[]>`
      INSERT INTO coaching_packages (business_id, name, kind, term_weeks, credit_units, price_cents, session_formats, cancellation_notice_hours, late_cancellation, updated_at)
      VALUES (${business.id}, 'Five Sessions', 'fixed', 5, 500, 50000,
        ${sql.json([{ name: 'Standard', durationMinutes: 60, creditUnits: 100 }])}, 24, 'forfeit', '2026-11-11T12:00:00Z') RETURNING id`
    const actor = { businessId: business.id, clientId: client.id, userId: eleni }
    const periodId = await assignClientPackage(db, actor, { id: randomUUID(), packageId: pkg.id, packageVersion: '2026-11-11T12:00:00Z', startsOn: '2026-11-11' })
    const scope = { ...actor, periodId }
    const now = new Date('2026-11-11T12:00:00Z')
    const payment = { id: randomUUID(), periodId, amountCents: 10000, method: 'check' as const, receivedOn: '2026-11-11', reference: null }
    await recordClientPayment(db, actor, payment, now)
    const starts = ['12', '13', '15', '18', '20'].map((day) => new Date(`2026-11-${day}T16:00:00Z`))
    const details = { id: randomUUID(), coachId: coach.id, formatIndex: 0, locationType: 'video_link' as const,
      locationDetail: 'https://example.com/private-meeting', contact: 'none', noticeHours: null, lateCancellation: null }
    await expect(reserveCoachingSeries(db, scope, { ...details, starts: [new Date('2026-11-11T16:00:00Z'), new Date('2026-11-12T10:00:00Z')] }, now))
      .rejects.toThrow(/inside the payment cutoff/)
    const { ids: [first, second, third, fourth, fifth], coveredIds } = await reserveCoachingSeries(db, scope, { ...details, starts: [...starts].reverse() }, now)
    expect(coveredIds).toEqual([first])
    await expect(reserveCoachingSession(db, scope, { ...details, id: randomUUID(), startsAt: new Date('2026-11-21T16:00:00Z') }, now))
      .rejects.toThrow(/package allowance/)
    expect(await as(sql, coachUser, (tx) => tx`SELECT location_detail, credit_covered_at FROM bookings WHERE id = ${second}`))
      .toEqual([{ location_detail: null, credit_covered_at: null }])
    await expect(as(sql, eleni, (tx) => tx`SELECT detail FROM coaching_reservation_locations`)).rejects.toThrow(/permission denied/)
    await expect(finishCoachingSession(db, actor, second, { action: 'attend' }, new Date('2026-11-13T18:00:00Z')))
      .rejects.toThrow(/paid credit coverage/)

    const installment = { ...payment, id: randomUUID() }
    expect(await recordClientPayment(db, actor, installment, now)).toEqual([second])
    expect(await recordClientPayment(db, actor, installment, now)).toEqual([])
    expect(await as(sql, coachUser, (tx) => tx`SELECT location_detail, credit_covered_at FROM bookings WHERE id = ${second}`))
      .toEqual([{ location_detail: details.locationDetail, credit_covered_at: now }])
    expect(await cancelUnpaidReservation(db, second, new Date('2026-11-12T16:00:00Z'))).toBeNull()
    const cancelled = await finishCoachingSession(db, actor, first, { action: 'cancel', by: 'business' }, now)
    expect(cancelled.coveredIds).toEqual([third])
    await finishCoachingSession(db, actor, second, { action: 'attend' }, new Date('2026-11-13T17:01:00Z'))

    const deadline = new Date('2026-11-17T16:00:00Z')
    expect(await cancelUnpaidReservation(db, fourth, new Date(deadline.getTime() - 1))).toBeNull()
    expect(await recordClientPayment(db, actor, { ...payment, id: randomUUID() }, deadline)).toEqual([fifth])
    expect(await cancelUnpaidReservation(db, fourth, deadline)).toMatchObject({ unpaidCancelled: true, creditCancellationOutcome: 'released', status: 'cancelled' })
    expect(await cancelUnpaidReservation(db, fourth, deadline)).toBeNull()
    expect(await sql`SELECT detail FROM coaching_reservation_locations WHERE booking_id = ${fourth}`).toHaveLength(0)
    expect(await as(sql, eleni, (tx) => tx`SELECT funded_units, reserved_units, unpaid_reserved_units, used_units, forfeited_units
      FROM client_credit_balances(${business.id}, ${client.id})`))
      .toEqual([{ funded_units: 300, reserved_units: 200, unpaid_reserved_units: 0, used_units: 100, forfeited_units: 0 }])
  })

  it('validates new businesses', async () => {
    await expect(as(sql, eleni, (tx) => tx`SELECT public.create_business('Dup', 'willow-coaching')`)).rejects.toThrow(/businesses_slug_key/)
    await expect(as(sql, eleni, (tx) => tx`SELECT public.create_business('Bad slug', 'Not OK!')`)).rejects.toThrow(/businesses_slug_format/)
    await expect(as(sql, eleni, (tx) => tx`SELECT public.create_business('Somewhere', 'somewhere', 'Mars/Olympus')`)).rejects.toThrow(/Unknown time zone/)
  })

  describe('stripe connect', () => {
    let admin: string
    let coach: string

    beforeAll(async () => {
      admin = await createUser(sql, 'ada@example.com', 'Ada Admin')
      coach = await createUser(sql, 'cole@example.com', 'Cole Coach')
      await as(sql, eleni, async (tx) => {
        await tx`INSERT INTO public.memberships (business_id, user_id, role) VALUES (${willow}, ${admin}, 'admin')`
        await tx`INSERT INTO public.memberships (business_id, user_id, role, coaches) VALUES (${willow}, ${coach}, 'coach', true)`
      })
      // The server writes these rows with its own connection (no RLS), like onboarding and webhooks do.
      await sql`INSERT INTO public.stripe_accounts (business_id, stripe_account_id, livemode) VALUES (${willow}, 'acct_willow', false)`
      await sql`INSERT INTO public.stripe_events (id, type, account, livemode, stripe_created_at) VALUES ('evt_1', 'account.updated', 'acct_willow', false, now())`
    })

    it('shows the connected account to owners and administrators only', async () => {
      const read = (user: string) => as(sql, user, (tx) => tx`SELECT stripe_account_id FROM public.stripe_accounts`)
      expect(await read(eleni)).toEqual([{ stripe_account_id: 'acct_willow' }])
      expect(await read(admin)).toEqual([{ stripe_account_id: 'acct_willow' }])
      expect(await read(coach)).toHaveLength(0)
      expect(await read(outsider)).toHaveLength(0)
      expect(await as(sql, null, (tx) => tx`SELECT 1 FROM public.stripe_accounts`)).toHaveLength(0)
    })

    it("never lets a signed-in user write the account, even the owner", async () => {
      await expect(as(sql, eleni, (tx) => tx`UPDATE public.stripe_accounts SET stripe_account_id = 'acct_attacker' WHERE business_id = ${willow}`)).rejects.toThrow(/permission denied/)
      await expect(as(sql, outsider, (tx) => tx`INSERT INTO public.stripe_accounts (business_id, stripe_account_id, livemode) VALUES (${willow}, 'acct_x', false)`)).rejects.toThrow(/permission denied/)
      await expect(as(sql, eleni, (tx) => tx`DELETE FROM public.stripe_accounts WHERE business_id = ${willow}`)).rejects.toThrow(/permission denied/)
    })

    it('keeps the event log out of the API entirely', async () => {
      await expect(as(sql, eleni, (tx) => tx`SELECT id FROM public.stripe_events`)).rejects.toThrow(/permission denied/)
      await expect(as(sql, null, (tx) => tx`SELECT id FROM public.stripe_events`)).rejects.toThrow(/permission denied/)
    })

    it('records each Stripe event only once', async () => {
      const again = await sql`INSERT INTO public.stripe_events (id, type, livemode, stripe_created_at) VALUES ('evt_1', 'account.updated', false, now()) ON CONFLICT DO NOTHING RETURNING id`
      expect(again).toHaveLength(0)
    })

    it('allows one Stripe account per business and one business per Stripe account', async () => {
      await expect(sql`INSERT INTO public.stripe_accounts (business_id, stripe_account_id, livemode) VALUES (${willow}, 'acct_other', false)`).rejects.toThrow(/stripe_accounts_pkey/)
      const [{ id: other }] = await sql<{ id: string }[]>`SELECT id FROM public.businesses WHERE slug = 'other-coaching'`
      await expect(sql`INSERT INTO public.stripe_accounts (business_id, stripe_account_id, livemode) VALUES (${other}, 'acct_willow', false)`).rejects.toThrow(/stripe_accounts_stripe_account_id_key/)
    })

    describe('availability', () => {
      const hours = [{ day: 1, start: 540, end: 1020 }]
      const membershipOf = async (user: string, business = willow) => (await sql<{ id: string }[]>`SELECT id FROM public.memberships WHERE user_id = ${user} AND business_id = ${business}`)[0].id

      it("keeps a person's hours and time off private to them (D-057)", async () => {
        await as(sql, coach, (tx) => tx`INSERT INTO public.availability_schedules (user_id, timezone, weekly_hours) VALUES (${coach}, 'America/Chicago', ${tx.json(hours)})`)
        await as(sql, coach, (tx) => tx`INSERT INTO public.availability_time_off (user_id, starts_at, ends_at, note) VALUES (${coach}, '2026-12-24', '2026-12-27', 'Family trip')`)
        expect(await as(sql, coach, (tx) => tx`SELECT timezone FROM public.availability_schedules`)).toEqual([{ timezone: 'America/Chicago' }])
        // Not even the owner of a business they work for can read or change them: businesses only learn "busy".
        expect(await as(sql, eleni, (tx) => tx`SELECT 1 FROM public.availability_schedules WHERE user_id = ${coach}`)).toHaveLength(0)
        expect(await as(sql, eleni, (tx) => tx`SELECT 1 FROM public.availability_time_off WHERE user_id = ${coach}`)).toHaveLength(0)
        expect(await as(sql, eleni, (tx) => tx`UPDATE public.availability_schedules SET timezone = 'America/Denver' WHERE user_id = ${coach} RETURNING 1`)).toHaveLength(0)
        await expect(as(sql, coach, (tx) => tx`INSERT INTO public.availability_schedules (user_id, timezone) VALUES (${eleni}, 'America/Chicago')`)).rejects.toThrow(/row-level security/)
        await expect(as(sql, outsider, (tx) => tx`INSERT INTO public.availability_time_off (user_id, starts_at, ends_at) VALUES (${coach}, now(), now() + interval '1 hour')`)).rejects.toThrow(/row-level security/)
        expect(await as(sql, null, (tx) => tx`SELECT 1 FROM public.availability_schedules`)).toHaveLength(0)
      })

      it('lets only the person set what one business is offered; managers can see it (D-058)', async () => {
        const coachs = await membershipOf(coach)
        const owners = await membershipOf(eleni)
        await as(sql, coach, (tx) => tx`INSERT INTO public.membership_availability (membership_id, business_id, offered_hours) VALUES (${coachs}, ${willow}, ${tx.json(hours)})`)
        // Owners and administrators can read it but not change it.
        expect(await as(sql, eleni, (tx) => tx`SELECT offered_hours FROM public.membership_availability WHERE membership_id = ${coachs}`)).toHaveLength(1)
        expect(await as(sql, admin, (tx) => tx`UPDATE public.membership_availability SET destination_calendar_id = 'work' WHERE membership_id = ${coachs} RETURNING 1`)).toHaveLength(0)
        expect(await as(sql, eleni, (tx) => tx`DELETE FROM public.membership_availability WHERE membership_id = ${coachs} RETURNING 1`)).toHaveLength(0)
        expect(await as(sql, coach, (tx) => tx`UPDATE public.membership_availability SET destination_calendar_id = 'work' WHERE membership_id = ${coachs} RETURNING destination_calendar_id`)).toEqual([{ destination_calendar_id: 'work' }])
        await expect(as(sql, coach, (tx) => tx`INSERT INTO public.membership_availability (membership_id, business_id) VALUES (${owners}, ${willow})`)).rejects.toThrow(/row-level security/)
        expect(await as(sql, outsider, (tx) => tx`SELECT 1 FROM public.membership_availability`)).toHaveLength(0)
        const [{ id: other }] = await sql<{ id: string }[]>`SELECT id FROM public.businesses WHERE slug = 'other-coaching'`
        await expect(as(sql, coach, (tx) => tx`INSERT INTO public.membership_availability (membership_id, business_id) VALUES (${coachs}, ${other})`)).rejects.toThrow(/row-level security|duplicate key/)
        await expect(sql`UPDATE public.membership_availability SET offered_hours = '{"day":1}'::jsonb WHERE membership_id = ${coachs}`).rejects.toThrow(/membership_availability_offered_array/)
      })

      it('shows a person only their own Google connection, never the token, and lets nobody write it', async () => {
        // The server writes these after its own checks, like the OAuth callback does.
        await sql`INSERT INTO public.google_calendar_connections (user_id, google_email, google_sub, scopes) VALUES (${coach}, 'cole@gmail.com', '123', '{openid}')`
        await sql`INSERT INTO public.google_calendar_tokens (user_id, refresh_token_ciphertext) VALUES (${coach}, 'v1.x.y.z')`
        expect(await as(sql, coach, (tx) => tx`SELECT google_email FROM public.google_calendar_connections`)).toEqual([{ google_email: 'cole@gmail.com' }])
        expect(await as(sql, eleni, (tx) => tx`SELECT 1 FROM public.google_calendar_connections`)).toHaveLength(0)
        await expect(as(sql, coach, (tx) => tx`SELECT refresh_token_ciphertext FROM public.google_calendar_tokens`)).rejects.toThrow(/permission denied/)
        await expect(as(sql, coach, (tx) => tx`UPDATE public.google_calendar_connections SET destination_calendar_id = 'x'`)).rejects.toThrow(/permission denied/)
        await expect(sql`UPDATE public.google_calendar_connections SET status = 'broken' WHERE user_id = ${coach}`).rejects.toThrow(/google_calendar_connections_status/)
        // Removing the connection removes its token.
        await sql`DELETE FROM public.google_calendar_connections WHERE user_id = ${coach}`
        expect(await sql`SELECT 1 FROM public.google_calendar_tokens WHERE user_id = ${coach}`).toHaveLength(0)
      })

      it('shows a person only their own Zoom connection, never the tokens, and lets nobody write it (D-038)', async () => {
        await sql`INSERT INTO public.zoom_connections (user_id, zoom_user_id, zoom_email) VALUES (${coach}, 'zu1', 'cole@zoom.example')`
        await sql`INSERT INTO public.zoom_tokens (user_id, refresh_token_ciphertext) VALUES (${coach}, 'v1.x.y.z')`
        expect(await as(sql, coach, (tx) => tx`SELECT zoom_email FROM public.zoom_connections`)).toEqual([{ zoom_email: 'cole@zoom.example' }])
        expect(await as(sql, eleni, (tx) => tx`SELECT 1 FROM public.zoom_connections`)).toHaveLength(0)
        await expect(as(sql, null, (tx) => tx`SELECT 1 FROM public.zoom_connections`)).rejects.toThrow(/permission denied/)
        await expect(as(sql, coach, (tx) => tx`SELECT refresh_token_ciphertext FROM public.zoom_tokens`)).rejects.toThrow(/permission denied/)
        await expect(as(sql, coach, (tx) => tx`UPDATE public.zoom_connections SET zoom_email = 'x'`)).rejects.toThrow(/permission denied/)
        await expect(as(sql, coach, (tx) => tx`INSERT INTO public.zoom_connections (user_id, zoom_user_id, zoom_email) VALUES (${eleni}, 'zu2', 'e@x')`)).rejects.toThrow(/permission denied/)
        await expect(sql`UPDATE public.zoom_connections SET status = 'broken' WHERE user_id = ${coach}`).rejects.toThrow(/zoom_connections_status/)
        await sql`DELETE FROM public.zoom_connections WHERE user_id = ${coach}`
        expect(await sql`SELECT 1 FROM public.zoom_tokens WHERE user_id = ${coach}`).toHaveLength(0)
      })

      it('lets a coach run their own booking pages, and owners any, but not other coaches', async () => {
        const coachs = await membershipOf(coach)
        const owners = await membershipOf(eleni)
        const [{ id: pageId }] = await as(sql, coach, (tx) => tx<{ id: string }[]>`INSERT INTO public.booking_pages (business_id, host_membership_id, slug, title, duration_minutes) VALUES (${willow}, ${coachs}, 'intro', 'Intro call', 30) RETURNING id`)
        await expect(as(sql, coach, (tx) => tx`INSERT INTO public.booking_pages (business_id, host_membership_id, slug, title, duration_minutes) VALUES (${willow}, ${owners}, 'sneaky', 'Owner page', 30)`)).rejects.toThrow(/row-level security/)
        expect(await as(sql, eleni, (tx) => tx`UPDATE public.booking_pages SET title = 'Intro chat' WHERE id = ${pageId} RETURNING title`)).toEqual([{ title: 'Intro chat' }])
        expect(await as(sql, outsider, (tx) => tx`SELECT 1 FROM public.booking_pages`)).toHaveLength(0)
        await expect(sql`INSERT INTO public.booking_pages (business_id, host_membership_id, slug, title, duration_minutes) VALUES (${willow}, ${coachs}, 'intro', 'Dup', 30)`).rejects.toThrow(/booking_pages_business_slug_key/)
        await expect(sql`INSERT INTO public.booking_pages (business_id, host_membership_id, slug, title, duration_minutes) VALUES (${willow}, ${coachs}, 'long', 'Too long', 999)`).rejects.toThrow(/booking_pages_duration/)
      })

      it('lets owners and administrators share a page between coaches, and keeps each coach in the business (D-061)', async () => {
        const coachs = await membershipOf(coach)
        const owners = await membershipOf(eleni)
        await expect(as(sql, coach, (tx) => tx`INSERT INTO public.booking_pages (business_id, host_membership_id, slug, title, duration_minutes) VALUES (${willow}, NULL, 'team-coach', 'Any coach', 30)`)).rejects.toThrow(/row-level security/)
        const [{ id: shared }] = await as(sql, eleni, (tx) => tx<{ id: string }[]>`INSERT INTO public.booking_pages (business_id, host_membership_id, slug, title, duration_minutes) VALUES (${willow}, NULL, 'any-coach', 'Any coach', 30) RETURNING id`)
        await as(sql, eleni, (tx) => tx`INSERT INTO public.booking_page_hosts (booking_page_id, membership_id, business_id) VALUES (${shared}, ${coachs}, ${willow}), (${shared}, ${owners}, ${willow})`)
        expect(await as(sql, coach, (tx) => tx`SELECT membership_id FROM public.booking_page_hosts WHERE booking_page_id = ${shared}`)).toHaveLength(2)
        expect(await as(sql, outsider, (tx) => tx`SELECT 1 FROM public.booking_page_hosts`)).toHaveLength(0)
        // Coaches can't change who's on a shared page, or the page itself.
        await expect(as(sql, coach, (tx) => tx`INSERT INTO public.booking_page_hosts (booking_page_id, membership_id, business_id) VALUES (${shared}, ${coachs}, ${willow})`)).rejects.toThrow(/row-level security/)
        expect(await as(sql, coach, (tx) => tx`DELETE FROM public.booking_page_hosts WHERE booking_page_id = ${shared} RETURNING 1`)).toHaveLength(0)
        expect(await as(sql, coach, (tx) => tx`UPDATE public.booking_pages SET title = 'Mine now' WHERE id = ${shared} RETURNING 1`)).toHaveLength(0)
        // Someone from another business can never be put on this page, whoever writes the row.
        const [{ id: elsewhere }] = await sql`INSERT INTO public.businesses (name, slug) VALUES ('Elsewhere', 'elsewhere-d061') RETURNING id`
        const [{ id: theirs }] = await sql`INSERT INTO public.memberships (business_id, user_id, role, coaches) VALUES (${elsewhere}, ${outsider}, 'coach', true) RETURNING id`
        await expect(sql`INSERT INTO public.booking_page_hosts (booking_page_id, membership_id, business_id) VALUES (${shared}, ${theirs}, ${willow})`).rejects.toThrow(/booking_page_hosts_membership_business_fk/)
        await expect(sql`INSERT INTO public.booking_page_hosts (booking_page_id, membership_id, business_id) VALUES (${shared}, ${theirs}, ${elsewhere})`).rejects.toThrow(/booking_page_hosts_page_business_fk/)
        // Owners can turn it back into a one-coach page.
        expect(await as(sql, eleni, (tx) => tx`UPDATE public.booking_pages SET host_membership_id = ${coachs} WHERE id = ${shared} RETURNING 1`)).toHaveLength(1)
        await sql`DELETE FROM public.booking_pages WHERE id = ${shared}`
      })

      it('never double-books a host, and keeps bookings read-only to signed-in users', async () => {
        const coachs = await membershipOf(coach)
        const book = (start: string, end: string, status = 'confirmed') =>
          sql`INSERT INTO public.bookings (business_id, host_membership_id, host_user_id, title, starts_at, ends_at, guest_name, guest_email, location_type, status) VALUES (${willow}, ${coachs}, ${coach}, 'Intro', ${start}, ${end}, 'Guest', 'g@example.com', 'video_link', ${status}) RETURNING id`
        const [first] = await book('2026-12-01T15:00Z', '2026-12-01T15:30Z')
        await expect(book('2026-12-01T15:15Z', '2026-12-01T15:45Z')).rejects.toThrow(/bookings_no_overlap/)
        // Back-to-back is fine, and so is overlapping a cancelled booking.
        await book('2026-12-01T15:30Z', '2026-12-01T16:00Z')
        await book('2026-12-01T15:00Z', '2026-12-01T15:30Z', 'cancelled')
        await sql`UPDATE public.bookings SET status = 'cancelled' WHERE id = ${first.id}`
        await book('2026-12-01T15:00Z', '2026-12-01T15:30Z')

        // A time held for a guest who is paying blocks others; once the hold expires, it doesn't.
        const [held] = await book('2026-12-02T15:00Z', '2026-12-02T15:30Z', 'pending_payment')
        await expect(book('2026-12-02T15:00Z', '2026-12-02T15:30Z')).rejects.toThrow(/bookings_no_overlap/)
        await sql`UPDATE public.bookings SET status = 'expired' WHERE id = ${held.id}`
        await book('2026-12-02T15:00Z', '2026-12-02T15:30Z')
        await expect(sql`UPDATE public.bookings SET status = 'maybe' WHERE id = ${held.id}`).rejects.toThrow(/bookings_status/)

        expect((await as(sql, admin, (tx) => tx`SELECT id FROM public.bookings`)).length).toBeGreaterThan(0)
        expect(await as(sql, outsider, (tx) => tx`SELECT id FROM public.bookings`)).toHaveLength(0)
        await expect(as(sql, eleni, (tx) => tx`UPDATE public.bookings SET guest_name = 'x'`)).rejects.toThrow(/permission denied/)
        await expect(as(sql, null, (tx) => tx`INSERT INTO public.bookings (business_id, host_membership_id, host_user_id, title, starts_at, ends_at, guest_name, guest_email, location_type) VALUES (${willow}, ${coachs}, ${coach}, 'x', now(), now() + interval '1 hour', 'x', 'x@x.co', 'phone')`)).rejects.toThrow(/permission denied/)
      })

      it('never double-books a person across the businesses they work for (D-057)', async () => {
        // Cole coaches for Willow and now also for Other Coaching.
        const [{ id: other }] = await sql<{ id: string }[]>`SELECT id FROM public.businesses WHERE slug = 'other-coaching'`
        await as(sql, outsider, (tx) => tx`INSERT INTO public.memberships (business_id, user_id, role, coaches) VALUES (${other}, ${coach}, 'coach', true)`)
        const atWillow = await membershipOf(coach)
        const atOther = await membershipOf(coach, other)
        const book = (business: string, membership: string, host: string, start: string, end: string) =>
          sql`INSERT INTO public.bookings (business_id, host_membership_id, host_user_id, title, starts_at, ends_at, guest_name, guest_email, location_type) VALUES (${business}, ${membership}, ${host}, 'Call', ${start}, ${end}, 'Guest', 'g@example.com', 'phone')`
        await book(willow, atWillow, coach, '2026-12-03T18:00Z', '2026-12-03T19:00Z')
        await expect(book(other, atOther, coach, '2026-12-03T18:30Z', '2026-12-03T19:30Z')).rejects.toThrow(/bookings_no_overlap/)
        // Someone else in the other business can take that time.
        const owner = await membershipOf(outsider, other)
        await book(other, owner, outsider, '2026-12-03T18:30Z', '2026-12-03T19:30Z')
        // Each business still sees only its own bookings.
        expect(await as(sql, outsider, (tx) => tx`SELECT business_id FROM public.bookings WHERE host_user_id = ${coach}`)).toHaveLength(0)
      })

      it('rejects malformed data', async () => {
        await expect(sql`UPDATE public.availability_schedules SET weekly_hours = '{"day":1}'::jsonb WHERE user_id = ${coach}`).rejects.toThrow(/availability_schedules_weekly_hours_array/)
        await expect(sql`INSERT INTO public.availability_time_off (user_id, starts_at, ends_at) VALUES (${coach}, '2026-12-27', '2026-12-24')`).rejects.toThrow(/availability_time_off_order/)
      })
    })
  })
  describe('team invitations (D-060)', () => {
    let priya: string
    let sam: string
    let db: ReturnType<typeof drizzle<typeof schema>>
    const owner = () => ({ id: eleni, name: 'Eleni Morgan', email: 'eleni@example.com' })
    const invite = (email: string, role: 'coach' | 'admin' = 'coach') =>
      sendInvitation({ businessId: willow, businessName: 'Willow Coaching', inviter: owner(), email, role, coaches: false, title: null }, db)
    const tokenOf = (r: Awaited<ReturnType<typeof invite>>) => {
      if ('error' in r) throw new Error(r.error)
      return r.url.split('/join/')[1]
    }

    let client: postgres.Sql
    beforeAll(async () => {
      // Its own connection: drizzle changes a client's JSON handling, which the raw queries here rely on.
      client = postgres(DB_URL!, { max: 1, onnotice: () => {} })
      db = drizzle(client, { schema })
      priya = await createUser(sql, 'priya@example.com', 'Priya Shah')
      sam = await createUser(sql, 'sam@example.com', 'Sam Lee')
    })
    afterAll(async () => {
      await client?.end()
    })

    it('stores only a hash of the link, and shows invitations to owners only', async () => {
      const token = tokenOf(await invite('Priya@Example.com'))
      const [row] = await sql`SELECT email, token_hash, role, coaches FROM public.invitations WHERE business_id = ${willow}`
      expect(row).toMatchObject({ email: 'priya@example.com', token_hash: hashToken(token), role: 'coach', coaches: true })
      expect(JSON.stringify(row)).not.toContain(token)
      expect(await as(sql, eleni, (tx) => tx`SELECT id FROM public.invitations`)).toHaveLength(1)
      expect(await as(sql, outsider, (tx) => tx`SELECT id FROM public.invitations`)).toHaveLength(0)
      expect(await as(sql, priya, (tx) => tx`SELECT id FROM public.invitations`)).toHaveLength(0)
      await expect(as(sql, eleni, (tx) => tx`INSERT INTO public.invitations (business_id, email, role, token_hash, expires_at) VALUES (${willow}, 'x@example.com', 'coach', 'h', now() + interval '1 day')`)).rejects.toThrow(/permission denied/)
      await expect(as(sql, priya, (tx) => tx`UPDATE public.invitations SET accepted_at = now()`)).rejects.toThrow(/permission denied/)
      await expect(as(sql, null, (tx) => tx`SELECT id FROM public.invitations`)).rejects.toThrow(/permission denied/)
    })

    it('lets only the invited email join, once', async () => {
      const old = tokenOf(await invite('priya@example.com'))
      const token = tokenOf(await invite('priya@example.com'))
      // Inviting again replaces the earlier link.
      expect(await acceptInvitation({ token: old }, { id: priya, email: 'priya@example.com', emailConfirmed: true }, db)).toEqual({ ok: false, reason: 'gone' })
      expect((await findInvitation(token, db))?.state).toBe('open')
      expect(await acceptInvitation({ token }, { id: sam, email: 'sam@example.com', emailConfirmed: true }, db)).toEqual({ ok: false, reason: 'wrong-email' })
      expect(await acceptInvitation({ token }, { id: priya, email: 'priya@example.com', emailConfirmed: false }, db)).toEqual({ ok: false, reason: 'unverified' })
      expect(await acceptInvitation({ token }, { id: priya, email: 'PRIYA@example.com', emailConfirmed: true }, db)).toEqual({ ok: true, businessId: willow, alreadyMember: false })
      expect(await acceptInvitation({ token }, { id: priya, email: 'priya@example.com', emailConfirmed: true }, db)).toEqual({ ok: false, reason: 'used' })
      expect((await findInvitation(token, db))?.state).toBe('accepted')
      const [m] = await sql`SELECT role, status, coaches, financial FROM public.memberships WHERE business_id = ${willow} AND user_id = ${priya}`
      expect(m).toEqual({ role: 'coach', status: 'active', coaches: true, financial: false })
      // Now a member, so inviting again is refused.
      expect(await invite('priya@example.com')).toEqual({ error: 'That person is already on your team.' })
    })

    it('refuses expired links, and brings back someone who left with the invited role', async () => {
      const first = tokenOf(await invite('sam@example.com', 'admin'))
      await sql`UPDATE public.invitations SET expires_at = now() - interval '1 minute' WHERE token_hash = ${hashToken(first)}`
      expect(await acceptInvitation({ token: first }, { id: sam, email: 'sam@example.com', emailConfirmed: true }, db)).toEqual({ ok: false, reason: 'expired' })
      expect((await findInvitation(first, db))?.state).toBe('expired')

      await sql`INSERT INTO public.memberships (business_id, user_id, role, status, coaches, financial) VALUES (${willow}, ${sam}, 'admin', 'inactive', false, true)`
      const [{ id }] = await sql`SELECT id FROM public.invitations WHERE token_hash = ${hashToken(tokenOf(await invite('sam@example.com', 'coach')))}`
      // From onboarding: accepted by id, which only matches the signed-in person's own email.
      expect(await acceptInvitation({ id }, { id: priya, email: 'priya@example.com', emailConfirmed: true }, db)).toEqual({ ok: false, reason: 'gone' })
      expect((await acceptInvitation({ id }, { id: sam, email: 'sam@example.com', emailConfirmed: true }, db)).ok).toBe(true)
      const [m] = await sql`SELECT role, status, financial FROM public.memberships WHERE business_id = ${willow} AND user_id = ${sam}`
      expect(m).toEqual({ role: 'coach', status: 'active', financial: false })
    })

    it('never invites an owner, and rejects junk links', async () => {
      await expect(sql`INSERT INTO public.invitations (business_id, email, role, token_hash, expires_at) VALUES (${willow}, 'boss@example.com', 'owner', 'h2', now() + interval '1 day')`).rejects.toThrow(/invitations_not_owner/)
      await expect(sql`INSERT INTO public.invitations (business_id, email, role, token_hash, expires_at) VALUES (${willow}, 'Boss@Example.com', 'coach', 'h3', now() + interval '1 day')`).rejects.toThrow(/invitations_email_lower/)
      expect(await findInvitation('not-a-token', db)).toBeNull()
      expect(await findInvitation('A'.repeat(43), db)).toBeNull()
    })
  })
})
