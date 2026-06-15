import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LogEntry, Pocket } from './types'

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
  exchangeRate: number
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

interface PocketState {
  pockets: Pocket[]
  addPocket: (pocket: Pocket) => void
  updatePocket: (id: string, data: Partial<Pocket>) => void
  removePocket: (id: string) => void
  topUp: (id: string, amount: number) => void
  topUpFromPending: (id: string, amount: number, clearDate: string) => void
  /** Decrease pocket saldo. For goal pockets, also decreases target_amount. */
  withdrawFromPocket: (id: string, amount: number) => void
  /** Transfer saldo between two pockets (in USD, converted per pocket currency). */
  transferBetweenPockets: (fromId: string, toId: string, fromAmount: number, toAmount: number) => void
}

export const usePocketStore = create<PocketState>()(
  persist(
    (set) => ({
      pockets: [],
      addPocket: (pocket) => set((s) => ({ pockets: [...s.pockets, pocket] })),
      updatePocket: (id, data) =>
        set((s) => ({
          pockets: s.pockets.map((p) => (p.id === id ? { ...p, ...data } : p)),
        })),
      removePocket: (id) => set((s) => ({ pockets: s.pockets.filter((p) => p.id !== id) })),
      topUp: (id, amount) =>
        set((s) => ({
          pockets: s.pockets.map((p) =>
            p.id === id ? { ...p, saldo: p.saldo + amount } : p
          ),
        })),
      topUpFromPending: (id, amount, clearDate) =>
        set((s) => ({
          pockets: s.pockets.map((p) =>
            p.id === id
              ? {
                  ...p,
                  saldo: p.saldo + amount,
                  pendingAllocations: [
                    ...(p.pendingAllocations || []),
                    { amount, clearDate },
                  ],
                }
              : p
          ),
        })),
      withdrawFromPocket: (id, amount) =>
        set((s) => ({
          pockets: s.pockets.map((p) => {
            if (p.id !== id) return p
            const newSaldo = Math.max(0, p.saldo - amount)
            if (p.tipe === 'goal' && p.target_amount != null) {
              return {
                ...p,
                saldo: newSaldo,
                target_amount: p.target_amount - amount,
                target_awal: Math.max(0, (p.target_awal ?? 0) - amount),
              }
            }
            return { ...p, saldo: newSaldo }
          }),
        })),
      transferBetweenPockets: (fromId, toId, fromAmount, toAmount) =>
        set((s) => ({
          pockets: s.pockets.map((p) => {
            if (p.id === fromId) return { ...p, saldo: Math.max(0, p.saldo - fromAmount) }
            if (p.id === toId) return { ...p, saldo: p.saldo + toAmount }
            return p
          }),
        })),
    }),
    { name: 'logtime_pockets' }
  )
)
