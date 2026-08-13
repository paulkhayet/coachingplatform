import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SOLI_SEED_PASSWORD;

if (process.env.SOLI_ALLOW_SEED !== "true") {
  throw new Error("Seeding is disabled. Set SOLI_ALLOW_SEED=true to confirm the target project is safe to seed.");
}
if (!url || !serviceKey || !password) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SOLI_SEED_PASSWORD are required.");
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const coachEmail = process.env.SOLI_SEED_COACH_EMAIL || "alex@soli-demo.test";

async function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

let users = await must(supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }), "List users");
let coach = users.users.find((user) => user.email === coachEmail);
if (!coach) {
  const created = await must(supabase.auth.admin.createUser({ email: coachEmail, password, email_confirm: true, user_metadata: { full_name: "Alex Morgan", account_type: "coach" } }), "Create coach");
  coach = created.user;
}

const membership = await must(supabase.from("organization_members").select("organization_id").eq("profile_id", coach.id).limit(1).single(), "Find coach organization");
const organizationId = membership.organization_id;

const existing = await must(supabase.from("clients").select("id").eq("organization_id", organizationId).limit(1), "Check clients");
if (existing.length) {
  console.log(`Seed skipped: organization ${organizationId} already has clients.`);
  process.exit(0);
}

const clientRows = [
  { full_name: "Maya Chen", kind: "adult", pronouns: "she/her", email: "maya.chen@example.com", phone: "+1 (415) 555-0148", headline: "Building confidence for a thoughtful career transition." },
  { full_name: "Eli Rivera", kind: "minor", pronouns: "they/them", birth_date: "2010-05-19", email: "eli.rivera@example.com", phone: "+1 (510) 555-0171", headline: "Growing self-trust while navigating school and family expectations." },
  { full_name: "Jonah Brooks", kind: "adult", pronouns: "he/him", email: "jonah.b@example.com", phone: "+1 (650) 555-0199", headline: "Leading with clarity without sacrificing life outside work." },
  { full_name: "Ava Thompson", kind: "minor", pronouns: "she/her", birth_date: "2011-02-07", email: "ava.t@example.com", phone: "+1 (925) 555-0126", headline: "Finding balance between achievement, friendships, and rest." },
  { full_name: "Priya Shah", kind: "adult", pronouns: "she/her", email: "priya.shah@example.com", phone: "+1 (408) 555-0164", status: "paused", headline: "Creating space for a more intentional next season." },
].map((client) => ({ ...client, organization_id: organizationId, assigned_coach_id: coach.id }));

const seededClients = await must(supabase.from("clients").insert(clientRows).select("id, full_name"), "Create clients");
const byName = new Map(seededClients.map((client) => [client.full_name, client.id]));

await must(supabase.from("goals").insert([
  { organization_id: organizationId, client_id: byName.get("Maya Chen"), title: "Choose the right next career chapter", progress: 68 },
  { organization_id: organizationId, client_id: byName.get("Maya Chen"), title: "Build a sustainable weekly rhythm", progress: 42 },
  { organization_id: organizationId, client_id: byName.get("Eli Rivera"), title: "Speak up with more confidence", progress: 58 },
  { organization_id: organizationId, client_id: byName.get("Eli Rivera"), title: "Create a calmer school routine", progress: 74 },
  { organization_id: organizationId, client_id: byName.get("Jonah Brooks"), title: "Set clear boundaries with my team", progress: 35 },
]), "Create goals");

await must(supabase.from("client_relationships").insert([
  { organization_id: organizationId, client_id: byName.get("Eli Rivera"), full_name: "Sofia Rivera", email: "sofia.rivera@example.com", role: "guardian", relation_label: "Mother", portal_enabled: true, permissions: { scheduling: true, billing: true, agreements: true, progress_updates: true } },
  { organization_id: organizationId, client_id: byName.get("Eli Rivera"), full_name: "Daniel Rivera", email: "daniel.rivera@example.com", role: "guardian", relation_label: "Father", portal_enabled: true, permissions: { scheduling: true, billing: false, agreements: true, progress_updates: false } },
  { organization_id: organizationId, client_id: byName.get("Eli Rivera"), full_name: "Dr. Nina Patel", email: "nina.patel@example.com", role: "third_party", relation_label: "Therapist", portal_enabled: false, permissions: { scheduling: false, billing: false, agreements: false, progress_updates: true } },
  { organization_id: organizationId, client_id: byName.get("Ava Thompson"), full_name: "Caroline Thompson", email: "caroline.t@example.com", role: "guardian", relation_label: "Mother", portal_enabled: true, permissions: { scheduling: true, billing: true, agreements: true, progress_updates: false } },
]), "Create relationships");

const at = (days, hour, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
};
await must(supabase.from("sessions").insert([
  { organization_id: organizationId, client_id: byName.get("Maya Chen"), coach_id: coach.id, starts_at: at(0, 10).toISOString(), ends_at: at(0, 10, 50).toISOString(), meeting_provider: "google_meet", meeting_url: "https://meet.google.com/demo-maya" },
  { organization_id: organizationId, client_id: byName.get("Eli Rivera"), coach_id: coach.id, starts_at: at(0, 14, 30).toISOString(), ends_at: at(0, 15, 20).toISOString(), meeting_provider: "google_meet", meeting_url: "https://meet.google.com/demo-eli" },
  { organization_id: organizationId, client_id: byName.get("Jonah Brooks"), coach_id: coach.id, starts_at: at(1, 11).toISOString(), ends_at: at(1, 11, 50).toISOString(), meeting_provider: "google_meet", meeting_url: "https://meet.google.com/demo-jonah" },
]), "Create sessions");

await must(supabase.from("assignments").insert([
  { organization_id: organizationId, client_id: byName.get("Maya Chen"), assigned_by: coach.id, title: "Values-aligned role scorecard", is_required: true, due_at: at(0, 17).toISOString(), status: "in_progress" },
  { organization_id: organizationId, client_id: byName.get("Eli Rivera"), assigned_by: coach.id, title: "Three moments I trusted myself", is_required: false, due_at: at(1, 17).toISOString() },
  { organization_id: organizationId, client_id: byName.get("Jonah Brooks"), assigned_by: coach.id, title: "Energy audit: one workweek", is_required: true, due_at: at(4, 17).toISOString(), status: "in_progress" },
]), "Create assignments");

await must(supabase.from("resources").insert([
  { organization_id: organizationId, created_by: coach.id, title: "Weekly Energy Audit", resource_type: "Worksheet", external_url: "https://example.com/weekly-energy-audit" },
  { organization_id: organizationId, created_by: coach.id, title: "Values Clarification Guide", resource_type: "Workbook", external_url: "https://example.com/values-guide" },
]), "Create resources");

await must(supabase.from("templates").insert([
  { organization_id: organizationId, created_by: coach.id, name: "New adult client", template_type: "Onboarding", definition: { steps: ["intake", "agreement", "payment", "welcome"] } },
  { organization_id: organizationId, created_by: coach.id, name: "Teen + guardian onboarding", template_type: "Onboarding", definition: { steps: ["minor intake", "guardian intake", "agreement", "permissions", "payment"] } },
]), "Create templates");

console.log(`Seeded Soli demo organization ${organizationId}.`);
console.log(`Coach login: ${coachEmail}`);
