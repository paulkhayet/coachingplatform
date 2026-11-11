CREATE TABLE "contact_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"organization" text NOT NULL,
	"team_size" text NOT NULL,
	"message" text,
	"plan" text,
	"emailed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_requests_lengths" CHECK (char_length("contact_requests"."name") <= 120 and char_length("contact_requests"."email") <= 254 and char_length("contact_requests"."organization") <= 160 and char_length(coalesce("contact_requests"."message", '')) <= 4000)
);
--> statement-breakpoint
CREATE INDEX "contact_requests_email_created_idx" ON "contact_requests" USING btree ("email","created_at");--> statement-breakpoint

-- D-067: only the server writes and reads contact requests; the API can't touch them.
ALTER TABLE "public"."contact_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "public"."contact_requests" FROM anon, authenticated;
