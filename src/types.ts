export interface LogEntry {
  id: string
  date: string
  description: string
  duration: number
  project?: string
}

export interface PendingAllocation {
  amount: number        // in the pocket's currency
  clearDate: string     // ISO date when this becomes withdrawable
}

export interface Pocket {
  id: string
  nama: string
  saldo: number
  tipe: 'permanen' | 'goal'
  target_amount?: number    // goal only: remaining target (decreases on withdraw)
  target_awal?: number      // goal only: original target (static, for progress display)
  currency: 'USD' | 'IDR'
  pendingAllocations?: PendingAllocation[]
  created_at: string
}

export type Period = 'today' | 'this_week' | 'all'

export interface WeekGroup {
  weekStart: string
  weekEnd: string
  cutoffDate: string
  clearDate: string
  logs: LogEntry[]
  totalHours: number
  status: 'active' | 'pending' | 'cleared'
}
