export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      approach_questionnaires: {
        Row: {
          id: string
          approach_id: string
          title: string
          description: string | null
          schema: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          approach_id: string
          title: string
          description?: string | null
          schema?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          approach_id?: string
          title?: string
          description?: string | null
          schema?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      approach_report_templates: {
        Row: {
          id: string
          approach_id: string
          name: string
          slug: string
          description: string | null
          type: string
          config: Json
          order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          approach_id: string
          name: string
          slug: string
          description?: string | null
          type?: string
          config?: Json
          order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          approach_id?: string
          name?: string
          slug?: string
          description?: string | null
          type?: string
          config?: Json
          order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      approaches: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          category: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          category?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          category?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      organization_approaches: {
        Row: {
          id: string
          organization_id: string
          approach_id: string
          assigned_at: string
          assigned_by: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          approach_id: string
          assigned_at?: string
          assigned_by?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          approach_id?: string
          assigned_at?: string
          assigned_by?: string | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: Database['public']['Enums']['org_member_role']
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role: Database['public']['Enums']['org_member_role']
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: Database['public']['Enums']['org_member_role']
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      participant_access_tokens: {
        Row: {
          id: string
          participant_id: string
          questionnaire_id: string
          token: string
          expires_at: string | null
          used: boolean
          used_at: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          participant_id: string
          questionnaire_id: string
          token: string
          expires_at?: string | null
          used?: boolean
          used_at?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          participant_id?: string
          questionnaire_id?: string
          token?: string
          expires_at?: string | null
          used?: boolean
          used_at?: string | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      participants: {
        Row: {
          id: string
          organization_id: string
          email: string
          name: string | null
          metadata: Json
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          email: string
          name?: string | null
          metadata?: Json
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          email?: string
          name?: string | null
          metadata?: Json
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      questionnaire_responses: {
        Row: {
          id: string
          questionnaire_id: string
          participant_id: string
          answers: Json
          submitted_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          questionnaire_id: string
          participant_id: string
          answers?: Json
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          questionnaire_id?: string
          participant_id?: string
          answers?: Json
          submitted_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      questionnaires: {
        Row: {
          id: string
          organization_id: string
          title: string
          description: string | null
          schema: Json
          status: Database['public']['Enums']['questionnaire_status']
          approach_questionnaire_id: string | null
          is_anonymous: boolean
          start_date: string | null
          end_date: string | null
          config: Json
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          title: string
          description?: string | null
          schema?: Json
          status?: Database['public']['Enums']['questionnaire_status']
          approach_questionnaire_id?: string | null
          is_anonymous?: boolean
          start_date?: string | null
          end_date?: string | null
          config?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          title?: string
          description?: string | null
          schema?: Json
          status?: Database['public']['Enums']['questionnaire_status']
          approach_questionnaire_id?: string | null
          is_anonymous?: boolean
          start_date?: string | null
          end_date?: string | null
          config?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      todo_list: {
        Row: {
          created_at: string
          description: string | null
          done: boolean
          done_at: string | null
          id: number
          owner: string
          title: string
          urgent: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          done?: boolean
          done_at?: string | null
          id?: number
          owner: string
          title: string
          urgent?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          done?: boolean
          done_at?: string | null
          id?: number
          owner?: string
          title?: string
          urgent?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: Database['public']['Enums']['user_role_type']
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          role: Database['public']['Enums']['user_role_type']
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          role?: Database['public']['Enums']['user_role_type']
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_participant_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_participant_id_from_token: {
        Args: {
          token_value: string
        }
        Returns: string
      }
      get_user_org_role: {
        Args: {
          org_id: string
        }
        Returns: Database['public']['Enums']['org_member_role']
      }
      is_org_admin: {
        Args: {
          org_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: {
          org_id: string
        }
        Returns: boolean
      }
      is_system_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      mark_token_used: {
        Args: {
          token_value: string
        }
        Returns: boolean
      }
      validate_participant_token: {
        Args: {
          token_value: string
        }
        Returns: {
          is_valid: boolean
          participant_id: string
          questionnaire_id: string
          organization_id: string
        }[]
      }
    }
    Enums: {
      org_member_role: 'admin' | 'auditor'
      questionnaire_status: 'draft' | 'active' | 'closed' | 'archived'
      user_role_type: 'system_admin' | 'org_admin' | 'org_auditor'
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
