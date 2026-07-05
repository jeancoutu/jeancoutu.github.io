// Hand-authored to match schema.md (supabase CLI type generation requires
// `supabase login` / SUPABASE_ACCESS_TOKEN, unavailable in this environment).
// Regenerate with:
//   supabase gen types typescript --project-id <id> --schema public > src/lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DurationTagEnum = "short" | "medium" | "long";

export type DayKeyEnum =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type IngredientCategoryEnum =
  | "vegetables"
  | "bakery"
  | "meat"
  | "aisle"
  | "fridge";

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      household_memberships: {
        Row: {
          household_id: string;
          user_id: string;
          email: string;
          joined_at: string;
        };
        Insert: {
          household_id: string;
          user_id: string;
          email: string;
          joined_at?: string;
        };
        Update: {
          household_id?: string;
          user_id?: string;
          email?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
      household_invites: {
        Row: {
          id: string;
          household_id: string;
          invited_by: string;
          invited_by_email: string;
          invite_email: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          invited_by: string;
          invited_by_email: string;
          invite_email: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          invited_by?: string;
          invited_by_email?: string;
          invite_email?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      meals: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          duration: DurationTagEnum;
          url: string;
          supper_days: DayKeyEnum[];
          instructions: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id?: string;
          name: string;
          duration?: DurationTagEnum;
          url?: string;
          supper_days?: DayKeyEnum[];
          instructions?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          duration?: DurationTagEnum;
          url?: string;
          supper_days?: DayKeyEnum[];
          instructions?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      meal_ingredients: {
        Row: {
          id: string;
          meal_id: string;
          name: string;
          quantity: string;
          category: IngredientCategoryEnum;
        };
        Insert: {
          id?: string;
          meal_id: string;
          name: string;
          quantity?: string;
          category: IngredientCategoryEnum;
        };
        Update: {
          id?: string;
          meal_id?: string;
          name?: string;
          quantity?: string;
          category?: IngredientCategoryEnum;
        };
        Relationships: [
          {
            foreignKeyName: "meal_ingredients_meal_id_fkey";
            columns: ["meal_id"];
            isOneToOne: false;
            referencedRelation: "meals";
            referencedColumns: ["id"];
          },
        ];
      };
      weekly_plans: {
        Row: {
          id: string;
          household_id: string;
          week_start: string;
          dismissed_ingredient_names: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id?: string;
          week_start: string;
          dismissed_ingredient_names?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          week_start?: string;
          dismissed_ingredient_names?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      day_plans: {
        Row: {
          id: string;
          weekly_plan_id: string;
          day_key: DayKeyEnum;
          supper_meal_id: string | null;
          diner_meal_id: string | null;
          note: string | null;
        };
        Insert: {
          id?: string;
          weekly_plan_id: string;
          day_key: DayKeyEnum;
          supper_meal_id?: string | null;
          diner_meal_id?: string | null;
          note?: string | null;
        };
        Update: {
          id?: string;
          weekly_plan_id?: string;
          day_key?: DayKeyEnum;
          supper_meal_id?: string | null;
          diner_meal_id?: string | null;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "day_plans_weekly_plan_id_fkey";
            columns: ["weekly_plan_id"];
            isOneToOne: false;
            referencedRelation: "weekly_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      grocery_items: {
        Row: {
          id: string;
          weekly_plan_id: string;
          name: string;
          quantity: string;
          category: IngredientCategoryEnum;
          checked: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          weekly_plan_id: string;
          name: string;
          quantity?: string;
          category: IngredientCategoryEnum;
          checked?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          weekly_plan_id?: string;
          name?: string;
          quantity?: string;
          category?: IngredientCategoryEnum;
          checked?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grocery_items_weekly_plan_id_fkey";
            columns: ["weekly_plan_id"];
            isOneToOne: false;
            referencedRelation: "weekly_plans";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_my_household_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      accept_household_invite: {
        Args: { invite_id: string };
        Returns: undefined;
      };
      remove_from_household: {
        Args: { target_user_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      duration_tag: DurationTagEnum;
      day_key: DayKeyEnum;
      ingredient_category: IngredientCategoryEnum;
    };
    CompositeTypes: Record<string, never>;
  };
}
