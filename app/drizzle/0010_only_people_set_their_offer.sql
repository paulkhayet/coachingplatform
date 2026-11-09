-- D-058: only the person decides what part of their time a business is offered. Owners and
-- administrators can still see it (the read policy is unchanged), but can no longer change it.

CREATE OR REPLACE FUNCTION private.owns_membership(p_membership_id uuid, p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.id = p_membership_id
      AND m.business_id = p_business_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
  );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.owns_membership(uuid, uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.owns_membership(uuid, uuid) TO authenticated;--> statement-breakpoint

DROP POLICY "people and managers add offered hours" ON "public"."membership_availability";--> statement-breakpoint
DROP POLICY "people and managers change offered hours" ON "public"."membership_availability";--> statement-breakpoint
DROP POLICY "people and managers remove offered hours" ON "public"."membership_availability";--> statement-breakpoint

CREATE POLICY "people set what they offer" ON "public"."membership_availability"
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.owns_membership(membership_id, business_id)));--> statement-breakpoint
CREATE POLICY "people change what they offer" ON "public"."membership_availability"
  FOR UPDATE TO authenticated
  USING ((SELECT private.owns_membership(membership_id, business_id)))
  WITH CHECK ((SELECT private.owns_membership(membership_id, business_id)));--> statement-breakpoint
CREATE POLICY "people remove what they offer" ON "public"."membership_availability"
  FOR DELETE TO authenticated USING ((SELECT private.owns_membership(membership_id, business_id)));--> statement-breakpoint

-- No policy uses this any more (availability became personal in 0009, and offers personal here).
DROP FUNCTION IF EXISTS private.can_edit_availability(uuid, uuid);
