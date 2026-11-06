-- Booking status becomes text with a check (an enum value can't be added and used in one migration).
-- The overlap guard depends on the column, so it's dropped first and rebuilt at the end.
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_no_overlap";--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'confirmed';--> statement-breakpoint
ALTER TABLE "booking_pages" ADD COLUMN "price_cents" integer;--> statement-breakpoint
ALTER TABLE "booking_pages" ADD COLUMN "refund_cutoff_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_pages" ADD COLUMN "ask_student" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_pages" ADD COLUMN "questions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "hold_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_status" text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "price_cents" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "stripe_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "stripe_payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refund_cutoff_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "student_name" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "student_grade" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "answers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_checkout_session_key" ON "bookings" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
ALTER TABLE "booking_pages" ADD CONSTRAINT "booking_pages_price" CHECK ("booking_pages"."price_cents" is null or "booking_pages"."price_cents" between 50 and 1000000);--> statement-breakpoint
ALTER TABLE "booking_pages" ADD CONSTRAINT "booking_pages_refund_cutoff" CHECK ("booking_pages"."refund_cutoff_hours" between 0 and 720);--> statement-breakpoint
ALTER TABLE "booking_pages" ADD CONSTRAINT "booking_pages_questions_array" CHECK (jsonb_typeof("booking_pages"."questions") = 'array');--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_status" CHECK ("bookings"."status" in ('pending_payment', 'confirmed', 'cancelled', 'expired'));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_payment_status" CHECK ("bookings"."payment_status" in ('not_required', 'pending', 'paid', 'refunded', 'refund_failed'));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by" CHECK ("bookings"."cancelled_by" is null or "bookings"."cancelled_by" in ('guest', 'business'));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_answers_array" CHECK (jsonb_typeof("bookings"."answers") = 'array');--> statement-breakpoint
DROP TYPE "public"."booking_status";--> statement-breakpoint

-- No double-booking, now counting times held for a guest who is paying. Expired holds are marked
-- 'expired' (by the Stripe webhook, or just before the next booking) and stop counting.
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("host_membership_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" IN ('confirmed', 'pending_payment'));--> statement-breakpoint
CREATE INDEX "bookings_reminder_due_idx" ON "public"."bookings" ("starts_at") WHERE "status" = 'confirmed' AND "reminder_sent_at" IS NULL;
