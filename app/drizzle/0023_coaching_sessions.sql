ALTER TABLE "bookings" DROP CONSTRAINT "bookings_guest_email_length";--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "guest_email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "coaching_client_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "credit_period_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "credit_units" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "credit_notice_hours" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "credit_late_cancellation" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "credit_cancellation_outcome" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "attended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "client_credit_events" ADD COLUMN "booking_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_credit_period_fk" FOREIGN KEY ("business_id","coaching_client_id","credit_period_id") REFERENCES "public"."client_credit_periods"("business_id","client_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_credit_events" ADD CONSTRAINT "client_credit_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_coaching_client_idx" ON "bookings" USING btree ("business_id","coaching_client_id","credit_period_id","starts_at") WHERE "bookings"."coaching_client_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "client_credit_events_booking_kind_key" ON "client_credit_events" USING btree ("booking_id","kind");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_coaching_terms" CHECK (
      ("bookings"."coaching_client_id" is null and "bookings"."credit_period_id" is null and "bookings"."credit_units" is null
       and "bookings"."credit_notice_hours" is null and "bookings"."credit_late_cancellation" is null
       and "bookings"."credit_cancellation_outcome" is null and "bookings"."attended_at" is null)
      or ("bookings"."coaching_client_id" is not null and "bookings"."credit_period_id" is not null and "bookings"."booking_page_id" is null
       and "bookings"."payment_status" = 'not_required' and "bookings"."price_cents" is null
       and "bookings"."credit_units" is not null and "bookings"."credit_units" between 1 and 100000
       and "bookings"."credit_notice_hours" is not null and "bookings"."credit_notice_hours" between 0 and 720
       and "bookings"."credit_late_cancellation" is not null and "bookings"."credit_late_cancellation" in ('preserve', 'forfeit')
       and (("bookings"."status" = 'confirmed' and "bookings"."credit_cancellation_outcome" is null)
         or ("bookings"."status" = 'cancelled' and "bookings"."attended_at" is null and "bookings"."credit_cancellation_outcome" is not null
           and "bookings"."credit_cancellation_outcome" in ('released', 'forfeited')))));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guest_email_length" CHECK (("bookings"."guest_email" is null and "bookings"."coaching_client_id" is not null) or ("bookings"."guest_email" is not null and char_length("bookings"."guest_email") between 3 and 254));--> statement-breakpoint

-- Coaching and public bookings already share the host exclusion constraint. Also guard
-- against a client booking overlapping sessions with two different coaches.
ALTER TABLE public.bookings ADD CONSTRAINT bookings_coaching_client_no_overlap
  EXCLUDE USING gist (coaching_client_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (coaching_client_id IS NOT NULL AND status = 'confirmed');--> statement-breakpoint

DROP POLICY "members read bookings" ON public.bookings;--> statement-breakpoint
CREATE POLICY "staff read bookings within their scope" ON public.bookings
  FOR SELECT TO authenticated USING (
    (coaching_client_id IS NULL AND (SELECT private.is_member(business_id)))
    OR (coaching_client_id IS NOT NULL AND (
      ((SELECT auth.uid()) = host_user_id AND (SELECT private.is_member(business_id)))
      OR EXISTS (
        SELECT 1 FROM public.coaching_clients c
        WHERE c.id = bookings.coaching_client_id AND c.business_id = bookings.business_id
      )
    ))
  );
