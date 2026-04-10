export interface LogEntry {
  id: string
  date: string
  description: string
  duration: number
  project?: string
}

export interface NeedsItem {
  id: string
  name: string
  amount: number        // target amount
  allocated: number     // amount saved/allocated (in same currency as need)
  currency: 'USD' | 'IDR'
  priority: 'high' | 'medium' | 'low'
}

export type Period = 'today' | 'this_week' | 'all'

export interface WeekGroup {
  weekStart: string // Monday ISO date
  weekEnd: string   // Sunday ISO date
  cutoffDate: string // Sunday ISO date (cutoff night)
  clearDate: string  // 10 days after cutoff
  logs: LogEntry[]
  totalHours: number
  status: 'active' | 'pending' | 'cleared'
}
