CREATE TABLE "coach_pay_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"method" text NOT NULL,
	"amount_cents" integer,
	"percent_bps" integer,
	"format_overrides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pay_forfeited" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_pay_rates_method" CHECK ("coach_pay_rates"."method" in ('hourly', 'per_session', 'percent', 'salary')),
	CONSTRAINT "coach_pay_rates_amounts" CHECK (
    ("coach_pay_rates"."method" = 'percent' and "coach_pay_rates"."percent_bps" is not null and "coach_pay_rates"."percent_bps" between 0 and 10000 and "coach_pay_rates"."amount_cents" is null)
    or ("coach_pay_rates"."method" <> 'percent' and "coach_pay_rates"."amount_cents" is not null and "coach_pay_rates"."amount_cents" between 0 and 100000000 and "coach_pay_rates"."percent_bps" is null)),
	CONSTRAINT "coach_pay_rates_overrides" CHECK (jsonb_typeof("coach_pay_rates"."format_overrides") = 'array'
    and ("coach_pay_rates"."method" = 'per_session' or jsonb_array_length("coach_pay_rates"."format_overrides") = 0))
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"stage" text DEFAULT 'new' NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"relationship" text,
	"student_name" text NOT NULL,
	"student_grade" text,
	"subjects" text[] DEFAULT '{}'::text[] NOT NULL,
	"goals" text,
	"availability_notes" text,
	"timezone" text,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text NOT NULL,
	"owner_membership_id" uuid,
	"coach_membership_id" uuid,
	"first_call_booking_id" uuid,
	"client_id" uuid,
	"lost_reason" text,
	"next_action" text,
	"next_action_due" date,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inquiries_stage" CHECK ("inquiries"."stage" in ('new', 'matching', 'first_call', 'offer', 'enrolled', 'lost')),
	CONSTRAINT "inquiries_source" CHECK ("inquiries"."source" in ('form', 'staff')),
	CONSTRAINT "inquiries_enrolled_client" CHECK (("inquiries"."stage" = 'enrolled') = ("inquiries"."client_id" is not null)),
	CONSTRAINT "inquiries_lost_reason" CHECK ("inquiries"."stage" <> 'lost' or "inquiries"."lost_reason" is not null),
	CONSTRAINT "inquiries_contact" CHECK (char_length(btrim("inquiries"."contact_name")) between 1 and 120
    and "inquiries"."contact_email" = lower("inquiries"."contact_email") and char_length("inquiries"."contact_email") between 3 and 254
    and char_length("inquiries"."contact_phone") <= 40 and char_length("inquiries"."relationship") <= 80),
	CONSTRAINT "inquiries_student" CHECK (char_length(btrim("inquiries"."student_name")) between 2 and 100 and char_length("inquiries"."student_grade") <= 40),
	CONSTRAINT "inquiries_subjects" CHECK (cardinality("inquiries"."subjects") <= 20 and array_position("inquiries"."subjects", null) is null),
	CONSTRAINT "inquiries_lengths" CHECK (char_length("inquiries"."goals") <= 2000 and char_length("inquiries"."availability_notes") <= 1000
    and char_length("inquiries"."timezone") <= 64 and char_length("inquiries"."lost_reason") <= 300 and char_length("inquiries"."next_action") <= 200),
	CONSTRAINT "inquiries_answers_array" CHECK (jsonb_typeof("inquiries"."answers") = 'array')
);
--> statement-breakpoint
CREATE TABLE "inquiry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"actor_id" uuid,
	"kind" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inquiry_events_kind" CHECK ("inquiry_events"."kind" in ('created', 'stage', 'assigned', 'note', 'first_call_booked', 'first_call_outcome', 'converted')),
	CONSTRAINT "inquiry_events_data" CHECK (jsonb_typeof("inquiry_events"."data") = 'object' and char_length("inquiry_events"."data"::text) <= 8000)
);
--> statement-breakpoint
CREATE TABLE "intake_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"intro" text,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notify_membership_ids" uuid[],
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intake_settings_intro" CHECK (char_length("intake_settings"."intro") <= 1000),
	CONSTRAINT "intake_settings_questions_array" CHECK (jsonb_typeof("intake_settings"."questions") = 'array'),
	CONSTRAINT "intake_settings_notify" CHECK ("intake_settings"."notify_membership_ids" is null or (cardinality("intake_settings"."notify_membership_ids") between 1 and 50 and array_position("intake_settings"."notify_membership_ids", null) is null))
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "stripe_fee_cents" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "inquiry_id" uuid;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "specialties" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "max_clients" integer;--> statement-breakpoint
ALTER TABLE "coach_pay_rates" ADD CONSTRAINT "coach_pay_rates_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_pay_rates" ADD CONSTRAINT "coach_pay_rates_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_pay_rates" ADD CONSTRAINT "coach_pay_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_owner_membership_id_memberships_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_coach_membership_id_memberships_id_fk" FOREIGN KEY ("coach_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_first_call_booking_id_bookings_id_fk" FOREIGN KEY ("first_call_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_client_fk" FOREIGN KEY ("business_id","client_id") REFERENCES "public"."coaching_clients"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inquiries_business_id_key" ON "inquiries" USING btree ("business_id","id");--> statement-breakpoint
ALTER TABLE "inquiry_events" ADD CONSTRAINT "inquiry_events_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_events" ADD CONSTRAINT "inquiry_events_inquiry_fk" FOREIGN KEY ("business_id","inquiry_id") REFERENCES "public"."inquiries"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_settings" ADD CONSTRAINT "intake_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coach_pay_rates_member_from_key" ON "coach_pay_rates" USING btree ("business_id","membership_id","effective_from");--> statement-breakpoint
CREATE INDEX "coach_pay_rates_membership_idx" ON "coach_pay_rates" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "coach_pay_rates_created_by_idx" ON "coach_pay_rates" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "inquiries_client_key" ON "inquiries" USING btree ("client_id") WHERE "inquiries"."client_id" is not null;--> statement-breakpoint
CREATE INDEX "inquiries_stage_idx" ON "inquiries" USING btree ("business_id","stage","stage_changed_at");--> statement-breakpoint
CREATE INDEX "inquiries_client_idx" ON "inquiries" USING btree ("business_id","client_id");--> statement-breakpoint
CREATE INDEX "inquiries_coach_idx" ON "inquiries" USING btree ("coach_membership_id");--> statement-breakpoint
CREATE INDEX "inquiries_owner_idx" ON "inquiries" USING btree ("owner_membership_id");--> statement-breakpoint
CREATE INDEX "inquiries_first_call_idx" ON "inquiries" USING btree ("first_call_booking_id");--> statement-breakpoint
CREATE INDEX "inquiries_email_idx" ON "inquiries" USING btree ("business_id","contact_email","created_at");--> statement-breakpoint
CREATE INDEX "inquiry_events_inquiry_idx" ON "inquiry_events" USING btree ("business_id","inquiry_id","created_at");--> statement-breakpoint
CREATE INDEX "inquiry_events_actor_idx" ON "inquiry_events" USING btree ("actor_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_inquiry_idx" ON "bookings" USING btree ("inquiry_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_stripe_fee" CHECK ("bookings"."stripe_fee_cents" is null or "bookings"."stripe_fee_cents" >= 0);--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_specialties" CHECK (cardinality("memberships"."specialties") <= 30 and array_position("memberships"."specialties", null) is null);--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_max_clients" CHECK ("memberships"."max_clients" is null or "memberships"."max_clients" between 0 and 1000);--> statement-breakpoint

-- D-074: the team dashboard. Coach pay is the owner's alone. Inquiries (intake) belong to owners and
-- administrators; a coach sees only the inquiries where they're the proposed coach, and may add notes
-- and a first-call outcome to those. Families and anonymous visitors never reach any of it: the public
-- inquiry form goes through the server.

-- Paid calls already on record: the money arrived about when they were booked.
UPDATE public.bookings SET paid_at = created_at
  WHERE payment_status IN ('paid', 'refunded', 'refund_failed') AND paid_at IS NULL;--> statement-breakpoint

CREATE FUNCTION private.validate_membership_specialties() RETURNS trigger
  LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(NEW.specialties) AS s WHERE char_length(btrim(s)) NOT BETWEEN 1 AND 40) THEN
    RAISE EXCEPTION 'Each specialty needs 1 to 40 characters.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.validate_membership_specialties() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
CREATE TRIGGER validate_membership_specialties BEFORE INSERT OR UPDATE OF specialties
  ON public.memberships FOR EACH ROW EXECUTE FUNCTION private.validate_membership_specialties();--> statement-breakpoint

-- A pay rate belongs to someone in the same business.
CREATE FUNCTION private.validate_coach_pay_rate() RETURNS trigger
  LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m WHERE m.id = NEW.membership_id AND m.business_id = NEW.business_id
  ) THEN
    RAISE EXCEPTION 'Choose someone from this business.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.validate_coach_pay_rate() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
CREATE TRIGGER validate_coach_pay_rate BEFORE INSERT OR UPDATE OF business_id, membership_id
  ON public.coach_pay_rates FOR EACH ROW EXECUTE FUNCTION private.validate_coach_pay_rate();--> statement-breakpoint

-- Keeps an inquiry consistent whoever writes it: staff from the same business, an enrolment that can't
-- be undone or pointed at another client, and stage timestamps the caller can't set.
CREATE FUNCTION private.validate_inquiry() RETURNS trigger
  LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(NEW.subjects) AS s WHERE char_length(btrim(s)) NOT BETWEEN 1 AND 60) THEN
    RAISE EXCEPTION 'Each subject needs 1 to 60 characters.' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.business_id <> OLD.business_id OR NEW.source <> OLD.source THEN
      RAISE EXCEPTION 'An inquiry can''t move to another business or change where it came from.' USING ERRCODE = '22023';
    END IF;
    IF OLD.client_id IS NOT NULL AND (NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.stage <> 'enrolled') THEN
      RAISE EXCEPTION 'This inquiry is already enrolled as a client.' USING ERRCODE = '22023';
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
    NEW.stage_changed_at := CASE WHEN NEW.stage <> OLD.stage THEN now() ELSE OLD.stage_changed_at END;
  END IF;
  IF NEW.owner_membership_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.owner_membership_id IS DISTINCT FROM OLD.owner_membership_id) AND NOT EXISTS (
    SELECT 1 FROM public.memberships m WHERE m.id = NEW.owner_membership_id AND m.business_id = NEW.business_id
      AND m.status = 'active' AND m.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Choose an active owner or administrator from this business.' USING ERRCODE = '22023';
  END IF;
  IF NEW.coach_membership_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.coach_membership_id IS DISTINCT FROM OLD.coach_membership_id) AND NOT EXISTS (
    SELECT 1 FROM public.memberships m WHERE m.id = NEW.coach_membership_id AND m.business_id = NEW.business_id
      AND m.status = 'active' AND m.coaches
  ) THEN
    RAISE EXCEPTION 'Choose an active coach from this business.' USING ERRCODE = '22023';
  END IF;
  IF NEW.first_call_booking_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.first_call_booking_id IS DISTINCT FROM OLD.first_call_booking_id) AND NOT EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.id = NEW.first_call_booking_id AND b.business_id = NEW.business_id AND b.inquiry_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'The first call must be a booking made for this inquiry.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.validate_inquiry() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
CREATE TRIGGER validate_inquiry BEFORE INSERT OR UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION private.validate_inquiry();--> statement-breakpoint

-- The timeline records every stage and assignment change, whoever makes it. SECURITY DEFINER so the
-- entry is written even though nobody may write those kinds of entry through the API.
CREATE FUNCTION private.log_inquiry_change() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
BEGIN
  IF v_actor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_actor) THEN
    v_actor := NULL;
  END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.inquiry_events (business_id, inquiry_id, actor_id, kind, data)
      VALUES (NEW.business_id, NEW.id, v_actor, 'created', jsonb_build_object('source', NEW.source));
    RETURN NEW;
  END IF;
  IF NEW.stage <> OLD.stage THEN
    INSERT INTO public.inquiry_events (business_id, inquiry_id, actor_id, kind, data)
      VALUES (NEW.business_id, NEW.id, v_actor, 'stage', jsonb_strip_nulls(jsonb_build_object(
        'from', OLD.stage, 'to', NEW.stage, 'reason', CASE WHEN NEW.stage = 'lost' THEN NEW.lost_reason END)));
  END IF;
  IF NEW.owner_membership_id IS DISTINCT FROM OLD.owner_membership_id OR NEW.coach_membership_id IS DISTINCT FROM OLD.coach_membership_id THEN
    INSERT INTO public.inquiry_events (business_id, inquiry_id, actor_id, kind, data)
      VALUES (NEW.business_id, NEW.id, v_actor, 'assigned', jsonb_build_object(
        'ownerFrom', OLD.owner_membership_id, 'ownerTo', NEW.owner_membership_id,
        'coachFrom', OLD.coach_membership_id, 'coachTo', NEW.coach_membership_id));
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.log_inquiry_change() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
CREATE TRIGGER log_inquiry_change AFTER INSERT OR UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION private.log_inquiry_change();--> statement-breakpoint

-- Whether the signed-in person is the proposed coach on an inquiry. SECURITY DEFINER so the timeline's
-- policies can ask without going back through the inquiry policies.
CREATE FUNCTION private.is_inquiry_coach(p_inquiry_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inquiries i
    JOIN public.memberships m ON m.id = i.coach_membership_id AND m.business_id = i.business_id
    WHERE i.id = p_inquiry_id AND m.user_id = (SELECT auth.uid()) AND m.status = 'active'
  );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.is_inquiry_coach(uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.is_inquiry_coach(uuid) TO authenticated;--> statement-breakpoint

ALTER TABLE public.coach_pay_rates ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.intake_settings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.inquiry_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

REVOKE ALL ON public.coach_pay_rates, public.intake_settings, public.inquiries, public.inquiry_events
  FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_pay_rates TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.intake_settings TO authenticated;--> statement-breakpoint
-- Enrolling (client_id) and the first call link are set only by the server, which creates the client
-- and the booking in the same transaction.
GRANT SELECT, DELETE ON public.inquiries TO authenticated;--> statement-breakpoint
GRANT INSERT (business_id, contact_name, contact_email, contact_phone, relationship, student_name, student_grade,
    subjects, goals, availability_notes, timezone, source, owner_membership_id, coach_membership_id, next_action, next_action_due),
  UPDATE (stage, contact_name, contact_email, contact_phone, relationship, student_name, student_grade,
    subjects, goals, availability_notes, timezone, owner_membership_id, coach_membership_id, lost_reason, next_action, next_action_due)
  ON public.inquiries TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT ON public.inquiry_events TO authenticated;--> statement-breakpoint

CREATE POLICY "owners read coach pay" ON public.coach_pay_rates
  FOR SELECT TO authenticated USING ((SELECT private.has_role(business_id, ARRAY['owner']::public.member_role[])));--> statement-breakpoint
CREATE POLICY "owners add coach pay" ON public.coach_pay_rates
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT private.has_role(business_id, ARRAY['owner']::public.member_role[])) AND created_by = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY "owners change coach pay" ON public.coach_pay_rates
  FOR UPDATE TO authenticated
  USING ((SELECT private.has_role(business_id, ARRAY['owner']::public.member_role[])))
  WITH CHECK ((SELECT private.has_role(business_id, ARRAY['owner']::public.member_role[])));--> statement-breakpoint
CREATE POLICY "owners remove coach pay" ON public.coach_pay_rates
  FOR DELETE TO authenticated USING ((SELECT private.has_role(business_id, ARRAY['owner']::public.member_role[])));--> statement-breakpoint

CREATE POLICY "managers read intake settings" ON public.intake_settings
  FOR SELECT TO authenticated USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint
CREATE POLICY "managers add intake settings" ON public.intake_settings
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint
CREATE POLICY "managers change intake settings" ON public.intake_settings
  FOR UPDATE TO authenticated
  USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])))
  WITH CHECK ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint

CREATE POLICY "managers read inquiries" ON public.inquiries
  FOR SELECT TO authenticated USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint
CREATE POLICY "proposed coaches read their inquiries" ON public.inquiries
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.id = inquiries.coach_membership_id AND m.business_id = inquiries.business_id
      AND m.user_id = (SELECT auth.uid()) AND m.status = 'active'
  ));--> statement-breakpoint
CREATE POLICY "managers add inquiries" ON public.inquiries
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])) AND source = 'staff');--> statement-breakpoint
CREATE POLICY "managers change inquiries" ON public.inquiries
  FOR UPDATE TO authenticated
  USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])))
  WITH CHECK ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint
CREATE POLICY "managers remove inquiries" ON public.inquiries
  FOR DELETE TO authenticated USING (
    (SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])) AND client_id IS NULL);--> statement-breakpoint

CREATE POLICY "managers read inquiry timelines" ON public.inquiry_events
  FOR SELECT TO authenticated USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint
CREATE POLICY "proposed coaches read their inquiry timelines" ON public.inquiry_events
  FOR SELECT TO authenticated USING ((SELECT private.is_member(business_id)) AND (SELECT private.is_inquiry_coach(inquiry_id)));--> statement-breakpoint
-- Through the API people can add only notes and first-call outcomes, as themselves. Everything else on
-- the timeline comes from the trigger above or the server.
CREATE POLICY "managers add notes to inquiries" ON public.inquiry_events
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[]))
    AND actor_id = (SELECT auth.uid()) AND kind IN ('note', 'first_call_outcome'));--> statement-breakpoint
CREATE POLICY "proposed coaches add notes to their inquiries" ON public.inquiry_events
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT private.is_member(business_id)) AND (SELECT private.is_inquiry_coach(inquiry_id))
    AND actor_id = (SELECT auth.uid()) AND kind IN ('note', 'first_call_outcome'));
--> statement-breakpoint

-- A salary is paid by the month whether or not there are sessions, so it has to stop when someone
-- leaves the team. Their history stays; a zero salary starts on the day they became inactive.
CREATE FUNCTION private.end_salary_on_leaving() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_today date;
  v_method text;
BEGIN
  SELECT (now() AT TIME ZONE b.timezone)::date INTO v_today FROM public.businesses b WHERE b.id = NEW.business_id;
  SELECT r.method INTO v_method FROM public.coach_pay_rates r
    WHERE r.business_id = NEW.business_id AND r.membership_id = NEW.id AND r.effective_from <= v_today
    ORDER BY r.effective_from DESC LIMIT 1;
  IF v_method = 'salary' THEN
    INSERT INTO public.coach_pay_rates (business_id, membership_id, effective_from, method, amount_cents)
      VALUES (NEW.business_id, NEW.id, v_today, 'salary', 0)
      ON CONFLICT (business_id, membership_id, effective_from) DO UPDATE SET method = 'salary', amount_cents = 0, percent_bps = NULL, format_overrides = '[]'::jsonb;
    -- Rates set to start later no longer apply either.
    DELETE FROM public.coach_pay_rates r WHERE r.business_id = NEW.business_id AND r.membership_id = NEW.id AND r.effective_from > v_today;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.end_salary_on_leaving() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
CREATE TRIGGER end_salary_on_leaving AFTER UPDATE OF status ON public.memberships
  FOR EACH ROW WHEN (OLD.status = 'active' AND NEW.status <> 'active') EXECUTE FUNCTION private.end_salary_on_leaving();
