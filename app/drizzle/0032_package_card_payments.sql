CREATE TABLE "client_payment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"sent_to" text,
	"invite_guardian_id" uuid,
	"invited_at" timestamp with time zone,
	"allow_instalments" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"stripe_account_id" text,
	"stripe_subscription_id" text,
	"plan_instalments" integer,
	"plan_cadence" text,
	"plan_status" text,
	CONSTRAINT "client_payment_requests_sent_to" CHECK ("client_payment_requests"."sent_to" is null or ("client_payment_requests"."sent_to" = lower("client_payment_requests"."sent_to") and char_length("client_payment_requests"."sent_to") between 3 and 254)),
	CONSTRAINT "client_payment_requests_plan" CHECK (
    ("client_payment_requests"."stripe_subscription_id" is null and "client_payment_requests"."plan_instalments" is null and "client_payment_requests"."plan_cadence" is null and "client_payment_requests"."plan_status" is null)
    or ("client_payment_requests"."stripe_subscription_id" is not null and "client_payment_requests"."stripe_account_id" is not null and "client_payment_requests"."plan_instalments" between 2 and 24
      and "client_payment_requests"."plan_cadence" in ('weekly', 'monthly') and "client_payment_requests"."plan_status" in ('active', 'past_due', 'canceled', 'completed')))
);
--> statement-breakpoint
ALTER TABLE "client_credit_payments" DROP CONSTRAINT "client_credit_payments_method";--> statement-breakpoint
ALTER TABLE "client_credit_payments" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "client_credit_payments" ADD COLUMN "stripe_payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "client_credit_payments" ADD COLUMN "stripe_invoice_id" text;--> statement-breakpoint
ALTER TABLE "client_credit_payments" ADD COLUMN "stripe_fee_cents" integer;--> statement-breakpoint
ALTER TABLE "client_credit_payments" ADD COLUMN "refunded_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "client_credit_payments" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "client_payment_requests" ADD CONSTRAINT "client_payment_requests_invite_guardian_id_client_guardians_id_fk" FOREIGN KEY ("invite_guardian_id") REFERENCES "public"."client_guardians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment_requests" ADD CONSTRAINT "client_payment_requests_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment_requests" ADD CONSTRAINT "client_payment_requests_period_fk" FOREIGN KEY ("business_id","client_id","period_id") REFERENCES "public"."client_credit_periods"("business_id","client_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_payment_requests_token_key" ON "client_payment_requests" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "client_payment_requests_subscription_key" ON "client_payment_requests" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "client_payment_requests_period_idx" ON "client_payment_requests" USING btree ("business_id","client_id","period_id");--> statement-breakpoint
CREATE INDEX "client_payment_requests_guardian_idx" ON "client_payment_requests" USING btree ("invite_guardian_id");--> statement-breakpoint
CREATE INDEX "client_payment_requests_created_by_idx" ON "client_payment_requests" USING btree ("created_by");--> statement-breakpoint
ALTER TABLE "client_credit_payments" ADD CONSTRAINT "client_credit_payments_request_id_client_payment_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."client_payment_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_credit_payments_payment_intent_key" ON "client_credit_payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_credit_payments_invoice_key" ON "client_credit_payments" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX "client_credit_payments_request_idx" ON "client_credit_payments" USING btree ("request_id");--> statement-breakpoint
ALTER TABLE "client_credit_payments" ADD CONSTRAINT "client_credit_payments_card" CHECK (("client_credit_payments"."method" = 'card') = ("client_credit_payments"."stripe_payment_intent_id" is not null or "client_credit_payments"."stripe_invoice_id" is not null));--> statement-breakpoint
ALTER TABLE "client_credit_payments" ADD CONSTRAINT "client_credit_payments_fee" CHECK ("client_credit_payments"."stripe_fee_cents" is null or "client_credit_payments"."stripe_fee_cents" >= 0);--> statement-breakpoint
ALTER TABLE "client_credit_payments" ADD CONSTRAINT "client_credit_payments_refunded" CHECK ("client_credit_payments"."refunded_cents" between 0 and "client_credit_payments"."amount_cents" and ("client_credit_payments"."refunded_cents" = 0) = ("client_credit_payments"."refunded_at" is null));--> statement-breakpoint
ALTER TABLE "client_credit_payments" ADD CONSTRAINT "client_credit_payments_method" CHECK ("client_credit_payments"."method" in ('cash', 'check', 'bank_transfer', 'other', 'card'));--> statement-breakpoint

-- D-076: families pay for packages by card. The server records every card payment from Stripe's
-- events; nobody writes these rows through the API. Owners and administrators can read payment links
-- (but never the token hash); families and coaches can't read them at all.
ALTER TABLE public.client_payment_requests ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON public.client_payment_requests FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT SELECT (id, business_id, client_id, period_id, sent_to, invite_guardian_id, invited_at, allow_instalments, created_by,
  created_at, cancelled_at, stripe_subscription_id, plan_instalments, plan_cadence, plan_status) ON public.client_payment_requests TO authenticated;--> statement-breakpoint
CREATE POLICY "managers read payment links" ON public.client_payment_requests
  FOR SELECT TO authenticated USING ((SELECT private.has_role(business_id, ARRAY['owner', 'admin']::public.member_role[])));--> statement-breakpoint

-- Stripe's fee is the business's own cost: families who can see their payments don't see it.
REVOKE SELECT ON public.client_credit_payments FROM authenticated;--> statement-breakpoint
GRANT SELECT (id, business_id, client_id, period_id, amount_cents, method, received_on, reference, recorded_by, recorded_at,
  request_id, stripe_payment_intent_id, stripe_invoice_id, refunded_cents, refunded_at) ON public.client_credit_payments TO authenticated;--> statement-breakpoint

-- A payment link belongs to one client's period, and any guardian it invites is that client's.
CREATE FUNCTION private.validate_payment_request() RETURNS trigger
  LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.invite_guardian_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.client_guardians g
    WHERE g.id = NEW.invite_guardian_id AND g.business_id = NEW.business_id AND g.client_id = NEW.client_id
  ) THEN
    RAISE EXCEPTION 'The guardian contact must belong to this client.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.validate_payment_request() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
CREATE TRIGGER validate_payment_request BEFORE INSERT OR UPDATE OF business_id, client_id, invite_guardian_id
  ON public.client_payment_requests FOR EACH ROW EXECUTE FUNCTION private.validate_payment_request();
