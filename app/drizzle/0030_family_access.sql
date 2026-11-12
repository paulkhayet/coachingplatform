CREATE TABLE "family_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"token_hash" text,
	"expires_at" timestamp with time zone,
	"invited_by" uuid,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"can_view_sessions" boolean DEFAULT true NOT NULL,
	"can_view_credits" boolean DEFAULT true NOT NULL,
	"can_reschedule" boolean DEFAULT true NOT NULL,
	"can_book" boolean DEFAULT true NOT NULL,
	CONSTRAINT "family_access_email" CHECK ("family_access"."email" = lower("family_access"."email") and char_length("family_access"."email") between 3 and 254),
	CONSTRAINT "family_access_accepted_user" CHECK (("family_access"."accepted_at" is null) = ("family_access"."user_id" is null))
);
--> statement-breakpoint
ALTER TABLE "client_files" ADD COLUMN "shared_with_family" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "family_access" ADD CONSTRAINT "family_access_guardian_id_client_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."client_guardians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_access" ADD CONSTRAINT "family_access_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_access" ADD CONSTRAINT "family_access_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_access" ADD CONSTRAINT "family_access_client_fk" FOREIGN KEY ("business_id","client_id") REFERENCES "public"."coaching_clients"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "family_access_guardian_key" ON "family_access" USING btree ("guardian_id");--> statement-breakpoint
CREATE UNIQUE INDEX "family_access_token_key" ON "family_access" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "family_access_user_idx" ON "family_access" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "family_access_client_idx" ON "family_access" USING btree ("business_id","client_id");--> statement-breakpoint
CREATE INDEX "family_access_invited_by_idx" ON "family_access" USING btree ("invited_by");--> statement-breakpoint

-- D-073: the family portal. A guardian with accepted, active access to a client can read that client's
-- record and business, and (per switch) its sessions, credits and the files shared with the family.
-- Everything is read-only through the API; the server makes every change after its own checks.

-- The guardian contact must belong to the same client.
CREATE FUNCTION private.validate_family_access() RETURNS trigger
  LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.client_guardians g
    WHERE g.id = NEW.guardian_id AND g.business_id = NEW.business_id AND g.client_id = NEW.client_id
  ) THEN
    RAISE EXCEPTION 'The guardian contact must belong to this client.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.validate_family_access() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
CREATE TRIGGER validate_family_access BEFORE INSERT OR UPDATE OF business_id, client_id, guardian_id
  ON public.family_access FOR EACH ROW EXECUTE FUNCTION private.validate_family_access();--> statement-breakpoint

-- Whether the signed-in person has active portal access to a client, and the named permission.
-- SECURITY DEFINER so policies on the client tables can use it without recursing through RLS.
CREATE FUNCTION private.family_can(p_client_id uuid, p_permission text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_access fa
    WHERE fa.client_id = p_client_id AND fa.user_id = (SELECT auth.uid())
      AND fa.accepted_at IS NOT NULL AND fa.revoked_at IS NULL
      AND CASE p_permission
        WHEN 'view' THEN true
        WHEN 'sessions' THEN fa.can_view_sessions
        WHEN 'credits' THEN fa.can_view_credits
        ELSE false
      END
  );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.family_can(uuid, text) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.family_can(uuid, text) TO authenticated;--> statement-breakpoint

CREATE FUNCTION private.family_in_business(p_business_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_access fa
    WHERE fa.business_id = p_business_id AND fa.user_id = (SELECT auth.uid())
      AND fa.accepted_at IS NOT NULL AND fa.revoked_at IS NULL
  );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.family_in_business(uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.family_in_business(uuid) TO authenticated;--> statement-breakpoint

ALTER TABLE public.family_access ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON public.family_access FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT SELECT (id, business_id, client_id, guardian_id, email, user_id, invited_at, accepted_at, revoked_at, expires_at,
  can_view_sessions, can_view_credits, can_reschedule, can_book) ON public.family_access TO authenticated;--> statement-breakpoint
CREATE POLICY "managers read portal access" ON public.family_access
  FOR SELECT TO authenticated USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint
CREATE POLICY "guardians read their own portal access" ON public.family_access
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) AND revoked_at IS NULL);--> statement-breakpoint

CREATE POLICY "guardians read their linked clients" ON public.coaching_clients
  FOR SELECT TO authenticated USING (private.family_can(id, 'view'));--> statement-breakpoint
CREATE POLICY "guardians read businesses they are linked to" ON public.businesses
  FOR SELECT TO authenticated USING (private.family_in_business(id));--> statement-breakpoint
CREATE POLICY "guardians read their client's sessions" ON public.bookings
  FOR SELECT TO authenticated USING (coaching_client_id IS NOT NULL AND private.family_can(coaching_client_id, 'sessions'));--> statement-breakpoint
CREATE POLICY "guardians read their client's credit periods" ON public.client_credit_periods
  FOR SELECT TO authenticated USING (private.family_can(client_id, 'credits'));--> statement-breakpoint
CREATE POLICY "guardians read their client's credit events" ON public.client_credit_events
  FOR SELECT TO authenticated USING (private.family_can(client_id, 'credits'));--> statement-breakpoint
CREATE POLICY "guardians read their client's payments" ON public.client_credit_payments
  FOR SELECT TO authenticated USING (private.family_can(client_id, 'credits'));--> statement-breakpoint
CREATE POLICY "guardians read files shared with the family" ON public.client_files
  FOR SELECT TO authenticated USING (shared_with_family AND status = 'ready' AND private.family_can(client_id, 'view'));
--> statement-breakpoint
CREATE POLICY "guardians read their client's package terms" ON public.client_packages
  FOR SELECT TO authenticated USING (private.family_can(client_id, 'credits'));
--> statement-breakpoint

-- Staff rules that said "you can read this if you can see its client" would now also let guardians in
-- (policies are OR-ed), skipping the family switches and file sharing. Limit them to members of the
-- business; guardians get in only through the family policies above.
DROP POLICY "staff read authorized credit periods" ON public.client_credit_periods;--> statement-breakpoint
CREATE POLICY "staff read authorized credit periods" ON public.client_credit_periods
  FOR SELECT TO authenticated USING ((SELECT private.is_member(business_id)) AND EXISTS (
    SELECT 1 FROM public.coaching_clients c
    WHERE c.business_id = client_credit_periods.business_id AND c.id = client_credit_periods.client_id
  ));--> statement-breakpoint
DROP POLICY "staff read authorized credit events" ON public.client_credit_events;--> statement-breakpoint
CREATE POLICY "staff read authorized credit events" ON public.client_credit_events
  FOR SELECT TO authenticated USING ((SELECT private.is_member(business_id)) AND EXISTS (
    SELECT 1 FROM public.coaching_clients c
    WHERE c.business_id = client_credit_events.business_id AND c.id = client_credit_events.client_id
  ));--> statement-breakpoint
DROP POLICY "staff read files of authorized clients" ON public.client_files;--> statement-breakpoint
CREATE POLICY "staff read files of authorized clients" ON public.client_files
  FOR SELECT TO authenticated USING ((SELECT private.is_member(business_id)) AND EXISTS (
    SELECT 1 FROM public.coaching_clients c
    WHERE c.business_id = client_files.business_id AND c.id = client_files.client_id
  ));--> statement-breakpoint
DROP POLICY "staff read bookings within their scope" ON public.bookings;--> statement-breakpoint
CREATE POLICY "staff read bookings within their scope" ON public.bookings
  FOR SELECT TO authenticated USING (
    (SELECT private.is_member(business_id)) AND (
      coaching_client_id IS NULL
      OR (SELECT auth.uid()) = host_user_id
      OR EXISTS (
        SELECT 1 FROM public.coaching_clients c
        WHERE c.id = bookings.coaching_client_id AND c.business_id = bookings.business_id
      )
    )
  );
