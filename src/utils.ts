import type { LogEntry, NeedsItem, Period, WeekGroup } from './types'

export function generateId(): string {
  return crypto.randomUUID()
}

export function getMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

export function getSunday(monday: Date): Date {
  const d = new Date(monday)
  d.setDate(monday.getDate() + 6)
  return d
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function filterByPeriod(logs: LogEntry[], period: Period): LogEntry[] {
  if (period === 'all') return logs

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (period === 'today') {
    const todayStr = toDateStr(today)
    return logs.filter((log) => log.date === todayStr)
  }

  if (period === 'this_week') {
    const monday = getMonday(today)
    const sunday = getSunday(monday)
    const monStr = toDateStr(monday)
    const sunStr = toDateStr(sunday)
    return logs.filter((log) => log.date >= monStr && log.date <= sunStr)
  }

  return logs
}

export function calculateEarnings(totalHours: number, rate: number) {
  if (totalHours === 0) {
    return { totalHours: 0, gross: 0, deduction: 0, net: 0 }
  }

  const gross = totalHours * rate
  const deduction = gross * 0.1 + 1
  const net = gross - deduction

  return { totalHours, gross, deduction, net }
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m} menit`
  if (m === 0) return `${h} jam`
  return `${h} jam ${m} menit`
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

/**
 * Group logs by week and determine status:
 * - active: current week (Mon-Sun)
 * - pending: past week, less than 10 days since cutoff (Sunday night)
 * - cleared: past week, 10+ days since cutoff
 */
export function groupLogsByWeek(logs: LogEntry[]): WeekGroup[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const currentMonday = getMonday(today)
  const currentMondayStr = toDateStr(currentMonday)

  // Group logs by their week's Monday
  const weekMap = new Map<string, LogEntry[]>()
  for (const log of logs) {
    const logDate = new Date(log.date + 'T00:00:00')
    const monday = getMonday(logDate)
    const key = toDateStr(monday)
    if (!weekMap.has(key)) weekMap.set(key, [])
    weekMap.get(key)!.push(log)
  }

  const groups: WeekGroup[] = []
  for (const [mondayStr, weekLogs] of weekMap) {
    const monday = new Date(mondayStr + 'T00:00:00')
    const sunday = getSunday(monday)
    const clearDate = addDays(sunday, 10)

    const isCurrentWeek = mondayStr === currentMondayStr
    let status: WeekGroup['status']
    if (isCurrentWeek) {
      status = 'active'
    } else if (today >= clearDate) {
      status = 'cleared'
    } else {
      status = 'pending'
    }

    const totalHours = weekLogs.reduce((sum, l) => sum + l.duration, 0)

    groups.push({
      weekStart: mondayStr,
      weekEnd: toDateStr(sunday),
      cutoffDate: toDateStr(sunday),
      clearDate: toDateStr(clearDate),
      logs: weekLogs.sort((a, b) => b.date.localeCompare(a.date)),
      totalHours,
      status,
    })
  }

  // Sort by weekStart descending (newest first)
  groups.sort((a, b) => b.weekStart.localeCompare(a.weekStart))
  return groups
}

/**
 * Calculate the locked (pending) amount in a need's own currency.
 * Locked = sum of pendingAllocations where clearDate > today.
 */
export function getLockedAmount(need: NeedsItem): number {
  if (!need.pendingAllocations?.length) return 0
  const today = toDateStr(new Date())
  return need.pendingAllocations
    .filter((pa) => pa.clearDate > today)
    .reduce((sum, pa) => sum + pa.amount, 0)
}

/**
 * Clean up pendingAllocations that have already cleared (clearDate <= today).
 * Returns a new array or undefined if empty.
 */
export function cleanPendingAllocations(need: NeedsItem): NeedsItem['pendingAllocations'] {
  if (!need.pendingAllocations?.length) return undefined
  const today = toDateStr(new Date())
  const remaining = need.pendingAllocations.filter((pa) => pa.clearDate > today)
  return remaining.length > 0 ? remaining : undefined
}
