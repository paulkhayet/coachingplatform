CREATE TABLE "coaching_reservation_locations" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"detail" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "credit_covered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_reminder_hours" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "unpaid_cancellation_hours" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "unpaid_cancelled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "allow_advance_reservations" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "payment_reminder_hours" integer;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "unpaid_cancellation_hours" integer;--> statement-breakpoint
ALTER TABLE "coaching_reservation_locations" ADD CONSTRAINT "coaching_reservation_locations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_unpaid_coaching_starts_idx" ON "bookings" USING btree ("starts_at") WHERE "bookings"."coaching_client_id" is not null and "bookings"."credit_covered_at" is null and "bookings"."status" = 'confirmed';--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_reservation_hours" CHECK (("businesses"."payment_reminder_hours" is null or "businesses"."payment_reminder_hours" between 1 and 720)
      and ("businesses"."unpaid_cancellation_hours" is null or "businesses"."unpaid_cancellation_hours" between 1 and 720)
      and "businesses"."payment_reminder_hours" > "businesses"."unpaid_cancellation_hours");--> statement-breakpoint
UPDATE public.bookings SET credit_covered_at = created_at WHERE coaching_client_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE public.coaching_reservation_locations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE public.coaching_reservation_locations FROM PUBLIC, anon, authenticated;--> statement-breakpoint
DROP FUNCTION public.client_credit_balances(uuid, uuid);--> statement-breakpoint
CREATE FUNCTION public.client_credit_balances(p_business_id uuid, p_client_id uuid)
RETURNS TABLE (
  id uuid, client_package_id uuid, name text, kind text, starts_on date, ends_on date,
  credit_units integer, expiration text, funded_units integer, reserved_units integer,
  used_units integer, forfeited_units integer, expired_units integer, paid_cents integer,
  unpaid_reserved_units integer, waiting_reserved_units integer
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT p.id, p.client_package_id, p.name, p.kind, p.starts_on, p.ends_on, p.credit_units, p.expiration,
    COALESCE(SUM(e.credit_units) FILTER (WHERE e.kind = 'funded'), 0)::integer,
    COALESCE(SUM(CASE e.kind WHEN 'reserved' THEN e.credit_units WHEN 'released' THEN -e.credit_units ELSE 0 END), 0)::integer,
    COALESCE(SUM(e.credit_units) FILTER (WHERE e.kind = 'used'), 0)::integer,
    COALESCE(SUM(e.credit_units) FILTER (WHERE e.kind = 'forfeited'), 0)::integer,
    COALESCE(SUM(e.credit_units) FILTER (WHERE e.kind = 'expired'), 0)::integer,
    (SELECT SUM(pay.amount_cents)::integer FROM public.client_credit_payments pay
      WHERE pay.business_id = p.business_id AND pay.client_id = p.client_id AND pay.period_id = p.id),
    (SELECT COALESCE(SUM(b.credit_units), 0)::integer FROM public.bookings b
      WHERE b.credit_period_id = p.id AND b.status = 'confirmed' AND b.credit_covered_at IS NULL),
    (SELECT COALESCE(SUM(b.credit_units), 0)::integer FROM public.bookings b
      JOIN public.memberships m ON m.id = b.host_membership_id AND m.status = 'active'
      WHERE b.credit_period_id = p.id AND b.status = 'confirmed' AND b.credit_covered_at IS NULL
        AND b.starts_at > now() + COALESCE(b.unpaid_cancellation_hours, 0) * interval '1 hour')
  FROM public.client_credit_periods p
  LEFT JOIN public.client_credit_events e
    ON e.business_id = p.business_id AND e.client_id = p.client_id AND e.period_id = p.id
  WHERE p.business_id = p_business_id AND p.client_id = p_client_id
  GROUP BY p.id
  ORDER BY p.starts_on DESC, p.created_at DESC, p.id;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.client_credit_balances(uuid, uuid) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.client_credit_balances(uuid, uuid) TO authenticated;
