-- Booking reminders on a schedule (D-056, TECH_STACK: pg_cron). Every 15 minutes the database asks the app
-- to send any reminders that are due (POST /api/cron/reminders with "Authorization: Bearer <CRON_SECRET>").
-- The app's address and the secret live in Supabase Vault, entered by hand per environment:
--   select vault.create_secret('https://www.schedulefa.st/api/cron/reminders', 'reminders_url');
--   select vault.create_secret('<the CRON_SECRET from Vercel>', 'cron_secret');
-- Until both exist the job does nothing, so development databases and fresh setups are unaffected.
CREATE OR REPLACE FUNCTION private.request_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'reminders_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('authorization', 'Bearer ' || v_secret, 'content-type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.request_reminders() FROM PUBLIC, anon, authenticated;--> statement-breakpoint

-- Supabase has pg_cron and pg_net; a plain Postgres (the test database) doesn't, so only schedule where they exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog';
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions';
    -- Same name again replaces the job, so this is safe to re-run.
    PERFORM cron.schedule('send-booking-reminders', '*/15 * * * *', 'SELECT private.request_reminders()');
  END IF;
END;
$$;
