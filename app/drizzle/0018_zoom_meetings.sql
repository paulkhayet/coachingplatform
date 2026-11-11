ALTER TYPE "public"."location_type" ADD VALUE 'zoom';--> statement-breakpoint
CREATE TABLE "zoom_connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"zoom_user_id" text NOT NULL,
	"zoom_email" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zoom_connections_status" CHECK ("zoom_connections"."status" in ('active', 'needs_reconnect'))
);
--> statement-breakpoint
CREATE TABLE "zoom_tokens" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"refresh_token_ciphertext" text NOT NULL,
	"access_token_ciphertext" text,
	"access_expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "zoom_meeting_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "meeting_error" text;--> statement-breakpoint
ALTER TABLE "zoom_connections" ADD CONSTRAINT "zoom_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoom_tokens" ADD CONSTRAINT "zoom_tokens_user_id_zoom_connections_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."zoom_connections"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "zoom_connections_zoom_user_idx" ON "zoom_connections" USING btree ("zoom_user_id");--> statement-breakpoint

-- D-038: Zoom connections belong to the person, like Google (D-057). Only the server writes them; people can
-- read their own connection, and the tokens are never reachable through the API.
ALTER TABLE "public"."zoom_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."zoom_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "people read their own zoom connection" ON "public"."zoom_connections"
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "public"."zoom_connections" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON "public"."zoom_connections" FROM anon;--> statement-breakpoint
REVOKE ALL ON "public"."zoom_tokens" FROM anon, authenticated;
