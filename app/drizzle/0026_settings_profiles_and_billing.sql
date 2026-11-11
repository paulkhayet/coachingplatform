CREATE TABLE "workspace_billing_customers" (
	"business_id" uuid NOT NULL,
	"livemode" boolean NOT NULL,
	"stripe_customer_id" text NOT NULL,
	CONSTRAINT "workspace_billing_customers_business_id_livemode_pk" PRIMARY KEY("business_id","livemode"),
	CONSTRAINT "workspace_billing_customer_id_format" CHECK ("workspace_billing_customers"."stripe_customer_id" ~ '^cus_[A-Za-z0-9]+$')
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "avatar_path" text;--> statement-breakpoint
ALTER TABLE "workspace_billing_customers" ADD CONSTRAINT "workspace_billing_customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_billing_customer_key" ON "workspace_billing_customers" USING btree ("livemode","stripe_customer_id");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_path_owner" CHECK ("profiles"."avatar_path" is null or split_part("profiles"."avatar_path", '/', 1) = "profiles"."id"::text);--> statement-breakpoint
ALTER TABLE public.workspace_billing_customers ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON public.workspace_billing_customers FROM PUBLIC, anon, authenticated;--> statement-breakpoint
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-photos', 'profile-photos', false, 768000, ARRAY['image/jpeg', 'image/png', 'image/webp']);--> statement-breakpoint
CREATE POLICY "people read their own profile photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);--> statement-breakpoint
CREATE POLICY "people upload their own profile photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);--> statement-breakpoint
CREATE POLICY "people delete their own profile photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
