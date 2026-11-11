-- D-063 follow-up: bookings made before custom-only questions kept the student's name and grade in their own
-- columns. Move them into answers (the same shape as the custom questions pages now use), so every booking
-- reads one way. The columns stay, empty, until a later deploy drops them with ask_student.
UPDATE "public"."bookings"
SET
  "answers" = "answers"
    || jsonb_build_array(jsonb_build_object('questionId', 'studentname', 'label', 'Student’s name', 'value', "student_name"))
    || CASE WHEN coalesce("student_grade", '') <> ''
         THEN jsonb_build_array(jsonb_build_object('questionId', 'studentgrade', 'label', 'Grade', 'value', "student_grade"))
         ELSE '[]'::jsonb END,
  "student_name" = NULL,
  "student_grade" = NULL
WHERE coalesce("student_name", '') <> '';
