CREATE TABLE "client_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"uploaded_by" uuid,
	"file_name" text NOT NULL,
	"path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_files_name" CHECK (char_length(btrim("client_files"."file_name")) between 1 and 200),
	CONSTRAINT "client_files_status" CHECK ("client_files"."status" in ('pending', 'ready')),
	CONSTRAINT "client_files_size" CHECK ("client_files"."size_bytes" is null or "client_files"."size_bytes" between 1 and 26214400),
	CONSTRAINT "client_files_path" CHECK ("client_files"."path" = "client_files"."business_id"::text || '/' || "client_files"."client_id"::text || '/' || "client_files"."id"::text)
);
--> statement-breakpoint
ALTER TABLE "client_files" ADD CONSTRAINT "client_files_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_files" ADD CONSTRAINT "client_files_client_fk" FOREIGN KEY ("business_id","client_id") REFERENCES "public"."coaching_clients"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_files_path_key" ON "client_files" USING btree ("path");--> statement-breakpoint
CREATE INDEX "client_files_client_idx" ON "client_files" USING btree ("business_id","client_id","created_at");--> statement-breakpoint
CREATE INDEX "client_files_uploaded_by_idx" ON "client_files" USING btree ("uploaded_by");--> statement-breakpoint

-- D-070: staff who can see a client can see and add its files; the server writes the rows after
-- checking that, so signed-in users get read access only.
ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON public.client_files FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.client_files TO authenticated;--> statement-breakpoint
CREATE POLICY "staff read files of authorized clients" ON public.client_files
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.coaching_clients c
    WHERE c.business_id = client_files.business_id AND c.id = client_files.client_id
  ));--> statement-breakpoint

-- Private bucket: 25 MB per file; documents, images and audio only (no HTML, SVG or executables).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-files', 'client-files', false, 26214400, ARRAY[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a'
]);--> statement-breakpoint

-- Storage access follows the client_files row (itself filtered by the policy above). An upload link
-- can only be issued for a pending row the same person created; there is no update, so files are
-- never overwritten.
CREATE POLICY "staff upload pending client files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'client-files' AND EXISTS (
      SELECT 1 FROM public.client_files f
      WHERE f.path = objects.name AND f.status = 'pending' AND f.uploaded_by = (SELECT auth.uid())
    )
  );--> statement-breakpoint
CREATE POLICY "staff read files of authorized clients" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'client-files' AND EXISTS (SELECT 1 FROM public.client_files f WHERE f.path = objects.name)
  );--> statement-breakpoint
CREATE POLICY "uploaders and managers delete client files" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'client-files' AND EXISTS (
      SELECT 1 FROM public.client_files f
      WHERE f.path = objects.name AND (
        f.uploaded_by = (SELECT auth.uid())
        OR (SELECT private.has_role(f.business_id, ARRAY['owner', 'admin']::public.member_role[]))
      )
    )
  );
