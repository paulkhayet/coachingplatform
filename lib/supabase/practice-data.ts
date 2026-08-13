"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  assignments as demoAssignments,
  clients as demoClients,
  resources as demoResources,
  templates as demoTemplates,
  type Client,
  type Visibility,
} from "@/lib/data";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "./client";
import type { Database, Json, VisibilityLevel } from "./database.types";

type Assignment = (typeof demoAssignments)[number];
type Resource = (typeof demoResources)[number];
type Template = (typeof demoTemplates)[number];

export type DataMode = "demo" | "supabase";
export type ConnectionState = "unconfigured" | "signed_out" | "loading" | "connected" | "error";

export type PracticeData = {
  clients: Client[];
  assignments: Assignment[];
  resources: Resource[];
  templates: Template[];
  mode: DataMode;
  connectionState: ConnectionState;
  organizationId: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  error: string | null;
};

const initialData: PracticeData = {
  clients: demoClients,
  assignments: demoAssignments,
  resources: demoResources,
  templates: demoTemplates,
  mode: "demo",
  connectionState: isSupabaseConfigured() ? "loading" : "unconfigured",
  organizationId: null,
  userId: null,
  userEmail: null,
  userName: null,
  error: null,
};

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type GoalRow = Database["public"]["Tables"]["goals"]["Row"];
type RelationshipRow = Database["public"]["Tables"]["client_relationships"]["Row"];
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function ageFromBirthDate(birthDate: string | null) {
  if (!birthDate) return undefined;
  const birth = new Date(`${birthDate}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday = today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function formatNextSession(session?: SessionRow) {
  if (!session) return { date: "Not scheduled", time: "" };
  const startsAt = new Date(session.starts_at);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDay = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());
  const dayDifference = Math.round((sessionDay.getTime() - today.getTime()) / 86_400_000);
  const date = dayDifference === 0 ? "Today" : dayDifference === 1 ? "Tomorrow" : startsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return { date, time };
}

function permissionLabels(value: Json): string[] {
  if (!value || Array.isArray(value) || typeof value !== "object") return [];
  const labels: Record<string, string> = {
    scheduling: "Scheduling",
    billing: "Billing",
    agreements: "Agreements",
    progress_updates: "Progress updates",
  };
  return Object.entries(value).filter(([, enabled]) => enabled === true).map(([key]) => labels[key] ?? key);
}

function mapClient(
  row: ClientRow,
  goals: GoalRow[],
  relationships: RelationshipRow[],
  sessions: SessionRow[],
  coachName: string,
  index: number,
): Client {
  const nextSession = sessions
    .filter((session) => session.client_id === row.id && new Date(session.starts_at).getTime() >= Date.now() && session.status === "scheduled")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const next = formatNextSession(nextSession);
  const related = relationships.filter((relationship) => relationship.client_id === row.id);
  const guardians = related.filter((relationship) => relationship.role === "guardian");
  const careTeam = related.filter((relationship) => relationship.role === "third_party");
  const palette = ["#d9c7ff", "#b9ddd2", "#f3c9ae", "#f0d8a9", "#c8d9f4"];

  return {
    id: row.id,
    name: row.full_name,
    initials: initials(row.full_name),
    age: ageFromBirthDate(row.birth_date),
    pronouns: row.pronouns || "Pronouns not set",
    email: row.email || "Email not set",
    phone: row.phone || "Phone not set",
    status: row.status === "paused" ? "Paused" : "Active",
    type: row.kind === "minor" ? "Teen" : "Adult",
    color: palette[index % palette.length],
    nextSession: next.date,
    nextSessionTime: next.time,
    cadence: "Cadence not set",
    package: "No active package",
    payment: "Paid",
    coach: coachName,
    joined: new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    timezone: row.timezone.replaceAll("_", " ").split("/").at(-1) || row.timezone,
    headline: row.headline || "Add a short coaching focus for this client.",
    goals: goals.filter((goal) => goal.client_id === row.id && goal.status === "active").map((goal) => ({ title: goal.title, progress: goal.progress })),
    guardians: guardians.map((guardian) => ({ name: guardian.full_name, relation: guardian.relation_label || "Guardian", initials: initials(guardian.full_name), permissions: permissionLabels(guardian.permissions) })),
    careTeam: careTeam.map((person) => ({ name: person.full_name, role: person.relation_label || "Third party", initials: initials(person.full_name), permissions: permissionLabels(person.permissions) })),
  };
}

function visibilityToUi(value: VisibilityLevel): Visibility {
  if (value === "coach_only") return "Coach only";
  if (value === "coach_parent") return "Coach + Parent";
  if (value === "coach_client_parent") return "Everyone";
  return "Coach + Client";
}

function dueLabel(value: string | null) {
  if (!value) return "No due date";
  const due = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function loadForUser(user: User): Promise<PracticeData> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ...initialData, connectionState: "unconfigured" };

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) throw new Error("Your account is not connected to a coaching organization.");

  const organizationId = membership.organization_id;
  const [profileResult, clientsResult, goalsResult, relationshipsResult, sessionsResult, assignmentsResult, resourcesResult, templatesResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("clients").select("*").eq("organization_id", organizationId).order("full_name"),
    supabase.from("goals").select("*").eq("organization_id", organizationId).order("created_at"),
    supabase.from("client_relationships").select("*").eq("organization_id", organizationId).order("created_at"),
    supabase.from("sessions").select("*").eq("organization_id", organizationId).order("starts_at"),
    supabase.from("assignments").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("resources").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("templates").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }),
  ]);

  const firstError = [profileResult, clientsResult, goalsResult, relationshipsResult, sessionsResult, assignmentsResult, resourcesResult, templatesResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const coachName = profileResult.data?.full_name || user.user_metadata.full_name || user.email || "Your coach";
  const mappedClients = (clientsResult.data || []).map((client, index) => mapClient(client, goalsResult.data || [], relationshipsResult.data || [], sessionsResult.data || [], coachName, index));
  const names = new Map(mappedClients.map((client) => [client.id, client.name]));

  return {
    clients: mappedClients,
    assignments: (assignmentsResult.data || []).map((assignment) => ({
      id: assignment.id,
      client: names.get(assignment.client_id) || "Unknown client",
      title: assignment.title,
      due: dueLabel(assignment.due_at),
      required: assignment.is_required,
      status: assignment.status === "completed" ? "Complete" : assignment.status === "in_progress" || assignment.status === "submitted" ? "In progress" : "Not started",
      visibility: visibilityToUi(assignment.visibility),
    })),
    resources: (resourcesResult.data || []).map((resource, index) => ({
      title: resource.title,
      type: resource.resource_type,
      size: resource.byte_size ? `${Math.max(1, Math.round(resource.byte_size / 1024))} KB` : resource.external_url ? "Link" : "File",
      assigned: 0,
      color: ["lavender", "peach", "sage", "blue", "yellow", "rose"][index % 6],
    })),
    templates: (templatesResult.data || []).map((template) => {
      const definition = template.definition && !Array.isArray(template.definition) && typeof template.definition === "object" ? template.definition : {};
      const steps = Array.isArray(definition.steps) ? definition.steps.length : 0;
      return { title: template.name, type: template.template_type, steps, updated: new Date(template.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }), icon: "sparkles" };
    }),
    mode: "supabase",
    connectionState: "connected",
    organizationId,
    userId: user.id,
    userEmail: user.email || null,
    userName: coachName,
    error: null,
  };
}

export function usePracticeData() {
  const [data, setData] = useState<PracticeData>(initialData);
  const [needsPasswordUpdate, setNeedsPasswordUpdate] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setData({ ...initialData, connectionState: "unconfigured" });
      return;
    }

    setData((current) => ({ ...current, connectionState: "loading", error: null }));
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setData({ ...initialData, connectionState: "signed_out" });
      return;
    }

    try {
      setData(await loadForUser(authData.user));
    } catch (error) {
      setData({ ...initialData, connectionState: "error", error: error instanceof Error ? error.message : "Unable to load Supabase data." });
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const authType = hash.get("type") || url.searchParams.get("type");
    if (authType === "invite" || authType === "recovery") setNeedsPasswordUpdate(true);

    void refresh();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setNeedsPasswordUpdate(true);
      window.setTimeout(() => void refresh(), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Add the Supabase URL and anon key to .env.local first.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setData({ ...initialData, connectionState: "signed_out" });
  }, []);

  const signUp = useCallback(async (fullName: string, email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, account_type: "coach" },
      },
    });
    if (error) throw error;
    if (authData.session) await refresh();
    return { requiresEmailConfirmation: !authData.session };
  }, [refresh]);

  const requestPasswordReset = useCallback(async (email: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setNeedsPasswordUpdate(false);
    window.history.replaceState({}, document.title, window.location.pathname);
    await refresh();
  }, [refresh]);

  return { ...data, needsPasswordUpdate, refresh, signIn, signOut, signUp, requestPasswordReset, updatePassword };
}

export function uiVisibilityToDatabase(value: Visibility): VisibilityLevel {
  if (value === "Coach only") return "coach_only";
  if (value === "Coach + Parent") return "coach_parent";
  if (value === "Everyone") return "coach_client_parent";
  return "coach_client";
}

export async function saveCoachNote(input: {
  organizationId: string;
  userId: string;
  clientId: string;
  body: string;
  visibility: Visibility;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("notes").insert({
    organization_id: input.organizationId,
    client_id: input.clientId,
    author_id: input.userId,
    body: input.body,
    visibility: uiVisibilityToDatabase(input.visibility),
    note_type: "coach_note",
    ai_generated: false,
  });
  if (error) throw error;
}
