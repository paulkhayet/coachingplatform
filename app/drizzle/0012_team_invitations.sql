CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" NOT NULL,
	"coaches" boolean DEFAULT true NOT NULL,
	"title" text,
	"token_hash" text NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	CONSTRAINT "invitations_not_owner" CHECK ("invitations"."role" <> 'owner'),
	CONSTRAINT "invitations_email_lower" CHECK ("invitations"."email" = lower("invitations"."email") and position('@' in "invitations"."email") > 1)
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_open_email_key" ON "invitations" USING btree ("business_id","email") WHERE "invitations"."accepted_at" is null;--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_invited_by_idx" ON "invitations" USING btree ("invited_by");--> statement-breakpoint
CREATE INDEX "invitations_accepted_by_idx" ON "invitations" USING btree ("accepted_by");--> statement-breakpoint

-- D-060: owners invite people by email. Only the server writes invitations (after checking the owner, and
-- when someone signed in with the invited email accepts), so the API can never create or accept one.
ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "owners read their invitations" ON "public"."invitations"
  FOR SELECT TO authenticated
  USING ((SELECT private.has_role(business_id, ARRAY['owner']::public.member_role[])));--> statement-breakpoint

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "public"."invitations" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON "public"."invitations" FROM anon;--> statement-breakpoint

COMMENT ON COLUMN "public"."invitations"."token_hash" IS 'SHA-256 of the token in the invitation link. The token itself is never stored. D-060.';
