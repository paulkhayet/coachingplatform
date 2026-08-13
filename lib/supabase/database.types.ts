export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrganizationRole = "owner" | "admin" | "coach";
export type ClientKind = "adult" | "minor";
export type RelationshipRole = "client" | "guardian" | "third_party";
export type VisibilityLevel = "coach_only" | "coach_client" | "coach_parent" | "coach_client_parent";
export type AssignmentStatus = "not_started" | "in_progress" | "submitted" | "completed";

export type Database = {
  public: {
    Tables: {
      organization_members: {
        Row: { organization_id: string; profile_id: string; role: OrganizationRole; created_at: string };
        Insert: { organization_id: string; profile_id: string; role?: OrganizationRole; created_at?: string };
        Update: { role?: OrganizationRole };
        Relationships: [];
      };
      organizations: {
        Row: { id: string; name: string; slug: string; timezone: string; created_at: string };
        Insert: { id?: string; name: string; slug: string; timezone?: string; created_at?: string };
        Update: { name?: string; slug?: string; timezone?: string };
        Relationships: [];
      };
      profiles: {
        Row: { id: string; full_name: string; email: string; phone: string | null; avatar_url: string | null; created_at: string };
        Insert: { id: string; full_name: string; email: string; phone?: string | null; avatar_url?: string | null; created_at?: string };
        Update: { full_name?: string; email?: string; phone?: string | null; avatar_url?: string | null };
        Relationships: [];
      };
      clients: {
        Row: { id: string; organization_id: string; assigned_coach_id: string; client_profile_id: string | null; kind: ClientKind; full_name: string; preferred_name: string | null; pronouns: string | null; birth_date: string | null; email: string | null; phone: string | null; timezone: string; status: string; headline: string | null; intake: Json; important_dates: Json; created_at: string; updated_at: string };
        Insert: { id?: string; organization_id: string; assigned_coach_id: string; client_profile_id?: string | null; kind?: ClientKind; full_name: string; preferred_name?: string | null; pronouns?: string | null; birth_date?: string | null; email?: string | null; phone?: string | null; timezone?: string; status?: string; headline?: string | null; intake?: Json; important_dates?: Json; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      client_relationships: {
        Row: { id: string; organization_id: string; client_id: string; profile_id: string | null; full_name: string; email: string | null; role: RelationshipRole; relation_label: string | null; permissions: Json; portal_enabled: boolean; created_at: string };
        Insert: { id?: string; organization_id: string; client_id: string; profile_id?: string | null; full_name: string; email?: string | null; role: RelationshipRole; relation_label?: string | null; permissions?: Json; portal_enabled?: boolean; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["client_relationships"]["Insert"]>;
        Relationships: [];
      };
      goals: {
        Row: { id: string; organization_id: string; client_id: string; title: string; description: string | null; progress: number; visibility: VisibilityLevel; status: string; created_at: string };
        Insert: { id?: string; organization_id: string; client_id: string; title: string; description?: string | null; progress?: number; visibility?: VisibilityLevel; status?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["goals"]["Insert"]>;
        Relationships: [];
      };
      sessions: {
        Row: { id: string; organization_id: string; client_id: string; coach_id: string; starts_at: string; ends_at: string; status: string; meeting_provider: string | null; meeting_url: string | null; external_calendar_event_id: string | null; recurring_series_id: string | null; next_session_at: string | null; created_at: string };
        Insert: { id?: string; organization_id: string; client_id: string; coach_id: string; starts_at: string; ends_at: string; status?: string; meeting_provider?: string | null; meeting_url?: string | null; external_calendar_event_id?: string | null; recurring_series_id?: string | null; next_session_at?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
        Relationships: [];
      };
      notes: {
        Row: { id: string; organization_id: string; client_id: string; session_id: string | null; author_id: string; body: string; visibility: VisibilityLevel; note_type: string; ai_generated: boolean; transcript_storage_path: string | null; client_consent_recorded_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; organization_id: string; client_id: string; session_id?: string | null; author_id: string; body: string; visibility?: VisibilityLevel; note_type?: string; ai_generated?: boolean; transcript_storage_path?: string | null; client_consent_recorded_at?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["notes"]["Insert"]>;
        Relationships: [];
      };
      assignments: {
        Row: { id: string; organization_id: string; client_id: string; assigned_by: string; title: string; instructions: string | null; assignment_type: string; is_required: boolean; due_at: string | null; status: AssignmentStatus; response: Json | null; submitted_at: string | null; completed_at: string | null; visibility: VisibilityLevel; created_at: string };
        Insert: { id?: string; organization_id: string; client_id: string; assigned_by: string; title: string; instructions?: string | null; assignment_type?: string; is_required?: boolean; due_at?: string | null; status?: AssignmentStatus; response?: Json | null; submitted_at?: string | null; completed_at?: string | null; visibility?: VisibilityLevel; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["assignments"]["Insert"]>;
        Relationships: [];
      };
      resources: {
        Row: { id: string; organization_id: string; created_by: string; title: string; description: string | null; resource_type: string; storage_path: string | null; external_url: string | null; mime_type: string | null; byte_size: number | null; created_at: string };
        Insert: { id?: string; organization_id: string; created_by: string; title: string; description?: string | null; resource_type: string; storage_path?: string | null; external_url?: string | null; mime_type?: string | null; byte_size?: number | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["resources"]["Insert"]>;
        Relationships: [];
      };
      templates: {
        Row: { id: string; organization_id: string; created_by: string; name: string; template_type: string; definition: Json; created_at: string; updated_at: string };
        Insert: { id?: string; organization_id: string; created_by: string; name: string; template_type: string; definition?: Json; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["templates"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      organization_role: OrganizationRole;
      client_kind: ClientKind;
      relationship_role: RelationshipRole;
      visibility_level: VisibilityLevel;
      assignment_status: AssignmentStatus;
      payment_status: "draft" | "open" | "paid" | "past_due" | "void";
    };
    CompositeTypes: Record<string, never>;
  };
};
