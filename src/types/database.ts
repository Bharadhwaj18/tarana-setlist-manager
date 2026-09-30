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
      profiles: {
        Row: {
          id: string
          display_name: string | null
          role: string
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          role?: string
          created_at?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          workspace_id: string | null
          id: string
          created_by: string
          updated_by: string | null
          title: string
          artist: string | null
          song_key: string | null
          bpm: number | null
          time_signature: string | null
          chord_chart: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          workspace_id?: string | null
          id?: string
          created_by: string
          updated_by?: string | null
          title: string
          artist?: string | null
          song_key?: string | null
          bpm?: number | null
          time_signature?: string | null
          chord_chart?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          workspace_id?: string | null
          id?: string
          created_by?: string
          updated_by?: string | null
          title?: string
          artist?: string | null
          song_key?: string | null
          bpm?: number | null
          time_signature?: string | null
          chord_chart?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      setlists: {
        Row: {
          workspace_id: string | null
          id: string
          created_by: string
          updated_by: string | null
          title: string
          show_date: string | null
          venue: string | null
          notes: string | null
          show_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          workspace_id?: string | null
          id?: string
          created_by: string
          updated_by?: string | null
          title: string
          show_date?: string | null
          venue?: string | null
          notes?: string | null
          show_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          workspace_id?: string | null
          id?: string
          created_by?: string
          updated_by?: string | null
          title?: string
          show_date?: string | null
          venue?: string | null
          notes?: string | null
          show_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'setlists_show_id_fkey'
            columns: ['show_id']
            isOneToOne: false
            referencedRelation: 'shows'
            referencedColumns: ['id']
          }
        ]
      }
      setlist_songs: {
        Row: {
          id: string
          setlist_id: string
          song_id: string
          position: number
          section: string | null
          created_at: string
        }
        Insert: {
          id?: string
          setlist_id: string
          song_id: string
          position?: number
          section?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          setlist_id?: string
          song_id?: string
          position?: number
          section?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'setlist_songs_setlist_id_fkey'
            columns: ['setlist_id']
            isOneToOne: false
            referencedRelation: 'setlists'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'setlist_songs_song_id_fkey'
            columns: ['song_id']
            isOneToOne: false
            referencedRelation: 'songs'
            referencedColumns: ['id']
          }
        ]
      }
      shows: {
        Row: {
          workspace_id: string | null
          visibility: string
          id: string
          title: string
          show_date: string | null
          venue: string | null
          split_at: string | null
          fee: number | null
          fee_received: boolean
          payment_reference: string | null
          tds_applicable: boolean
          tds_percentage: number | null
          tds_amount: number | null
          tds_filed: boolean
          tds_certificate_received: boolean
          booking_status: string | null
          poc_name: string | null
          poc_phone: string | null
          poc_email: string | null
          event_management_id: string | null
          format: string | null
          media_url: string | null
          notes: string | null
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          workspace_id?: string | null
          visibility?: string
          id?: string
          title: string
          show_date?: string | null
          venue?: string | null
          split_at?: string | null
          fee?: number | null
          fee_received?: boolean
          payment_reference?: string | null
          tds_applicable?: boolean
          tds_percentage?: number | null
          tds_amount?: number | null
          tds_filed?: boolean
          tds_certificate_received?: boolean
          booking_status?: string | null
          poc_name?: string | null
          poc_phone?: string | null
          poc_email?: string | null
          event_management_id?: string | null
          format?: string | null
          media_url?: string | null
          notes?: string | null
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          workspace_id?: string | null
          visibility?: string
          id?: string
          title?: string
          show_date?: string | null
          venue?: string | null
          split_at?: string | null
          fee?: number | null
          fee_received?: boolean
          payment_reference?: string | null
          tds_applicable?: boolean
          tds_percentage?: number | null
          tds_amount?: number | null
          tds_filed?: boolean
          tds_certificate_received?: boolean
          booking_status?: string | null
          poc_name?: string | null
          poc_phone?: string | null
          poc_email?: string | null
          event_management_id?: string | null
          format?: string | null
          media_url?: string | null
          notes?: string | null
          created_by?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shows_event_management_id_fkey'
            columns: ['event_management_id']
            isOneToOne: false
            referencedRelation: 'event_management'
            referencedColumns: ['id']
          }
        ]
      }
      event_management: {
        Row: {
          workspace_id: string | null
          id: string
          name: string
          contact_name: string | null
          contact_phone: string | null
          contact_email: string | null
          base_location: string | null
          notes: string | null
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          workspace_id?: string | null
          id?: string
          name: string
          contact_name?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          base_location?: string | null
          notes?: string | null
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          workspace_id?: string | null
          id?: string
          name?: string
          contact_name?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          base_location?: string | null
          notes?: string | null
          created_by?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          workspace_id: string | null
          id: string
          title: string
          content: string | null
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
          assigned_to: string | null
          due_date: string | null
          completed_at: string | null
          remind_days_before: number | null
          pinned: boolean
          archived_at: string | null
          color: string | null
          recurrence: string | null
          labels: string[] | null
        }
        Insert: {
          workspace_id?: string | null
          id?: string
          title: string
          content?: string | null
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
          assigned_to?: string | null
          due_date?: string | null
          completed_at?: string | null
          remind_days_before?: number | null
          pinned?: boolean
          archived_at?: string | null
          color?: string | null
          recurrence?: string | null
          labels?: string[] | null
        }
        Update: {
          workspace_id?: string | null
          id?: string
          title?: string
          content?: string | null
          created_by?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
          assigned_to?: string | null
          due_date?: string | null
          completed_at?: string | null
          remind_days_before?: number | null
          pinned?: boolean
          archived_at?: string | null
          color?: string | null
          recurrence?: string | null
          labels?: string[] | null
        }
        Relationships: []
      }
      note_checklist_items: {
        Row: {
          id: string
          note_id: string
          text: string
          done: boolean
          position: number
          created_at: string
          assigned_to: string | null
        }
        Insert: {
          id?: string
          note_id: string
          text: string
          done?: boolean
          position?: number
          created_at?: string
          assigned_to?: string | null
        }
        Update: {
          id?: string
          note_id?: string
          text?: string
          done?: boolean
          position?: number
          created_at?: string
          assigned_to?: string | null
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          workspace_id: string | null
          id: string
          member_id: string | null
          amount: number
          description: string
          category: string | null
          show_id: string | null
          budget_id: string | null
          date: string
          recorded_by: string
          created_at: string
        }
        Insert: {
          workspace_id?: string | null
          id?: string
          member_id?: string | null
          amount: number
          description: string
          category?: string | null
          show_id?: string | null
          budget_id?: string | null
          date?: string
          recorded_by: string
          created_at?: string
        }
        Update: {
          workspace_id?: string | null
          id?: string
          member_id?: string | null
          amount?: number
          description?: string
          category?: string | null
          show_id?: string | null
          budget_id?: string | null
          date?: string
          recorded_by?: string
          created_at?: string
        }
        Relationships: []
      }
      pending_payments: {
        Row: {
          workspace_id: string | null
          id: string
          from_member: string
          to_member: string
          amount: number
          description: string
          category: string
          show_id: string | null
          created_at: string
          paid_at: string | null
          paid_transaction_id: string | null
        }
        Insert: {
          workspace_id?: string | null
          id?: string
          from_member: string
          to_member: string
          amount: number
          description: string
          category?: string
          show_id?: string | null
          created_at?: string
          paid_at?: string | null
          paid_transaction_id?: string | null
        }
        Update: {
          workspace_id?: string | null
          id?: string
          from_member?: string
          to_member?: string
          amount?: number
          description?: string
          category?: string
          show_id?: string | null
          created_at?: string
          paid_at?: string | null
          paid_transaction_id?: string | null
        }
        Relationships: []
      }
      budgets: {
        Row: {
          workspace_id: string | null
          id: string
          name: string
          allocated_amount: number
          recurrence: 'none' | 'monthly'
          start_date: string
          end_date: string | null
          status: 'active' | 'closed'
          created_by: string
          created_at: string
        }
        Insert: {
          workspace_id?: string | null
          id?: string
          name: string
          allocated_amount: number
          recurrence?: 'none' | 'monthly'
          start_date?: string
          end_date?: string | null
          status?: 'active' | 'closed'
          created_by: string
          created_at?: string
        }
        Update: {
          workspace_id?: string | null
          id?: string
          name?: string
          allocated_amount?: number
          recurrence?: 'none' | 'monthly'
          start_date?: string
          end_date?: string | null
          status?: 'active' | 'closed'
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      budget_adjustments: {
        Row: {
          id: string
          budget_id: string
          kind: 'created' | 'top_up' | 'reduce' | 'closed' | 'reopened'
          delta: number
          note: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          budget_id: string
          kind: 'created' | 'top_up' | 'reduce' | 'closed' | 'reopened'
          delta?: number
          note?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          budget_id?: string
          kind?: 'created' | 'top_up' | 'reduce' | 'closed' | 'reopened'
          delta?: number
          note?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          id: string
          name: string
          type: string
          owner_id: string
          plan: string
          status: string
          trial_ends_at: string | null
          past_due_since: string | null
          read_only_until: string | null
          blocked_at: string | null
          settings: Json
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          type?: string
          owner_id: string
          plan?: string
          status?: string
          trial_ends_at?: string | null
          past_due_since?: string | null
          read_only_until?: string | null
          blocked_at?: string | null
          settings?: Json
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          owner_id?: string
          plan?: string
          status?: string
          trial_ends_at?: string | null
          past_due_since?: string | null
          read_only_until?: string | null
          blocked_at?: string | null
          settings?: Json
          created_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          workspace_id: string
          user_id: string
          role: string
          permissions: Json
          created_at: string
        }
        Insert: {
          workspace_id: string
          user_id: string
          role?: string
          permissions?: Json
          created_at?: string
        }
        Update: {
          workspace_id?: string
          user_id?: string
          role?: string
          permissions?: Json
          created_at?: string
        }
        Relationships: []
      }
      workspace_invites: {
        Row: {
          id: string
          workspace_id: string
          token: string
          role: string
          permissions: Json
          created_by: string
          expires_at: string
          max_uses: number | null
          use_count: number
          revoked_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          token?: string
          role?: string
          permissions?: Json
          created_by?: string
          expires_at?: string
          max_uses?: number | null
          use_count?: number
          revoked_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          token?: string
          role?: string
          permissions?: Json
          created_by?: string
          expires_at?: string
          max_uses?: number | null
          use_count?: number
          revoked_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          plan: string
          feature: string
          value: Json
        }
        Insert: {
          plan: string
          feature: string
          value?: Json
        }
        Update: {
          plan?: string
          feature?: string
          value?: Json
        }
        Relationships: []
      }
      split_runs: {
        Row: {
          workspace_id: string | null
          id: string
          created_at: string
          created_by: string | null
          band_pct: number | null
          total_net: number
          total_band_fund: number | null
          shows: Json
          payments: Json
          report: Json | null
          reconstructed: boolean
        }
        Insert: {
          workspace_id?: string | null
          id?: string
          created_at?: string
          created_by?: string | null
          band_pct?: number | null
          total_net?: number
          total_band_fund?: number | null
          shows?: Json
          payments?: Json
          report?: Json | null
          reconstructed?: boolean
        }
        Update: {
          workspace_id?: string | null
          id?: string
          created_at?: string
          created_by?: string | null
          band_pct?: number | null
          total_net?: number
          total_band_fund?: number | null
          shows?: Json
          payments?: Json
          report?: Json | null
          reconstructed?: boolean
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          profile_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          created_at?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          workspace_id: string | null
          visibility: string
          id: string
          title: string
          start_date: string
          end_date: string
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          workspace_id?: string | null
          visibility?: string
          id?: string
          title: string
          start_date: string
          end_date: string
          notes?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          workspace_id?: string | null
          visibility?: string
          id?: string
          title?: string
          start_date?: string
          end_date?: string
          notes?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      unavailability: {
        Row: {
          workspace_id: string | null
          visibility: string
          id: string
          member_id: string
          start_date: string
          end_date: string
          reason: string | null
          created_at: string
        }
        Insert: {
          workspace_id?: string | null
          visibility?: string
          id?: string
          member_id: string
          start_date: string
          end_date: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          workspace_id?: string | null
          visibility?: string
          id?: string
          member_id?: string
          start_date?: string
          end_date?: string
          reason?: string | null
          created_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          recipient_id: string
          sender_id: string | null
          title: string
          body: string | null
          link: string | null
          type: string
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          recipient_id: string
          sender_id?: string | null
          title: string
          body?: string | null
          link?: string | null
          type?: string
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          recipient_id?: string
          sender_id?: string | null
          title?: string
          body?: string | null
          link?: string | null
          type?: string
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          workspace_id: string | null
          id: string
          title: string
          file_path: string
          duration_seconds: number
          mime_type: string
          song_id: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          workspace_id?: string | null
          id?: string
          title: string
          file_path: string
          duration_seconds: number
          mime_type: string
          song_id?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          workspace_id?: string | null
          id?: string
          title?: string
          file_path?: string
          duration_seconds?: number
          mime_type?: string
          song_id?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_song_id_fkey"
            columns: ["song_id"]
            referencedRelation: "songs"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      calendar_external: {
        Args: { p_ws: string }
        Returns: {
          kind: 'show' | 'event' | 'unavailable'
          item_id: string
          member_id: string
          source_name: string | null
          start_date: string
          end_date: string
          visibility: string
          title: string | null
          detail: string | null
        }[]
      }
      create_workspace: { Args: { p_name: string; p_type?: string }; Returns: string }
      rename_workspace: { Args: { p_ws: string; p_name: string }; Returns: undefined }
      revoke_workspace_invite: { Args: { p_invite: string }; Returns: undefined }
      accept_workspace_invite: { Args: { p_token: string }; Returns: string }
      invite_preview: {
        Args: { p_token: string }
        Returns: { workspace_name: string; workspace_type: string; state: string }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
