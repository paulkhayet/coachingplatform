"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  assignments as demoAssignments,
  clients as demoClients,
  resources as demoResources,
  sharedNotes as demoSharedNotes,
  templates as demoTemplates,
  sessions as demoSessions,
  type Assignment,
  type Client,
  type PracticeSession,
  type PortalInvitation,
  type Resource,
  type SharedNote,
  type Visibility,
} from "@/lib/data";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "./client";
import type { Database, Json, VisibilityLevel } from "./database.types";

type Template = (typeof demoTemplates)[number];

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const RESOURCE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "video/mp4",
  "audio/mpeg",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const HOMEWORK_MIME_TYPES = new Set(
  [...RESOURCE_MIME_TYPES].filter(
    (mime) => mime !== "video/mp4" && mime !== "audio/mpeg",
  ),
);

export type DataMode = "demo" | "supabase";
export type ConnectionState =
  "unconfigured" | "signed_out" | "loading" | "connected" | "error";
export type AccountRole =
  "coach" | "client" | "guardian" | "third_party" | "unlinked";
export type PortalInvitationPreview = {
  invitationId: string;
  email: string;
  fullName: string;
  role: "client" | "guardian" | "third_party";
  clientName: string;
  expiresAt: string;
  acceptedAt: string | null;
};

export type IntegrationConnection = {
  id: string;
  provider: "google" | "zoom";
  status: "connected" | "needs_attention" | "disconnected";
  accountEmail: string | null;
  scopes: string[];
  syncEnabled: boolean;
  autoAddMeeting: boolean;
  defaultForScheduling: boolean;
  lastSyncedAt: string | null;
  updatedAt: string;
};

export type BookingQuestion = {
  id: string;
  label: string;
  type: "short_text" | "long_text" | "select" | "checkbox";
  required: boolean;
  options: string[];
};

export type BookingPage = {
  id: string;
  slug: string;
  brandName: string;
  title: string;
  description: string;
  accentColor: string;
  durationMinutes: number;
  locationType: "zoom" | "google_meet" | "phone";
  availability: { days: number[]; start: string; end: string };
  minimumNoticeHours: number;
  active: boolean;
  questions: BookingQuestion[];
};

export type BookingRequest = {
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  startsAt: string;
  endsAt: string;
  guestTimezone: string;
  answers: Json;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
};

export type PracticeData = {
  clients: Client[];
  assignments: Assignment[];
  sessions: PracticeSession[];
  notes: SharedNote[];
  invitations: PortalInvitation[];
  resources: Resource[];
  templates: Template[];
  integrations: IntegrationConnection[];
  bookingPage: BookingPage | null;
  bookingRequests: BookingRequest[];
  mode: DataMode;
  connectionState: ConnectionState;
  organizationId: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  accountRole: AccountRole;
  portalClientId: string | null;
  portalRelationshipId: string | null;
  portalPermissions: string[];
  error: string | null;
};

const initialData: PracticeData = {
  clients: demoClients,
  assignments: demoAssignments,
  sessions: demoSessions,
  notes: demoSharedNotes,
  invitations: [],
  resources: demoResources,
  templates: demoTemplates,
  integrations: [],
  bookingPage: null,
  bookingRequests: [],
  mode: "demo",
  connectionState: isSupabaseConfigured() ? "loading" : "unconfigured",
  organizationId: null,
  userId: null,
  userEmail: null,
  userName: null,
  accountRole: "coach",
  portalClientId: null,
  portalRelationshipId: null,
  portalPermissions: [],
  error: null,
};

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type GoalRow = Database["public"]["Tables"]["goals"]["Row"];
type RelationshipRow =
  Database["public"]["Tables"]["client_relationships"]["Row"];
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type AssignmentResponseRow =
  Database["public"]["Tables"]["assignment_responses"]["Row"];
type AssignmentFileRow =
  Database["public"]["Tables"]["assignment_files"]["Row"];

function fileSizeLabel(bytes: number | null) {
  if (!bytes) return "Link";
  if (bytes >= 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function validateFile(file: File, allowed: Set<string>) {
  if (!file.size) throw new Error("Choose a file that is not empty.");
  if (file.size > MAX_FILE_BYTES)
    throw new Error("Files must be 10 MB or smaller.");
  if (!allowed.has(file.type))
    throw new Error("That file type is not supported yet.");
}

function resourceType(file: File) {
  if (file.type === "application/pdf") return "PDF";
  if (file.type.startsWith("image/")) return "Image";
  if (file.type.startsWith("video/")) return "Video";
  if (file.type.startsWith("audio/")) return "Audio";
  if (file.type.includes("word")) return "Document";
  if (file.type.includes("excel") || file.type.includes("spreadsheet"))
    return "Spreadsheet";
  return "File";
}

function mapAssignmentFile(file: AssignmentFileRow) {
  return {
    id: file.id,
    name: file.original_filename,
    mimeType: file.mime_type,
    byteSize: file.byte_size,
    storagePath: file.storage_path,
    createdAt: file.created_at,
  };
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function ageFromBirthDate(birthDate: string | null) {
  if (!birthDate) return undefined;
  const birth = new Date(`${birthDate}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function formatNextSession(session?: SessionRow) {
  if (!session) return { date: "Not scheduled", time: "" };
  const startsAt = new Date(session.starts_at);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDay = new Date(
    startsAt.getFullYear(),
    startsAt.getMonth(),
    startsAt.getDate(),
  );
  const dayDifference = Math.round(
    (sessionDay.getTime() - today.getTime()) / 86_400_000,
  );
  const date =
    dayDifference === 0
      ? "Today"
      : dayDifference === 1
        ? "Tomorrow"
        : startsAt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
  const time = startsAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
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
  return Object.entries(value)
    .filter(([, enabled]) => enabled === true)
    .map(([key]) => labels[key] ?? key);
}

function bookingAvailability(value: Json) {
  const fallback = { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" };
  if (!value || Array.isArray(value) || typeof value !== "object")
    return fallback;
  const days = Array.isArray(value.days)
    ? value.days.filter((day): day is number => typeof day === "number")
    : fallback.days;
  return {
    days,
    start: typeof value.start === "string" ? value.start : fallback.start,
    end: typeof value.end === "string" ? value.end : fallback.end,
  };
}

function stringOptions(value: Json) {
  return Array.isArray(value)
    ? value.filter((option): option is string => typeof option === "string")
    : [];
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
    .filter(
      (session) =>
        session.client_id === row.id &&
        new Date(session.starts_at).getTime() >= Date.now() &&
        session.status === "scheduled",
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const next = formatNextSession(nextSession);
  const related = relationships.filter(
    (relationship) => relationship.client_id === row.id,
  );
  const guardians = related.filter(
    (relationship) => relationship.role === "guardian",
  );
  const careTeam = related.filter(
    (relationship) => relationship.role === "third_party",
  );
  const palette = ["#dedbd5", "#b9ddd2", "#f3c9ae", "#f0d8a9", "#c8d9f4"];

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
    joined: new Date(row.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    timezone:
      row.timezone.replaceAll("_", " ").split("/").at(-1) || row.timezone,
    headline: row.headline || "Add a short coaching focus for this client.",
    portalActive: Boolean(row.client_profile_id),
    goals: goals
      .filter((goal) => goal.client_id === row.id && goal.status === "active")
      .map((goal) => ({ title: goal.title, progress: goal.progress })),
    guardians: guardians.map((guardian) => ({
      id: guardian.id,
      name: guardian.full_name,
      email: guardian.email || "Email not set",
      relation: guardian.relation_label || "Guardian",
      initials: initials(guardian.full_name),
      permissions: permissionLabels(guardian.permissions),
      automaticAssignmentUpdates: guardian.automatic_assignment_updates,
      portalActive: Boolean(guardian.profile_id && guardian.portal_enabled),
    })),
    careTeam: careTeam.map((person) => ({
      id: person.id,
      name: person.full_name,
      email: person.email || "Email not set",
      role: person.relation_label || "Third party",
      initials: initials(person.full_name),
      permissions: permissionLabels(person.permissions),
      portalActive: Boolean(person.profile_id && person.portal_enabled),
    })),
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

function assignmentStatus(
  assignment: Database["public"]["Tables"]["assignments"]["Row"],
): Assignment["status"] {
  if (assignment.reviewed_at) return "Reviewed";
  if (assignment.status === "completed") return "Complete";
  if (assignment.status === "submitted") return "Submitted";
  if (assignment.due_at && new Date(assignment.due_at).getTime() < Date.now())
    return "Overdue";
  if (assignment.status === "in_progress") return "In progress";
  return "Not started";
}

async function loadPortalForUser(user: User): Promise<PracticeData> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ...initialData, connectionState: "unconfigured" };

  const [profileResult, clientSelfResult, relationshipResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("clients")
        .select("*")
        .eq("client_profile_id", user.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("client_relationships")
        .select("*")
        .eq("profile_id", user.id)
        .eq("portal_enabled", true)
        .limit(1)
        .maybeSingle(),
    ]);
  const discoveryError = [
    profileResult,
    clientSelfResult,
    relationshipResult,
  ].find((result) => result.error)?.error;
  if (discoveryError) throw discoveryError;

  const relationship = relationshipResult.data;
  let clientRow = clientSelfResult.data;
  if (!clientRow && relationship) {
    const { data: relatedClients, error } =
      await supabase.rpc("get_portal_client");
    if (error) throw error;
    clientRow =
      relatedClients?.find(
        (relatedClient) => relatedClient.id === relationship.client_id,
      ) || null;
  }

  const userName =
    profileResult.data?.full_name ||
    user.user_metadata.full_name ||
    user.email ||
    "Portal member";
  if (!clientRow) {
    return {
      ...initialData,
      clients: [],
      assignments: [],
      sessions: [],
      notes: [],
      invitations: [],
      resources: [],
      templates: [],
      integrations: [],
      mode: "supabase",
      connectionState: "connected",
      organizationId: null,
      userId: user.id,
      userEmail: user.email || null,
      userName,
      accountRole: "unlinked",
      portalClientId: null,
      portalRelationshipId: null,
      portalPermissions: [],
      error: null,
    };
  }

  const organizationId = clientRow.organization_id;
  const [
    goalsResult,
    relationshipsResult,
    sessionsResult,
    notesResult,
    assignmentsResult,
    responsesResult,
    assignmentFilesResult,
    resourcesResult,
  ] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("client_id", clientRow.id)
      .order("created_at"),
    supabase
      .from("client_relationships")
      .select("*")
      .eq("client_id", clientRow.id)
      .order("created_at"),
    supabase
      .from("sessions")
      .select("*")
      .eq("client_id", clientRow.id)
      .order("starts_at"),
    supabase
      .from("notes")
      .select("*")
      .eq("client_id", clientRow.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("assignments")
      .select("*")
      .eq("client_id", clientRow.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("assignment_responses")
      .select("*")
      .eq("client_id", clientRow.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("assignment_files")
      .select("*")
      .eq("client_id", clientRow.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("resources")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
  ]);
  const portalError = [
    goalsResult,
    relationshipsResult,
    sessionsResult,
    notesResult,
    assignmentsResult,
    responsesResult,
    assignmentFilesResult,
    resourcesResult,
  ].find((result) => result.error)?.error;
  if (portalError) throw portalError;

  const relatedRows =
    relationshipsResult.data || (relationship ? [relationship] : []);
  const mappedClient = mapClient(
    clientRow,
    goalsResult.data || [],
    relatedRows,
    sessionsResult.data || [],
    "Your coach",
    0,
  );
  const responseMap = new Map(
    (responsesResult.data || []).map((response: AssignmentResponseRow) => [
      response.assignment_id,
      response,
    ]),
  );
  const filesByAssignment = new Map<string, AssignmentFileRow[]>();
  for (const file of assignmentFilesResult.data || []) {
    const current = filesByAssignment.get(file.assignment_id) || [];
    current.push(file);
    filesByAssignment.set(file.assignment_id, current);
  }
  const autoGuardian = relatedRows.some(
    (item) => item.role === "guardian" && item.automatic_assignment_updates,
  );
  const accountRole: AccountRole = clientSelfResult.data
    ? "client"
    : relationship?.role === "guardian"
      ? "guardian"
      : relationship?.role === "third_party"
        ? "third_party"
        : "client";

  return {
    clients: [mappedClient],
    assignments: (assignmentsResult.data || []).map((assignment) => ({
      id: assignment.id,
      clientId: assignment.client_id,
      client: mappedClient.name,
      title: assignment.title,
      instructions: assignment.instructions || "",
      due: dueLabel(assignment.due_at),
      dueAt: assignment.due_at,
      required: assignment.is_required,
      status: assignmentStatus(assignment),
      visibility: visibilityToUi(assignment.visibility),
      responseType: assignment.response_type,
      responseText: responseMap.get(assignment.id)?.response_text || "",
      resourceId: assignment.resource_id,
      files: (filesByAssignment.get(assignment.id) || []).map(
        mapAssignmentFile,
      ),
      guardianShare: assignment.guardian_share_setting,
      guardianLogisticsShared:
        assignment.guardian_share_setting === "share" ||
        (assignment.guardian_share_setting === "client_default" &&
          autoGuardian),
    })),
    sessions: (sessionsResult.data || []).map((session) => ({
      id: session.id,
      clientId: session.client_id,
      client: mappedClient.name,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      status: session.status as PracticeSession["status"],
      meetingProvider: session.meeting_provider,
      meetingUrl: session.meeting_url,
      nextSessionAt: session.next_session_at,
    })),
    notes: (notesResult.data || []).map((note) => ({
      id: note.id,
      clientId: note.client_id,
      body: note.body,
      visibility: visibilityToUi(note.visibility),
      type: note.note_type,
      createdAt: note.created_at,
    })),
    invitations: [],
    resources: (resourcesResult.data || []).map((resource, index) => ({
      id: resource.id,
      title: resource.title,
      description: resource.description || "",
      type: resource.resource_type,
      size: fileSizeLabel(resource.byte_size),
      byteSize: resource.byte_size || 0,
      assigned: 1,
      color: ["lavender", "peach", "sage", "blue"][index % 4],
      storagePath: resource.storage_path,
      externalUrl: resource.external_url,
      mimeType: resource.mime_type,
      createdAt: resource.created_at,
    })),
    templates: [],
    integrations: [],
    bookingPage: null,
    bookingRequests: [],
    mode: "supabase",
    connectionState: "connected",
    organizationId,
    userId: user.id,
    userEmail: user.email || null,
    userName,
    accountRole,
    portalClientId: clientRow.id,
    portalRelationshipId: relationship?.id || null,
    portalPermissions: relationship
      ? permissionLabels(relationship.permissions)
      : ["Scheduling", "Assignments", "Goals", "Resources"],
    error: null,
  };
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
  if (!membership) return loadPortalForUser(user);

  const organizationId = membership.organization_id;
  const [
    profileResult,
    clientsResult,
    goalsResult,
    relationshipsResult,
    sessionsResult,
    notesResult,
    assignmentsResult,
    assignmentResponsesResult,
    assignmentFilesResult,
    resourcesResult,
    resourceAssignmentsResult,
    templatesResult,
    invitationsResult,
    integrationsResult,
    bookingPageResult,
    bookingQuestionsResult,
    bookingRequestsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("*")
      .eq("organization_id", organizationId)
      .order("full_name"),
    supabase
      .from("goals")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at"),
    supabase
      .from("client_relationships")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at"),
    supabase
      .from("sessions")
      .select("*")
      .eq("organization_id", organizationId)
      .order("starts_at"),
    supabase
      .from("notes")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("assignments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("assignment_responses")
      .select("*")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("assignment_files")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("resources")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase.from("resource_assignments").select("resource_id, client_id"),
    supabase
      .from("templates")
      .select("*")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("portal_invitations")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("integration_connections")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("profile_id", user.id)
      .order("provider"),
    supabase
      .from("booking_pages")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("coach_id", user.id)
      .maybeSingle(),
    supabase
      .from("booking_questions")
      .select("*")
      .order("sort_order"),
    supabase
      .from("booking_requests")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("coach_id", user.id)
      .order("starts_at", { ascending: true }),
  ]);

  const firstError = [
    profileResult,
    clientsResult,
    goalsResult,
    relationshipsResult,
    sessionsResult,
    notesResult,
    assignmentsResult,
    assignmentResponsesResult,
    assignmentFilesResult,
    resourcesResult,
    resourceAssignmentsResult,
    templatesResult,
    invitationsResult,
    integrationsResult,
    bookingPageResult,
    bookingQuestionsResult,
    bookingRequestsResult,
  ].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const coachName =
    profileResult.data?.full_name ||
    user.user_metadata.full_name ||
    user.email ||
    "Your coach";
  const mappedClients = (clientsResult.data || []).map((client, index) =>
    mapClient(
      client,
      goalsResult.data || [],
      relationshipsResult.data || [],
      sessionsResult.data || [],
      coachName,
      index,
    ),
  );
  const names = new Map(
    mappedClients.map((client) => [client.id, client.name]),
  );
  const responses = new Map(
    (assignmentResponsesResult.data || []).map(
      (response: AssignmentResponseRow) => [response.assignment_id, response],
    ),
  );
  const filesByAssignment = new Map<string, AssignmentFileRow[]>();
  for (const file of assignmentFilesResult.data || []) {
    const current = filesByAssignment.get(file.assignment_id) || [];
    current.push(file);
    filesByAssignment.set(file.assignment_id, current);
  }
  const resourceAssignmentCounts = new Map<string, number>();
  for (const assignment of resourceAssignmentsResult.data || [])
    resourceAssignmentCounts.set(
      assignment.resource_id,
      (resourceAssignmentCounts.get(assignment.resource_id) || 0) + 1,
    );
  const autoGuardianClients = new Set(
    (relationshipsResult.data || [])
      .filter(
        (relationship) =>
          relationship.role === "guardian" &&
          relationship.automatic_assignment_updates,
      )
      .map((relationship) => relationship.client_id),
  );

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
      resourceId: assignment.resource_id,
      files: (filesByAssignment.get(assignment.id) || []).map(
        mapAssignmentFile,
      ),
      guardianShare: assignment.guardian_share_setting,
      guardianLogisticsShared:
        assignment.guardian_share_setting === "share" ||
        (assignment.guardian_share_setting === "client_default" &&
          autoGuardianClients.has(assignment.client_id)),
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
    notes: (notesResult.data || []).map((note) => ({
      id: note.id,
      clientId: note.client_id,
      body: note.body,
      visibility: visibilityToUi(note.visibility),
      type: note.note_type,
      createdAt: note.created_at,
    })),
    invitations: (invitationsResult.data || []).map((invitation) => ({
      id: invitation.id,
      clientId: invitation.client_id,
      relationshipId: invitation.relationship_id,
      email: invitation.email,
      fullName: invitation.full_name,
      role: invitation.role,
      token: invitation.token,
      expiresAt: invitation.expires_at,
      acceptedAt: invitation.accepted_at,
      revokedAt: invitation.revoked_at,
    })),
    resources: (resourcesResult.data || []).map((resource, index) => ({
      id: resource.id,
      title: resource.title,
      description: resource.description || "",
      type: resource.resource_type,
      size: fileSizeLabel(resource.byte_size),
      byteSize: resource.byte_size || 0,
      assigned: resourceAssignmentCounts.get(resource.id) || 0,
      color: ["lavender", "peach", "sage", "blue", "yellow", "rose"][index % 6],
      storagePath: resource.storage_path,
      externalUrl: resource.external_url,
      mimeType: resource.mime_type,
      createdAt: resource.created_at,
    })),
    templates: (templatesResult.data || []).map((template) => {
      const definition =
        template.definition &&
        !Array.isArray(template.definition) &&
        typeof template.definition === "object"
          ? template.definition
          : {};
      const steps = Array.isArray(definition.steps)
        ? definition.steps.length
        : 0;
      return {
        title: template.name,
        type: template.template_type,
        steps,
        updated: new Date(template.updated_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        icon: "sparkles",
      };
    }),
    integrations: (integrationsResult.data || []).map((integration) => ({
      id: integration.id,
      provider: integration.provider,
      status: integration.status,
      accountEmail: integration.account_email,
      scopes: integration.scopes,
      syncEnabled: integration.sync_enabled,
      autoAddMeeting: integration.auto_add_meeting,
      defaultForScheduling: integration.default_for_scheduling,
      lastSyncedAt: integration.last_synced_at,
      updatedAt: integration.updated_at,
    })),
    bookingPage: bookingPageResult.data
      ? {
          id: bookingPageResult.data.id,
          slug: bookingPageResult.data.slug,
          brandName: bookingPageResult.data.brand_name,
          title: bookingPageResult.data.title,
          description: bookingPageResult.data.description,
          accentColor: bookingPageResult.data.accent_color,
          durationMinutes: bookingPageResult.data.duration_minutes,
          locationType: bookingPageResult.data.location_type,
          availability: bookingAvailability(
            bookingPageResult.data.availability,
          ),
          minimumNoticeHours: bookingPageResult.data.minimum_notice_hours,
          active: bookingPageResult.data.is_active,
          questions: (bookingQuestionsResult.data || [])
            .filter(
              (question) =>
                question.booking_page_id === bookingPageResult.data?.id,
            )
            .map((question) => ({
              id: question.id,
              label: question.label,
              type: question.question_type,
              required: question.is_required,
              options: stringOptions(question.options),
            })),
        }
      : null,
    bookingRequests: (bookingRequestsResult.data || []).map((request) => ({
      id: request.id,
      guestName: request.guest_name,
      guestEmail: request.guest_email,
      guestPhone: request.guest_phone,
      startsAt: request.starts_at,
      endsAt: request.ends_at,
      guestTimezone: request.guest_timezone,
      answers: request.answers,
      status: request.status,
      createdAt: request.created_at,
    })),
    mode: "supabase",
    connectionState: "connected",
    organizationId,
    userId: user.id,
    userEmail: user.email || null,
    userName: coachName,
    accountRole: "coach",
    portalClientId: null,
    portalRelationshipId: null,
    portalPermissions: [],
    error: null,
  };
}

export function usePracticeData() {
  const [data, setData] = useState<PracticeData>(initialData);
  const [needsPasswordUpdate, setNeedsPasswordUpdate] = useState(false);
  const [invitationPreview, setInvitationPreview] =
    useState<PortalInvitationPreview | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setData({ ...initialData, connectionState: "unconfigured" });
      return;
    }

    setData((current) => ({
      ...current,
      connectionState: "loading",
      error: null,
    }));
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setData({ ...initialData, connectionState: "signed_out" });
      return;
    }

    try {
      setData(await loadForUser(authData.user));
    } catch (error) {
      setData({
        ...initialData,
        connectionState: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Supabase data.",
      });
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const inviteToken = url.searchParams.get("invite");
    const supabase = getSupabaseBrowserClient();
    if (inviteToken && supabase) {
      void supabase
        .rpc("get_portal_invitation", { invite_token: inviteToken })
        .then(({ data: invitationData, error: previewError }) => {
          if (previewError) setInvitationError(previewError.message);
          const invitation = invitationData?.[0];
          if (invitation)
            setInvitationPreview({
              invitationId: invitation.invitation_id,
              email: invitation.email,
              fullName: invitation.full_name,
              role: invitation.role,
              clientName: invitation.client_name,
              expiresAt: invitation.expires_at,
              acceptedAt: invitation.accepted_at,
            });
          if (!invitation && !previewError)
            setInvitationError("This invitation is no longer available.");
        });
    }
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const authType = hash.get("type") || url.searchParams.get("type");
    if (authType === "invite" || authType === "recovery")
      window.setTimeout(() => setNeedsPasswordUpdate(true), 0);
    const callbackError =
      url.searchParams.get("error_description") ||
      hash.get("error_description");
    if (callbackError) {
      window.setTimeout(
        () =>
          setData({
            ...initialData,
            connectionState: "signed_out",
            error: callbackError.replaceAll("+", " "),
          }),
        0,
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      window.setTimeout(() => void refresh(), 0);
    }

    if (!supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (callbackError && event === "INITIAL_SESSION") return;
      if (event === "PASSWORD_RECOVERY") setNeedsPasswordUpdate(true);
      window.setTimeout(() => void refresh(), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase)
        throw new Error(
          "Add the Supabase URL and anon key to .env.local first.",
        );
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

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

  const signUp = useCallback(
    async (
      fullName: string,
      email: string,
      password: string,
      accountType: "coach" | "portal" = "coach",
    ) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: invitationPreview
            ? `${window.location.origin}/?invite=${new URL(window.location.href).searchParams.get("invite")}`
            : window.location.origin,
          data: { full_name: fullName, account_type: accountType },
        },
      });
      if (error) throw error;
      if (authData.session) await refresh();
      return { requiresEmailConfirmation: !authData.session };
    },
    [invitationPreview, refresh],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(
    async (password: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setNeedsPasswordUpdate(false);
      window.history.replaceState({}, document.title, window.location.pathname);
      await refresh();
    },
    [refresh],
  );

  const createSession = useCallback(
    async (input: {
      clientId: string;
      startsAt: string;
      durationMinutes: number;
      meetingProvider: "google_meet" | "zoom" | "other" | null;
    }) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !data.organizationId || !data.userId)
        throw new Error("Sign in to schedule a session.");
      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(
        startsAt.getTime() + input.durationMinutes * 60_000,
      );
      const { error } = await supabase.from("sessions").insert({
        organization_id: data.organizationId,
        client_id: input.clientId,
        coach_id: data.userId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        meeting_provider: input.meetingProvider,
      });
      if (error) throw error;
      await refresh();
    },
    [data.organizationId, data.userId, refresh],
  );

  const createAssignment = useCallback(
    async (input: {
      clientId: string;
      title: string;
      instructions: string;
      responseType: "checkbox" | "text" | "file";
      required: boolean;
      dueAt: string | null;
      guardianShare: "client_default" | "share" | "private";
      resourceId?: string | null;
    }) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !data.organizationId || !data.userId)
        throw new Error("Sign in to create an assignment.");
      const { error } = await supabase.from("assignments").insert({
        organization_id: data.organizationId,
        client_id: input.clientId,
        assigned_by: data.userId,
        title: input.title,
        instructions: input.instructions || null,
        response_type: input.responseType,
        assignment_type:
          input.responseType === "text"
            ? "reflection"
            : input.responseType === "file"
              ? "upload"
              : "task",
        resource_id: input.resourceId || null,
        is_required: input.required,
        due_at: input.dueAt,
        status: "not_started",
        visibility: "coach_client",
        guardian_share_setting: input.guardianShare,
      });
      if (error) throw error;
      await refresh();
    },
    [data.organizationId, data.userId, refresh],
  );

  const uploadResource = useCallback(
    async (input: { file: File; title: string; description: string }) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !data.organizationId || !data.userId)
        throw new Error("Sign in to upload a resource.");
      validateFile(input.file, RESOURCE_MIME_TYPES);
      const storagePath = `${data.organizationId}/library/${crypto.randomUUID()}`;
      const { error: uploadError } = await supabase.storage
        .from("soli-resources")
        .upload(storagePath, input.file, {
          contentType: input.file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("resources").insert({
        organization_id: data.organizationId,
        created_by: data.userId,
        title: input.title.trim() || input.file.name,
        description: input.description.trim() || null,
        resource_type: resourceType(input.file),
        storage_path: storagePath,
        mime_type: input.file.type,
        byte_size: input.file.size,
      });
      if (error) {
        await supabase.storage.from("soli-resources").remove([storagePath]);
        throw error;
      }
      await refresh();
    },
    [data.organizationId, data.userId, refresh],
  );

  const getResourceUrl = useCallback(async (resource: Resource) => {
    if (resource.externalUrl) return resource.externalUrl;
    if (!resource.storagePath) throw new Error("This resource has no file.");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data: signed, error } = await supabase.storage
      .from("soli-resources")
      .createSignedUrl(resource.storagePath, 60);
    if (error) throw error;
    return signed.signedUrl;
  }, []);

  const assignResourceAsHomework = useCallback(
    async (input: {
      resource: Resource;
      clientId: string;
      dueAt: string | null;
      required: boolean;
      responseType: "checkbox" | "file";
      instructions: string;
      guardianShare: "client_default" | "share" | "private";
    }) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !data.organizationId || !data.userId)
        throw new Error("Sign in to assign a resource.");
      const { error: shareError } = await supabase
        .from("resource_assignments")
        .upsert(
          {
            resource_id: input.resource.id,
            client_id: input.clientId,
            assigned_by: data.userId,
            visibility: "coach_client",
          },
          { onConflict: "resource_id,client_id" },
        );
      if (shareError) throw shareError;
      await createAssignment({
        clientId: input.clientId,
        title: input.resource.title,
        instructions:
          input.instructions.trim() ||
          `Review ${input.resource.title} and complete the requested follow-up.`,
        responseType: input.responseType,
        required: input.required,
        dueAt: input.dueAt,
        guardianShare: input.guardianShare,
        resourceId: input.resource.id,
      });
    },
    [createAssignment, data.organizationId, data.userId],
  );

  const uploadAssignmentFile = useCallback(
    async (assignment: Assignment, file: File) => {
      const supabase = getSupabaseBrowserClient();
      if (
        !supabase ||
        !data.organizationId ||
        !data.userId ||
        data.accountRole !== "client"
      )
        throw new Error("Only the client can upload homework from the portal.");
      validateFile(file, HOMEWORK_MIME_TYPES);
      const storagePath = `${data.organizationId}/${assignment.clientId}/${assignment.id}/${crypto.randomUUID()}`;
      const { error: uploadError } = await supabase.storage
        .from("soli-homework")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: recordError } = await supabase
        .from("assignment_files")
        .insert({
          organization_id: data.organizationId,
          assignment_id: assignment.id,
          client_id: assignment.clientId,
          uploaded_by: data.userId,
          storage_path: storagePath,
          original_filename: file.name,
          mime_type: file.type,
          byte_size: file.size,
        });
      if (recordError) {
        await supabase.storage.from("soli-homework").remove([storagePath]);
        throw recordError;
      }
      const { error } = await supabase.rpc("submit_portal_assignment", {
        target_assignment: assignment.id,
        response_value: "",
        is_completed: true,
      });
      if (error) throw error;
      await refresh();
    },
    [data.accountRole, data.organizationId, data.userId, refresh],
  );

  const getAssignmentFileUrl = useCallback(async (storagePath: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data: signed, error } = await supabase.storage
      .from("soli-homework")
      .createSignedUrl(storagePath, 60);
    if (error) throw error;
    return signed.signedUrl;
  }, []);

  const connectIntegration = useCallback((provider: "google" | "zoom") => {
    window.location.assign(`/api/integrations/${provider}/start`);
  }, []);

  const updateIntegrationPreferences = useCallback(
    async (input: {
      connectionId: string;
      syncEnabled: boolean;
      autoAddMeeting: boolean;
      defaultForScheduling: boolean;
    }) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase.rpc("update_integration_preferences", {
        target_connection: input.connectionId,
        target_sync_enabled: input.syncEnabled,
        target_auto_add_meeting: input.autoAddMeeting,
        target_default_for_scheduling: input.defaultForScheduling,
      });
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const disconnectIntegration = useCallback(
    async (connectionId: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase.rpc("disconnect_integration", {
        target_connection: connectionId,
      });
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const completeSession = useCallback(
    async (input: {
      sessionId: string | null;
      clientId: string;
      attendance: "attended" | "late_cancel" | "no_show";
      notes: string;
      noteVisibility: Visibility;
      sharedSummary: string;
      nextSessionAt: string | null;
      assignment: null | {
        title: string;
        instructions: string;
        responseType: "checkbox" | "text";
        required: boolean;
        dueAt: string | null;
        guardianShare: "client_default" | "share" | "private";
      };
    }) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !data.organizationId || !data.userId)
        throw new Error("Sign in to complete a session.");
      let sessionId = input.sessionId;
      if (!sessionId) {
        const now = new Date();
        const { data: created, error } = await supabase
          .from("sessions")
          .insert({
            organization_id: data.organizationId,
            client_id: input.clientId,
            coach_id: data.userId,
            starts_at: now.toISOString(),
            ends_at: new Date(now.getTime() + 50 * 60_000).toISOString(),
            status: input.attendance,
            next_session_at: input.nextSessionAt,
          })
          .select("id")
          .single();
        if (error) throw error;
        sessionId = created.id;
      } else {
        const { error } = await supabase
          .from("sessions")
          .update({
            status: input.attendance,
            next_session_at: input.nextSessionAt,
          })
          .eq("id", sessionId);
        if (error) throw error;
      }
      const notes: {
        body: string;
        visibility: VisibilityLevel;
        note_type: "coach_note" | "shared_note";
      }[] = [
        {
          body: input.notes,
          visibility: uiVisibilityToDatabase(input.noteVisibility),
          note_type: "coach_note",
        },
      ];
      if (input.sharedSummary.trim())
        notes.push({
          body: input.sharedSummary.trim(),
          visibility: "coach_client",
          note_type: "shared_note",
        });
      const { error: noteError } = await supabase.from("notes").insert(
        notes.map((note) => ({
          organization_id: data.organizationId!,
          client_id: input.clientId,
          session_id: sessionId,
          author_id: data.userId!,
          body: note.body,
          visibility: note.visibility as VisibilityLevel,
          note_type: note.note_type,
          ai_generated: false,
        })),
      );
      if (noteError) throw noteError;
      if (input.assignment?.title.trim())
        await createAssignment({
          clientId: input.clientId,
          ...input.assignment,
        });
      await refresh();
    },
    [createAssignment, data.organizationId, data.userId, refresh],
  );

  const updateGuardianAssignmentSharing = useCallback(
    async (relationshipId: string, enabled: boolean) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase
        .from("client_relationships")
        .update({ automatic_assignment_updates: enabled })
        .eq("id", relationshipId);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const submitAssignmentResponse = useCallback(
    async (
      assignment: Assignment,
      responseText: string,
      completed: boolean,
    ) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !data.organizationId)
        throw new Error("Sign in to submit an assignment.");
      if (data.accountRole === "client") {
        const { error } = await supabase.rpc("submit_portal_assignment", {
          target_assignment: assignment.id,
          response_value: responseText,
          is_completed: completed,
        });
        if (error) throw error;
        await refresh();
        return;
      }
      const now = new Date().toISOString();
      const { error: responseError } = await supabase
        .from("assignment_responses")
        .upsert(
          {
            organization_id: data.organizationId,
            assignment_id: assignment.id,
            client_id: assignment.clientId,
            submitted_by: data.userId,
            response_text: responseText,
            completed,
            visibility: "coach_client",
            submitted_at: now,
            updated_at: now,
          },
          { onConflict: "assignment_id" },
        );
      if (responseError) throw responseError;
      const { error } = await supabase
        .from("assignments")
        .update({
          status: completed ? "completed" : "submitted",
          submitted_at: now,
          completed_at: completed ? now : null,
        })
        .eq("id", assignment.id);
      if (error) throw error;
      await refresh();
    },
    [data.accountRole, data.organizationId, data.userId, refresh],
  );

  const reviewAssignment = useCallback(
    async (assignmentId: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase
        .from("assignments")
        .update({ reviewed_at: new Date().toISOString() })
        .eq("id", assignmentId);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const createPortalInvitation = useCallback(
    async (input: {
      clientId: string;
      relationshipId: string | null;
      email: string;
      fullName: string;
      role: "client" | "guardian" | "third_party";
    }) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !data.organizationId || !data.userId)
        throw new Error("Sign in as a coach to create an invitation.");
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
      const { error } = await supabase.from("portal_invitations").insert({
        organization_id: data.organizationId,
        client_id: input.clientId,
        relationship_id: input.relationshipId,
        email: input.email.trim().toLowerCase(),
        full_name: input.fullName.trim(),
        role: input.role,
        token,
        created_by: data.userId,
        expires_at: expiresAt,
      });
      if (error) throw error;
      await refresh();
      return `${window.location.origin}/?invite=${token}`;
    },
    [data.organizationId, data.userId, refresh],
  );

  const acceptPortalInvitation = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const inviteToken = new URL(window.location.href).searchParams.get(
      "invite",
    );
    if (!supabase || !inviteToken)
      throw new Error("This invitation link is missing its secure token.");
    const { error } = await supabase.rpc("claim_portal_invitation", {
      invite_token: inviteToken,
    });
    if (error) throw error;
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("invite");
    window.history.replaceState(
      {},
      document.title,
      `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`,
    );
    setInvitationPreview(null);
    setInvitationError(null);
    await refresh();
  }, [refresh]);

  const requestScheduleChange = useCallback(
    async (input: {
      sessionId: string | null;
      requestType: "reschedule" | "cancel" | "new_session";
      requestedStartsAt: string | null;
      message: string;
    }) => {
      const supabase = getSupabaseBrowserClient();
      if (
        !supabase ||
        !data.organizationId ||
        !data.userId ||
        !data.portalClientId
      )
        throw new Error(
          "Your portal account is not ready for scheduling requests.",
        );
      const { error } = await supabase.from("scheduling_requests").insert({
        organization_id: data.organizationId,
        client_id: data.portalClientId,
        session_id: input.sessionId,
        requested_by: data.userId,
        request_type: input.requestType,
        requested_starts_at: input.requestedStartsAt,
        message: input.message || null,
      });
      if (error) throw error;
    },
    [data.organizationId, data.portalClientId, data.userId],
  );

  const saveBookingPage = useCallback(
    async (page: Omit<BookingPage, "id">) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !data.organizationId)
        throw new Error("Sign in to publish a booking page.");
      const { error } = await supabase.rpc("save_booking_page", {
        target_organization: data.organizationId,
        target_slug: page.slug,
        target_brand_name: page.brandName,
        target_title: page.title,
        target_description: page.description,
        target_accent_color: page.accentColor,
        target_duration_minutes: page.durationMinutes,
        target_location_type: page.locationType,
        target_availability: page.availability,
        target_minimum_notice_hours: page.minimumNoticeHours,
        target_is_active: page.active,
        target_questions: page.questions.map((question) => ({
          label: question.label,
          type: question.type,
          required: question.required,
          options: question.options,
        })),
      });
      if (error) throw error;
      await refresh();
    },
    [data.organizationId, refresh],
  );

  const cancelBookingRequest = useCallback(
    async (requestId: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase
        .from("booking_requests")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return {
    ...data,
    needsPasswordUpdate,
    invitationPreview,
    invitationError,
    refresh,
    signIn,
    signInWithOAuth,
    signOut,
    signUp,
    requestPasswordReset,
    updatePassword,
    createSession,
    createAssignment,
    uploadResource,
    getResourceUrl,
    assignResourceAsHomework,
    uploadAssignmentFile,
    getAssignmentFileUrl,
    connectIntegration,
    updateIntegrationPreferences,
    disconnectIntegration,
    completeSession,
    updateGuardianAssignmentSharing,
    submitAssignmentResponse,
    reviewAssignment,
    createPortalInvitation,
    acceptPortalInvitation,
    requestScheduleChange,
    saveBookingPage,
    cancelBookingRequest,
  };
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
