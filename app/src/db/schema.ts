import { boolean, check, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
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
    // When the business takes bookings at all, for everyone (D-059), in its own time zone. Null = no limit.
    openingHours: jsonb('opening_hours').$type<WeeklyWindow[]>(),
    createdBy: uuid('created_by').references(() => authUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('businesses_slug_key').on(t.slug),
    index('businesses_created_by_idx').on(t.createdBy),
    check('businesses_slug_format', sql`${t.slug} ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$'`),
    check('businesses_name_length', sql`char_length(${t.name}) between 2 and 80`),
    check('businesses_opening_hours_array', sql`${t.openingHours} is null or jsonb_typeof(${t.openingHours}) = 'array'`),
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

/** An owner's invitation to join their business (D-060). The link carries a random token; only its SHA-256
 *  hash is stored. Written only by the server; owners can read their business's invitations. */
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    // Lower-cased. Only someone signed in with this email can accept.
    email: text('email').notNull(),
    role: memberRole('role').notNull(),
    coaches: boolean('coaches').notNull().default(true),
    title: text('title'),
    tokenHash: text('token_hash').notNull(),
    invitedBy: uuid('invited_by').references(() => authUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedBy: uuid('accepted_by').references(() => authUsers.id, { onDelete: 'set null' }),
  },
  (t) => [
    uniqueIndex('invitations_token_hash_key').on(t.tokenHash),
    // One open invitation per person per business; inviting again replaces it.
    uniqueIndex('invitations_open_email_key').on(t.businessId, t.email).where(sql`${t.acceptedAt} is null`),
    index('invitations_email_idx').on(t.email),
    index('invitations_invited_by_idx').on(t.invitedBy),
    index('invitations_accepted_by_idx').on(t.acceptedBy),
    check('invitations_not_owner', sql`${t.role} <> 'owner'`),
    check('invitations_email_lower', sql`${t.email} = lower(${t.email}) and position('@' in ${t.email}) > 1`),
  ],
)

/** A weekly working window in the coach's own time zone, in minutes after local midnight (0 = Sunday). */
export interface WeeklyWindow {
  day: number
  start: number
  end: number
}

/** A person's weekly hours, shared by every business they work with (D-057). Only they edit it. */
export const availabilitySchedules = pgTable(
  'availability_schedules',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    timezone: text('timezone').notNull(),
    weeklyHours: jsonb('weekly_hours').$type<WeeklyWindow[]>().notNull().default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('availability_schedules_weekly_hours_array', sql`jsonb_typeof(${t.weeklyHours}) = 'array'`),
  ],
)

/** Blocks of time a person isn't available, for every business they work with (D-057). Private to them. */
export const availabilityTimeOff = pgTable(
  'availability_time_off',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('availability_time_off_user_idx').on(t.userId, t.startsAt),
    check('availability_time_off_order', sql`${t.endsAt} > ${t.startsAt}`),
    check('availability_time_off_note_length', sql`char_length(${t.note}) <= 200`),
  ],
)

/**
 * A person's arrangement with one business (D-057, D-059): their own weekly hours for that business
 * (null means their default hours), and which of their calendars its bookings go into (null = default).
 */
export const membershipAvailability = pgTable('membership_availability', {
  membershipId: uuid('membership_id')
    .primaryKey()
    .references(() => memberships.id, { onDelete: 'cascade' }),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  offeredHours: jsonb('offered_hours').$type<WeeklyWindow[]>(),
  destinationCalendarId: text('destination_calendar_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('membership_availability_business_idx').on(t.businessId),
  check('membership_availability_offered_array', sql`${t.offeredHours} is null or jsonb_typeof(${t.offeredHours}) = 'array'`),
])

export const locationType = pgEnum('location_type', ['video_link', 'phone', 'in_person'])
/** pending_payment holds the time while a guest pays; expired is a hold that ran out. */
export const BOOKING_STATUSES = ['pending_payment', 'confirmed', 'cancelled', 'expired'] as const
export const PAYMENT_STATUSES = ['not_required', 'pending', 'paid', 'refunded', 'refund_failed'] as const

/** A business-authored question on a booking page (D-056). */
export interface BookingQuestion {
  id: string
  label: string
  type: 'short' | 'paragraph' | 'single' | 'multiple'
  options: string[]
  required: boolean
}

/** A guest's answer, stored with a copy of the question so later edits don't change history. */
export interface BookingAnswer {
  questionId: string
  label: string
  value: string | string[]
}

/** A public page guests use to book a call with one coach (D-049, first slice of P-21). */
export const bookingPages = pgTable(
  'booking_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    // The one coach who takes these calls. Null = any available coach from booking_page_hosts (D-061).
    hostMembershipId: uuid('host_membership_id').references(() => memberships.id, { onDelete: 'cascade' }),
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
    // Paid calls (D-056): null means free. Whole US cents.
    priceCents: integer('price_cents'),
    // Guests who cancel at least this long before the call get a full refund.
    refundCutoffHours: integer('refund_cutoff_hours').notNull().default(24),
    // Unused since D-063 (moved into custom questions); drop in a later deploy.
    askStudent: boolean('ask_student').notNull().default(false),
    questions: jsonb('questions').$type<BookingQuestion[]>().notNull().default([]),
    // Whether guests get the optional "anything else?" note (D-064).
    askNotes: boolean('ask_notes').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('booking_pages_price', sql`${t.priceCents} is null or ${t.priceCents} between 50 and 1000000`),
    check('booking_pages_refund_cutoff', sql`${t.refundCutoffHours} between 0 and 720`),
    check('booking_pages_questions_array', sql`jsonb_typeof(${t.questions}) = 'array'`),
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
    // The person hosting, across all their businesses (D-057). The double-booking guard uses this.
    hostUserId: uuid('host_user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: text('status', { enum: BOOKING_STATUSES }).notNull().default('confirmed'),
    // While pending_payment, the time is held until this moment.
    holdExpiresAt: timestamp('hold_expires_at', { withTimezone: true }),
    paymentStatus: text('payment_status', { enum: PAYMENT_STATUSES }).notNull().default('not_required'),
    priceCents: integer('price_cents'),
    stripeAccountId: text('stripe_account_id'),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    refundCutoffHours: integer('refund_cutoff_hours').notNull().default(24),
    studentName: text('student_name'),
    studentGrade: text('student_grade'),
    answers: jsonb('answers').$type<BookingAnswer[]>().notNull().default([]),
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    cancelledBy: text('cancelled_by', { enum: ['guest', 'business'] }),
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
    uniqueIndex('bookings_checkout_session_key').on(t.stripeCheckoutSessionId),
    check('bookings_status', sql`${t.status} in ('pending_payment', 'confirmed', 'cancelled', 'expired')`),
    check('bookings_payment_status', sql`${t.paymentStatus} in ('not_required', 'pending', 'paid', 'refunded', 'refund_failed')`),
    check('bookings_cancelled_by', sql`${t.cancelledBy} is null or ${t.cancelledBy} in ('guest', 'business')`),
    check('bookings_answers_array', sql`jsonb_typeof(${t.answers}) = 'array'`),
    index('bookings_business_starts_idx').on(t.businessId, t.startsAt),
    index('bookings_host_starts_idx').on(t.hostMembershipId, t.startsAt),
    index('bookings_host_user_starts_idx').on(t.hostUserId, t.startsAt),
    index('bookings_page_idx').on(t.bookingPageId),
    check('bookings_order', sql`${t.endsAt} > ${t.startsAt}`),
    check('bookings_guest_name_length', sql`char_length(${t.guestName}) between 1 and 120`),
    check('bookings_guest_email_length', sql`char_length(${t.guestEmail}) between 3 and 254`),
    check('bookings_guest_notes_length', sql`char_length(${t.guestNotes}) <= 2000`),
  ],
)

/** A person's connected Google Calendar (D-039, D-057), used by every business they work with. Written
 *  only by the server; only the person can read it. */
export const googleCalendarConnections = pgTable(
  'google_calendar_connections',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    googleEmail: text('google_email').notNull(),
    googleSub: text('google_sub').notNull(),
    scopes: text('scopes').array().notNull(),
    // Calendars whose busy times block bookings, and the (owned) calendar bookings go to by default
    // (each business can choose another: membership_availability.destination_calendar_id).
    busyCalendarIds: text('busy_calendar_ids').array().notNull().default(sql`'{}'::text[]`),
    destinationCalendarId: text('destination_calendar_id'),
    status: text('status').notNull().default('active'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('google_calendar_connections_status', sql`${t.status} in ('active', 'needs_reconnect')`),
  ],
)

/** The encrypted refresh token for a connection. No API access at all; only the server reads it. */
export const googleCalendarTokens = pgTable('google_calendar_tokens', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => googleCalendarConnections.userId, { onDelete: 'cascade' }),
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

/** D-061: the coaches who share a booking page with no single host. Each booking goes to one of them. */
export const bookingPageHosts = pgTable(
  'booking_page_hosts',
  {
    bookingPageId: uuid('booking_page_id')
      .notNull()
      .references(() => bookingPages.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.bookingPageId, t.membershipId] }), index('booking_page_hosts_membership_idx').on(t.membershipId), index('booking_page_hosts_business_idx').on(t.businessId)],
)

export type Business = typeof businesses.$inferSelect
export type Membership = typeof memberships.$inferSelect
export type Invitation = typeof invitations.$inferSelect
export type Profile = typeof profiles.$inferSelect
export type StripeAccountRow = typeof stripeAccounts.$inferSelect
export type AvailabilitySchedule = typeof availabilitySchedules.$inferSelect
export type TimeOff = typeof availabilityTimeOff.$inferSelect
export type MembershipAvailability = typeof membershipAvailability.$inferSelect
export type MemberRole = (typeof memberRole.enumValues)[number]
export type BookingPage = typeof bookingPages.$inferSelect
export type Booking = typeof bookings.$inferSelect
