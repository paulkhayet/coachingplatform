CREATE TABLE "client_credit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"credit_units" integer NOT NULL,
	"payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_credit_events_kind" CHECK ("client_credit_events"."kind" in ('funded', 'reserved', 'released', 'used', 'forfeited', 'expired')),
	CONSTRAINT "client_credit_events_units" CHECK ("client_credit_events"."credit_units" between 1 and 100000),
	CONSTRAINT "client_credit_events_payment" CHECK (("client_credit_events"."kind" = 'funded') = ("client_credit_events"."payment_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "client_credit_payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" text NOT NULL,
	"received_on" date NOT NULL,
	"reference" text,
	"recorded_by" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_credit_payments_amount" CHECK ("client_credit_payments"."amount_cents" between 1 and 100000000),
	CONSTRAINT "client_credit_payments_method" CHECK ("client_credit_payments"."method" in ('cash', 'check', 'bank_transfer', 'other')),
	CONSTRAINT "client_credit_payments_reference" CHECK (char_length("client_credit_payments"."reference") <= 200)
);
--> statement-breakpoint
CREATE TABLE "client_credit_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"client_package_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"credit_units" integer NOT NULL,
	"expiration" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_credit_periods_dates" CHECK ("client_credit_periods"."starts_on" < "client_credit_periods"."ends_on"),
	CONSTRAINT "client_credit_periods_kind" CHECK ("client_credit_periods"."kind" in ('fixed', 'monthly')),
	CONSTRAINT "client_credit_periods_units" CHECK ("client_credit_periods"."credit_units" between 1 and 100000),
	CONSTRAINT "client_credit_periods_expiration" CHECK ("client_credit_periods"."expiration" in ('inherit', 'end_of_term'))
);
--> statement-breakpoint
CREATE TABLE "client_guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relationship" text,
	"email" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_guardians_name" CHECK (char_length(btrim("client_guardians"."name")) between 2 and 100),
	CONSTRAINT "client_guardians_contact" CHECK (("client_guardians"."email" is not null or "client_guardians"."phone" is not null) and char_length(coalesce("client_guardians"."email", '')) <= 254 and char_length(coalesce("client_guardians"."phone", '')) <= 40),
	CONSTRAINT "client_guardians_relationship" CHECK (char_length("client_guardians"."relationship") <= 80)
);
--> statement-breakpoint
CREATE TABLE "client_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"package_id" uuid,
	"terms" jsonb NOT NULL,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_packages_terms_object" CHECK (jsonb_typeof("client_packages"."terms") = 'object')
);
--> statement-breakpoint
CREATE TABLE "coaching_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"coach_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coaching_clients_name" CHECK (char_length(btrim("coaching_clients"."name")) between 2 and 100),
	CONSTRAINT "coaching_clients_email" CHECK (char_length("coaching_clients"."email") <= 254)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "client_credit_periods_business_client_id_key" ON "client_credit_periods" USING btree ("business_id","client_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_packages_business_client_id_key" ON "client_packages" USING btree ("business_id","client_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "coaching_clients_business_id_key" ON "coaching_clients" USING btree ("business_id","id");--> statement-breakpoint
ALTER TABLE "client_credit_events" ADD CONSTRAINT "client_credit_events_payment_id_client_credit_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."client_credit_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_credit_events" ADD CONSTRAINT "client_credit_events_period_fk" FOREIGN KEY ("business_id","client_id","period_id") REFERENCES "public"."client_credit_periods"("business_id","client_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_credit_payments" ADD CONSTRAINT "client_credit_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_credit_payments" ADD CONSTRAINT "client_credit_payments_period_fk" FOREIGN KEY ("business_id","client_id","period_id") REFERENCES "public"."client_credit_periods"("business_id","client_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_credit_periods" ADD CONSTRAINT "client_credit_periods_package_fk" FOREIGN KEY ("business_id","client_id","client_package_id") REFERENCES "public"."client_packages"("business_id","client_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_guardians" ADD CONSTRAINT "client_guardians_client_fk" FOREIGN KEY ("business_id","client_id") REFERENCES "public"."coaching_clients"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_packages" ADD CONSTRAINT "client_packages_package_id_coaching_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."coaching_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_packages" ADD CONSTRAINT "client_packages_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_packages" ADD CONSTRAINT "client_packages_client_fk" FOREIGN KEY ("business_id","client_id") REFERENCES "public"."coaching_clients"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_clients" ADD CONSTRAINT "coaching_clients_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_clients" ADD CONSTRAINT "coaching_clients_coach_membership_id_memberships_id_fk" FOREIGN KEY ("coach_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_credit_events_period_idx" ON "client_credit_events" USING btree ("business_id","client_id","period_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "client_credit_events_payment_key" ON "client_credit_events" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "client_credit_payments_period_idx" ON "client_credit_payments" USING btree ("business_id","client_id","period_id");--> statement-breakpoint
CREATE INDEX "client_credit_payments_actor_idx" ON "client_credit_payments" USING btree ("recorded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "client_credit_periods_package_start_key" ON "client_credit_periods" USING btree ("business_id","client_id","client_package_id","starts_on");--> statement-breakpoint
CREATE INDEX "client_guardians_client_idx" ON "client_guardians" USING btree ("business_id","client_id");--> statement-breakpoint
CREATE INDEX "client_packages_catalog_idx" ON "client_packages" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "client_packages_assigned_by_idx" ON "client_packages" USING btree ("assigned_by");--> statement-breakpoint
CREATE INDEX "coaching_clients_coach_idx" ON "coaching_clients" USING btree ("coach_membership_id");--> statement-breakpoint
CREATE INDEX "coaching_clients_business_name_idx" ON "coaching_clients" USING btree ("business_id","name");--> statement-breakpoint

ALTER TABLE public.coaching_clients ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.client_guardians ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.client_packages ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.client_credit_periods ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.client_credit_payments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.client_credit_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

REVOKE ALL ON public.coaching_clients, public.client_guardians, public.client_packages,
  public.client_credit_periods, public.client_credit_payments, public.client_credit_events
  FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.coaching_clients, public.client_guardians, public.client_packages,
  public.client_credit_periods, public.client_credit_payments, public.client_credit_events
  TO authenticated;--> statement-breakpoint
GRANT INSERT (business_id, name, email, coach_membership_id),
  UPDATE (name, email, coach_membership_id, updated_at) ON public.coaching_clients TO authenticated;--> statement-breakpoint
GRANT INSERT (business_id, client_id, name, relationship, email, phone),
  UPDATE (name, relationship, email, phone) ON public.client_guardians TO authenticated;--> statement-breakpoint

CREATE POLICY "staff read authorized clients" ON public.coaching_clients
  FOR SELECT TO authenticated USING (
    (SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[]))
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.id = coach_membership_id AND m.business_id = coaching_clients.business_id
        AND m.user_id = (SELECT auth.uid()) AND m.status = 'active' AND m.coaches
    )
  );--> statement-breakpoint
CREATE POLICY "managers add clients" ON public.coaching_clients
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[]))
  );--> statement-breakpoint
CREATE POLICY "managers edit clients" ON public.coaching_clients
  FOR UPDATE TO authenticated
  USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])))
  WITH CHECK ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint

CREATE POLICY "managers read guardian contacts" ON public.client_guardians
  FOR SELECT TO authenticated USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint
CREATE POLICY "managers add guardian contacts" ON public.client_guardians
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint
CREATE POLICY "managers edit guardian contacts" ON public.client_guardians
  FOR UPDATE TO authenticated
  USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])))
  WITH CHECK ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint

-- Only the server can append assignments, payments and credit events. Staff who may
-- read a client can see its credit counts, with monetary records under separate policies.
CREATE POLICY "managers read package terms" ON public.client_packages
  FOR SELECT TO authenticated USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint
CREATE POLICY "managers read payment records" ON public.client_credit_payments
  FOR SELECT TO authenticated USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint
CREATE POLICY "staff read authorized credit periods" ON public.client_credit_periods
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.coaching_clients c
    WHERE c.business_id = client_credit_periods.business_id AND c.id = client_credit_periods.client_id
  ));--> statement-breakpoint
CREATE POLICY "staff read authorized credit events" ON public.client_credit_events
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.coaching_clients c
    WHERE c.business_id = client_credit_events.business_id AND c.id = client_credit_events.client_id
  ));--> statement-breakpoint

CREATE FUNCTION private.validate_client_coach() RETURNS trigger
  LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.coach_membership_id IS NOT DISTINCT FROM OLD.coach_membership_id
    AND NEW.business_id = OLD.business_id THEN
    RETURN NEW;
  END IF;
  IF NEW.coach_membership_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.memberships m WHERE m.id = NEW.coach_membership_id
      AND m.business_id = NEW.business_id AND m.status = 'active' AND m.coaches
  ) THEN
    RAISE EXCEPTION 'Choose an active coach from this business.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.validate_client_coach() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
CREATE TRIGGER validate_client_coach BEFORE INSERT OR UPDATE OF business_id, coach_membership_id
  ON public.coaching_clients FOR EACH ROW EXECUTE FUNCTION private.validate_client_coach();--> statement-breakpoint

-- Calculate from all events even when the UI displays only recent history.
CREATE FUNCTION public.client_credit_balances(p_business_id uuid, p_client_id uuid)
RETURNS TABLE (
  id uuid, client_package_id uuid, name text, kind text, starts_on date, ends_on date,
  credit_units integer, expiration text, funded_units integer, reserved_units integer,
  used_units integer, forfeited_units integer, expired_units integer, paid_cents integer
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT p.id, p.client_package_id, p.name, p.kind, p.starts_on, p.ends_on, p.credit_units, p.expiration,
    COALESCE(SUM(e.credit_units) FILTER (WHERE e.kind = 'funded'), 0)::integer,
    COALESCE(SUM(CASE e.kind WHEN 'reserved' THEN e.credit_units WHEN 'released' THEN -e.credit_units ELSE 0 END), 0)::integer,
    COALESCE(SUM(e.credit_units) FILTER (WHERE e.kind = 'used'), 0)::integer,
    COALESCE(SUM(e.credit_units) FILTER (WHERE e.kind = 'forfeited'), 0)::integer,
    COALESCE(SUM(e.credit_units) FILTER (WHERE e.kind = 'expired'), 0)::integer,
    (SELECT SUM(pay.amount_cents)::integer FROM public.client_credit_payments pay
      WHERE pay.business_id = p.business_id AND pay.client_id = p.client_id AND pay.period_id = p.id)
  FROM public.client_credit_periods p
  LEFT JOIN public.client_credit_events e
    ON e.business_id = p.business_id AND e.client_id = p.client_id AND e.period_id = p.id
  WHERE p.business_id = p_business_id AND p.client_id = p_client_id
  GROUP BY p.id
  ORDER BY p.starts_on DESC, p.created_at DESC, p.id;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.client_credit_balances(uuid, uuid) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.client_credit_balances(uuid, uuid) TO authenticated;
