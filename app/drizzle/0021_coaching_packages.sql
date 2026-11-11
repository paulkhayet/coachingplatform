CREATE TABLE "coaching_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" text NOT NULL,
	"term_weeks" integer,
	"credit_units" integer NOT NULL,
	"session_formats" jsonb NOT NULL,
	"price_cents" integer NOT NULL,
	"installment_count" integer,
	"installment_cadence" text,
	"eligible_coach_ids" uuid[],
	"cancellation_notice_hours" integer,
	"late_cancellation" text DEFAULT 'inherit' NOT NULL,
	"expiration" text DEFAULT 'inherit' NOT NULL,
	"makeup_extension_days" integer,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coaching_packages_name_length" CHECK (char_length(btrim("coaching_packages"."name")) between 2 and 100),
	CONSTRAINT "coaching_packages_description_length" CHECK (char_length("coaching_packages"."description") <= 1000),
	CONSTRAINT "coaching_packages_term" CHECK (("coaching_packages"."kind" = 'fixed' and "coaching_packages"."term_weeks" is not null and "coaching_packages"."term_weeks" between 1 and 260) or ("coaching_packages"."kind" = 'monthly' and "coaching_packages"."term_weeks" is null)),
	CONSTRAINT "coaching_packages_credit_units" CHECK ("coaching_packages"."credit_units" between 1 and 100000),
	CONSTRAINT "coaching_packages_price" CHECK ("coaching_packages"."price_cents" between 1 and 100000000),
	CONSTRAINT "coaching_packages_installments" CHECK (
    ("coaching_packages"."installment_count" is null and "coaching_packages"."installment_cadence" is null) or
    ("coaching_packages"."kind" = 'fixed' and "coaching_packages"."installment_count" is not null and "coaching_packages"."installment_count" between 2 and 24
     and "coaching_packages"."installment_cadence" is not null and "coaching_packages"."installment_cadence" in ('weekly', 'monthly')
     and "coaching_packages"."price_cents" >= "coaching_packages"."installment_count")),
	CONSTRAINT "coaching_packages_formats" CHECK (
    case when jsonb_typeof("coaching_packages"."session_formats") = 'array' then
      jsonb_array_length("coaching_packages"."session_formats") between 1 and 10 and not jsonb_path_exists(
        "coaching_packages"."session_formats",
        '$[*] ? (@.type() != "object" || !exists(@.name) || @.name.type() != "string" || @.name == "" || !exists(@.durationMinutes) || @.durationMinutes.type() != "number" || @.durationMinutes < 1 || @.durationMinutes > 480 || @.durationMinutes != @.durationMinutes.floor() || !exists(@.creditUnits) || @.creditUnits.type() != "number" || @.creditUnits < 1 || @.creditUnits > $allowance || @.creditUnits != @.creditUnits.floor())',
        jsonb_build_object('allowance', "coaching_packages"."credit_units")
      ) else false end),
	CONSTRAINT "coaching_packages_coach_ids" CHECK ("coaching_packages"."eligible_coach_ids" is null or (cardinality("coaching_packages"."eligible_coach_ids") between 1 and 200 and array_position("coaching_packages"."eligible_coach_ids", null) is null)),
	CONSTRAINT "coaching_packages_cancellation" CHECK ("coaching_packages"."cancellation_notice_hours" between 0 and 720),
	CONSTRAINT "coaching_packages_late_cancellation" CHECK ("coaching_packages"."late_cancellation" in ('inherit', 'preserve', 'forfeit')),
	CONSTRAINT "coaching_packages_expiration" CHECK ("coaching_packages"."expiration" in ('inherit', 'end_of_term')),
	CONSTRAINT "coaching_packages_makeups" CHECK ("coaching_packages"."makeup_extension_days" between 0 and 365)
);
--> statement-breakpoint
ALTER TABLE "coaching_packages" ADD CONSTRAINT "coaching_packages_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coaching_packages_business_archive_idx" ON "coaching_packages" USING btree ("business_id","archived_at");--> statement-breakpoint

ALTER TABLE public.coaching_packages ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON public.coaching_packages FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT, INSERT ON public.coaching_packages TO authenticated;--> statement-breakpoint
GRANT UPDATE (name, description, kind, term_weeks, credit_units, session_formats, price_cents,
  installment_count, installment_cadence, eligible_coach_ids, cancellation_notice_hours,
  late_cancellation, expiration, makeup_extension_days, archived_at, updated_at)
  ON public.coaching_packages TO authenticated;--> statement-breakpoint

CREATE POLICY "owners and administrators read packages" ON public.coaching_packages
  FOR SELECT TO authenticated
  USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint

CREATE POLICY "financial staff add packages" ON public.coaching_packages
  FOR INSERT TO authenticated WITH CHECK (business_id IN (
    SELECT m.business_id FROM public.memberships m
    WHERE m.user_id = (SELECT auth.uid()) AND m.status = 'active'
      AND (m.role = 'owner' OR (m.role = 'admin' AND m.financial))
  ));--> statement-breakpoint

CREATE POLICY "financial staff change packages" ON public.coaching_packages
  FOR UPDATE TO authenticated USING (business_id IN (
    SELECT m.business_id FROM public.memberships m
    WHERE m.user_id = (SELECT auth.uid()) AND m.status = 'active'
      AND (m.role = 'owner' OR (m.role = 'admin' AND m.financial))
  )) WITH CHECK (business_id IN (
    SELECT m.business_id FROM public.memberships m
    WHERE m.user_id = (SELECT auth.uid()) AND m.status = 'active'
      AND (m.role = 'owner' OR (m.role = 'admin' AND m.financial))
  ));--> statement-breakpoint

-- The package and its selected coaches are saved together. An archived package can retain a former
-- coach in its history, but restoring it requires that the selection is still available.
CREATE FUNCTION private.validate_package_coaches() RETURNS trigger
  LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.archived_at IS NOT NULL
    AND NEW.business_id = OLD.business_id
    AND NEW.eligible_coach_ids IS NOT DISTINCT FROM OLD.eligible_coach_ids THEN
    RETURN NEW;
  END IF;

  IF NEW.eligible_coach_ids IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(NEW.eligible_coach_ids) AS selected(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.memberships m WHERE m.id = selected.id
        AND m.business_id = NEW.business_id AND m.status = 'active' AND m.coaches
    )
  ) THEN
    RAISE EXCEPTION 'Choose active coaches from this business.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.validate_package_coaches() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
CREATE TRIGGER validate_package_coaches
  BEFORE INSERT OR UPDATE OF business_id, eligible_coach_ids, archived_at ON public.coaching_packages
  FOR EACH ROW EXECUTE FUNCTION private.validate_package_coaches();
