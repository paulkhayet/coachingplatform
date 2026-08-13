import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Soli coaching workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Soli — Your coaching practice, beautifully organized<\/title>/i);
  assert.match(html, /Good morning, Alex|Securing your workspace…/);
  assert.match(html, /Sessions today|auth-spinner/);
  assert.match(html, /Client homework|auth-loading/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("ships the privacy-aware MVP foundation", async () => {
  const [app, data, layout, packageJson, migration, authMigration, repository] = await Promise.all([
    readFile(new URL("../app/coach-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260813000000_initial.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260813010000_auth_bootstrap_and_storage.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/practice-data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /Minor privacy controls are active/);
  assert.match(app, /Soli never gives coaching advice/);
  assert.match(app, /Coach \+ Parent/);
  assert.match(data, /Dr\. Nina Patel/);
  assert.match(layout, /og\.png/);
  assert.match(packageJson, /"name": "soli-coaching-platform"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(migration, /create type public\.visibility_level/);
  assert.match(migration, /guardians read explicitly shared notes/);
  assert.match(migration, /check \(not ai_generated or note_type = 'meeting_summary'\)/);
  assert.match(authMigration, /create or replace function public\.handle_new_user/);
  assert.match(authMigration, /soli-resources/);
  assert.match(repository, /supabase\.from\("clients"\)/);
  assert.match(repository, /saveCoachNote/);
  assert.match(repository, /resetPasswordForEmail/);
  assert.match(repository, /updateUser\(\{ password \}\)/);
  assert.match(app, /Create your practice/);
  assert.match(app, /Set password and continue/);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
