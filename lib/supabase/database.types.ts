export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrganizationRole = "owner" | "admin" | "coach";
export type ClientKind = "adult" | "minor";
export type RelationshipRole = "client" | "guardian" | "third_party";
export type VisibilityLevel =
  "coach_only" | "coach_client" | "coach_parent" | "coach_client_parent";
export type AssignmentStatus =
  "not_started" | "in_progress" | "submitted" | "completed";

export type Database = {
  public: {
    Tables: {
      organization_members: {
        Row: {
          organization_id: string;
          profile_id: string;
          role: OrganizationRole;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          profile_id: string;
          role?: OrganizationRole;
          created_at?: string;
        };
        Update: { role?: OrganizationRole };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          created_at?: string;
        };
        Update: { name?: string; slug?: string; timezone?: string };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          full_name?: string;
          email?: string;
          phone?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          organization_id: string;
          assigned_coach_id: string;
          client_profile_id: string | null;
          kind: ClientKind;
          full_name: string;
          preferred_name: string | null;
          pronouns: string | null;
          birth_date: string | null;
          email: string | null;
          phone: string | null;
          timezone: string;
          status: string;
          headline: string | null;
          intake: Json;
          important_dates: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          assigned_coach_id: string;
          client_profile_id?: string | null;
          kind?: ClientKind;
          full_name: string;
          preferred_name?: string | null;
          pronouns?: string | null;
          birth_date?: string | null;
          email?: string | null;
          phone?: string | null;
          timezone?: string;
          status?: string;
          headline?: string | null;
          intake?: Json;
          important_dates?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      client_relationships: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          profile_id: string | null;
          full_name: string;
          email: string | null;
          role: RelationshipRole;
          relation_label: string | null;
          permissions: Json;
          portal_enabled: boolean;
          automatic_assignment_updates: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          profile_id?: string | null;
          full_name: string;
          email?: string | null;
          role: RelationshipRole;
          relation_label?: string | null;
          permissions?: Json;
          portal_enabled?: boolean;
          automatic_assignment_updates?: boolean;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["client_relationships"]["Insert"]
        >;
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          title: string;
          description: string | null;
          progress: number;
          visibility: VisibilityLevel;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          title: string;
          description?: string | null;
          progress?: number;
          visibility?: VisibilityLevel;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["goals"]["Insert"]>;
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          coach_id: string;
          starts_at: string;
          ends_at: string;
          status: string;
          meeting_provider: string | null;
          meeting_url: string | null;
          external_calendar_event_id: string | null;
          recurring_series_id: string | null;
          next_session_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          coach_id: string;
          starts_at: string;
          ends_at: string;
          status?: string;
          meeting_provider?: string | null;
          meeting_url?: string | null;
          external_calendar_event_id?: string | null;
          recurring_series_id?: string | null;
          next_session_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          session_id: string | null;
          author_id: string;
          body: string;
          visibility: VisibilityLevel;
          note_type: string;
          ai_generated: boolean;
          transcript_storage_path: string | null;
          client_consent_recorded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          session_id?: string | null;
          author_id: string;
          body: string;
          visibility?: VisibilityLevel;
          note_type?: string;
          ai_generated?: boolean;
          transcript_storage_path?: string | null;
          client_consent_recorded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notes"]["Insert"]>;
        Relationships: [];
      };
      assignments: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          assigned_by: string;
          title: string;
          instructions: string | null;
          assignment_type: string;
          response_type: "checkbox" | "text" | "file";
          resource_id: string | null;
          is_required: boolean;
          due_at: string | null;
          status: AssignmentStatus;
          response: Json | null;
          submitted_at: string | null;
          completed_at: string | null;
          reviewed_at: string | null;
          visibility: VisibilityLevel;
          guardian_share_setting: "client_default" | "share" | "private";
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          assigned_by: string;
          title: string;
          instructions?: string | null;
          assignment_type?: string;
          response_type?: "checkbox" | "text" | "file";
          resource_id?: string | null;
          is_required?: boolean;
          due_at?: string | null;
          status?: AssignmentStatus;
          response?: Json | null;
          submitted_at?: string | null;
          completed_at?: string | null;
          reviewed_at?: string | null;
          visibility?: VisibilityLevel;
          guardian_share_setting?: "client_default" | "share" | "private";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["assignments"]["Insert"]>;
        Relationships: [];
      };
      assignment_responses: {
        Row: {
          id: string;
          organization_id: string;
          assignment_id: string;
          client_id: string;
          submitted_by: string | null;
          response_text: string;
          completed: boolean;
          visibility: VisibilityLevel;
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          assignment_id: string;
          client_id: string;
          submitted_by?: string | null;
          response_text?: string;
          completed?: boolean;
          visibility?: VisibilityLevel;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["assignment_responses"]["Insert"]
        >;
        Relationships: [];
      };
      assignment_files: {
        Row: {
          id: string;
          organization_id: string;
          assignment_id: string;
          client_id: string;
          uploaded_by: string;
          storage_path: string;
          original_filename: string;
          mime_type: string;
          byte_size: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          assignment_id: string;
          client_id: string;
          uploaded_by: string;
          storage_path: string;
          original_filename: string;
          mime_type: string;
          byte_size: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["assignment_files"]["Insert"]
        >;
        Relationships: [];
      };
      integration_connections: {
        Row: {
          id: string;
          organization_id: string;
          profile_id: string;
          provider: "google" | "zoom";
          status: "connected" | "needs_attention" | "disconnected";
          account_email: string | null;
          external_account_id: string | null;
          scopes: string[];
          sync_enabled: boolean;
          auto_add_meeting: boolean;
          default_for_scheduling: boolean;
          token_expires_at: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          profile_id: string;
          provider: "google" | "zoom";
          status?: "connected" | "needs_attention" | "disconnected";
          account_email?: string | null;
          external_account_id?: string | null;
          scopes?: string[];
          sync_enabled?: boolean;
          auto_add_meeting?: boolean;
          default_for_scheduling?: boolean;
          token_expires_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["integration_connections"]["Insert"]
        >;
        Relationships: [];
      };
      integration_credentials: {
        Row: {
          connection_id: string;
          access_token_encrypted: string;
          refresh_token_encrypted: string | null;
          updated_at: string;
        };
        Insert: {
          connection_id: string;
          access_token_encrypted: string;
          refresh_token_encrypted?: string | null;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["integration_credentials"]["Insert"]
        >;
        Relationships: [];
      };
      resources: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string;
          title: string;
          description: string | null;
          resource_type: string;
          storage_path: string | null;
          external_url: string | null;
          mime_type: string | null;
          byte_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by: string;
          title: string;
          description?: string | null;
          resource_type: string;
          storage_path?: string | null;
          external_url?: string | null;
          mime_type?: string | null;
          byte_size?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["resources"]["Insert"]>;
        Relationships: [];
      };
      resource_assignments: {
        Row: {
          resource_id: string;
          client_id: string;
          assigned_by: string;
          visibility: VisibilityLevel;
          assigned_at: string;
        };
        Insert: {
          resource_id: string;
          client_id: string;
          assigned_by: string;
          visibility?: VisibilityLevel;
          assigned_at?: string;
        };
        Update: { visibility?: VisibilityLevel };
        Relationships: [];
      };
      portal_invitations: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          relationship_id: string | null;
          email: string;
          full_name: string;
          role: "client" | "guardian" | "third_party";
          token: string;
          created_by: string;
          expires_at: string;
          accepted_by: string | null;
          accepted_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          relationship_id?: string | null;
          email: string;
          full_name: string;
          role: "client" | "guardian" | "third_party";
          token?: string;
          created_by: string;
          expires_at?: string;
          accepted_by?: string | null;
          accepted_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          expires_at?: string;
          revoked_at?: string | null;
          accepted_by?: string | null;
          accepted_at?: string | null;
        };
        Relationships: [];
      };
      scheduling_requests: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          session_id: string | null;
          requested_by: string;
          request_type: "reschedule" | "cancel" | "new_session";
          requested_starts_at: string | null;
          message: string | null;
          status: "pending" | "approved" | "declined" | "withdrawn";
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          session_id?: string | null;
          requested_by: string;
          request_type: "reschedule" | "cancel" | "new_session";
          requested_starts_at?: string | null;
          message?: string | null;
          status?: "pending" | "approved" | "declined" | "withdrawn";
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          status?: "pending" | "approved" | "declined" | "withdrawn";
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      portal_audit_events: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          actor_profile_id: string | null;
          event_type: string;
          subject_type: string;
          subject_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          actor_profile_id?: string | null;
          event_type: string;
          subject_type: string;
          subject_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      templates: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string;
          name: string;
          template_type: string;
          definition: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by: string;
          name: string;
          template_type: string;
          definition?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["templates"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_portal_client: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["clients"]["Row"][];
      };
      get_portal_invitation: {
        Args: { invite_token: string };
        Returns: {
          invitation_id: string;
          email: string;
          full_name: string;
          role: "client" | "guardian" | "third_party";
          client_name: string;
          expires_at: string;
          accepted_at: string | null;
        }[];
      };
      claim_portal_invitation: {
        Args: { invite_token: string };
        Returns: string;
      };
      submit_portal_assignment: {
        Args: {
          target_assignment: string;
          response_value: string;
          is_completed: boolean;
        };
        Returns: string;
      };
      save_integration_oauth_connection: {
        Args: {
          target_organization: string;
          target_provider: string;
          target_account_email: string;
          target_external_account_id: string;
          target_scopes: string[];
          encrypted_access_token: string;
          encrypted_refresh_token: string;
          target_token_expires_at: string | null;
        };
        Returns: string;
      };
      update_integration_preferences: {
        Args: {
          target_connection: string;
          target_sync_enabled: boolean;
          target_auto_add_meeting: boolean;
          target_default_for_scheduling: boolean;
        };
        Returns: undefined;
      };
      disconnect_integration: {
        Args: { target_connection: string };
        Returns: undefined;
      };
    };
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
