import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LogEntry, NeedsItem } from './types'

interface LogState {
  logs: LogEntry[]
  addLog: (log: LogEntry) => void
  updateLog: (id: string, data: Partial<LogEntry>) => void
  removeLog: (id: string) => void
  removeLogs: (ids: string[]) => void
}

export const useLogStore = create<LogState>()(
  persist(
    (set) => ({
      logs: [],
      addLog: (log) => set((s) => ({ logs: [...s.logs, log] })),
      updateLog: (id, data) =>
        set((s) => ({
          logs: s.logs.map((l) => (l.id === id ? { ...l, ...data } : l)),
        })),
      removeLog: (id) => set((s) => ({ logs: s.logs.filter((l) => l.id !== id) })),
      removeLogs: (ids) => set((s) => ({ logs: s.logs.filter((l) => !ids.includes(l.id)) })),
    }),
    { name: 'logtime_entries' }
  )
)

interface RateState {
  rate: number
  currency: string
  exchangeRate: number // 1 USD = ? IDR
  setRate: (rate: number) => void
  setCurrency: (currency: string) => void
  setExchangeRate: (rate: number) => void
}

export const useRateStore = create<RateState>()(
  persist(
    (set) => ({
      rate: 15,
      currency: 'USD',
      exchangeRate: 16500,
      setRate: (rate) => set({ rate }),
      setCurrency: (currency) => set({ currency }),
      setExchangeRate: (exchangeRate) => set({ exchangeRate }),
    }),
    { name: 'logtime_rate' }
  )
)

interface TargetState {
  weeklyTarget: number
  setWeeklyTarget: (amount: number) => void
}

export const useTargetStore = create<TargetState>()(
  persist(
    (set) => ({
      weeklyTarget: 200,
      setWeeklyTarget: (weeklyTarget) => set({ weeklyTarget }),
    }),
    { name: 'logtime_weekly_target' }
  )
)

interface BalanceState {
  manualBalance: number
  setManualBalance: (amount: number) => void
}

export const useBalanceStore = create<BalanceState>()(
  persist(
    (set) => ({
      manualBalance: 0,
      setManualBalance: (manualBalance) => set({ manualBalance }),
    }),
    { name: 'logtime_balance' }
  )
)

interface NeedsState {
  needs: NeedsItem[]
  addNeed: (item: NeedsItem) => void
  updateNeed: (id: string, data: Partial<NeedsItem>) => void
  removeNeed: (id: string) => void
  allocate: (id: string, amount: number) => void
  allocateFromPending: (id: string, amount: number, clearDate: string) => void
  withdraw: (id: string, amount: number) => void
}

export const useNeedsStore = create<NeedsState>()(
  persist(
    (set) => ({
      needs: [],
      addNeed: (item) => set((s) => ({ needs: [...s.needs, item] })),
      updateNeed: (id, data) =>
        set((s) => ({
          needs: s.needs.map((n) => (n.id === id ? { ...n, ...data } : n)),
        })),
      removeNeed: (id) => set((s) => ({ needs: s.needs.filter((n) => n.id !== id) })),
      allocate: (id, amount) =>
        set((s) => ({
          needs: s.needs.map((n) =>
            n.id === id ? { ...n, allocated: (n.allocated || 0) + amount } : n
          ),
        })),
      allocateFromPending: (id, amount, clearDate) =>
        set((s) => ({
          needs: s.needs.map((n) =>
            n.id === id
              ? {
                  ...n,
                  allocated: (n.allocated || 0) + amount,
                  pendingAllocations: [
                    ...(n.pendingAllocations || []),
                    { amount, clearDate },
                  ],
                }
              : n
          ),
        })),
      withdraw: (id, amount) =>
        set((s) => ({
          needs: s.needs.map((n) =>
            n.id === id ? { ...n, allocated: Math.max(0, (n.allocated || 0) - amount) } : n
          ),
        })),
    }),
    { name: 'logtime_needs' }
  )
)
