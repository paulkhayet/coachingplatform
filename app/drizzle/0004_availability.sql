CREATE TABLE "availability_schedules" (
	"membership_id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"timezone" text NOT NULL,
	"weekly_hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_schedules_weekly_hours_array" CHECK (jsonb_typeof("availability_schedules"."weekly_hours") = 'array')
);
--> statement-breakpoint
CREATE TABLE "availability_time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_time_off_order" CHECK ("availability_time_off"."ends_at" > "availability_time_off"."starts_at"),
	CONSTRAINT "availability_time_off_note_length" CHECK (char_length("availability_time_off"."note") <= 200)
);
--> statement-breakpoint
ALTER TABLE "availability_schedules" ADD CONSTRAINT "availability_schedules_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_schedules" ADD CONSTRAINT "availability_schedules_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_time_off" ADD CONSTRAINT "availability_time_off_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_time_off" ADD CONSTRAINT "availability_time_off_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_schedules_business_idx" ON "availability_schedules" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "availability_time_off_membership_idx" ON "availability_time_off" USING btree ("membership_id","starts_at");--> statement-breakpoint
CREATE INDEX "availability_time_off_business_idx" ON "availability_time_off" USING btree ("business_id");--> statement-breakpoint

-- Row-level security for availability.
-- Everyone in the business can read schedules and time off (booking needs them). A coach edits their
-- own; owners and administrators can edit anyone's in their business. The membership must belong to
-- the same business as the row, so nobody can attach availability to another business's coach.
CREATE OR REPLACE FUNCTION private.can_edit_availability(p_membership_id uuid, p_business_id uuid)
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
      AND (
        (m.user_id = (SELECT auth.uid()) AND m.status = 'active')
        OR private.has_role(p_business_id, ARRAY['owner', 'admin']::public.member_role[])
      )
  );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.can_edit_availability(uuid, uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.can_edit_availability(uuid, uuid) TO authenticated;--> statement-breakpoint

ALTER TABLE "public"."availability_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."availability_time_off" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "members read schedules" ON "public"."availability_schedules"
  FOR SELECT TO authenticated USING ((SELECT private.is_member(business_id)));--> statement-breakpoint
CREATE POLICY "coaches and managers add schedules" ON "public"."availability_schedules"
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.can_edit_availability(membership_id, business_id)));--> statement-breakpoint
CREATE POLICY "coaches and managers change schedules" ON "public"."availability_schedules"
  FOR UPDATE TO authenticated
  USING ((SELECT private.can_edit_availability(membership_id, business_id)))
  WITH CHECK ((SELECT private.can_edit_availability(membership_id, business_id)));--> statement-breakpoint
CREATE POLICY "coaches and managers remove schedules" ON "public"."availability_schedules"
  FOR DELETE TO authenticated USING ((SELECT private.can_edit_availability(membership_id, business_id)));--> statement-breakpoint

CREATE POLICY "members read time off" ON "public"."availability_time_off"
  FOR SELECT TO authenticated USING ((SELECT private.is_member(business_id)));--> statement-breakpoint
CREATE POLICY "coaches and managers add time off" ON "public"."availability_time_off"
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.can_edit_availability(membership_id, business_id)));--> statement-breakpoint
CREATE POLICY "coaches and managers change time off" ON "public"."availability_time_off"
  FOR UPDATE TO authenticated
  USING ((SELECT private.can_edit_availability(membership_id, business_id)))
  WITH CHECK ((SELECT private.can_edit_availability(membership_id, business_id)));--> statement-breakpoint
CREATE POLICY "coaches and managers remove time off" ON "public"."availability_time_off"
  FOR DELETE TO authenticated USING ((SELECT private.can_edit_availability(membership_id, business_id)));
