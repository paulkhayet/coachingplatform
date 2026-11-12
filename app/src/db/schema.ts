import { boolean, check, date, foreignKey, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
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
    allowAdvanceReservations: boolean('allow_advance_reservations').notNull().default(false),
    paymentReminderHours: integer('payment_reminder_hours'),
    unpaidCancellationHours: integer('unpaid_cancellation_hours'),
    // Public profile shown on booking pages (D-071). The logo lives in the public `business-logos` bucket.
    logoPath: text('logo_path'),
    about: text('about'),
    websiteUrl: text('website_url'),
    contactEmail: text('contact_email'),
    createdBy: uuid('created_by').references(() => authUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('businesses_slug_key').on(t.slug),
    index('businesses_created_by_idx').on(t.createdBy),
    check('businesses_slug_format', sql`${t.slug} ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$'`),
    check('businesses_name_length', sql`char_length(${t.name}) between 2 and 80`),
    check('businesses_opening_hours_array', sql`${t.openingHours} is null or jsonb_typeof(${t.openingHours}) = 'array'`),
    check('businesses_reservation_hours', sql`(${t.paymentReminderHours} is null or ${t.paymentReminderHours} between 1 and 720)
      and (${t.unpaidCancellationHours} is null or ${t.unpaidCancellationHours} between 1 and 720)
      and ${t.paymentReminderHours} > ${t.unpaidCancellationHours}`),
    check('businesses_logo_path_owner', sql`${t.logoPath} is null or split_part(${t.logoPath}, '/', 1) = ${t.id}::text`),
    check('businesses_profile_lengths', sql`char_length(${t.about}) <= 600 and char_length(${t.contactEmail}) <= 254`),
    check('businesses_website_url', sql`${t.websiteUrl} is null or (char_length(${t.websiteUrl}) <= 200 and ${t.websiteUrl} ~ '^https?://')`),
  ],
)

/** One row per signed-in person. Created automatically when someone signs up. */
export const profiles = pgTable('profiles', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  fullName: text('full_name'),
  email: text('email'),
  avatarPath: text('avatar_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('profiles_avatar_path_owner', sql`${t.avatarPath} is null or split_part(${t.avatarPath}, '/', 1) = ${t.id}::text`),
])

/** The platform's Billing customer, separate from a business's Stripe Connect account. */
export const workspaceBillingCustomers = pgTable('workspace_billing_customers', {
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  livemode: boolean('livemode').notNull(),
  stripeCustomerId: text('stripe_customer_id').notNull(),
}, (t) => [
  primaryKey({ columns: [t.businessId, t.livemode] }),
  uniqueIndex('workspace_billing_customer_key').on(t.livemode, t.stripeCustomerId),
  check('workspace_billing_customer_id_format', sql`${t.stripeCustomerId} ~ '^cus_[A-Za-z0-9]+$'`),
])

/**
 * The workspace's schedulefa.st plan (D-072). Written only by the server: from Stripe subscription
 * events, or a `complimentary` row the founder adds by hand. No row (or a lapsed one) means the free plan.
 */
export const workspaceSubscriptions = pgTable('workspace_subscriptions', {
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  livemode: boolean('livemode').notNull(),
  source: text('source', { enum: ['stripe', 'complimentary'] }).notNull().default('stripe'),
  plan: text('plan', { enum: ['solo', 'team'] }).notNull(),
  billingInterval: text('billing_interval', { enum: ['year', 'month'] }),
  status: text('status').notNull(),
  seats: integer('seats').notNull().default(1),
  stripeSubscriptionId: text('stripe_subscription_id'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.businessId, t.livemode] }),
  uniqueIndex('workspace_subscriptions_stripe_key').on(t.stripeSubscriptionId),
  check('workspace_subscriptions_source', sql`${t.source} in ('stripe', 'complimentary')`),
  check('workspace_subscriptions_plan', sql`${t.plan} in ('solo', 'team')`),
  check('workspace_subscriptions_interval', sql`${t.billingInterval} is null or ${t.billingInterval} in ('year', 'month')`),
  check('workspace_subscriptions_seats', sql`${t.seats} between 1 and 1000`),
  check('workspace_subscriptions_stripe_id', sql`(${t.source} = 'stripe') = (${t.stripeSubscriptionId} is not null) and (${t.stripeSubscriptionId} is null or ${t.stripeSubscriptionId} ~ '^sub_[A-Za-z0-9]+$')`),
])

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

export interface PackageSessionFormat {
  name: string
  durationMinutes: number
  creditUnits: number
}

/** Reusable terms for future coaching purchases. Money is in cents and credits in hundredths. */
export const coachingPackages = pgTable('coaching_packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  kind: text('kind').$type<'fixed' | 'monthly'>().notNull(),
  termWeeks: integer('term_weeks'),
  creditUnits: integer('credit_units').notNull(),
  sessionFormats: jsonb('session_formats').$type<PackageSessionFormat[]>().notNull(),
  priceCents: integer('price_cents').notNull(),
  installmentCount: integer('installment_count'),
  installmentCadence: text('installment_cadence').$type<'weekly' | 'monthly'>(),
  // Null means any active coaching member of this business. Otherwise, use the selected members.
  eligibleCoachIds: uuid('eligible_coach_ids').array(),
  cancellationNoticeHours: integer('cancellation_notice_hours'),
  lateCancellation: text('late_cancellation').$type<'inherit' | 'preserve' | 'forfeit'>().notNull().default('inherit'),
  expiration: text('expiration').$type<'inherit' | 'end_of_term'>().notNull().default('inherit'),
  makeupExtensionDays: integer('makeup_extension_days'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('coaching_packages_business_archive_idx').on(t.businessId, t.archivedAt),
  check('coaching_packages_name_length', sql`char_length(btrim(${t.name})) between 2 and 100`),
  check('coaching_packages_description_length', sql`char_length(${t.description}) <= 1000`),
  check('coaching_packages_term', sql`(${t.kind} = 'fixed' and ${t.termWeeks} is not null and ${t.termWeeks} between 1 and 260) or (${t.kind} = 'monthly' and ${t.termWeeks} is null)`),
  check('coaching_packages_credit_units', sql`${t.creditUnits} between 1 and 100000`),
  check('coaching_packages_price', sql`${t.priceCents} between 1 and 100000000`),
  check('coaching_packages_installments', sql`
    (${t.installmentCount} is null and ${t.installmentCadence} is null) or
    (${t.kind} = 'fixed' and ${t.installmentCount} is not null and ${t.installmentCount} between 2 and 24
     and ${t.installmentCadence} is not null and ${t.installmentCadence} in ('weekly', 'monthly')
     and ${t.priceCents} >= ${t.installmentCount})`),
  check('coaching_packages_formats', sql`
    case when jsonb_typeof(${t.sessionFormats}) = 'array' then
      jsonb_array_length(${t.sessionFormats}) between 1 and 10 and not jsonb_path_exists(
        ${t.sessionFormats},
        '$[*] ? (@.type() != "object" || !exists(@.name) || @.name.type() != "string" || @.name == "" || !exists(@.durationMinutes) || @.durationMinutes.type() != "number" || @.durationMinutes < 1 || @.durationMinutes > 480 || @.durationMinutes != @.durationMinutes.floor() || !exists(@.creditUnits) || @.creditUnits.type() != "number" || @.creditUnits < 1 || @.creditUnits > $allowance || @.creditUnits != @.creditUnits.floor())',
        jsonb_build_object('allowance', ${t.creditUnits})
      ) else false end`),
  check('coaching_packages_coach_ids', sql`${t.eligibleCoachIds} is null or (cardinality(${t.eligibleCoachIds}) between 1 and 200 and array_position(${t.eligibleCoachIds}, null) is null)`),
  check('coaching_packages_cancellation', sql`${t.cancellationNoticeHours} between 0 and 720`),
  check('coaching_packages_late_cancellation', sql`${t.lateCancellation} in ('inherit', 'preserve', 'forfeit')`),
  check('coaching_packages_expiration', sql`${t.expiration} in ('inherit', 'end_of_term')`),
  check('coaching_packages_makeups', sql`${t.makeupExtensionDays} between 0 and 365`),
])

export const coachingClients = pgTable('coaching_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  coachMembershipId: uuid('coach_membership_id').references(() => memberships.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('coaching_clients_business_id_key').on(t.businessId, t.id),
  index('coaching_clients_coach_idx').on(t.coachMembershipId),
  index('coaching_clients_business_name_idx').on(t.businessId, t.name),
  check('coaching_clients_name', sql`char_length(btrim(${t.name})) between 2 and 100`),
  check('coaching_clients_email', sql`char_length(${t.email}) <= 254`),
])

/** Contact records only. A guardian contact does not confer login or student access. */
export const clientGuardians = pgTable('client_guardians', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull(),
  clientId: uuid('client_id').notNull(),
  name: text('name').notNull(),
  relationship: text('relationship'),
  email: text('email'),
  phone: text('phone'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.businessId, t.clientId], foreignColumns: [coachingClients.businessId, coachingClients.id], name: 'client_guardians_client_fk' }).onDelete('cascade'),
  index('client_guardians_client_idx').on(t.businessId, t.clientId),
  check('client_guardians_name', sql`char_length(btrim(${t.name})) between 2 and 100`),
  check('client_guardians_contact', sql`(${t.email} is not null or ${t.phone} is not null) and char_length(coalesce(${t.email}, '')) <= 254 and char_length(coalesce(${t.phone}, '')) <= 40`),
  check('client_guardians_relationship', sql`char_length(${t.relationship}) <= 80`),
])

/**
 * Files staff keep on a client's record (D-070). The bytes live in the private `client-files` Storage
 * bucket at `path` (`{business_id}/{client_id}/{id}`); this row decides who may read them. A row starts
 * `pending` when the upload link is issued and becomes `ready` once the server has checked the upload.
 */
export const clientFiles = pgTable('client_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull(),
  clientId: uuid('client_id').notNull(),
  uploadedBy: uuid('uploaded_by').references(() => profiles.id, { onDelete: 'set null' }),
  fileName: text('file_name').notNull(),
  path: text('path').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes'),
  status: text('status', { enum: ['pending', 'ready'] }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.businessId, t.clientId], foreignColumns: [coachingClients.businessId, coachingClients.id], name: 'client_files_client_fk' }).onDelete('cascade'),
  uniqueIndex('client_files_path_key').on(t.path),
  index('client_files_client_idx').on(t.businessId, t.clientId, t.createdAt),
  index('client_files_uploaded_by_idx').on(t.uploadedBy),
  check('client_files_name', sql`char_length(btrim(${t.fileName})) between 1 and 200`),
  check('client_files_status', sql`${t.status} in ('pending', 'ready')`),
  check('client_files_size', sql`${t.sizeBytes} is null or ${t.sizeBytes} between 1 and 26214400`),
  check('client_files_path', sql`${t.path} = ${t.businessId}::text || '/' || ${t.clientId}::text || '/' || ${t.id}::text`),
])

/** Copy of the terms in force when staff assign a package to a client. */
export type AssignedPackageTerms = Pick<typeof coachingPackages.$inferSelect,
  'name' | 'description' | 'kind' | 'termWeeks' | 'creditUnits' | 'sessionFormats' | 'priceCents' |
  'installmentCount' | 'installmentCadence' | 'eligibleCoachIds' | 'cancellationNoticeHours' |
  'lateCancellation' | 'expiration' | 'makeupExtensionDays'>

export const clientPackages = pgTable('client_packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull(),
  clientId: uuid('client_id').notNull(),
  packageId: uuid('package_id').references(() => coachingPackages.id, { onDelete: 'set null' }),
  terms: jsonb('terms').$type<AssignedPackageTerms>().notNull(),
  assignedBy: uuid('assigned_by').references(() => authUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.businessId, t.clientId], foreignColumns: [coachingClients.businessId, coachingClients.id], name: 'client_packages_client_fk' }).onDelete('cascade'),
  uniqueIndex('client_packages_business_client_id_key').on(t.businessId, t.clientId, t.id),
  index('client_packages_catalog_idx').on(t.packageId),
  index('client_packages_assigned_by_idx').on(t.assignedBy),
  check('client_packages_terms_object', sql`jsonb_typeof(${t.terms}) = 'object'`),
])

/** A price-free allowance for a fixed term or a single monthly service period. Dates are inclusive/exclusive. */
export const clientCreditPeriods = pgTable('client_credit_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull(),
  clientId: uuid('client_id').notNull(),
  clientPackageId: uuid('client_package_id').notNull(),
  name: text('name').notNull(),
  kind: text('kind').$type<'fixed' | 'monthly'>().notNull(),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  creditUnits: integer('credit_units').notNull(),
  expiration: text('expiration').$type<'inherit' | 'end_of_term'>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.businessId, t.clientId, t.clientPackageId], foreignColumns: [clientPackages.businessId, clientPackages.clientId, clientPackages.id], name: 'client_credit_periods_package_fk' }).onDelete('cascade'),
  uniqueIndex('client_credit_periods_business_client_id_key').on(t.businessId, t.clientId, t.id),
  uniqueIndex('client_credit_periods_package_start_key').on(t.businessId, t.clientId, t.clientPackageId, t.startsOn),
  check('client_credit_periods_dates', sql`${t.startsOn} < ${t.endsOn}`),
  check('client_credit_periods_kind', sql`${t.kind} in ('fixed', 'monthly')`),
  check('client_credit_periods_units', sql`${t.creditUnits} between 1 and 100000`),
  check('client_credit_periods_expiration', sql`${t.expiration} in ('inherit', 'end_of_term')`),
])

export const OFFLINE_PAYMENT_METHODS = ['cash', 'check', 'bank_transfer', 'other'] as const
export const clientCreditPayments = pgTable('client_credit_payments', {
  id: uuid('id').primaryKey(),
  businessId: uuid('business_id').notNull(),
  clientId: uuid('client_id').notNull(),
  periodId: uuid('period_id').notNull(),
  amountCents: integer('amount_cents').notNull(),
  method: text('method').$type<(typeof OFFLINE_PAYMENT_METHODS)[number]>().notNull(),
  receivedOn: date('received_on').notNull(),
  reference: text('reference'),
  recordedBy: uuid('recorded_by').references(() => authUsers.id, { onDelete: 'set null' }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.businessId, t.clientId, t.periodId], foreignColumns: [clientCreditPeriods.businessId, clientCreditPeriods.clientId, clientCreditPeriods.id], name: 'client_credit_payments_period_fk' }).onDelete('cascade'),
  index('client_credit_payments_period_idx').on(t.businessId, t.clientId, t.periodId),
  index('client_credit_payments_actor_idx').on(t.recordedBy),
  check('client_credit_payments_amount', sql`${t.amountCents} between 1 and 100000000`),
  check('client_credit_payments_method', sql`${t.method} in ('cash', 'check', 'bank_transfer', 'other')`),
  check('client_credit_payments_reference', sql`char_length(${t.reference}) <= 200`),
])

export const CREDIT_EVENT_KINDS = ['funded', 'reserved', 'released', 'used', 'forfeited', 'expired'] as const
export const clientCreditEvents = pgTable('client_credit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull(),
  clientId: uuid('client_id').notNull(),
  periodId: uuid('period_id').notNull(),
  kind: text('kind').$type<(typeof CREDIT_EVENT_KINDS)[number]>().notNull(),
  creditUnits: integer('credit_units').notNull(),
  paymentId: uuid('payment_id').references(() => clientCreditPayments.id, { onDelete: 'cascade' }),
  bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.businessId, t.clientId, t.periodId], foreignColumns: [clientCreditPeriods.businessId, clientCreditPeriods.clientId, clientCreditPeriods.id], name: 'client_credit_events_period_fk' }).onDelete('cascade'),
  index('client_credit_events_period_idx').on(t.businessId, t.clientId, t.periodId, t.createdAt),
  uniqueIndex('client_credit_events_payment_key').on(t.paymentId),
  uniqueIndex('client_credit_events_booking_kind_key').on(t.bookingId, t.kind),
  check('client_credit_events_kind', sql`${t.kind} in ('funded', 'reserved', 'released', 'used', 'forfeited', 'expired')`),
  check('client_credit_events_units', sql`${t.creditUnits} between 1 and 100000`),
  check('client_credit_events_payment', sql`(${t.kind} = 'funded') = (${t.paymentId} is not null)`),
])

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

// zoom: a Zoom meeting is created on the host's own Zoom account for each booking (D-038).
export const locationType = pgEnum('location_type', ['video_link', 'phone', 'in_person', 'zoom'])
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
    answers: jsonb('answers').$type<BookingAnswer[]>().notNull().default([]),
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    cancelledBy: text('cancelled_by', { enum: ['guest', 'business'] }),
    guestName: text('guest_name').notNull(),
    guestEmail: text('guest_email'),
    guestNotes: text('guest_notes'),
    guestTimezone: text('guest_timezone'),
    locationType: locationType('location_type').notNull(),
    locationDetail: text('location_detail'),
    googleCalendarId: text('google_calendar_id'),
    googleEventId: text('google_event_id'),
    calendarSyncError: text('calendar_sync_error'),
    // Zoom pages (D-038): the meeting on the host's Zoom account; its join link is in location_detail.
    zoomMeetingId: text('zoom_meeting_id'),
    meetingError: text('meeting_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    coachingClientId: uuid('coaching_client_id'),
    creditPeriodId: uuid('credit_period_id'),
    creditUnits: integer('credit_units'),
    creditNoticeHours: integer('credit_notice_hours'),
    creditLateCancellation: text('credit_late_cancellation').$type<'preserve' | 'forfeit'>(),
    creditCancellationOutcome: text('credit_cancellation_outcome').$type<'released' | 'forfeited'>(),
    attendedAt: timestamp('attended_at', { withTimezone: true }),
    coachingSeriesId: uuid('coaching_series_id'),
    creditCoveredAt: timestamp('credit_covered_at', { withTimezone: true }),
    paymentReminderHours: integer('payment_reminder_hours'),
    paymentReminderSentAt: timestamp('payment_reminder_sent_at', { withTimezone: true }),
    unpaidCancellationHours: integer('unpaid_cancellation_hours'),
    unpaidCancelled: boolean('unpaid_cancelled').notNull().default(false),
  },
  (t) => [
    foreignKey({ columns: [t.businessId, t.coachingClientId, t.creditPeriodId], foreignColumns: [clientCreditPeriods.businessId, clientCreditPeriods.clientId, clientCreditPeriods.id], name: 'bookings_credit_period_fk' }).onDelete('restrict'),
    uniqueIndex('bookings_checkout_session_key').on(t.stripeCheckoutSessionId),
    check('bookings_status', sql`${t.status} in ('pending_payment', 'confirmed', 'cancelled', 'expired')`),
    check('bookings_payment_status', sql`${t.paymentStatus} in ('not_required', 'pending', 'paid', 'refunded', 'refund_failed')`),
    check('bookings_cancelled_by', sql`${t.cancelledBy} is null or ${t.cancelledBy} in ('guest', 'business')`),
    check('bookings_answers_array', sql`jsonb_typeof(${t.answers}) = 'array'`),
    index('bookings_business_starts_idx').on(t.businessId, t.startsAt),
    index('bookings_host_starts_idx').on(t.hostMembershipId, t.startsAt),
    index('bookings_host_user_starts_idx').on(t.hostUserId, t.startsAt),
    index('bookings_page_idx').on(t.bookingPageId),
    index('bookings_coaching_client_idx').on(t.businessId, t.coachingClientId, t.creditPeriodId, t.startsAt).where(sql`${t.coachingClientId} is not null`),
    index('bookings_coaching_series_idx').on(t.coachingSeriesId).where(sql`${t.coachingSeriesId} is not null`),
    index('bookings_unpaid_coaching_starts_idx').on(t.startsAt).where(sql`${t.coachingClientId} is not null and ${t.creditCoveredAt} is null and ${t.status} = 'confirmed'`),
    check('bookings_order', sql`${t.endsAt} > ${t.startsAt}`),
    check('bookings_guest_name_length', sql`char_length(${t.guestName}) between 1 and 120`),
    check('bookings_guest_email_length', sql`(${t.guestEmail} is null and ${t.coachingClientId} is not null) or (${t.guestEmail} is not null and char_length(${t.guestEmail}) between 3 and 254)`),
    check('bookings_guest_notes_length', sql`char_length(${t.guestNotes}) <= 2000`),
    check('bookings_coaching_series', sql`${t.coachingSeriesId} is null or ${t.coachingClientId} is not null`),
    check('bookings_coaching_terms', sql`
      (${t.coachingClientId} is null and ${t.creditPeriodId} is null and ${t.creditUnits} is null
       and ${t.creditNoticeHours} is null and ${t.creditLateCancellation} is null
       and ${t.creditCancellationOutcome} is null and ${t.attendedAt} is null)
      or (${t.coachingClientId} is not null and ${t.creditPeriodId} is not null and ${t.bookingPageId} is null
       and ${t.paymentStatus} = 'not_required' and ${t.priceCents} is null
       and ${t.creditUnits} is not null and ${t.creditUnits} between 1 and 100000
       and ${t.creditNoticeHours} is not null and ${t.creditNoticeHours} between 0 and 720
       and ${t.creditLateCancellation} is not null and ${t.creditLateCancellation} in ('preserve', 'forfeit')
       and ((${t.status} = 'confirmed' and ${t.creditCancellationOutcome} is null)
         or (${t.status} = 'cancelled' and ${t.attendedAt} is null and ${t.creditCancellationOutcome} is not null
           and ${t.creditCancellationOutcome} in ('released', 'forfeited'))))`),
  ],
)

/** Meeting details held by the server until this session has paid coverage. */
export const coachingReservationLocations = pgTable('coaching_reservation_locations', {
  bookingId: uuid('booking_id').primaryKey().references(() => bookings.id, { onDelete: 'cascade' }),
  detail: text('detail').notNull(),
})

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

/** A person's own Zoom account, used to create a meeting for each booking on Zoom pages (D-038). Like
 *  the Google connection it belongs to the person and serves every business they work with. Written only
 *  by the server; people can read their own. */
export const zoomConnections = pgTable(
  'zoom_connections',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    zoomUserId: text('zoom_user_id').notNull(),
    zoomEmail: text('zoom_email').notNull(),
    status: text('status').notNull().default('active'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('zoom_connections_status', sql`${t.status} in ('active', 'needs_reconnect')`), index('zoom_connections_zoom_user_idx').on(t.zoomUserId)],
)

/** Zoom tokens, encrypted. Zoom replaces the refresh token every time it's used, so both are stored and
 *  refreshed under a row lock. No API access at all. */
export const zoomTokens = pgTable('zoom_tokens', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => zoomConnections.userId, { onDelete: 'cascade' }),
  refreshTokenCiphertext: text('refresh_token_ciphertext').notNull(),
  accessTokenCiphertext: text('access_token_ciphertext'),
  accessExpiresAt: timestamp('access_expires_at', { withTimezone: true }),
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

/** Sales enquiries from the public contact form (D-067), e.g. the Corporate plan. Server-only: no API access. */
export const contactRequests = pgTable(
  'contact_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    organization: text('organization').notNull(),
    teamSize: text('team_size').notNull(),
    message: text('message'),
    plan: text('plan'),
    emailed: boolean('emailed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('contact_requests_email_created_idx').on(t.email, t.createdAt),
    check('contact_requests_lengths', sql`char_length(${t.name}) <= 120 and char_length(${t.email}) <= 254 and char_length(${t.organization}) <= 160 and char_length(coalesce(${t.message}, '')) <= 4000`),
  ],
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
