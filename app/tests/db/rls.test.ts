import postgres from 'postgres'
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

  it('never lets anyone become an owner or remove themselves through the API', async () => {
    await expect(as(sql, eleni, (tx) => tx`INSERT INTO public.memberships (business_id, user_id, role) VALUES (${willow}, ${outsider}, 'owner')`)).rejects.toThrow(/row-level security/)
    await expect(as(sql, eleni, (tx) => tx`UPDATE public.memberships SET role = 'owner' WHERE business_id = ${willow} AND user_id = ${marcus}`)).rejects.toThrow(/row-level security/)
    expect(await as(sql, eleni, (tx) => tx`DELETE FROM public.memberships WHERE user_id = ${eleni} RETURNING id`)).toHaveLength(0)
  })

  it('removes access as soon as a member is made inactive', async () => {
    await as(sql, eleni, (tx) => tx`UPDATE public.memberships SET status = 'inactive' WHERE business_id = ${willow} AND user_id = ${marcus}`)
    expect(await as(sql, marcus, (tx) => tx`SELECT id FROM public.businesses WHERE id = ${willow}`)).toHaveLength(0)
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
  })
})
