CREATE TABLE "stripe_accounts" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"stripe_account_id" text NOT NULL,
	"livemode" boolean NOT NULL,
	"details_submitted" boolean DEFAULT false NOT NULL,
	"charges_enabled" boolean DEFAULT false NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"disabled_reason" text,
	"requirements_due" integer DEFAULT 0 NOT NULL,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"account" text,
	"livemode" boolean NOT NULL,
	"stripe_created_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stripe_accounts" ADD CONSTRAINT "stripe_accounts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_accounts_stripe_account_id_key" ON "stripe_accounts" USING btree ("stripe_account_id");--> statement-breakpoint

-- Row-level security for Stripe Connect (D-055).
-- Only the server writes these tables: Connect onboarding creates the account row, and verified Stripe
-- webhooks keep it in sync. Signed-in users never insert or update them, so a member can't point their
-- business at a Stripe account it doesn't own.
ALTER TABLE "public"."stripe_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."stripe_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "owners and admins read the stripe account" ON "public"."stripe_accounts"
  FOR SELECT TO authenticated
  USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "public"."stripe_accounts" FROM anon, authenticated;--> statement-breakpoint

-- The event log is internal bookkeeping: no API access at all.
REVOKE ALL ON "public"."stripe_events" FROM anon, authenticated;
