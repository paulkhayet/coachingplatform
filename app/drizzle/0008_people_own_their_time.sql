CREATE TABLE "membership_availability" (
	"membership_id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"offered_hours" jsonb,
	"destination_calendar_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_availability_offered_array" CHECK ("membership_availability"."offered_hours" is null or jsonb_typeof("membership_availability"."offered_hours") = 'array')
);
--> statement-breakpoint
ALTER TABLE "availability_schedules" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "availability_time_off" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "host_user_id" uuid;--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "google_calendar_tokens" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "membership_availability" ADD CONSTRAINT "membership_availability_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_availability" ADD CONSTRAINT "membership_availability_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_availability_business_idx" ON "membership_availability" USING btree ("business_id");--> statement-breakpoint
ALTER TABLE "availability_schedules" ADD CONSTRAINT "availability_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_time_off" ADD CONSTRAINT "availability_time_off_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_tokens" ADD CONSTRAINT "google_calendar_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- D-057: a person's time belongs to them, across every business they work with. This migration fills
-- the new person columns from today's per-business rows; 0009 then drops the per-business columns.
UPDATE "public"."availability_schedules" s SET "user_id" = m."user_id" FROM "public"."memberships" m WHERE m."id" = s."membership_id";--> statement-breakpoint
-- One weekly schedule per person: if someone had several, keep the most recently updated.
DELETE FROM "public"."availability_schedules" a USING "public"."availability_schedules" b
  WHERE a."user_id" = b."user_id" AND (a."updated_at", a."membership_id"::text) < (b."updated_at", b."membership_id"::text);--> statement-breakpoint
UPDATE "public"."availability_time_off" t SET "user_id" = m."user_id" FROM "public"."memberships" m WHERE m."id" = t."membership_id";--> statement-breakpoint
UPDATE "public"."bookings" b SET "host_user_id" = m."user_id" FROM "public"."memberships" m WHERE m."id" = b."host_membership_id";--> statement-breakpoint
UPDATE "public"."google_calendar_connections" c SET "user_id" = m."user_id" FROM "public"."memberships" m WHERE m."id" = c."membership_id";--> statement-breakpoint
-- Each business keeps the calendar its bookings were going into.
INSERT INTO "public"."membership_availability" ("membership_id", "business_id", "destination_calendar_id")
  SELECT "membership_id", "business_id", "destination_calendar_id" FROM "public"."google_calendar_connections"
  ON CONFLICT ("membership_id") DO NOTHING;--> statement-breakpoint
UPDATE "public"."google_calendar_tokens" t SET "user_id" = c."user_id" FROM "public"."google_calendar_connections" c WHERE c."membership_id" = t."membership_id";--> statement-breakpoint
-- One Google connection per person: keep the most recent (its token goes with it).
DELETE FROM "public"."google_calendar_connections" a USING "public"."google_calendar_connections" b
  WHERE a."user_id" = b."user_id" AND (a."updated_at", a."membership_id"::text) < (b."updated_at", b."membership_id"::text);--> statement-breakpoint

-- What a business gets of a person's time: readable by that business's team; the person, or the
-- business's owners and administrators, can change it.
ALTER TABLE "public"."membership_availability" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "members read offered hours" ON "public"."membership_availability"
  FOR SELECT TO authenticated USING ((SELECT private.is_member(business_id)));--> statement-breakpoint
CREATE POLICY "people and managers add offered hours" ON "public"."membership_availability"
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.can_edit_availability(membership_id, business_id)));--> statement-breakpoint
CREATE POLICY "people and managers change offered hours" ON "public"."membership_availability"
  FOR UPDATE TO authenticated
  USING ((SELECT private.can_edit_availability(membership_id, business_id)))
  WITH CHECK ((SELECT private.can_edit_availability(membership_id, business_id)));--> statement-breakpoint
CREATE POLICY "people and managers remove offered hours" ON "public"."membership_availability"
  FOR DELETE TO authenticated USING ((SELECT private.can_edit_availability(membership_id, business_id)));
