import { boolean, check, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { authUsers } from 'drizzle-orm/supabase'

// Every business-owned table carries business_id and is protected by row-level security
// (see drizzle/*_rls.sql). The browser only ever talks to Postgres through those policies.

export const memberRole = pgEnum('member_role', ['owner', 'admin', 'coach'])
export const memberStatus = pgEnum('member_status', ['active', 'invited', 'inactive'])

export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    timezone: text('timezone').notNull().default('America/New_York'),
    createdBy: uuid('created_by').references(() => authUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('businesses_slug_key').on(t.slug),
    index('businesses_created_by_idx').on(t.createdBy),
    check('businesses_slug_format', sql`${t.slug} ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$'`),
    check('businesses_name_length', sql`char_length(${t.name}) between 2 and 80`),
  ],
)

/** One row per signed-in person. Created automatically when someone signs up. */
export const profiles = pgTable('profiles', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  fullName: text('full_name'),
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** A person's role inside one business. Staff seats are counted from active and invited rows (D-043, P-15). */
export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    role: memberRole('role').notNull(),
    status: memberStatus('status').notNull().default('active'),
    coaches: boolean('coaches').notNull().default(false),
    // Administrators need explicit delegation for financial actions (P-02).
    financial: boolean('financial').notNull().default(false),
    title: text('title'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('memberships_business_user_key').on(t.businessId, t.userId), index('memberships_user_idx').on(t.userId)],
)

/** A business's connected Stripe account (D-055: Standard account, direct charges). Written only by the
 *  server (Connect onboarding and Stripe webhooks); owners and administrators can read it. */
export const stripeAccounts = pgTable(
  'stripe_accounts',
  {
    businessId: uuid('business_id')
      .primaryKey()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    stripeAccountId: text('stripe_account_id').notNull(),
    livemode: boolean('livemode').notNull(),
    detailsSubmitted: boolean('details_submitted').notNull().default(false),
    chargesEnabled: boolean('charges_enabled').notNull().default(false),
    payoutsEnabled: boolean('payouts_enabled').notNull().default(false),
    // Stripe's requirements.disabled_reason, plus how many requirements are currently due.
    disabledReason: text('disabled_reason'),
    requirementsDue: integer('requirements_due').notNull().default(0),
    // Set when the business disconnects schedulefa.st from its Stripe account.
    disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('stripe_accounts_stripe_account_id_key').on(t.stripeAccountId)],
)

/** Every Stripe event we have accepted, so each one is processed exactly once even if Stripe sends it twice. */
export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  account: text('account'),
  livemode: boolean('livemode').notNull(),
  stripeCreatedAt: timestamp('stripe_created_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Business = typeof businesses.$inferSelect
export type Membership = typeof memberships.$inferSelect
export type Profile = typeof profiles.$inferSelect
export type StripeAccountRow = typeof stripeAccounts.$inferSelect
export type MemberRole = (typeof memberRole.enumValues)[number]
