"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  assignments as demoAssignments,
  clients as demoClients,
  resources as demoResources,
  templates as demoTemplates,
  sessions as demoSessions,
  type Assignment,
  type Client,
  type PracticeSession,
  type Visibility,
} from "@/lib/data";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "./client";
import type { Database, Json, VisibilityLevel } from "./database.types";

type Resource = (typeof demoResources)[number];
type Template = (typeof demoTemplates)[number];

export type DataMode = "demo" | "supabase";
export type ConnectionState = "unconfigured" | "signed_out" | "loading" | "connected" | "error";

export type PracticeData = {
  clients: Client[];
  assignments: Assignment[];
  sessions: PracticeSession[];
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
  sessions: demoSessions,
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
type AssignmentResponseRow = Database["public"]["Tables"]["assignment_responses"]["Row"];

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
    guardians: guardians.map((guardian) => ({ id: guardian.id, name: guardian.full_name, relation: guardian.relation_label || "Guardian", initials: initials(guardian.full_name), permissions: permissionLabels(guardian.permissions), automaticAssignmentUpdates: guardian.automatic_assignment_updates })),
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

function assignmentStatus(assignment: Database["public"]["Tables"]["assignments"]["Row"]): Assignment["status"] {
  if (assignment.reviewed_at) return "Reviewed";
  if (assignment.status === "completed") return "Complete";
  if (assignment.status === "submitted") return "Submitted";
  if (assignment.due_at && new Date(assignment.due_at).getTime() < Date.now()) return "Overdue";
  if (assignment.status === "in_progress") return "In progress";
  return "Not started";
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
  const [profileResult, clientsResult, goalsResult, relationshipsResult, sessionsResult, assignmentsResult, assignmentResponsesResult, resourcesResult, templatesResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("clients").select("*").eq("organization_id", organizationId).order("full_name"),
    supabase.from("goals").select("*").eq("organization_id", organizationId).order("created_at"),
    supabase.from("client_relationships").select("*").eq("organization_id", organizationId).order("created_at"),
    supabase.from("sessions").select("*").eq("organization_id", organizationId).order("starts_at"),
    supabase.from("assignments").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("assignment_responses").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }),
    supabase.from("resources").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("templates").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }),
  ]);

  const firstError = [profileResult, clientsResult, goalsResult, relationshipsResult, sessionsResult, assignmentsResult, assignmentResponsesResult, resourcesResult, templatesResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const coachName = profileResult.data?.full_name || user.user_metadata.full_name || user.email || "Your coach";
  const mappedClients = (clientsResult.data || []).map((client, index) => mapClient(client, goalsResult.data || [], relationshipsResult.data || [], sessionsResult.data || [], coachName, index));
  const names = new Map(mappedClients.map((client) => [client.id, client.name]));
  const responses = new Map((assignmentResponsesResult.data || []).map((response: AssignmentResponseRow) => [response.assignment_id, response]));
  const autoGuardianClients = new Set((relationshipsResult.data || []).filter((relationship) => relationship.role === "guardian" && relationship.automatic_assignment_updates).map((relationship) => relationship.client_id));

  return {
    clients: mappedClients,
    assignments: (assignmentsResult.data || []).map((assignment) => ({
      id: assignment.id,
      clientId: assignment.client_id,
      client: names.get(assignment.client_id) || "Unknown client",
      title: assignment.title,
      instructions: assignment.instructions || "",
      due: dueLabel(assignment.due_at),
      dueAt: assignment.due_at,
      required: assignment.is_required,
      status: assignmentStatus(assignment),
      visibility: visibilityToUi(assignment.visibility),
      responseType: assignment.response_type,
      responseText: responses.get(assignment.id)?.response_text || "",
      guardianShare: assignment.guardian_share_setting,
      guardianLogisticsShared: assignment.guardian_share_setting === "share" || (assignment.guardian_share_setting === "client_default" && autoGuardianClients.has(assignment.client_id)),
    })),
    sessions: (sessionsResult.data || []).map((session) => ({
      id: session.id,
      clientId: session.client_id,
      client: names.get(session.client_id) || "Unknown client",
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      status: session.status as PracticeSession["status"],
      meetingProvider: session.meeting_provider,
      meetingUrl: session.meeting_url,
      nextSessionAt: session.next_session_at,
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
    const callbackError = url.searchParams.get("error_description") || hash.get("error_description");
    if (callbackError) {
      setData({ ...initialData, connectionState: "signed_out", error: callbackError.replaceAll("+", " ") });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      void refresh();
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (callbackError && event === "INITIAL_SESSION") return;
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

  const signInWithOAuth = useCallback(async (provider: "google" | "apple") => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  }, []);

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

  const createSession = useCallback(async (input: { clientId: string; startsAt: string; durationMinutes: number; meetingProvider: "google_meet" | "zoom" | "other" | null }) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !data.organizationId || !data.userId) throw new Error("Sign in to schedule a session.");
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
    const { error } = await supabase.from("sessions").insert({ organization_id: data.organizationId, client_id: input.clientId, coach_id: data.userId, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), meeting_provider: input.meetingProvider });
    if (error) throw error;
    await refresh();
  }, [data.organizationId, data.userId, refresh]);

  const createAssignment = useCallback(async (input: { clientId: string; title: string; instructions: string; responseType: "checkbox" | "text"; required: boolean; dueAt: string | null; guardianShare: "client_default" | "share" | "private" }) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !data.organizationId || !data.userId) throw new Error("Sign in to create an assignment.");
    const { error } = await supabase.from("assignments").insert({ organization_id: data.organizationId, client_id: input.clientId, assigned_by: data.userId, title: input.title, instructions: input.instructions || null, response_type: input.responseType, assignment_type: input.responseType === "text" ? "reflection" : "task", is_required: input.required, due_at: input.dueAt, status: "not_started", visibility: "coach_client", guardian_share_setting: input.guardianShare });
    if (error) throw error;
    await refresh();
  }, [data.organizationId, data.userId, refresh]);

  const completeSession = useCallback(async (input: { sessionId: string | null; clientId: string; attendance: "attended" | "late_cancel" | "no_show"; notes: string; noteVisibility: Visibility; sharedSummary: string; nextSessionAt: string | null; assignment: null | { title: string; instructions: string; responseType: "checkbox" | "text"; required: boolean; dueAt: string | null; guardianShare: "client_default" | "share" | "private" } }) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !data.organizationId || !data.userId) throw new Error("Sign in to complete a session.");
    let sessionId = input.sessionId;
    if (!sessionId) {
      const now = new Date();
      const { data: created, error } = await supabase.from("sessions").insert({ organization_id: data.organizationId, client_id: input.clientId, coach_id: data.userId, starts_at: now.toISOString(), ends_at: new Date(now.getTime() + 50 * 60_000).toISOString(), status: input.attendance, next_session_at: input.nextSessionAt }).select("id").single();
      if (error) throw error;
      sessionId = created.id;
    } else {
      const { error } = await supabase.from("sessions").update({ status: input.attendance, next_session_at: input.nextSessionAt }).eq("id", sessionId);
      if (error) throw error;
    }
    const notes: { body: string; visibility: VisibilityLevel; note_type: "coach_note" | "shared_note" }[] = [{ body: input.notes, visibility: uiVisibilityToDatabase(input.noteVisibility), note_type: "coach_note" }];
    if (input.sharedSummary.trim()) notes.push({ body: input.sharedSummary.trim(), visibility: "coach_client", note_type: "shared_note" });
    const { error: noteError } = await supabase.from("notes").insert(notes.map((note) => ({ organization_id: data.organizationId!, client_id: input.clientId, session_id: sessionId, author_id: data.userId!, body: note.body, visibility: note.visibility as VisibilityLevel, note_type: note.note_type, ai_generated: false })));
    if (noteError) throw noteError;
    if (input.assignment?.title.trim()) await createAssignment({ clientId: input.clientId, ...input.assignment });
    await refresh();
  }, [createAssignment, data.organizationId, data.userId, refresh]);

  const updateGuardianAssignmentSharing = useCallback(async (relationshipId: string, enabled: boolean) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.from("client_relationships").update({ automatic_assignment_updates: enabled }).eq("id", relationshipId);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const submitAssignmentResponse = useCallback(async (assignment: Assignment, responseText: string, completed: boolean) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !data.organizationId) throw new Error("Sign in to submit an assignment.");
    const now = new Date().toISOString();
    const { error: responseError } = await supabase.from("assignment_responses").upsert({ organization_id: data.organizationId, assignment_id: assignment.id, client_id: assignment.clientId, submitted_by: data.userId, response_text: responseText, completed, visibility: "coach_client", submitted_at: now, updated_at: now }, { onConflict: "assignment_id" });
    if (responseError) throw responseError;
    const { error } = await supabase.from("assignments").update({ status: completed ? "completed" : "submitted", submitted_at: now, completed_at: completed ? now : null }).eq("id", assignment.id);
    if (error) throw error;
    await refresh();
  }, [data.organizationId, data.userId, refresh]);

  const reviewAssignment = useCallback(async (assignmentId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.from("assignments").update({ reviewed_at: new Date().toISOString() }).eq("id", assignmentId);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  return { ...data, needsPasswordUpdate, refresh, signIn, signInWithOAuth, signOut, signUp, requestPasswordReset, updatePassword, createSession, createAssignment, completeSession, updateGuardianAssignmentSharing, submitAssignmentResponse, reviewAssignment };
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
