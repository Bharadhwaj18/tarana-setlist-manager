import type { Database } from './database'

export type FinanceShow = Database['public']['Tables']['finance_shows']['Row']
export type FinanceTransaction = Database['public']['Tables']['finance_transactions']['Row']

export interface MemberBalance {
  member_id: string | null  // null = band fund
  display_name: string
  balance: number
}
