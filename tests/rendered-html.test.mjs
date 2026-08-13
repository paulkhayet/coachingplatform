import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Soli coaching workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Soli — Your coaching practice, beautifully organized<\/title>/i,
  );
  assert.match(html, /Good morning, Alex|Securing your workspace…/);
  assert.match(html, /Sessions today|auth-spinner/);
  assert.match(html, /Client homework|auth-loading/);
  assert.doesNotMatch(
    html,
    /codex-preview|react-loading-skeleton|Your site is taking shape/i,
  );
});

test("ships the privacy-aware MVP foundation", async () => {
  const [
    app,
    data,
    layout,
    packageJson,
    migration,
    authMigration,
    workflowMigration,
    portalMigration,
    storageMigration,
    integrationMigration,
    bookingMigration,
    bookingsView,
    publicBookingPage,
    oauth,
    repository,
  ] = await Promise.all([
    readFile(new URL("../app/coach-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/20260813000000_initial.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260813010000_auth_bootstrap_and_storage.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260813020000_core_coaching_workflows.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260813030000_portal_accounts_and_invitations.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260813040000_secure_resources_and_homework_files.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260813050000_practice_integrations.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260813060000_public_booking_pages.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../components/bookings-view.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/book/[slug]/public-booking-page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/integrations/oauth.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/supabase/practice-data.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(app, /Minor privacy controls are active/);
  assert.match(app, /Soli never gives\s+coaching advice/);
  assert.match(app, /Coach \+ Parent/);
  assert.match(data, /Dr\. Nina Patel/);
  assert.match(layout, /og\.png/);
  assert.match(packageJson, /"name": "soli-coaching-platform"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(migration, /create type public\.visibility_level/);
  assert.match(migration, /guardians read explicitly shared notes/);
  assert.match(
    migration,
    /check \(not ai_generated or note_type = 'meeting_summary'\)/,
  );
  assert.match(
    authMigration,
    /create or replace function public\.handle_new_user/,
  );
  assert.match(authMigration, /soli-resources/);
  assert.match(
    workflowMigration,
    /create table if not exists public\.assignment_responses/,
  );
  assert.match(workflowMigration, /automatic_assignment_updates/);
  assert.match(workflowMigration, /guardian_can_read_assignment_logistics/);
  assert.match(workflowMigration, /Never shares response content/);
  assert.match(portalMigration, /create table public\.portal_invitations/);
  assert.match(portalMigration, /create table public\.scheduling_requests/);
  assert.match(portalMigration, /get_portal_client/);
  assert.match(portalMigration, /sensitive intake columns/);
  assert.match(portalMigration, /claim_portal_invitation/);
  assert.match(portalMigration, /submit_portal_assignment/);
  assert.match(portalMigration, /portal_audit_events/);
  assert.match(storageMigration, /file_size_limit = 10485760/);
  assert.match(
    storageMigration,
    /create table if not exists public\.assignment_files/,
  );
  assert.match(storageMigration, /clients read assigned resource files/);
  assert.match(storageMigration, /clients upload homework files/);
  assert.match(storageMigration, /Guardian access is intentionally excluded/);
  assert.match(
    integrationMigration,
    /create table if not exists public\.integration_connections/,
  );
  assert.match(
    integrationMigration,
    /create table if not exists public\.integration_credentials/,
  );
  assert.match(integrationMigration, /save_integration_oauth_connection/);
  assert.match(integrationMigration, /disconnect_integration/);
  assert.match(integrationMigration, /No direct authenticated-user policy/);
  assert.match(bookingMigration, /create table if not exists public\.booking_pages/);
  assert.match(bookingMigration, /create table if not exists public\.booking_requests/);
  assert.match(bookingMigration, /create or replace function public\.submit_public_booking/);
  assert.match(bookingMigration, /availableSlots/);
  assert.match(bookingMigration, /#variable_conflict use_variable/);
  assert.match(bookingsView, /Intake questionnaire/);
  assert.match(bookingsView, /Choices separated by commas/);
  assert.match(bookingsView, /Your consultation link/);
  assert.match(publicBookingPage, /Book consultation/);
  assert.match(publicBookingPage, /availableSlots/);
  assert.match(app, /Bookings/);
  assert.match(oauth, /AES-GCM/);
  assert.match(oauth, /https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
  assert.match(oauth, /https:\/\/zoom\.us\/oauth\/authorize/);
  assert.match(oauth, /https:\/\/www\.googleapis\.com\/auth\/calendar\.events/);
  assert.match(repository, /supabase\s*\.from\("clients"\)/);
  assert.match(repository, /createSession/);
  assert.match(repository, /completeSession/);
  assert.match(repository, /submitAssignmentResponse/);
  assert.match(repository, /uploadResource/);
  assert.match(repository, /assignResourceAsHomework/);
  assert.match(repository, /uploadAssignmentFile/);
  assert.match(repository, /connectIntegration/);
  assert.match(repository, /updateIntegrationPreferences/);
  assert.match(repository, /disconnectIntegration/);
  assert.match(repository, /saveCoachNote/);
  assert.match(repository, /resetPasswordForEmail/);
  assert.match(repository, /signInWithOAuth/);
  assert.match(repository, /updateUser\(\{ password \}\)/);
  assert.match(app, /Create your practice/);
  assert.match(app, /Set password and continue/);
  assert.match(app, /Sign in with Google/);
  assert.match(app, /Continue with Apple/);
  assert.match(app, /google-signin-light\.png/);
  assert.match(app, /apple-continue-white\.png/);
  assert.doesNotMatch(app, /oauth-google-mark/);
  assert.match(app, /ScheduleSessionModal/);
  assert.match(app, /AssignmentComposer/);
  assert.match(app, /Guardian assignment updates/);
  assert.match(
    app,
    /The assignment response is never\s+automatically visible to a guardian/,
  );
  assert.match(app, /Guardian portal/);
  assert.match(app, /Join Zoom/);
  assert.match(app, /Portal access for/);
  assert.match(app, /Create portal account/);
  assert.match(app, /Zoom is the primary meeting provider/);
  assert.match(app, /Google Workspace/);
  assert.match(app, /Calendar \+ Google Meet/);
  assert.match(app, /Default meeting provider/);

  await assert.rejects(
    access(new URL("../app/_sites-preview", import.meta.url)),
  );
});
