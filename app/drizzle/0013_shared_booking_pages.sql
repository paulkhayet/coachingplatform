CREATE TABLE "booking_page_hosts" (
	"booking_page_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_page_hosts_booking_page_id_membership_id_pk" PRIMARY KEY("booking_page_id","membership_id")
);
--> statement-breakpoint
ALTER TABLE "booking_pages" ALTER COLUMN "host_membership_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_page_hosts" ADD CONSTRAINT "booking_page_hosts_booking_page_id_booking_pages_id_fk" FOREIGN KEY ("booking_page_id") REFERENCES "public"."booking_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_page_hosts" ADD CONSTRAINT "booking_page_hosts_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_page_hosts" ADD CONSTRAINT "booking_page_hosts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_page_hosts_membership_idx" ON "booking_page_hosts" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "booking_page_hosts_business_idx" ON "booking_page_hosts" USING btree ("business_id");--> statement-breakpoint

-- D-061: a booking page with no single host is shared by the coaches listed in booking_page_hosts.
-- Each listed coach must belong to the page's business: composite keys make that impossible to break,
-- whoever writes the row.
ALTER TABLE "public"."booking_pages" ADD CONSTRAINT "booking_pages_id_business_key" UNIQUE ("id", "business_id");--> statement-breakpoint
ALTER TABLE "public"."memberships" ADD CONSTRAINT "memberships_id_business_key" UNIQUE ("id", "business_id");--> statement-breakpoint
ALTER TABLE "public"."booking_page_hosts" ADD CONSTRAINT "booking_page_hosts_page_business_fk" FOREIGN KEY ("booking_page_id", "business_id") REFERENCES "public"."booking_pages"("id", "business_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "public"."booking_page_hosts" ADD CONSTRAINT "booking_page_hosts_membership_business_fk" FOREIGN KEY ("membership_id", "business_id") REFERENCES "public"."memberships"("id", "business_id") ON DELETE CASCADE;--> statement-breakpoint

-- Shared pages (no single host) are run by owners and administrators; single-host pages as before.
CREATE OR REPLACE FUNCTION private.can_manage_booking_page(p_host_membership_id uuid, p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_host_membership_id IS NULL THEN private.has_role(p_business_id, ARRAY['owner', 'admin']::public.member_role[])
    ELSE EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.id = p_host_membership_id
        AND m.business_id = p_business_id
        AND (
          (m.user_id = (SELECT auth.uid()) AND m.status = 'active')
          OR private.has_role(p_business_id, ARRAY['owner', 'admin']::public.member_role[])
        )
    )
  END;
$$;--> statement-breakpoint

ALTER TABLE "public"."booking_page_hosts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "members read shared page hosts" ON "public"."booking_page_hosts"
  FOR SELECT TO authenticated USING ((SELECT private.is_member(business_id)));--> statement-breakpoint
CREATE POLICY "managers add shared page hosts" ON "public"."booking_page_hosts"
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint
CREATE POLICY "managers remove shared page hosts" ON "public"."booking_page_hosts"
  FOR DELETE TO authenticated USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint

REVOKE UPDATE, TRUNCATE ON "public"."booking_page_hosts" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON "public"."booking_page_hosts" FROM anon;
