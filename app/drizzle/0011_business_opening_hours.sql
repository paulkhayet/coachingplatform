ALTER TABLE "businesses" ADD COLUMN "opening_hours" jsonb;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_opening_hours_array" CHECK ("businesses"."opening_hours" is null or jsonb_typeof("businesses"."opening_hours") = 'array');--> statement-breakpoint

-- D-059: owners change opening hours through the existing "owners update their business" policy;
-- everyone in the business can read them through "members read their business". Nothing else needed.
COMMENT ON COLUMN "public"."businesses"."opening_hours" IS 'Weekly windows (business time zone) when the business takes bookings, for everyone. Null = no limit. D-059.';
