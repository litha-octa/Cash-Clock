import { useState, useMemo } from 'react';
import { useNeedsStore, useRateStore, useLogStore, useBalanceStore } from '../store';
import { calculateEarnings, formatCurrency, generateId, groupLogsByWeek, getLockedAmount, formatDateShort } from '../utils';
import type { NeedsItem } from '../types';

type Priority = 'high' | 'medium' | 'low';
type NeedCurrency = 'USD' | 'IDR';

function formatRupiahInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('id-ID');
}

function parseRupiahInput(formatted: string): number {
  return Number(formatted.replace(/\D/g, '')) || 0;
}

const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const priorityBadge: Record<Priority, { label: string; cls: string }> = {
  high: { label: 'Tinggi', cls: 'bg-red-500/20 text-red-400' },
  medium: { label: 'Sedang', cls: 'bg-yellow-500/20 text-yellow-400' },
  low: { label: 'Rendah', cls: 'bg-blue-500/20 text-blue-400' },
};

export default function NeedsPage() {
  const needs = useNeedsStore((s) => s.needs);
  const addNeed = useNeedsStore((s) => s.addNeed);
  const updateNeed = useNeedsStore((s) => s.updateNeed);
  const removeNeed = useNeedsStore((s) => s.removeNeed);
  const allocate = useNeedsStore((s) => s.allocate);
  const allocateFromPending = useNeedsStore((s) => s.allocateFromPending);
  const withdraw = useNeedsStore((s) => s.withdraw);

  const rate = useRateStore((s) => s.rate);
  const exchangeRate = useRateStore((s) => s.exchangeRate);
  const logs = useLogStore((s) => s.logs);
  const manualBalance = useBalanceStore((s) => s.manualBalance);
  const setManualBalance = useBalanceStore((s) => s.setManualBalance);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [needCurrency, setNeedCurrency] = useState<NeedCurrency>('IDR');
  const [priority, setPriority] = useState<Priority>('medium');

  // Allocate modal state
  const [allocatingId, setAllocatingId] = useState<string | null>(null);
  const [allocateAmount, setAllocateAmount] = useState('');
  const [allocateMode, setAllocateMode] = useState<'add' | 'withdraw'>('add');
  const [allocateSource, setAllocateSource] = useState<'balance' | 'pending'>('balance');
  const [selectedPendingWeek, setSelectedPendingWeek] = useState<string | null>(null);

  // Multi-withdraw state
  const [withdrawMode, setWithdrawMode] = useState(false);
  const [selectedWithdrawIds, setSelectedWithdrawIds] = useState<Set<string>>(new Set());
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  // Calculate total cleared balance (USD)
  const weekGroups = useMemo(() => groupLogsByWeek(logs), [logs]);
  const totalBalanceUSD = useMemo(
    () => weekGroups
      .filter((g) => g.status === 'cleared')
      .reduce((sum, g) => sum + calculateEarnings(g.totalHours, rate).net, 0),
    [weekGroups, rate],
  );

  // Pending groups and total pending
  const pendingGroups = useMemo(
    () => weekGroups.filter((g) => g.status === 'pending'),
    [weekGroups],
  );
  const totalPendingUSD = useMemo(
    () => pendingGroups.reduce((sum, g) => sum + calculateEarnings(g.totalHours, rate).net, 0),
    [pendingGroups, rate],
  );

  // Total allocated converted to USD
  const totalAllocatedUSD = useMemo(
    () => needs.reduce((sum, n) => {
      const alloc = n.allocated || 0;
      if ((n.currency || 'USD') === 'IDR') return sum + alloc / exchangeRate;
      return sum + alloc;
    }, 0),
    [needs, exchangeRate],
  );

  // Total locked (pending allocations not yet cleared) in USD
  const totalLockedUSD = useMemo(
    () => needs.reduce((sum, n) => {
      const locked = getLockedAmount(n);
      if ((n.currency || 'USD') === 'IDR') return sum + locked / exchangeRate;
      return sum + locked;
    }, 0),
    [needs, exchangeRate],
  );

  const freeBalanceUSD = totalBalanceUSD + manualBalance - (totalAllocatedUSD - totalLockedUSD);
  const freePendingUSD = totalPendingUSD - totalLockedUSD;

  const sortedNeeds = useMemo(
    () => [...needs].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    [needs],
  );

  // Withdrawable needs (has unlocked allocated > 0)
  const withdrawableNeeds = useMemo(
    () => needs.filter((n) => {
      const allocated = n.allocated || 0;
      const locked = getLockedAmount(n);
      return allocated - locked > 0;
    }),
    [needs],
  );

  // Multi-withdraw summary
  const withdrawSummary = useMemo(() => {
    const items: { need: NeedsItem; withdrawAmount: number; withdrawUSD: number }[] = [];
    let totalUSD = 0;
    for (const id of selectedWithdrawIds) {
      const need = needs.find((n) => n.id === id);
      if (!need) continue;
      const allocated = need.allocated || 0;
      const locked = getLockedAmount(need);
      const withdrawable = Math.max(0, allocated - locked);
      if (withdrawable <= 0) continue;
      const cur = need.currency || 'USD';
      const usd = cur === 'IDR' ? withdrawable / exchangeRate : withdrawable;
      items.push({ need, withdrawAmount: withdrawable, withdrawUSD: usd });
      totalUSD += usd;
    }
    return { items, totalUSD };
  }, [selectedWithdrawIds, needs, exchangeRate]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setAmount('');
    setNeedCurrency('IDR');
    setPriority('medium');
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (needCurrency === 'IDR') {
      setAmount(formatRupiahInput(e.target.value));
    } else {
      setAmount(e.target.value);
    }
  };

  const handleCurrencySwitch = (cur: NeedCurrency) => {
    if (cur === needCurrency) return;
    setNeedCurrency(cur);
    setAmount('');
  };

  const getAmountValue = (): number => {
    if (needCurrency === 'IDR') return parseRupiahInput(amount);
    return parseFloat(amount) || 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = getAmountValue();
    if (!name.trim() || parsedAmount <= 0) return;

    if (editingId) {
      updateNeed(editingId, {
        name: name.trim(),
        amount: parsedAmount,
        currency: needCurrency,
        priority,
      });
    } else {
      addNeed({
        id: generateId(),
        name: name.trim(),
        amount: parsedAmount,
        allocated: 0,
        currency: needCurrency,
        priority,
      });
    }

    resetForm();
  };

  const handleEdit = (need: NeedsItem) => {
    const cur = need.currency || 'USD';
    setEditingId(need.id);
    setName(need.name);
    setNeedCurrency(cur);
    setAmount(
      cur === 'IDR'
        ? formatRupiahInput(need.amount.toString())
        : need.amount.toString()
    );
    setPriority(need.priority);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    removeNeed(id);
    if (editingId === id) resetForm();
  };

  const openAllocate = (id: string, mode: 'add' | 'withdraw') => {
    setAllocatingId(id);
    setAllocateMode(mode);
    setAllocateAmount('');
    setAllocateSource('balance');
    setSelectedPendingWeek(pendingGroups.length > 0 ? pendingGroups[0].weekStart : null);
  };

  const handleAllocateSubmit = () => {
    if (!allocatingId) return;
    const need = needs.find((n) => n.id === allocatingId);
    if (!need) return;

    const cur = need.currency || 'USD';
    let val: number;
    if (cur === 'IDR') {
      val = parseRupiahInput(allocateAmount);
    } else {
      val = parseFloat(allocateAmount) || 0;
    }
    if (val <= 0) return;

    if (allocateMode === 'add') {
      const costUSD = cur === 'IDR' ? val / exchangeRate : val;

      if (allocateSource === 'pending') {
        if (costUSD > freePendingUSD + 0.001) return;
        const group = pendingGroups.find((g) => g.weekStart === selectedPendingWeek);
        if (!group) return;
        const groupAvailUSD = calculateEarnings(group.totalHours, rate).net;
        if (costUSD > groupAvailUSD + 0.001) return;
        allocateFromPending(allocatingId, val, group.clearDate);
      } else {
        if (costUSD > freeBalanceUSD + 0.001) return;
        allocate(allocatingId, val);
      }
    } else {
      const allocated = need.allocated || 0;
      const locked = getLockedAmount(need);
      const withdrawable = allocated - locked;
      withdraw(allocatingId, Math.min(val, Math.max(0, withdrawable)));
    }

    setAllocatingId(null);
    setAllocateAmount('');
  };

  // Toggle multi-withdraw mode
  const toggleWithdrawMode = () => {
    if (withdrawMode) {
      setWithdrawMode(false);
      setSelectedWithdrawIds(new Set());
    } else {
      setWithdrawMode(true);
      setSelectedWithdrawIds(new Set());
    }
  };

  const toggleWithdrawSelect = (id: string) => {
    setSelectedWithdrawIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllWithdrawable = () => {
    if (selectedWithdrawIds.size === withdrawableNeeds.length) {
      setSelectedWithdrawIds(new Set());
    } else {
      setSelectedWithdrawIds(new Set(withdrawableNeeds.map((n) => n.id)));
    }
  };

  const handleMultiWithdraw = () => {
    for (const item of withdrawSummary.items) {
      withdraw(item.need.id, item.withdrawAmount);
    }
    setManualBalance(manualBalance - withdrawSummary.totalUSD);
    setShowWithdrawConfirm(false);
    setWithdrawMode(false);
    setSelectedWithdrawIds(new Set());
  };

  const allocatingNeed = allocatingId ? needs.find((n) => n.id === allocatingId) : null;
  const allocatingCur = allocatingNeed?.currency || 'USD';

  // Summary
  const summaryUSD = useMemo(() => {
    const items = needs.filter((n) => (n.currency || 'USD') === 'USD');
    const target = items.reduce((s, n) => s + n.amount, 0);
    const alloc = items.reduce((s, n) => s + (n.allocated || 0), 0);
    return { target, allocated: alloc };
  }, [needs]);

  const summaryIDR = useMemo(() => {
    const items = needs.filter((n) => n.currency === 'IDR');
    const target = items.reduce((s, n) => s + n.amount, 0);
    const alloc = items.reduce((s, n) => s + (n.allocated || 0), 0);
    return { target, allocated: alloc };
  }, [needs]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">
        {editingId ? 'Edit Kantong' : 'Kantong Kebutuhan'}
      </h1>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/70 mb-1">Saldo Tersedia</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(Math.max(0, freeBalanceUSD), 'USD')}</p>
          <p className="text-sm text-emerald-400/60 font-medium">
            {formatCurrency(Math.max(0, freeBalanceUSD) * exchangeRate, 'IDR')}
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-yellow-400/70 mb-1">Saldo Pending</p>
          <p className="text-xl font-bold text-yellow-400">{formatCurrency(Math.max(0, freePendingUSD), 'USD')}</p>
          <p className="text-sm text-yellow-400/60 font-medium">
            {formatCurrency(Math.max(0, freePendingUSD) * exchangeRate, 'IDR')}
          </p>
        </div>
      </div>

      {/* Withdraw Button */}
      {withdrawableNeeds.length > 0 && (
        <button
          onClick={toggleWithdrawMode}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-colors ${
            withdrawMode
              ? 'bg-gray-700 border border-gray-600 text-gray-300'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
          </svg>
          {withdrawMode ? 'Batal Tarik Saldo' : 'Tarik Saldo dari Kantong'}
        </button>
      )}

      {/* Withdraw selection bar */}
      {withdrawMode && (
        <div className="rounded-2xl bg-gray-800 p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">
              Pilih kantong untuk ditarik ({selectedWithdrawIds.size} dipilih)
            </p>
            <button
              onClick={selectAllWithdrawable}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              {selectedWithdrawIds.size === withdrawableNeeds.length ? 'Batal Semua' : 'Pilih Semua'}
            </button>
          </div>

          <ul className="space-y-2">
            {withdrawableNeeds.map((need) => {
              const cur = need.currency || 'USD';
              const allocated = need.allocated || 0;
              const locked = getLockedAmount(need);
              const withdrawable = Math.max(0, allocated - locked);
              const isSelected = selectedWithdrawIds.has(need.id);

              return (
                <li
                  key={need.id}
                  onClick={() => toggleWithdrawSelect(need.id)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30'
                      : 'bg-gray-900/50 hover:bg-gray-900/80'
                  }`}
                >
                  <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
                  }`}>
                    {isSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{need.name}</p>
                    {locked > 0 && (
                      <p className="text-xs text-yellow-400/70">
                        {formatCurrency(locked, cur)} terkunci
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-emerald-400">{formatCurrency(withdrawable, cur)}</p>
                    {cur === 'IDR' && (
                      <p className="text-xs text-gray-500">{formatCurrency(withdrawable / exchangeRate, 'USD')}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {selectedWithdrawIds.size > 0 && (
            <button
              onClick={() => setShowWithdrawConfirm(true)}
              className="w-full rounded-xl bg-emerald-500 py-2.5 font-semibold text-white hover:bg-emerald-600 transition-colors"
            >
              Tarik {selectedWithdrawIds.size} Kantong
            </button>
          )}
        </div>
      )}

      {/* Form */}
      {!withdrawMode && (
        <form onSubmit={handleSubmit} className="rounded-2xl bg-gray-800 p-5 shadow-lg space-y-4">
          <p className="text-sm font-medium text-gray-400">{editingId ? 'Edit kantong' : 'Buat kantong baru'}</p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">Nama</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Bayar kost"
              className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white placeholder-gray-600 outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">Target</label>
            <div className="flex gap-2">
              <div className="flex rounded-xl bg-gray-900 ring-1 ring-gray-700 overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => handleCurrencySwitch('IDR')}
                  className={`px-3 py-2.5 text-sm font-medium transition-colors ${
                    needCurrency === 'IDR'
                      ? 'bg-emerald-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Rp
                </button>
                <button
                  type="button"
                  onClick={() => handleCurrencySwitch('USD')}
                  className={`px-3 py-2.5 text-sm font-medium transition-colors ${
                    needCurrency === 'USD'
                      ? 'bg-emerald-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  $
                </button>
              </div>
              {needCurrency === 'IDR' ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="50.000"
                  className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white placeholder-gray-600 outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
                />
              ) : (
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0.00"
                  className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white placeholder-gray-600 outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
                />
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">Prioritas</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
            >
              <option value="high">Tinggi</option>
              <option value="medium">Sedang</option>
              <option value="low">Rendah</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-emerald-500 py-2.5 font-semibold text-white hover:bg-emerald-600 transition-colors"
            >
              {editingId ? 'Simpan' : 'Buat Kantong'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl bg-gray-700 px-5 py-2.5 font-medium text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Batal
              </button>
            )}
          </div>
        </form>
      )}

      {/* Needs / Kantong List */}
      {!withdrawMode && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Daftar Kantong ({sortedNeeds.length})
          </h2>

          {sortedNeeds.length === 0 ? (
            <div className="rounded-2xl bg-gray-800 p-8 text-center shadow-lg">
              <p className="text-gray-500">Belum ada kantong. Buat kantong pertamamu!</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {sortedNeeds.map((need) => {
                const cur = need.currency || 'USD';
                const allocated = need.allocated || 0;
                const progress = need.amount > 0 ? (allocated / need.amount) * 100 : 0;
                const isFull = allocated >= need.amount;

                return (
                  <li
                    key={need.id}
                    className={`rounded-2xl bg-gray-800 p-4 shadow-lg ${isFull ? 'ring-1 ring-emerald-500/30' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${isFull ? 'text-emerald-400' : 'text-white'}`}>
                          {need.name}
                        </p>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            priorityBadge[need.priority].cls
                          }`}
                        >
                          {priorityBadge[need.priority].label}
                        </span>
                        {isFull && (
                          <span className="inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                            Terpenuhi
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-gray-700">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${isFull ? 'bg-emerald-500' : 'bg-yellow-500'}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-sm mb-3">
                      <span className={`font-semibold ${isFull ? 'text-emerald-400' : 'text-white'}`}>
                        {formatCurrency(allocated, cur)}
                      </span>
                      <span className="text-gray-400">
                        / {formatCurrency(need.amount, cur)}
                      </span>
                    </div>

                    {/* Locked indicator */}
                    {(() => {
                      const locked = getLockedAmount(need);
                      if (locked <= 0) return null;
                      const pa = (need.pendingAllocations || []).filter((p) => p.clearDate > new Date().toISOString().split('T')[0]);
                      const nearestClear = pa.length > 0 ? pa.reduce((min, p) => p.clearDate < min ? p.clearDate : min, pa[0].clearDate) : '';
                      return (
                        <div className="flex items-center gap-1.5 mb-3 rounded-lg bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          <span>{formatCurrency(locked, cur)} terkunci dari pending · cair {formatDateShort(nearestClear)}</span>
                        </div>
                      );
                    })()}

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => openAllocate(need.id, 'add')}
                        disabled={freeBalanceUSD <= 0 && freePendingUSD <= 0}
                        className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        + Isi Saldo
                      </button>
                      <button
                        onClick={() => handleEdit(need)}
                        className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-600 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(need.id)}
                        className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        Hapus
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Allocate Modal */}
      {allocatingId && allocatingNeed && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setAllocatingId(null)}>
          <div
            className="w-full max-w-lg rounded-t-2xl bg-gray-800 p-5 pb-24 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">
              {allocateMode === 'add' ? 'Isi Saldo' : 'Tarik Saldo'} — {allocatingNeed.name}
            </h3>

            {allocateMode === 'add' && (
              <>
                {/* Source selector */}
                <div className="flex rounded-xl bg-gray-900 ring-1 ring-gray-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAllocateSource('balance')}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                      allocateSource === 'balance'
                        ? 'bg-emerald-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Saldo Tersedia
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocateSource('pending')}
                    disabled={pendingGroups.length === 0}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      allocateSource === 'pending'
                        ? 'bg-yellow-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Saldo Pending
                  </button>
                </div>

                {allocateSource === 'balance' ? (
                  <p className="text-xs text-gray-400">
                    Saldo tersedia: {formatCurrency(Math.max(0, freeBalanceUSD), 'USD')}
                    {allocatingCur === 'IDR' && (
                      <> ({formatCurrency(Math.max(0, freeBalanceUSD) * exchangeRate, 'IDR')})</>
                    )}
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-gray-400">
                      Total pending: {formatCurrency(Math.max(0, freePendingUSD), 'USD')}
                      {allocatingCur === 'IDR' && (
                        <> ({formatCurrency(Math.max(0, freePendingUSD) * exchangeRate, 'IDR')})</>
                      )}
                    </p>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Pilih minggu pending</label>
                      <select
                        value={selectedPendingWeek || ''}
                        onChange={(e) => setSelectedPendingWeek(e.target.value)}
                        className="w-full rounded-xl bg-gray-900 px-3 py-2 text-sm text-white outline-none ring-1 ring-gray-700 focus:ring-yellow-500 transition-shadow"
                      >
                        {pendingGroups.map((g) => {
                          const ge = calculateEarnings(g.totalHours, rate).net;
                          return (
                            <option key={g.weekStart} value={g.weekStart}>
                              {formatDateShort(g.weekStart)} - {formatDateShort(g.weekEnd)} · {formatCurrency(ge, 'USD')} · cair {formatDateShort(g.clearDate)}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <p className="text-xs text-yellow-400/80 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Saldo dari pending tidak bisa ditarik sampai masa pending berakhir
                    </p>
                  </>
                )}
              </>
            )}
            {allocateMode === 'withdraw' && (() => {
              const locked = getLockedAmount(allocatingNeed);
              const withdrawable = (allocatingNeed.allocated || 0) - locked;
              return (
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">
                    Saldo kantong: {formatCurrency(allocatingNeed.allocated || 0, allocatingCur)}
                  </p>
                  {locked > 0 && (
                    <p className="text-xs text-yellow-400/80">
                      Terkunci (pending): {formatCurrency(locked, allocatingCur)}
                    </p>
                  )}
                  <p className="text-xs text-emerald-400">
                    Bisa ditarik: {formatCurrency(Math.max(0, withdrawable), allocatingCur)}
                  </p>
                </div>
              );
            })()}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-400">
                Jumlah ({allocatingCur === 'IDR' ? 'Rp' : '$'})
              </label>
              {allocatingCur === 'IDR' ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={allocateAmount}
                  onChange={(e) => setAllocateAmount(formatRupiahInput(e.target.value))}
                  placeholder="50.000"
                  autoFocus
                  className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white placeholder-gray-600 outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
                />
              ) : (
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={allocateAmount}
                  onChange={(e) => setAllocateAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white placeholder-gray-600 outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
                />
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAllocateSubmit}
                className={`flex-1 rounded-xl py-2.5 font-semibold text-white transition-colors ${
                  allocateMode === 'add'
                    ? allocateSource === 'pending'
                      ? 'bg-yellow-500 hover:bg-yellow-600'
                      : 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-yellow-500 hover:bg-yellow-600'
                }`}
              >
                {allocateMode === 'add'
                  ? allocateSource === 'pending' ? 'Isi dari Pending' : 'Isi Saldo'
                  : 'Tarik Saldo'}
              </button>
              <button
                onClick={() => setAllocatingId(null)}
                className="rounded-xl bg-gray-700 px-5 py-2.5 font-medium text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Withdraw Confirmation Modal */}
      {showWithdrawConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowWithdrawConfirm(false)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-gray-800 p-6 shadow-xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-4">
              Rincian Penarikan
            </h3>

            <ul className="space-y-3 mb-4">
              {withdrawSummary.items.map((item) => {
                const cur = item.need.currency || 'USD';
                return (
                  <li key={item.need.id} className="rounded-xl bg-gray-900/50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{item.need.name}</p>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${priorityBadge[item.need.priority].cls}`}>
                          {priorityBadge[item.need.priority].label}
                        </span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-semibold text-emerald-400">
                          {formatCurrency(item.withdrawAmount, cur)}
                        </p>
                        {cur === 'IDR' && (
                          <p className="text-xs text-gray-500">
                            {formatCurrency(item.withdrawUSD, 'USD')}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Total */}
            <div className="border-t border-gray-700 pt-4 mb-5">
              <div className="flex justify-between items-end">
                <span className="text-sm text-gray-400">Total Penarikan</span>
                <div className="text-right">
                  <p className="text-xl font-bold text-emerald-400">
                    {formatCurrency(withdrawSummary.totalUSD, 'USD')}
                  </p>
                  <p className="text-sm text-emerald-400/60 font-medium">
                    {formatCurrency(withdrawSummary.totalUSD * exchangeRate, 'IDR')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdrawConfirm(false)}
                className="flex-1 rounded-xl bg-gray-700 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleMultiWithdraw}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
              >
                Tarik Saldo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {needs.length > 0 && !withdrawMode && (
        <div className="rounded-2xl bg-gray-800 p-5 shadow-lg">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Ringkasan
          </h2>

          <div className="space-y-2">
            {summaryUSD.target > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-2">USD</p>
                <div className="flex justify-between text-gray-300">
                  <span>Target</span>
                  <span className="font-medium text-white">{formatCurrency(summaryUSD.target, 'USD')}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Terisi</span>
                  <span className="font-medium text-emerald-400">{formatCurrency(summaryUSD.allocated, 'USD')}</span>
                </div>
              </>
            )}

            {summaryIDR.target > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-2">IDR</p>
                <div className="flex justify-between text-gray-300">
                  <span>Target</span>
                  <span className="font-medium text-white">{formatCurrency(summaryIDR.target, 'IDR')}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Terisi</span>
                  <span className="font-medium text-emerald-400">{formatCurrency(summaryIDR.allocated, 'IDR')}</span>
                </div>
              </>
            )}

            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="flex justify-between text-gray-300">
                <span>Total Dialokasikan</span>
                <span className="font-medium text-white">{formatCurrency(totalAllocatedUSD, 'USD')}</span>
              </div>
              <div className="flex justify-between text-gray-300 mt-1">
                <span>Saldo Tersedia</span>
                <span className="font-bold text-emerald-400">{formatCurrency(Math.max(0, freeBalanceUSD), 'USD')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
