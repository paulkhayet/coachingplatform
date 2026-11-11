ALTER TABLE "businesses" ADD COLUMN "logo_path" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "about" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_logo_path_owner" CHECK ("businesses"."logo_path" is null or split_part("businesses"."logo_path", '/', 1) = "businesses"."id"::text);--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_profile_lengths" CHECK (char_length("businesses"."about") <= 600 and char_length("businesses"."contact_email") <= 254);--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_website_url" CHECK ("businesses"."website_url" is null or (char_length("businesses"."website_url") <= 200 and "businesses"."website_url" ~ '^https?://'));--> statement-breakpoint

-- D-071: logos appear on public booking pages, so the bucket is public (anyone with the URL can read
-- a logo). Only the business's owner can add or remove files in its folder; nothing can be overwritten.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('business-logos', 'business-logos', true, 768000, ARRAY['image/jpeg', 'image/png', 'image/webp']);--> statement-breakpoint
CREATE POLICY "owners upload their business logo" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'business-logos'
    AND CASE WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN private.has_role(((storage.foldername(name))[1])::uuid, ARRAY['owner']::public.member_role[]) ELSE false END
  );--> statement-breakpoint
CREATE POLICY "owners see their business logo files" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'business-logos'
    AND CASE WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN private.has_role(((storage.foldername(name))[1])::uuid, ARRAY['owner']::public.member_role[]) ELSE false END
  );--> statement-breakpoint
CREATE POLICY "owners remove their business logo" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'business-logos'
    AND CASE WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN private.has_role(((storage.foldername(name))[1])::uuid, ARRAY['owner']::public.member_role[]) ELSE false END
  );
