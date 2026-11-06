CREATE TABLE "google_calendar_connections" (
	"membership_id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"google_email" text NOT NULL,
	"google_sub" text NOT NULL,
	"scopes" text[] NOT NULL,
	"busy_calendar_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"destination_calendar_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "google_calendar_connections_status" CHECK ("google_calendar_connections"."status" in ('active', 'needs_reconnect'))
);
--> statement-breakpoint
CREATE TABLE "google_calendar_tokens" (
	"membership_id" uuid PRIMARY KEY NOT NULL,
	"refresh_token_ciphertext" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_tokens" ADD CONSTRAINT "google_calendar_tokens_membership_id_google_calendar_connections_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."google_calendar_connections"("membership_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "google_calendar_connections_business_idx" ON "google_calendar_connections" USING btree ("business_id");--> statement-breakpoint

-- Row-level security for Google Calendar connections.
-- The server writes both tables after checking who is asking (a coach connects only their own
-- calendar). The team can see who is connected and which calendars are used; nobody can read the
-- token table through the API.
ALTER TABLE "public"."google_calendar_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."google_calendar_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "members read calendar connections" ON "public"."google_calendar_connections"
  FOR SELECT TO authenticated USING ((SELECT private.is_member(business_id)));--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "public"."google_calendar_connections" FROM anon, authenticated;--> statement-breakpoint

REVOKE ALL ON "public"."google_calendar_tokens" FROM anon, authenticated;
