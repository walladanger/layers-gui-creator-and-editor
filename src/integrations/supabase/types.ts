export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_tokens: {
        Row: {
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          project_id: string
          revoked_at: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          last_used_at?: string | null
          project_id: string
          revoked_at?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          project_id?: string
          revoked_at?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      annotations: {
        Row: {
          color: string | null
          comment_id: string | null
          created_at: string
          frame_id: string
          id: string
          shapes: Json
          updated_at: string
        }
        Insert: {
          color?: string | null
          comment_id?: string | null
          created_at?: string
          frame_id: string
          id?: string
          shapes?: Json
          updated_at?: string
        }
        Update: {
          color?: string | null
          comment_id?: string | null
          created_at?: string
          frame_id?: string
          id?: string
          shapes?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotations_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "frames"
            referencedColumns: ["id"]
          },
        ]
      }
      change_records: {
        Row: {
          after: Json | null
          before: Json | null
          created_at: string
          css: string | null
          frame_id: string | null
          id: string
          kind: string
          screenshot_after: string | null
          screenshot_before: string | null
          session_id: string
          superseded_by: string | null
          tailwind_hint: string | null
          target: Json
          updated_at: string
        }
        Insert: {
          after?: Json | null
          before?: Json | null
          created_at?: string
          css?: string | null
          frame_id?: string | null
          id?: string
          kind: string
          screenshot_after?: string | null
          screenshot_before?: string | null
          session_id: string
          superseded_by?: string | null
          tailwind_hint?: string | null
          target?: Json
          updated_at?: string
        }
        Update: {
          after?: Json | null
          before?: Json | null
          created_at?: string
          css?: string | null
          frame_id?: string | null
          id?: string
          kind?: string
          screenshot_after?: string | null
          screenshot_before?: string | null
          session_id?: string
          superseded_by?: string | null
          tailwind_hint?: string | null
          target?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_records_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "frames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_records_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "change_records"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_replies: {
        Row: {
          author_id: string | null
          author_kind: string
          comment_id: string
          created_at: string
          id: string
          text: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_kind?: string
          comment_id: string
          created_at?: string
          id?: string
          text: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_kind?: string
          comment_id?: string
          created_at?: string
          id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_replies_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_kind: string
          created_at: string
          frame_id: string | null
          id: string
          project_id: string
          px: number | null
          py: number | null
          session_id: string | null
          status: string
          target: Json
          text: string
          updated_at: string
        }
        Insert: {
          author_kind?: string
          created_at?: string
          frame_id?: string | null
          id?: string
          project_id: string
          px?: number | null
          py?: number | null
          session_id?: string | null
          status?: string
          target?: Json
          text: string
          updated_at?: string
        }
        Update: {
          author_kind?: string
          created_at?: string
          frame_id?: string | null
          id?: string
          project_id?: string
          px?: number | null
          py?: number | null
          session_id?: string | null
          status?: string
          target?: Json
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "frames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      design_tokens: {
        Row: {
          created_at: string
          group: string
          id: string
          name: string
          project_id: string
          source: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          group: string
          id?: string
          name: string
          project_id: string
          source?: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          group?: string
          id?: string
          name?: string
          project_id?: string
          source?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      frames: {
        Row: {
          breakpoint: string
          canvas_x: number
          canvas_y: number
          created_at: string
          height: number
          id: string
          label: string | null
          project_id: string
          route: string
          updated_at: string
          width: number
        }
        Insert: {
          breakpoint?: string
          canvas_x?: number
          canvas_y?: number
          created_at?: string
          height?: number
          id?: string
          label?: string | null
          project_id: string
          route?: string
          updated_at?: string
          width?: number
        }
        Update: {
          breakpoint?: string
          canvas_x?: number
          canvas_y?: number
          created_at?: string
          height?: number
          id?: string
          label?: string | null
          project_id?: string
          route?: string
          updated_at?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "frames_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      looks: {
        Row: {
          created_at: string
          edits: Json
          id: string
          name: string
          project_id: string
          style: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          edits?: Json
          id?: string
          name: string
          project_id: string
          style?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          edits?: Json
          id?: string
          name?: string
          project_id?: string
          style?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "looks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      production_items: {
        Row: {
          acceptance: string[]
          agent: string | null
          agent_note: string | null
          change_record_ids: string[]
          component: string | null
          created_at: string
          file: string | null
          id: string
          instructions: string | null
          line: number | null
          list_id: string
          pr_url: string | null
          priority: string
          seq: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          acceptance?: string[]
          agent?: string | null
          agent_note?: string | null
          change_record_ids?: string[]
          component?: string | null
          created_at?: string
          file?: string | null
          id?: string
          instructions?: string | null
          line?: number | null
          list_id: string
          pr_url?: string | null
          priority?: string
          seq: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          acceptance?: string[]
          agent?: string | null
          agent_note?: string | null
          change_record_ids?: string[]
          component?: string | null
          created_at?: string
          file?: string | null
          id?: string
          instructions?: string | null
          line?: number | null
          list_id?: string
          pr_url?: string | null
          priority?: string
          seq?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "production_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      production_lists: {
        Row: {
          created_at: string
          id: string
          json: Json | null
          markdown: string | null
          session_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          json?: Json | null
          markdown?: string | null
          session_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          json?: Json | null
          markdown?: string | null
          session_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_lists_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          design_md: string | null
          framework: string | null
          id: string
          name: string
          owner_id: string
          repo_url: string | null
          target_mode: string
          target_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          design_md?: string | null
          framework?: string | null
          id?: string
          name: string
          owner_id?: string
          repo_url?: string | null
          target_mode?: string
          target_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          design_md?: string | null
          framework?: string | null
          id?: string
          name?: string
          owner_id?: string
          repo_url?: string | null
          target_mode?: string
          target_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          base_commit: string | null
          created_at: string
          id: string
          name: string
          parent_session_id: string | null
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          base_commit?: string | null
          created_at?: string
          id?: string
          name: string
          parent_session_id?: string | null
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          base_commit?: string | null
          created_at?: string
          id?: string
          name?: string
          parent_session_id?: string | null
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_project: { Args: { _project_id: string }; Returns: boolean }
      can_read_project: { Args: { _project_id: string }; Returns: boolean }
      comment_project: { Args: { _comment_id: string }; Returns: string }
      frame_project: { Args: { _frame_id: string }; Returns: string }
      is_project_owner: { Args: { _project_id: string }; Returns: boolean }
      list_project: { Args: { _list_id: string }; Returns: string }
      session_project: { Args: { _session_id: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
