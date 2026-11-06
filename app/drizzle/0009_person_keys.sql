-- D-057, part 2: per-business columns go; the person columns become the keys.
-- The old access rules depend on the old columns, so they're dropped first and replaced at the end.
DROP POLICY "members read schedules" ON "public"."availability_schedules";--> statement-breakpoint
DROP POLICY "coaches and managers add schedules" ON "public"."availability_schedules";--> statement-breakpoint
DROP POLICY "coaches and managers change schedules" ON "public"."availability_schedules";--> statement-breakpoint
DROP POLICY "coaches and managers remove schedules" ON "public"."availability_schedules";--> statement-breakpoint
DROP POLICY "members read time off" ON "public"."availability_time_off";--> statement-breakpoint
DROP POLICY "coaches and managers add time off" ON "public"."availability_time_off";--> statement-breakpoint
DROP POLICY "coaches and managers change time off" ON "public"."availability_time_off";--> statement-breakpoint
DROP POLICY "coaches and managers remove time off" ON "public"."availability_time_off";--> statement-breakpoint
DROP POLICY "members read calendar connections" ON "public"."google_calendar_connections";--> statement-breakpoint
ALTER TABLE "public"."bookings" DROP CONSTRAINT "bookings_no_overlap";--> statement-breakpoint
ALTER TABLE "availability_schedules" DROP CONSTRAINT "availability_schedules_membership_id_memberships_id_fk";
--> statement-breakpoint
ALTER TABLE "availability_schedules" DROP CONSTRAINT "availability_schedules_business_id_businesses_id_fk";
--> statement-breakpoint
ALTER TABLE "availability_time_off" DROP CONSTRAINT "availability_time_off_membership_id_memberships_id_fk";
--> statement-breakpoint
ALTER TABLE "availability_time_off" DROP CONSTRAINT "availability_time_off_business_id_businesses_id_fk";
--> statement-breakpoint
ALTER TABLE "google_calendar_connections" DROP CONSTRAINT "google_calendar_connections_membership_id_memberships_id_fk";
--> statement-breakpoint
ALTER TABLE "google_calendar_connections" DROP CONSTRAINT "google_calendar_connections_business_id_businesses_id_fk";
--> statement-breakpoint
ALTER TABLE "google_calendar_tokens" DROP CONSTRAINT "google_calendar_tokens_membership_id_google_calendar_connections_membership_id_fk";
--> statement-breakpoint
ALTER TABLE "google_calendar_tokens" DROP CONSTRAINT "google_calendar_tokens_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "availability_schedules_business_idx";--> statement-breakpoint
DROP INDEX "availability_time_off_membership_idx";--> statement-breakpoint
DROP INDEX "availability_time_off_business_idx";--> statement-breakpoint
DROP INDEX "google_calendar_connections_business_idx";--> statement-breakpoint
ALTER TABLE "availability_schedules" DROP CONSTRAINT "availability_schedules_pkey";--> statement-breakpoint
ALTER TABLE "availability_schedules" ADD PRIMARY KEY ("user_id");--> statement-breakpoint
ALTER TABLE "availability_schedules" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_time_off" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "host_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "google_calendar_connections" DROP CONSTRAINT "google_calendar_connections_pkey";--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD PRIMARY KEY ("user_id");--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "google_calendar_tokens" DROP CONSTRAINT "google_calendar_tokens_pkey";--> statement-breakpoint
ALTER TABLE "google_calendar_tokens" ADD PRIMARY KEY ("user_id");--> statement-breakpoint
ALTER TABLE "google_calendar_tokens" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "google_calendar_tokens" ADD CONSTRAINT "google_calendar_tokens_user_id_google_calendar_connections_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."google_calendar_connections"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_time_off_user_idx" ON "availability_time_off" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_host_user_starts_idx" ON "bookings" USING btree ("host_user_id","starts_at");--> statement-breakpoint
ALTER TABLE "availability_schedules" DROP COLUMN "membership_id";--> statement-breakpoint
ALTER TABLE "availability_schedules" DROP COLUMN "business_id";--> statement-breakpoint
ALTER TABLE "availability_time_off" DROP COLUMN "membership_id";--> statement-breakpoint
ALTER TABLE "availability_time_off" DROP COLUMN "business_id";--> statement-breakpoint
ALTER TABLE "google_calendar_connections" DROP COLUMN "membership_id";--> statement-breakpoint
ALTER TABLE "google_calendar_connections" DROP COLUMN "business_id";--> statement-breakpoint
ALTER TABLE "google_calendar_tokens" DROP COLUMN "membership_id";--> statement-breakpoint

-- No double-booking for a person across every business they work with (D-057), counting payment holds.
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("host_user_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" IN ('confirmed', 'pending_payment'));--> statement-breakpoint

-- A person's own hours, time off and calendar connection are private to them. Businesses compute
-- open times on the server and only ever learn "busy".
CREATE POLICY "people manage their own schedule" ON "public"."availability_schedules"
  FOR ALL TO authenticated
  USING ("user_id" = (SELECT auth.uid()))
  WITH CHECK ("user_id" = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY "people manage their own time off" ON "public"."availability_time_off"
  FOR ALL TO authenticated
  USING ("user_id" = (SELECT auth.uid()))
  WITH CHECK ("user_id" = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY "people read their own calendar connection" ON "public"."google_calendar_connections"
  FOR SELECT TO authenticated USING ("user_id" = (SELECT auth.uid()));
