CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('video_link', 'phone', 'in_person');--> statement-breakpoint
CREATE TABLE "booking_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"host_membership_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"location_type" "location_type" DEFAULT 'video_link' NOT NULL,
	"location_detail" text,
	"min_notice_minutes" integer DEFAULT 240 NOT NULL,
	"window_days" integer DEFAULT 30 NOT NULL,
	"buffer_before_minutes" integer DEFAULT 0 NOT NULL,
	"buffer_after_minutes" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_pages_slug_format" CHECK ("booking_pages"."slug" ~ '^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$'),
	CONSTRAINT "booking_pages_title_length" CHECK (char_length("booking_pages"."title") between 2 and 80),
	CONSTRAINT "booking_pages_description_length" CHECK (char_length("booking_pages"."description") <= 1000),
	CONSTRAINT "booking_pages_duration" CHECK ("booking_pages"."duration_minutes" between 5 and 480),
	CONSTRAINT "booking_pages_notice" CHECK ("booking_pages"."min_notice_minutes" between 0 and 43200),
	CONSTRAINT "booking_pages_window" CHECK ("booking_pages"."window_days" between 1 and 365),
	CONSTRAINT "booking_pages_buffers" CHECK ("booking_pages"."buffer_before_minutes" between 0 and 240 and "booking_pages"."buffer_after_minutes" between 0 and 240)
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"booking_page_id" uuid,
	"host_membership_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"guest_name" text NOT NULL,
	"guest_email" text NOT NULL,
	"guest_notes" text,
	"guest_timezone" text,
	"location_type" "location_type" NOT NULL,
	"location_detail" text,
	"google_calendar_id" text,
	"google_event_id" text,
	"calendar_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "bookings_order" CHECK ("bookings"."ends_at" > "bookings"."starts_at"),
	CONSTRAINT "bookings_guest_name_length" CHECK (char_length("bookings"."guest_name") between 1 and 120),
	CONSTRAINT "bookings_guest_email_length" CHECK (char_length("bookings"."guest_email") between 3 and 254),
	CONSTRAINT "bookings_guest_notes_length" CHECK (char_length("bookings"."guest_notes") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "booking_pages" ADD CONSTRAINT "booking_pages_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_pages" ADD CONSTRAINT "booking_pages_host_membership_id_memberships_id_fk" FOREIGN KEY ("host_membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booking_page_id_booking_pages_id_fk" FOREIGN KEY ("booking_page_id") REFERENCES "public"."booking_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_host_membership_id_memberships_id_fk" FOREIGN KEY ("host_membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_pages_business_slug_key" ON "booking_pages" USING btree ("business_id","slug");--> statement-breakpoint
CREATE INDEX "booking_pages_host_idx" ON "booking_pages" USING btree ("host_membership_id");--> statement-breakpoint
CREATE INDEX "bookings_business_starts_idx" ON "bookings" USING btree ("business_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_host_starts_idx" ON "bookings" USING btree ("host_membership_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_page_idx" ON "bookings" USING btree ("booking_page_id");--> statement-breakpoint

-- No double-booking: the database refuses two confirmed bookings for the same host whose times
-- overlap, even if two guests submit at the same instant. Cancelled bookings don't count.
CREATE SCHEMA IF NOT EXISTS extensions;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;--> statement-breakpoint
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("host_membership_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" = 'confirmed');--> statement-breakpoint

-- Row-level security.
-- Booking pages: the team can read them; owners and administrators manage any, and a coach manages
-- their own (they host it). The host must belong to the same business.
-- Bookings: the team can read them. Guests book through the server (they have no account), and
-- staff changes go through server actions, so nobody writes bookings through the API.
CREATE OR REPLACE FUNCTION private.can_manage_booking_page(p_host_membership_id uuid, p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.id = p_host_membership_id
      AND m.business_id = p_business_id
      AND (
        (m.user_id = (SELECT auth.uid()) AND m.status = 'active')
        OR private.has_role(p_business_id, ARRAY['owner', 'admin']::public.member_role[])
      )
  );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.can_manage_booking_page(uuid, uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.can_manage_booking_page(uuid, uuid) TO authenticated;--> statement-breakpoint

ALTER TABLE "public"."booking_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "members read booking pages" ON "public"."booking_pages"
  FOR SELECT TO authenticated USING ((SELECT private.is_member(business_id)));--> statement-breakpoint
CREATE POLICY "hosts and managers add booking pages" ON "public"."booking_pages"
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.can_manage_booking_page(host_membership_id, business_id)));--> statement-breakpoint
CREATE POLICY "hosts and managers change booking pages" ON "public"."booking_pages"
  FOR UPDATE TO authenticated
  USING ((SELECT private.can_manage_booking_page(host_membership_id, business_id)))
  WITH CHECK ((SELECT private.can_manage_booking_page(host_membership_id, business_id)));--> statement-breakpoint
CREATE POLICY "hosts and managers remove booking pages" ON "public"."booking_pages"
  FOR DELETE TO authenticated USING ((SELECT private.can_manage_booking_page(host_membership_id, business_id)));--> statement-breakpoint

CREATE POLICY "members read bookings" ON "public"."bookings"
  FOR SELECT TO authenticated USING ((SELECT private.is_member(business_id)));--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "public"."bookings" FROM anon, authenticated;
