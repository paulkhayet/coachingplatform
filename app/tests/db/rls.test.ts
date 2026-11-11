import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '@/db/schema'
import { acceptInvitation, findInvitation, hashToken, sendInvitation } from '@/lib/team/invitations'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB_URL, as, createUser, resetDatabase } from './helpers'

// Runs only when TEST_DATABASE_URL points at a disposable Postgres database (CI provides one).
describe.skipIf(!DB_URL)('row-level security', () => {
  let sql: postgres.Sql
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
    await sql?.end()
  })

  it('creates a profile for every new user', async () => {
    const [p] = await sql`SELECT full_name, email FROM public.profiles WHERE id = ${eleni}`
    expect(p).toEqual({ full_name: 'Eleni Morgan', email: 'eleni@example.com' })
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

  it('keeps the reminder trigger away from the API', async () => {
    await expect(as(sql, eleni, (tx) => tx`SELECT private.request_reminders()`)).rejects.toThrow(/permission denied/)
    await expect(as(sql, null, (tx) => tx`SELECT private.request_reminders()`)).rejects.toThrow(/permission denied/)
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
