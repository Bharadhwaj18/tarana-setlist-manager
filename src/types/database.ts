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
          id: string
          title: string
          show_date: string | null
          venue: string | null
          split_at: string | null
          fee: number | null
          fee_received: boolean
          payment_reference: string | null
          tds_applicable: boolean
          tds_amount: number | null
          tds_filed: boolean
          tds_certificate_received: boolean
          notes: string | null
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          show_date?: string | null
          venue?: string | null
          split_at?: string | null
          fee?: number | null
          fee_received?: boolean
          payment_reference?: string | null
          tds_applicable?: boolean
          tds_amount?: number | null
          tds_filed?: boolean
          tds_certificate_received?: boolean
          notes?: string | null
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          show_date?: string | null
          venue?: string | null
          split_at?: string | null
          fee?: number | null
          fee_received?: boolean
          payment_reference?: string | null
          tds_applicable?: boolean
          tds_amount?: number | null
          tds_filed?: boolean
          tds_certificate_received?: boolean
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
          id: string
          title: string
          content: string | null
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content?: string | null
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string | null
          created_by?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          id: string
          member_id: string | null
          amount: number
          description: string
          category: string | null
          show_id: string | null
          date: string
          recorded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          member_id?: string | null
          amount: number
          description: string
          category?: string | null
          show_id?: string | null
          date?: string
          recorded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          member_id?: string | null
          amount?: number
          description?: string
          category?: string | null
          show_id?: string | null
          date?: string
          recorded_by?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
