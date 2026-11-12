CREATE TABLE "workspace_subscriptions" (
	"business_id" uuid NOT NULL,
	"livemode" boolean NOT NULL,
	"source" text DEFAULT 'stripe' NOT NULL,
	"plan" text NOT NULL,
	"billing_interval" text,
	"status" text NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"stripe_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_subscriptions_business_id_livemode_pk" PRIMARY KEY("business_id","livemode"),
	CONSTRAINT "workspace_subscriptions_source" CHECK ("workspace_subscriptions"."source" in ('stripe', 'complimentary')),
	CONSTRAINT "workspace_subscriptions_plan" CHECK ("workspace_subscriptions"."plan" in ('solo', 'team')),
	CONSTRAINT "workspace_subscriptions_interval" CHECK ("workspace_subscriptions"."billing_interval" is null or "workspace_subscriptions"."billing_interval" in ('year', 'month')),
	CONSTRAINT "workspace_subscriptions_seats" CHECK ("workspace_subscriptions"."seats" between 1 and 1000),
	CONSTRAINT "workspace_subscriptions_stripe_id" CHECK (("workspace_subscriptions"."source" = 'stripe') = ("workspace_subscriptions"."stripe_subscription_id" is not null) and ("workspace_subscriptions"."stripe_subscription_id" is null or "workspace_subscriptions"."stripe_subscription_id" ~ '^sub_[A-Za-z0-9]+$'))
);
--> statement-breakpoint
ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_subscriptions_stripe_key" ON "workspace_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint

-- D-072: members can see their workspace's plan (to show limits); only the server writes it.
ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON public.workspace_subscriptions FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.workspace_subscriptions TO authenticated;--> statement-breakpoint
CREATE POLICY "members read their workspace plan" ON public.workspace_subscriptions
  FOR SELECT TO authenticated USING ((SELECT private.is_member(business_id)));
