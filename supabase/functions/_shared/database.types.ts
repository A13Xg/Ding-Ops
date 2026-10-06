/*
 * DING schema types.
 *
 * Keep this file aligned with supabase/migrations/. Once the dedicated DING
 * Supabase project is linked, replace this checked-in bootstrap version with:
 *
 *   supabase gen types typescript --linked > supabase/functions/_shared/database.types.ts
 *
 * The explicit table/RPC surface is intentional: createClient<Database>()
 * should fail CI when an Edge Function references a stale Bust table/column.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Insert, Update, Relationships extends Relationship[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      game_config: Table<
        {
          id: string;
          expansion_key: string;
          expansion_name: string;
          level_cap: number;
          updated_at: string;
        },
        {
          id: string;
          expansion_key: string;
          expansion_name: string;
          level_cap: number;
          updated_at?: string;
        },
        {
          id?: string;
          expansion_key?: string;
          expansion_name?: string;
          level_cap?: number;
          updated_at?: string;
        }
      >;
      profiles: Table<
        {
          id: string;
          username: string;
          avatar_seed: string | null;
          tagline: string | null;
          showcase: string | null;
          active_character_id: string | null;
          created_at: string;
        },
        {
          id: string;
          username: string;
          avatar_seed?: string | null;
          tagline?: string | null;
          showcase?: string | null;
          active_character_id?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          username?: string;
          avatar_seed?: string | null;
          tagline?: string | null;
          showcase?: string | null;
          active_character_id?: string | null;
          created_at?: string;
        },
        [
          {
            foreignKeyName: 'profiles_active_character_id_fkey';
            columns: ['active_character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
        ]
      >;
      characters: Table<
        {
          id: string;
          user_id: string;
          name: string;
          realm: string;
          region: string;
          class_name: string;
          spec: string | null;
          race: string | null;
          faction: string | null;
          current_level: number;
          tracked_from_level: number;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          name: string;
          realm: string;
          region: string;
          class_name: string;
          spec?: string | null;
          race?: string | null;
          faction?: string | null;
          current_level: number;
          tracked_from_level: number;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          name?: string;
          realm?: string;
          region?: string;
          class_name?: string;
          spec?: string | null;
          race?: string | null;
          faction?: string | null;
          current_level?: number;
          tracked_from_level?: number;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        [
          {
            foreignKeyName: 'characters_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ]
      >;
      level_events: Table<
        {
          id: string;
          user_id: string;
          character_id: string;
          from_level: number;
          to_level: number;
          timestamp: string;
          time_zone: string;
          local_date: string;
          local_hour: number;
          time_bucket: string;
          zone: string | null;
          activity_type: string | null;
          deaths: number | null;
          session_minutes: number | null;
          note: string;
          created_at: string;
        },
        {
          id: string;
          user_id: string;
          character_id: string;
          from_level: number;
          to_level: number;
          timestamp: string;
          time_zone: string;
          local_date: string;
          local_hour: number;
          time_bucket: string;
          zone?: string | null;
          activity_type?: string | null;
          deaths?: number | null;
          session_minutes?: number | null;
          note?: string;
          created_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          character_id?: string;
          from_level?: number;
          to_level?: number;
          timestamp?: string;
          time_zone?: string;
          local_date?: string;
          local_hour?: number;
          time_bucket?: string;
          zone?: string | null;
          activity_type?: string | null;
          deaths?: number | null;
          session_minutes?: number | null;
          note?: string;
          created_at?: string;
        },
        [
          {
            foreignKeyName: 'level_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'level_events_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
        ]
      >;
      achievement_catalog: Table<
        { id: string },
        { id: string },
        { id?: string }
      >;
      achievements: Table<
        {
          id: string;
          user_id: string;
          achievement_type: string;
          unlocked_at: string;
        },
        {
          id?: string;
          user_id: string;
          achievement_type: string;
          unlocked_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          achievement_type?: string;
          unlocked_at?: string;
        },
        [
          {
            foreignKeyName: 'achievements_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'achievements_achievement_type_fkey';
            columns: ['achievement_type'];
            isOneToOne: false;
            referencedRelation: 'achievement_catalog';
            referencedColumns: ['id'];
          },
        ]
      >;
      push_subscriptions: Table<
        {
          id: number;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          updated_at: string;
          last_success_at: string | null;
          last_ack_at: string | null;
          failure_count: number;
          unacked_count: number;
        },
        {
          id?: never;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          updated_at?: string;
          last_success_at?: string | null;
          last_ack_at?: string | null;
          failure_count?: number;
          unacked_count?: number;
        },
        {
          id?: never;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
          updated_at?: string;
          last_success_at?: string | null;
          last_ack_at?: string | null;
          failure_count?: number;
          unacked_count?: number;
        },
        [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ]
      >;
      push_events: Table<
        {
          id: number;
          kind: string;
          source_id: string;
          actor_id: string | null;
          created_at: string;
          dispatched_at: string | null;
          recipients: number;
          delivered: number;
        },
        {
          id?: never;
          kind: string;
          source_id: string;
          actor_id?: string | null;
          created_at?: string;
          dispatched_at?: string | null;
          recipients?: number;
          delivered?: number;
        },
        {
          id?: never;
          kind?: string;
          source_id?: string;
          actor_id?: string | null;
          created_at?: string;
          dispatched_at?: string | null;
          recipients?: number;
          delivered?: number;
        },
        [
          {
            foreignKeyName: 'push_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ]
      >;
      push_deliveries: Table<
        {
          id: number;
          receipt_id: string;
          batch_id: string;
          kind: string;
          actor_id: string | null;
          recipient_id: string | null;
          subscription_id: number | null;
          title: string;
          sent_at: string;
          acked_at: string | null;
        },
        {
          id?: never;
          receipt_id?: string;
          batch_id: string;
          kind: string;
          actor_id?: string | null;
          recipient_id?: string | null;
          subscription_id?: number | null;
          title?: string;
          sent_at?: string;
          acked_at?: string | null;
        },
        {
          id?: never;
          receipt_id?: string;
          batch_id?: string;
          kind?: string;
          actor_id?: string | null;
          recipient_id?: string | null;
          subscription_id?: number | null;
          title?: string;
          sent_at?: string;
          acked_at?: string | null;
        },
        [
          {
            foreignKeyName: 'push_deliveries_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_deliveries_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ]
      >;
      inactivity_reminders: Table<
        {
          user_id: string;
          cycle_ding_at: string;
          scheduled_for: string | null;
          last_sent_at: string | null;
          last_message_index: number | null;
          updated_at: string;
        },
        {
          user_id: string;
          cycle_ding_at: string;
          scheduled_for?: string | null;
          last_sent_at?: string | null;
          last_message_index?: number | null;
          updated_at?: string;
        },
        {
          user_id?: string;
          cycle_ding_at?: string;
          scheduled_for?: string | null;
          last_sent_at?: string | null;
          last_message_index?: number | null;
          updated_at?: string;
        },
        [
          {
            foreignKeyName: 'inactivity_reminders_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ]
      >;
      discord_settings: Table<
        {
          id: number;
          enabled: boolean;
          ding_enabled: boolean;
          achievement_enabled: boolean;
          webhook_url: string | null;
          bot_username: string | null;
          bot_avatar_url: string | null;
          footer_text: string | null;
          ding_color: string | null;
          achievement_color: string | null;
          ding_title_template: string | null;
          ding_description_template: string | null;
          achievement_title_template: string | null;
          achievement_description_template: string | null;
          mention_content: string | null;
          include_thumbnail: boolean;
          updated_at: string;
          updated_by: string | null;
        },
        {
          id?: number;
          enabled?: boolean;
          ding_enabled?: boolean;
          achievement_enabled?: boolean;
          webhook_url?: string | null;
          bot_username?: string | null;
          bot_avatar_url?: string | null;
          footer_text?: string | null;
          ding_color?: string | null;
          achievement_color?: string | null;
          ding_title_template?: string | null;
          ding_description_template?: string | null;
          achievement_title_template?: string | null;
          achievement_description_template?: string | null;
          mention_content?: string | null;
          include_thumbnail?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        },
        {
          id?: number;
          enabled?: boolean;
          ding_enabled?: boolean;
          achievement_enabled?: boolean;
          webhook_url?: string | null;
          bot_username?: string | null;
          bot_avatar_url?: string | null;
          footer_text?: string | null;
          ding_color?: string | null;
          achievement_color?: string | null;
          ding_title_template?: string | null;
          ding_description_template?: string | null;
          achievement_title_template?: string | null;
          achievement_description_template?: string | null;
          mention_content?: string | null;
          include_thumbnail?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        },
        [
          {
            foreignKeyName: 'discord_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ]
      >;
      discord_events: Table<
        {
          id: number;
          kind: string;
          source_id: string;
          actor_id: string | null;
          created_at: string;
          dispatched_at: string | null;
          success: boolean | null;
          status_code: number | null;
          error: string | null;
        },
        {
          id?: never;
          kind: string;
          source_id: string;
          actor_id?: string | null;
          created_at?: string;
          dispatched_at?: string | null;
          success?: boolean | null;
          status_code?: number | null;
          error?: string | null;
        },
        {
          id?: never;
          kind?: string;
          source_id?: string;
          actor_id?: string | null;
          created_at?: string;
          dispatched_at?: string | null;
          success?: boolean | null;
          status_code?: number | null;
          error?: string | null;
        },
        [
          {
            foreignKeyName: 'discord_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ]
      >;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      bump_push_failure: {
        Args: { subscription_ids: number[] };
        Returns: number;
      };
      mark_push_sent: {
        Args: { subscription_ids: number[] };
        Returns: undefined;
      };
      record_push_ack: {
        Args: { receipt: string };
        Returns: boolean;
      };
      prune_dead_push_subscriptions: {
        Args: {
          never_acked_after?: number;
          min_age?: string;
          went_silent_after?: number;
          silent_for?: string;
        };
        Returns: number;
      };
      push_subscription_health: {
        Args: never;
        Returns: {
          id: number;
          user_id: string;
          host: string;
          user_agent: string | null;
          created_at: string;
          last_success_at: string | null;
          last_ack_at: string | null;
          unacked_count: number;
          failure_count: number;
          sent_total: number;
          acked_total: number;
        }[];
      };
      set_active_character: {
        Args: { p_character_id: string | null };
        Returns: Database['public']['Tables']['profiles']['Row'];
      };
      update_character_metadata: {
        Args: {
          p_character_id: string;
          p_name: string;
          p_realm: string;
          p_region: string;
          p_class_name: string;
          p_spec?: string | null;
          p_race?: string | null;
          p_faction?: string | null;
          p_is_archived?: boolean;
        };
        Returns: Database['public']['Tables']['characters']['Row'];
      };
      record_ding: {
        Args: {
          p_event_id: string;
          p_character_id: string;
          p_expected_from_level: number;
          p_zone?: string | null;
          p_activity_type?: string | null;
          p_deaths?: number | null;
          p_session_minutes?: number | null;
          p_note?: string;
          p_time_zone?: string;
        };
        Returns: Database['public']['Tables']['level_events']['Row'];
      };
      update_level_event_note: {
        Args: { p_event_id: string; p_note: string };
        Returns: Database['public']['Tables']['level_events']['Row'];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database['public'];

export type Tables<
  Name extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
> = (DefaultSchema['Tables'] & DefaultSchema['Views'])[Name] extends { Row: infer Row }
  ? Row
  : never;

export type TablesInsert<Name extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][Name] extends { Insert: infer Insert } ? Insert : never;

export type TablesUpdate<Name extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][Name] extends { Update: infer Update } ? Update : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
