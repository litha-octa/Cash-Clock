import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useLogStore,
  useRateStore,
  useTargetStore,
  usePocketStore,
  useBalanceStore,
} from "../store";
import {
  calculateEarnings,
  formatHours,
  formatCurrency,
  filterByPeriod,
  groupLogsByWeek,
  formatDateShort,
} from "../utils";
import type { Period } from "../types";

const periods: { label: string; value: Period }[] = [
  { label: "Hari Ini", value: "today" },
  { label: "Minggu Ini", value: "this_week" },
  { label: "Semua", value: "all" },
];

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>("this_week");
  const [confirmClear, setConfirmClear] = useState<"balance" | "pending" | null>(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [editBalanceValue, setEditBalanceValue] = useState("");

  const logs = useLogStore((s) => s.logs);
  const removeLogs = useLogStore((s) => s.removeLogs);
  const rate = useRateStore((s) => s.rate);
  const currency = useRateStore((s) => s.currency);
  const exchangeRate = useRateStore((s) => s.exchangeRate);
  const weeklyTarget = useTargetStore((s) => s.weeklyTarget);
  const pockets = usePocketStore((s) => s.pockets);
  const manualBalance = useBalanceStore((s) => s.manualBalance);
  const setManualBalance = useBalanceStore((s) => s.setManualBalance);

  const filteredLogs = useMemo(
    () => filterByPeriod(logs, period),
    [logs, period],
  );

  const totalHours = useMemo(
    () => filteredLogs.reduce((sum, log) => sum + log.duration, 0),
    [filteredLogs],
  );

  const earnings = useMemo(
    () => calculateEarnings(totalHours, rate),
    [totalHours, rate],
  );

  // Weekly target progress (always based on this_week)
  const weeklyLogs = useMemo(() => filterByPeriod(logs, "this_week"), [logs]);
  const weeklyHours = useMemo(
    () => weeklyLogs.reduce((sum, log) => sum + log.duration, 0),
    [weeklyLogs],
  );
  const weeklyEarnings = useMemo(
    () => calculateEarnings(weeklyHours, rate),
    [weeklyHours, rate],
  );
  const targetProgress =
    weeklyTarget > 0 ? (weeklyEarnings.net / weeklyTarget) * 100 : 0;
  const clampedProgress = Math.min(targetProgress, 100);
  const remaining = Math.max(weeklyTarget - weeklyEarnings.net, 0);

  // Pending & Balance from past weeks
  const weekGroups = useMemo(() => groupLogsByWeek(logs), [logs]);
  const pendingGroups = useMemo(
    () => weekGroups.filter((g) => g.status === "pending"),
    [weekGroups],
  );
  const clearedGroups = useMemo(
    () => weekGroups.filter((g) => g.status === "cleared"),
    [weekGroups],
  );

  const totalPending = useMemo(
    () =>
      pendingGroups.reduce(
        (sum, g) => sum + calculateEarnings(g.totalHours, rate).net,
        0,
      ),
    [pendingGroups, rate],
  );
  const totalClearedBalance = useMemo(
    () =>
      clearedGroups.reduce(
        (sum, g) => sum + calculateEarnings(g.totalHours, rate).net,
        0,
      ),
    [clearedGroups, rate],
  );

  // Total pocket saldo (converted to USD)
  const totalPocketSaldoUSD = useMemo(
    () => pockets.reduce((sum, p) => {
      return sum + (p.currency === 'IDR' ? p.saldo / exchangeRate : p.saldo);
    }, 0),
    [pockets, exchangeRate],
  );

  const freeBalance = totalClearedBalance + manualBalance - totalPocketSaldoUSD;

  // Pocket overview
  const goalPockets = useMemo(() => pockets.filter((p) => p.tipe === 'goal'), [pockets]);
  const goalReady = useMemo(
    () => goalPockets.filter((p) => p.target_amount != null && p.saldo >= p.target_amount).length,
    [goalPockets],
  );

  // Recent logs (5 most recent)
  const recentLogs = useMemo(
    () => [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [logs],
  );

  const targetLabel = () => {
    if (targetProgress <= 0)
      return { text: "Belum mulai", color: "text-red-400" };
    if (targetProgress < 100)
      return { text: "Sedang berjalan", color: "text-yellow-400" };
    return { text: "Target tercapai!", color: "text-emerald-400" };
  };

  const status = targetLabel();

  const handleClearBalance = () => {
    const ids = clearedGroups.flatMap((g) => g.logs.map((l) => l.id));
    removeLogs(ids);
    setManualBalance(0);
    setConfirmClear(null);
  };

  const handleOpenEditBalance = () => {
    setEditBalanceValue(String(Math.max(0, freeBalance).toFixed(2)));
    setEditingBalance(true);
  };

  const handleSaveBalance = () => {
    const desired = parseFloat(editBalanceValue);
    if (isNaN(desired) || desired < 0) return;
    const calculatedFree = totalClearedBalance - totalPocketSaldoUSD;
    setManualBalance(desired - calculatedFree);
    setEditingBalance(false);
  };

  const handleClearPending = () => {
    const ids = pendingGroups.flatMap((g) => g.logs.map((l) => l.id));
    removeLogs(ids);
    setConfirmClear(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <Link
          to="/log"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white text-xl shadow-lg hover:bg-emerald-600 transition-colors"
          aria-label="Tambah Log"
        >
          +
        </Link>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              period === p.value
                ? "bg-emerald-500 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {/* Balance & Pending */}
      <div className="space-y-3">
        <div className="rounded-2xl bg-gray-800 p-4 shadow-lg">
          <div className="flex items-start justify-between mb-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Saldo Tersedia
            </p>
            <div className="flex gap-1">
              <button
                onClick={handleOpenEditBalance}
                className="text-gray-500 hover:text-emerald-400 transition-colors"
                aria-label="Edit saldo tersedia"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              {(clearedGroups.length > 0 || manualBalance !== 0) && (
                <button
                  onClick={() => setConfirmClear("balance")}
                  className="text-gray-500 hover:text-red-400 transition-colors"
                  aria-label="Hapus saldo tersedia"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xl font-bold text-emerald-400">
                {formatCurrency(Math.max(0, freeBalance), "USD")}
              </p>
              <p className="text-sm text-emerald-400/60 font-medium">
                {formatCurrency(Math.max(0, freeBalance) * exchangeRate, "IDR")}
              </p>
            </div>
            {totalPocketSaldoUSD > 0 && (
              <p className="text-xs text-gray-500">
                {formatCurrency(totalPocketSaldoUSD, "USD")} di kantong
              </p>
            )}
          </div>
        </div>
        <div className="rounded-2xl bg-gray-800 p-4 shadow-lg">
          <div className="flex items-start justify-between mb-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Pending
            </p>
            {pendingGroups.length > 0 && (
              <button
                onClick={() => setConfirmClear("pending")}
                className="text-gray-500 hover:text-red-400 transition-colors"
                aria-label="Hapus saldo pending"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xl font-bold text-yellow-400">
                {formatCurrency(totalPending, "USD")}
              </p>
              <p className="text-sm text-yellow-400/60 font-medium">
                {formatCurrency(totalPending * exchangeRate, "IDR")}
              </p>
            </div>
            <p className="text-xs text-gray-500">
              {pendingGroups.length} minggu pending
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-800 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2">
              Hapus {confirmClear === "balance" ? "Saldo Tersedia" : "Saldo Pending"}?
            </h3>
            <p className="text-sm text-gray-400 mb-1">
              Semua log dari minggu yang{" "}
              {confirmClear === "balance" ? "sudah cair" : "masih pending"} akan
              dihapus permanen.
            </p>
            <p className="text-sm font-semibold mb-5">
              <span className={confirmClear === "balance" ? "text-emerald-400" : "text-yellow-400"}>
                {formatCurrency(
                  confirmClear === "balance" ? totalClearedBalance : totalPending,
                  "USD",
                )}
              </span>
              {" "}akan dihapus.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmClear(null)}
                className="flex-1 rounded-xl bg-gray-700 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmClear === "balance" ? handleClearBalance : handleClearPending}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Balance Modal */}
      {editingBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-800 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">
              Edit Saldo Tersedia
            </h3>
            <label className="block text-sm text-gray-400 mb-1">Saldo (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={editBalanceValue}
              onChange={(e) => setEditBalanceValue(e.target.value)}
              className="w-full rounded-xl bg-gray-900 border border-gray-700 px-4 py-2.5 text-white text-lg font-medium focus:outline-none focus:border-emerald-500 mb-2"
              autoFocus
            />
            <p className="text-sm text-gray-500 mb-5">
              {formatCurrency((parseFloat(editBalanceValue) || 0) * exchangeRate, "IDR")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setEditingBalance(false)}
                className="flex-1 rounded-xl bg-gray-700 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveBalance}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 transition-colors"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Earnings List */}
      {pendingGroups.length > 0 && (
        <div className="rounded-2xl bg-gray-800 p-5 shadow-lg">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Pending Earnings
          </h2>
          <ul className="space-y-3">
            {pendingGroups.map((group) => {
              const groupEarnings = calculateEarnings(group.totalHours, rate);
              return (
                <li
                  key={group.weekStart}
                  className="rounded-xl bg-gray-900/50 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {formatDateShort(group.weekStart)} -{" "}
                        {formatDateShort(group.weekEnd)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {group.logs.length} log ·{" "}
                        {formatHours(group.totalHours)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-yellow-400">
                        {formatCurrency(groupEarnings.net, "USD")}
                      </p>
                      <p className="text-xs text-yellow-400/60 font-medium">
                        {formatCurrency(groupEarnings.net * exchangeRate, "IDR")}
                      </p>
                      <p className="text-xs text-gray-500">
                        Cair {formatDateShort(group.clearDate)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Kantong Overview */}
      {pockets.length > 0 && (
        <div className="rounded-2xl bg-gray-800 p-5 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Kantong
            </h2>
            <Link to="/needs" className="text-sm text-emerald-400 hover:text-emerald-300">
              Kelola
            </Link>
          </div>

          <div className="flex justify-between text-gray-300">
            <span>Jumlah Kantong</span>
            <span className="font-medium text-white">{pockets.length}</span>
          </div>
          {goalPockets.length > 0 && (
            <div className="mt-1 flex justify-between text-gray-300">
              <span>Goal Siap Tarik</span>
              <span className="font-medium text-emerald-400">{goalReady} / {goalPockets.length}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between text-gray-300">
            <span>Total di Kantong</span>
            <span className="font-medium text-white">
              {formatCurrency(totalPocketSaldoUSD, "USD")}
            </span>
          </div>
        </div>
      )}

      {/* Earning Summary Card */}
      <div className="rounded-2xl bg-gray-800 p-5 shadow-lg">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Ringkasan Pendapatan
        </h2>

        <div className="space-y-3">
          <div className="flex justify-between text-gray-300">
            <span>Total Jam Kerja</span>
            <span className="font-medium text-white">
              {formatHours(totalHours)}
            </span>
          </div>

          <div className="flex justify-between text-gray-300">
            <span>Pendapatan Kotor</span>
            <span className="font-medium text-white">
              {formatCurrency(earnings.gross, currency)}
            </span>
          </div>

          <div className="flex justify-between text-gray-300">
            <span>Potongan (10% + {formatCurrency(1, currency)})</span>
            <span className="font-medium text-red-400">
              -{formatCurrency(earnings.deduction, currency)}
            </span>
          </div>

          <div className="border-t border-gray-700 pt-3">
            <div className="flex justify-between items-end">
              <span className="text-lg font-semibold text-white">
                Pendapatan Bersih
              </span>
              <div className="text-right">
                <span className="block text-2xl font-bold text-emerald-400">
                  {formatCurrency(earnings.net, "USD")}
                </span>
                <span className="block text-sm text-emerald-400/60 font-medium">
                  {formatCurrency(earnings.net * exchangeRate, "IDR")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Target Progress */}
      <div className="rounded-2xl bg-gray-800 p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Target Mingguan
          </h2>
          <span className={`text-sm font-semibold ${status.color}`}>
            {status.text}
          </span>
        </div>

        <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-gray-700">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>

        <div className="flex justify-between text-sm text-gray-400">
          <span>{targetProgress.toFixed(1)}%</span>
          <span>
            Sisa: {formatCurrency(remaining, currency)} /{" "}
            {formatCurrency(weeklyTarget, currency)}
          </span>
        </div>
      </div>

      {/* Recent Logs */}
      <div className="rounded-2xl bg-gray-800 p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Log Terbaru
          </h2>
          <Link
            to="/log"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            Lihat Semua
          </Link>
        </div>

        {recentLogs.length === 0 ? (
          <p className="text-center text-gray-500 py-4">
            Belum ada log. Mulai catat waktumu!
          </p>
        ) : (
          <ul className="space-y-3">
            {recentLogs.map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between rounded-xl bg-gray-900/50 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">
                    {log.description}
                  </p>
                  <p className="text-xs text-gray-500">
                    {log.date}
                    {log.project ? ` · ${log.project}` : ""}
                  </p>
                </div>
                <div className="ml-4 text-right shrink-0">
                  <p className="font-semibold text-emerald-400">
                    {formatCurrency(log.duration * rate, currency)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatHours(log.duration)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
