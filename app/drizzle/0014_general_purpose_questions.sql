-- D-063: booking questions are fully custom. The built-in "ask for the student's name and grade" option is
-- gone; pages that had it on get the same two questions as ordinary custom questions (they can edit or
-- remove them like any other), so nothing changes for families booking those pages. Only pages with room
-- (at most 10 questions) are converted; others keep the setting until edited, and the app no longer reads it.
UPDATE "public"."booking_pages"
SET
  "questions" = "questions" || jsonb_build_array(
    jsonb_build_object('id', 'studentname', 'label', 'Student’s name', 'type', 'short', 'options', '[]'::jsonb, 'required', true),
    jsonb_build_object('id', 'studentgrade', 'label', 'Grade', 'type', 'short', 'options', '[]'::jsonb, 'required', false)
  ),
  "ask_student" = false,
  "updated_at" = now()
WHERE "ask_student" = true
  AND jsonb_array_length("questions") <= 8
  AND NOT "questions" @> '[{"id": "studentname"}]'::jsonb;--> statement-breakpoint

COMMENT ON COLUMN "public"."booking_pages"."ask_student" IS 'Unused since D-063 (moved into custom questions). Drop in a later deploy.';--> statement-breakpoint
COMMENT ON COLUMN "public"."bookings"."student_name" IS 'Only on bookings made before D-063; new answers live in answers. Kept for history.';
