import { useState } from 'react';
import { useRateStore, useTargetStore, useLogStore } from '../store';
import { groupLogsByWeek, calculateEarnings, formatCurrency } from '../utils';

function formatRupiahInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('id-ID');
}

function parseRupiahInput(formatted: string): number {
  return Number(formatted.replace(/\D/g, '')) || 0;
}

export default function Settings() {
  const rate = useRateStore((s) => s.rate);
  const currency = useRateStore((s) => s.currency);
  const exchangeRate = useRateStore((s) => s.exchangeRate);
  const setRate = useRateStore((s) => s.setRate);
  const setCurrency = useRateStore((s) => s.setCurrency);
  const setExchangeRate = useRateStore((s) => s.setExchangeRate);
  const weeklyTarget = useTargetStore((s) => s.weeklyTarget);
  const setWeeklyTarget = useTargetStore((s) => s.setWeeklyTarget);

  const logs = useLogStore((s) => s.logs);
  const removeLogs = useLogStore((s) => s.removeLogs);
  const [confirmDelete, setConfirmDelete] = useState<'balance' | 'pending' | 'all' | null>(null);

  const weekGroups = groupLogsByWeek(logs);
  const clearedGroups = weekGroups.filter((g) => g.status === 'cleared');
  const pendingGroups = weekGroups.filter((g) => g.status === 'pending');

  const totalCleared = clearedGroups.reduce(
    (sum, g) => sum + calculateEarnings(g.totalHours, rate).net, 0
  );
  const totalPending = pendingGroups.reduce(
    (sum, g) => sum + calculateEarnings(g.totalHours, rate).net, 0
  );

  const handleDelete = () => {
    if (!confirmDelete) return;
    let ids: string[] = [];
    if (confirmDelete === 'balance') {
      ids = clearedGroups.flatMap((g) => g.logs.map((l) => l.id));
    } else if (confirmDelete === 'pending') {
      ids = pendingGroups.flatMap((g) => g.logs.map((l) => l.id));
    } else if (confirmDelete === 'all') {
      ids = [...clearedGroups, ...pendingGroups].flatMap((g) => g.logs.map((l) => l.id));
    }
    removeLogs(ids);
    setConfirmDelete(null);
  };

  const deleteLabel = confirmDelete === 'balance'
    ? 'Saldo Tersedia'
    : confirmDelete === 'pending'
    ? 'Saldo Pending'
    : 'Semua Saldo';

  const deleteAmount = confirmDelete === 'balance'
    ? totalCleared
    : confirmDelete === 'pending'
    ? totalPending
    : totalCleared + totalPending;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Pengaturan</h1>

      <div className="rounded-2xl bg-gray-800 p-5 shadow-lg space-y-5">
        {/* Rate per hour */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-400">
            Rate per Jam
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
              {currency}
            </span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl bg-gray-900 py-2.5 pl-16 pr-4 text-white outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
            />
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Tarif yang kamu kenakan per jam kerja.
          </p>
        </div>

        {/* Currency */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-400">
            Mata Uang
          </label>
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="USD"
            className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white placeholder-gray-600 outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
          />
          <p className="mt-1 text-xs text-gray-600">
            Simbol atau kode mata uang (contoh: USD, IDR, $).
          </p>
        </div>

        {/* Exchange Rate */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-400">
            Nilai Tukar (1 USD = ? IDR)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={formatRupiahInput(exchangeRate.toString())}
              onChange={(e) => setExchangeRate(parseRupiahInput(e.target.value))}
              className="w-full rounded-xl bg-gray-900 py-2.5 pl-12 pr-4 text-white outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
            />
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Kurs konversi USD ke Rupiah.
          </p>
        </div>

        {/* Weekly target */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-400">
            Target Mingguan
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
              {currency}
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={weeklyTarget}
              onChange={(e) => setWeeklyTarget(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl bg-gray-900 py-2.5 pl-16 pr-4 text-white outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
            />
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Target pendapatan bersih per minggu.
          </p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl bg-gray-800 p-5 shadow-lg space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-red-400">
          Hapus Data Saldo
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">Saldo Tersedia</p>
            <p className="text-xs text-gray-500">
              {clearedGroups.length} minggu · {formatCurrency(totalCleared, 'USD')}
            </p>
          </div>
          <button
            onClick={() => setConfirmDelete('balance')}
            disabled={clearedGroups.length === 0}
            className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Hapus
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">Saldo Pending</p>
            <p className="text-xs text-gray-500">
              {pendingGroups.length} minggu · {formatCurrency(totalPending, 'USD')}
            </p>
          </div>
          <button
            onClick={() => setConfirmDelete('pending')}
            disabled={pendingGroups.length === 0}
            className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Hapus
          </button>
        </div>

        <div className="border-t border-gray-700 pt-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">Hapus Semua Saldo</p>
            <p className="text-xs text-gray-500">
              Hapus saldo tersedia & pending sekaligus
            </p>
          </div>
          <button
            onClick={() => setConfirmDelete('all')}
            disabled={clearedGroups.length === 0 && pendingGroups.length === 0}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Hapus Semua
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-800 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2">
              Hapus {deleteLabel}?
            </h3>
            <p className="text-sm text-gray-400 mb-1">
              Semua log dari minggu terkait akan dihapus permanen dan tidak bisa dikembalikan.
            </p>
            <p className="text-sm font-semibold text-red-400 mb-5">
              {formatCurrency(deleteAmount, 'USD')} akan dihapus.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl bg-gray-700 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info notice */}
      <div className="rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-300">
        Semua perubahan disimpan secara otomatis.
      </div>
    </div>
  );
}
