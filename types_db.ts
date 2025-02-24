export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      burn_config: {
        Row: {
          created_at: string | null
          current_stage: Database["public"]["Enums"]["burn_stage"]
          id: string
          last_possible_transfer_at: string | null
          lottery_closes_at: string | null
          lottery_opens_at: string | null
          max_memberships: number | null
          membership_addons: Json
          membership_price_currency: string
          membership_price_tier_1: number | null
          membership_price_tier_2: number | null
          membership_price_tier_3: number | null
          membership_pricing_type: Database["public"]["Enums"]["burn_membership_pricing_type"]
          open_sale_general_starting_at: string | null
          open_sale_lottery_entrants_only_starting_at: string | null
          open_sale_reservation_duration: number | null
          plus_one_reservation_duration: number | null
          project_id: string
          share_memberships_lottery: number | null
          share_memberships_low_income: number | null
          stripe_secret_api_key: string | null
          stripe_webhook_secret: string | null
          transfer_reservation_duration: number | null
        }
        Insert: {
          created_at?: string | null
          current_stage: Database["public"]["Enums"]["burn_stage"]
          id?: string
          last_possible_transfer_at?: string | null
          lottery_closes_at?: string | null
          lottery_opens_at?: string | null
          max_memberships?: number | null
          membership_addons?: Json
          membership_price_currency: string
          membership_price_tier_1?: number | null
          membership_price_tier_2?: number | null
          membership_price_tier_3?: number | null
          membership_pricing_type: Database["public"]["Enums"]["burn_membership_pricing_type"]
          open_sale_general_starting_at?: string | null
          open_sale_lottery_entrants_only_starting_at?: string | null
          open_sale_reservation_duration?: number | null
          plus_one_reservation_duration?: number | null
          project_id: string
          share_memberships_lottery?: number | null
          share_memberships_low_income?: number | null
          stripe_secret_api_key?: string | null
          stripe_webhook_secret?: string | null
          transfer_reservation_duration?: number | null
        }
        Update: {
          created_at?: string | null
          current_stage?: Database["public"]["Enums"]["burn_stage"]
          id?: string
          last_possible_transfer_at?: string | null
          lottery_closes_at?: string | null
          lottery_opens_at?: string | null
          max_memberships?: number | null
          membership_addons?: Json
          membership_price_currency?: string
          membership_price_tier_1?: number | null
          membership_price_tier_2?: number | null
          membership_price_tier_3?: number | null
          membership_pricing_type?: Database["public"]["Enums"]["burn_membership_pricing_type"]
          open_sale_general_starting_at?: string | null
          open_sale_lottery_entrants_only_starting_at?: string | null
          open_sale_reservation_duration?: number | null
          plus_one_reservation_duration?: number | null
          project_id?: string
          share_memberships_lottery?: number | null
          share_memberships_low_income?: number | null
          stripe_secret_api_key?: string | null
          stripe_webhook_secret?: string | null
          transfer_reservation_duration?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "burn_config_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      burn_lottery_tickets: {
        Row: {
          birthdate: string
          can_invite_plus_one: boolean | null
          created_at: string | null
          first_name: string
          id: string
          is_low_income: boolean | null
          is_winner: boolean | null
          last_name: string
          metadata: Json | null
          owner_id: string
          project_id: string
        }
        Insert: {
          birthdate: string
          can_invite_plus_one?: boolean | null
          created_at?: string | null
          first_name: string
          id?: string
          is_low_income?: boolean | null
          is_winner?: boolean | null
          last_name: string
          metadata?: Json | null
          owner_id: string
          project_id: string
        }
        Update: {
          birthdate?: string
          can_invite_plus_one?: boolean | null
          created_at?: string | null
          first_name?: string
          id?: string
          is_low_income?: boolean | null
          is_winner?: boolean | null
          last_name?: string
          metadata?: Json | null
          owner_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "burn_lottery_tickets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "burn_lottery_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      burn_membership_purchase_rights: {
        Row: {
          birthdate: string | null
          created_at: string | null
          details_modifiable: boolean | null
          expires_at: string
          first_name: string | null
          id: string
          is_low_income: boolean | null
          last_name: string | null
          metadata: Json | null
          owner_id: string
          project_id: string
        }
        Insert: {
          birthdate?: string | null
          created_at?: string | null
          details_modifiable?: boolean | null
          expires_at: string
          first_name?: string | null
          id?: string
          is_low_income?: boolean | null
          last_name?: string | null
          metadata?: Json | null
          owner_id: string
          project_id: string
        }
        Update: {
          birthdate?: string | null
          created_at?: string | null
          details_modifiable?: boolean | null
          expires_at?: string
          first_name?: string | null
          id?: string
          is_low_income?: boolean | null
          last_name?: string | null
          metadata?: Json | null
          owner_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "burn_membership_purchase_rights_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "burn_membership_purchase_rights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      burn_memberships: {
        Row: {
          birthdate: string
          checked_in_at: string | null
          created_at: string | null
          first_name: string
          id: string
          last_name: string
          metadata: Json | null
          owner_id: string
          price: number
          price_currency: string
          project_id: string
          stripe_payment_intent_id: string | null
        }
        Insert: {
          birthdate: string
          checked_in_at?: string | null
          created_at?: string | null
          first_name: string
          id?: string
          last_name: string
          metadata?: Json | null
          owner_id: string
          price: number
          price_currency: string
          project_id: string
          stripe_payment_intent_id?: string | null
        }
        Update: {
          birthdate?: string
          checked_in_at?: string | null
          created_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
          metadata?: Json | null
          owner_id?: string
          price?: number
          price_currency?: string
          project_id?: string
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "burn_memberships_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "burn_memberships_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          email: string
          id: string
          is_admin: boolean | null
          registered_at: string | null
        }
        Insert: {
          email: string
          id: string
          is_admin?: boolean | null
          registered_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          is_admin?: boolean | null
          registered_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
          type: Database["public"]["Enums"]["project_type"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
          type: Database["public"]["Enums"]["project_type"]
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
          type?: Database["public"]["Enums"]["project_type"]
        }
        Relationships: []
      }
      questions: {
        Row: {
          created_at: string | null
          id: string
          project_id: string
          question_description: string | null
          question_id: string
          question_options: string | null
          question_order: number | null
          question_text: string | null
          question_type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id: string
          question_description?: string | null
          question_id: string
          question_options?: string | null
          question_order?: number | null
          question_text?: string | null
          question_type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string
          question_description?: string | null
          question_id?: string
          question_options?: string | null
          question_order?: number | null
          question_text?: string | null
          question_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      role_assignments: {
        Row: {
          created_at: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          id: string
          name: string
          project_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          project_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_project_id_fkey"
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
      json_matches_schema: {
        Args: {
          schema: Json
          instance: Json
        }
        Returns: boolean
      }
      jsonb_matches_schema: {
        Args: {
          schema: Json
          instance: Json
        }
        Returns: boolean
      }
      jsonschema_is_valid: {
        Args: {
          schema: Json
        }
        Returns: boolean
      }
      jsonschema_validation_errors: {
        Args: {
          schema: Json
          instance: Json
        }
        Returns: string[]
      }
    }
    Enums: {
      burn_membership_pricing_type: "tiered-3"
      burn_stage:
        | "lottery-open"
        | "lottery-closed"
        | "open-sale-lottery-entrants-only"
        | "open-sale-general"
      project_type: "burn"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

