-- Row-level security for the foundation tables.
-- Rule: a signed-in person can only see or change data for businesses they are an active member of.
-- Helper functions are SECURITY DEFINER with an empty search_path so policies can check memberships
-- without recursing into the memberships policies themselves.

ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_member(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.business_id = p_business_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
  );
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.has_role(p_business_id uuid, p_roles public.member_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.business_id = p_business_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role = ANY (p_roles)
  );
$$;--> statement-breakpoint

-- Businesses: members can read; only owners can edit. Creation goes through create_business().
CREATE POLICY "members read their business" ON "public"."businesses"
  FOR SELECT TO authenticated
  USING ((SELECT public.is_member(id)));--> statement-breakpoint

CREATE POLICY "owners update their business" ON "public"."businesses"
  FOR UPDATE TO authenticated
  USING ((SELECT public.has_role(id, ARRAY['owner']::public.member_role[])))
  WITH CHECK ((SELECT public.has_role(id, ARRAY['owner']::public.member_role[])));--> statement-breakpoint

-- Memberships: members see their colleagues; owners manage the team.
CREATE POLICY "members read memberships" ON "public"."memberships"
  FOR SELECT TO authenticated
  USING ((SELECT public.is_member(business_id)) OR user_id = (SELECT auth.uid()));--> statement-breakpoint

CREATE POLICY "owners add memberships" ON "public"."memberships"
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role(business_id, ARRAY['owner']::public.member_role[])) AND role <> 'owner');--> statement-breakpoint

CREATE POLICY "owners update memberships" ON "public"."memberships"
  FOR UPDATE TO authenticated
  USING ((SELECT public.has_role(business_id, ARRAY['owner']::public.member_role[])) AND user_id <> (SELECT auth.uid()))
  WITH CHECK ((SELECT public.has_role(business_id, ARRAY['owner']::public.member_role[])) AND role <> 'owner');--> statement-breakpoint

CREATE POLICY "owners remove memberships" ON "public"."memberships"
  FOR DELETE TO authenticated
  USING ((SELECT public.has_role(business_id, ARRAY['owner']::public.member_role[])) AND user_id <> (SELECT auth.uid()));--> statement-breakpoint

-- Profiles: you can read your own and those of people you work with; you can edit only your own.
CREATE POLICY "read own and colleague profiles" ON "public"."profiles"
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = profiles.id AND (SELECT public.is_member(m.business_id))
    )
  );--> statement-breakpoint

CREATE POLICY "update own profile" ON "public"."profiles"
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));--> statement-breakpoint

-- Create a business and its owner membership in one transaction.
CREATE OR REPLACE FUNCTION public.create_business(p_name text, p_slug text, p_timezone text DEFAULT 'America/New_York')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You need to be signed in to create a business' USING ERRCODE = '42501';
  END IF;
  IF p_timezone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_timezone) THEN
    RAISE EXCEPTION 'Unknown time zone' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.businesses (name, slug, timezone, created_by)
  VALUES (btrim(p_name), lower(btrim(p_slug)), p_timezone, v_user)
  RETURNING id INTO v_id;
  INSERT INTO public.memberships (business_id, user_id, role, status, coaches, financial, title)
  VALUES (v_id, v_user, 'owner', 'active', true, true, 'Owner');
  RETURN v_id;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.create_business(text, text, text) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.create_business(text, text, text) TO authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.is_member(uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.has_role(uuid, public.member_role[]) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.member_role[]) TO authenticated;--> statement-breakpoint

-- Keep a profile row for every signed-up person.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;--> statement-breakpoint

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
