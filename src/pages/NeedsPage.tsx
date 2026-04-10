import { useState, useMemo } from 'react';
import { useNeedsStore, useRateStore, useLogStore } from '../store';
import { calculateEarnings, formatCurrency, generateId, groupLogsByWeek } from '../utils';
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
  const withdraw = useNeedsStore((s) => s.withdraw);

  const rate = useRateStore((s) => s.rate);
  const exchangeRate = useRateStore((s) => s.exchangeRate);
  const logs = useLogStore((s) => s.logs);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [needCurrency, setNeedCurrency] = useState<NeedCurrency>('IDR');
  const [priority, setPriority] = useState<Priority>('medium');

  // Allocate modal state
  const [allocatingId, setAllocatingId] = useState<string | null>(null);
  const [allocateAmount, setAllocateAmount] = useState('');
  const [allocateMode, setAllocateMode] = useState<'add' | 'withdraw'>('add');

  // Calculate total cleared balance (USD)
  const weekGroups = useMemo(() => groupLogsByWeek(logs), [logs]);
  const totalBalanceUSD = useMemo(
    () => weekGroups
      .filter((g) => g.status === 'cleared')
      .reduce((sum, g) => sum + calculateEarnings(g.totalHours, rate).net, 0),
    [weekGroups, rate],
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

  const freeBalanceUSD = totalBalanceUSD - totalAllocatedUSD;

  const sortedNeeds = useMemo(
    () => [...needs].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    [needs],
  );

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
      // Check if enough free balance
      const costUSD = cur === 'IDR' ? val / exchangeRate : val;
      if (costUSD > freeBalanceUSD + 0.001) return; // not enough balance
      allocate(allocatingId, val);
    } else {
      const allocated = need.allocated || 0;
      withdraw(allocatingId, Math.min(val, allocated));
    }

    setAllocatingId(null);
    setAllocateAmount('');
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

      {/* Free Balance Card */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/70 mb-1">Saldo Tersedia</p>
        <p className="text-xl font-bold text-emerald-400">{formatCurrency(Math.max(0, freeBalanceUSD), 'USD')}</p>
        <p className="text-sm text-emerald-400/60 font-medium">
          {formatCurrency(Math.max(0, freeBalanceUSD) * exchangeRate, 'IDR')}
        </p>
      </div>

      {/* Form */}
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

      {/* Needs / Kantong List */}
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

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => openAllocate(need.id, 'add')}
                      disabled={freeBalanceUSD <= 0}
                      className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      + Isi Saldo
                    </button>
                    {allocated > 0 && (
                      <button
                        onClick={() => openAllocate(need.id, 'withdraw')}
                        className="rounded-lg bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                      >
                        Tarik Saldo
                      </button>
                    )}
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

      {/* Allocate Modal */}
      {allocatingId && allocatingNeed && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setAllocatingId(null)}>
          <div
            className="w-full max-w-lg rounded-t-2xl bg-gray-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">
              {allocateMode === 'add' ? 'Isi Saldo' : 'Tarik Saldo'} — {allocatingNeed.name}
            </h3>

            {allocateMode === 'add' && (
              <p className="text-xs text-gray-400">
                Saldo tersedia: {formatCurrency(Math.max(0, freeBalanceUSD), 'USD')}
                {allocatingCur === 'IDR' && (
                  <> ({formatCurrency(Math.max(0, freeBalanceUSD) * exchangeRate, 'IDR')})</>
                )}
              </p>
            )}
            {allocateMode === 'withdraw' && (
              <p className="text-xs text-gray-400">
                Saldo kantong: {formatCurrency(allocatingNeed.allocated || 0, allocatingCur)}
              </p>
            )}

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
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-yellow-500 hover:bg-yellow-600'
                }`}
              >
                {allocateMode === 'add' ? 'Isi Saldo' : 'Tarik Saldo'}
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

      {/* Summary */}
      {needs.length > 0 && (
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
