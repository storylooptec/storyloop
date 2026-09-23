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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          company_id: string
          created_at: string
          duration_minutes: number | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_reversible: boolean
          metadata: Json
          status: Database["public"]["Enums"]["audit_event_status"]
          undo_action_key: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          company_id: string
          created_at?: string
          duration_minutes?: number | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_reversible?: boolean
          metadata?: Json
          status?: Database["public"]["Enums"]["audit_event_status"]
          undo_action_key?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          company_id?: string
          created_at?: string
          duration_minutes?: number | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_reversible?: boolean
          metadata?: Json
          status?: Database["public"]["Enums"]["audit_event_status"]
          undo_action_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_brand_settings: {
        Row: {
          company_id: string
          dark_colors: Json
          dark_logo_key: string | null
          dark_logo_meta: Json | null
          default_theme: string
          favicon_key: string | null
          favicon_meta: Json | null
          gradient: Json
          light_colors: Json
          light_logo_key: string | null
          light_logo_meta: Json | null
          primary_logo_key: string | null
          primary_logo_meta: Json | null
          radius: Json
          spacing: number[]
          typography: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          dark_colors: Json
          dark_logo_key?: string | null
          dark_logo_meta?: Json | null
          default_theme?: string
          favicon_key?: string | null
          favicon_meta?: Json | null
          gradient: Json
          light_colors: Json
          light_logo_key?: string | null
          light_logo_meta?: Json | null
          primary_logo_key?: string | null
          primary_logo_meta?: Json | null
          radius?: Json
          spacing?: number[]
          typography: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          dark_colors?: Json
          dark_logo_key?: string | null
          dark_logo_meta?: Json | null
          default_theme?: string
          favicon_key?: string | null
          favicon_meta?: Json | null
          gradient?: Json
          light_colors?: Json
          light_logo_key?: string | null
          light_logo_meta?: Json | null
          primary_logo_key?: string | null
          primary_logo_meta?: Json | null
          radius?: Json
          spacing?: number[]
          typography?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_brand_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_configuration: {
        Row: {
          category: string
          company_id: string
          description: string | null
          id: string
          is_tbd: boolean
          key: string
          label: string
          updated_at: string
          value: Json | null
          value_type: Database["public"]["Enums"]["configuration_value_type"]
        }
        Insert: {
          category: string
          company_id: string
          description?: string | null
          id?: string
          is_tbd?: boolean
          key: string
          label: string
          updated_at?: string
          value?: Json | null
          value_type: Database["public"]["Enums"]["configuration_value_type"]
        }
        Update: {
          category?: string
          company_id?: string
          description?: string | null
          id?: string
          is_tbd?: boolean
          key?: string
          label?: string
          updated_at?: string
          value?: Json | null
          value_type?: Database["public"]["Enums"]["configuration_value_type"]
        }
        Relationships: [
          {
            foreignKeyName: "company_configuration_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_creators: {
        Row: {
          commercial_relationship: string | null
          company_id: string
          created_at: string
          creator_id: string
          id: string
          metadata: Json
          source: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          commercial_relationship?: string | null
          company_id: string
          created_at?: string
          creator_id: string
          id?: string
          metadata?: Json
          source?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          commercial_relationship?: string | null
          company_id?: string
          created_at?: string
          creator_id?: string
          id?: string
          metadata?: Json
          source?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_creators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_creators_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      company_integrations: {
        Row: {
          category: string
          company_id: string
          id: string
          label: string
          non_secret_config: Json
          provider_key: string
          state: Database["public"]["Enums"]["integration_state"]
          status_message: string | null
          updated_at: string
        }
        Insert: {
          category: string
          company_id: string
          id?: string
          label: string
          non_secret_config?: Json
          provider_key: string
          state?: Database["public"]["Enums"]["integration_state"]
          status_message?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          id?: string
          label?: string
          non_secret_config?: Json
          provider_key?: string
          state?: Database["public"]["Enums"]["integration_state"]
          status_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["template_channel"]
          company_id: string
          id: string
          is_active: boolean
          label: string
          requires_human_review: boolean
          subject: string | null
          template_key: string
          updated_at: string
          variables: Json
        }
        Insert: {
          body?: string
          channel: Database["public"]["Enums"]["template_channel"]
          company_id: string
          id?: string
          is_active?: boolean
          label: string
          requires_human_review?: boolean
          subject?: string | null
          template_key: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["template_channel"]
          company_id?: string
          id?: string
          is_active?: boolean
          label?: string
          requires_human_review?: boolean
          subject?: string | null
          template_key?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "company_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          metadata: Json
          primary_handle: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          metadata?: Json
          primary_handle?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          metadata?: Json
          primary_handle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission: string
          role: Database["public"]["Enums"]["team_role"]
        }
        Insert: {
          permission: string
          role: Database["public"]["Enums"]["team_role"]
        }
        Update: {
          permission?: string
          role?: Database["public"]["Enums"]["team_role"]
        }
        Relationships: []
      }
      team_memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["team_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["team_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      audit_event_status: "success" | "failed"
      configuration_value_type: "boolean" | "integer" | "number" | "string"
      integration_state: "disconnected" | "mock" | "sandbox" | "live" | "error"
      team_role: "junior" | "senior"
      template_channel: "whatsapp" | "email" | "system" | "document"
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
    Enums: {
      audit_event_status: ["success", "failed"],
      configuration_value_type: ["boolean", "integer", "number", "string"],
      integration_state: ["disconnected", "mock", "sandbox", "live", "error"],
      team_role: ["junior", "senior"],
      template_channel: ["whatsapp", "email", "system", "document"],
    },
  },
} as const
