import { boolean, check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
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

/** A weekly working window in the coach's own time zone, in minutes after local midnight (0 = Sunday). */
export interface WeeklyWindow {
  day: number
  start: number
  end: number
}

/** A coach's weekly hours. One per membership; the coach (or an owner/administrator) edits it. */
export const availabilitySchedules = pgTable(
  'availability_schedules',
  {
    membershipId: uuid('membership_id')
      .primaryKey()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    timezone: text('timezone').notNull(),
    weeklyHours: jsonb('weekly_hours').$type<WeeklyWindow[]>().notNull().default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('availability_schedules_business_idx').on(t.businessId),
    check('availability_schedules_weekly_hours_array', sql`jsonb_typeof(${t.weeklyHours}) = 'array'`),
  ],
)

/** Blocks of time a coach isn't available (vacation, appointments), whatever their weekly hours say. */
export const availabilityTimeOff = pgTable(
  'availability_time_off',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('availability_time_off_membership_idx').on(t.membershipId, t.startsAt),
    index('availability_time_off_business_idx').on(t.businessId),
    check('availability_time_off_order', sql`${t.endsAt} > ${t.startsAt}`),
    check('availability_time_off_note_length', sql`char_length(${t.note}) <= 200`),
  ],
)

export const locationType = pgEnum('location_type', ['video_link', 'phone', 'in_person'])
export const bookingStatus = pgEnum('booking_status', ['confirmed', 'cancelled'])

/** A public page guests use to book a call with one coach (D-049, first slice of P-21). */
export const bookingPages = pgTable(
  'booking_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    hostMembershipId: uuid('host_membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    durationMinutes: integer('duration_minutes').notNull(),
    locationType: locationType('location_type').notNull().default('video_link'),
    // The meeting link, phone instructions or address, shown to the guest once booked.
    locationDetail: text('location_detail'),
    minNoticeMinutes: integer('min_notice_minutes').notNull().default(240),
    windowDays: integer('window_days').notNull().default(30),
    bufferBeforeMinutes: integer('buffer_before_minutes').notNull().default(0),
    bufferAfterMinutes: integer('buffer_after_minutes').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('booking_pages_business_slug_key').on(t.businessId, t.slug),
    index('booking_pages_host_idx').on(t.hostMembershipId),
    check('booking_pages_slug_format', sql`${t.slug} ~ '^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$'`),
    check('booking_pages_title_length', sql`char_length(${t.title}) between 2 and 80`),
    check('booking_pages_description_length', sql`char_length(${t.description}) <= 1000`),
    check('booking_pages_duration', sql`${t.durationMinutes} between 5 and 480`),
    check('booking_pages_notice', sql`${t.minNoticeMinutes} between 0 and 43200`),
    check('booking_pages_window', sql`${t.windowDays} between 1 and 365`),
    check('booking_pages_buffers', sql`${t.bufferBeforeMinutes} between 0 and 240 and ${t.bufferAfterMinutes} between 0 and 240`),
  ],
)

/** A booked call. The database refuses overlapping confirmed bookings for the same host (see migration). */
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    bookingPageId: uuid('booking_page_id').references(() => bookingPages.id, { onDelete: 'set null' }),
    hostMembershipId: uuid('host_membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: bookingStatus('status').notNull().default('confirmed'),
    guestName: text('guest_name').notNull(),
    guestEmail: text('guest_email').notNull(),
    guestNotes: text('guest_notes'),
    guestTimezone: text('guest_timezone'),
    locationType: locationType('location_type').notNull(),
    locationDetail: text('location_detail'),
    googleCalendarId: text('google_calendar_id'),
    googleEventId: text('google_event_id'),
    calendarSyncError: text('calendar_sync_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t) => [
    index('bookings_business_starts_idx').on(t.businessId, t.startsAt),
    index('bookings_host_starts_idx').on(t.hostMembershipId, t.startsAt),
    index('bookings_page_idx').on(t.bookingPageId),
    check('bookings_order', sql`${t.endsAt} > ${t.startsAt}`),
    check('bookings_guest_name_length', sql`char_length(${t.guestName}) between 1 and 120`),
    check('bookings_guest_email_length', sql`char_length(${t.guestEmail}) between 3 and 254`),
    check('bookings_guest_notes_length', sql`char_length(${t.guestNotes}) <= 2000`),
  ],
)

/** A coach's connected Google Calendar (D-039). Written only by the server; the team can read it. */
export const googleCalendarConnections = pgTable(
  'google_calendar_connections',
  {
    membershipId: uuid('membership_id')
      .primaryKey()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    googleEmail: text('google_email').notNull(),
    googleSub: text('google_sub').notNull(),
    scopes: text('scopes').array().notNull(),
    // Calendars whose busy times block bookings, and the (owned) calendar bookings are added to.
    busyCalendarIds: text('busy_calendar_ids').array().notNull().default(sql`'{}'::text[]`),
    destinationCalendarId: text('destination_calendar_id'),
    status: text('status').notNull().default('active'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('google_calendar_connections_business_idx').on(t.businessId),
    check('google_calendar_connections_status', sql`${t.status} in ('active', 'needs_reconnect')`),
  ],
)

/** The encrypted refresh token for a connection. No API access at all; only the server reads it. */
export const googleCalendarTokens = pgTable('google_calendar_tokens', {
  membershipId: uuid('membership_id')
    .primaryKey()
    .references(() => googleCalendarConnections.membershipId, { onDelete: 'cascade' }),
  refreshTokenCiphertext: text('refresh_token_ciphertext').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

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
export type AvailabilitySchedule = typeof availabilitySchedules.$inferSelect
export type TimeOff = typeof availabilityTimeOff.$inferSelect
export type MemberRole = (typeof memberRole.enumValues)[number]
export type BookingPage = typeof bookingPages.$inferSelect
export type Booking = typeof bookings.$inferSelect
