CREATE INDEX "businesses_created_by_idx" ON "businesses" USING btree ("created_by");--> statement-breakpoint

-- Supabase advisor fixes (security lint 0029, performance lint 0001).
--
-- is_member() and has_role() are SECURITY DEFINER helpers for row-level security policies. In the
-- public schema they were also callable as /rest/v1/rpc/is_member and /rest/v1/rpc/has_role.
-- Move them to a schema the Data API doesn't expose. Policies reference functions by OID, so the
-- existing policies keep working without being recreated. Signed-in users still need USAGE on the
-- schema and EXECUTE on the functions, because policies run as the querying role.
CREATE SCHEMA IF NOT EXISTS private;--> statement-breakpoint
REVOKE ALL ON SCHEMA private FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA private TO authenticated;--> statement-breakpoint
ALTER FUNCTION public.is_member(uuid) SET SCHEMA private;--> statement-breakpoint
ALTER FUNCTION public.has_role(uuid, public.member_role[]) SET SCHEMA private;--> statement-breakpoint

-- create_business() stays in public on purpose: onboarding calls it as an RPC. It checks auth.uid()
-- itself and is the only way to create a business and its owner membership.
COMMENT ON FUNCTION public.create_business(text, text, text) IS
  'Public RPC used by onboarding. SECURITY DEFINER by design: creates a business and the caller''s owner membership atomically. Requires a signed-in user.';
