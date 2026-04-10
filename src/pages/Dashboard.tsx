import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useLogStore,
  useRateStore,
  useTargetStore,
  useNeedsStore,
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

  const logs = useLogStore((s) => s.logs);
  const rate = useRateStore((s) => s.rate);
  const currency = useRateStore((s) => s.currency);
  const exchangeRate = useRateStore((s) => s.exchangeRate);
  const weeklyTarget = useTargetStore((s) => s.weeklyTarget);
  const needs = useNeedsStore((s) => s.needs);

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

  // Total allocated to needs (converted to USD)
  const totalAllocatedUSD = useMemo(
    () => needs.reduce((sum, n) => {
      const alloc = n.allocated || 0;
      if ((n.currency || 'USD') === 'IDR') return sum + alloc / exchangeRate;
      return sum + alloc;
    }, 0),
    [needs, exchangeRate],
  );

  const freeBalance = totalClearedBalance - totalAllocatedUSD;

  // Needs overview
  const needsFulfilled = useMemo(
    () => needs.filter((n) => (n.allocated || 0) >= n.amount).length,
    [needs],
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
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gray-800 p-4 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Saldo Tersedia
          </p>
          <p className="text-xl font-bold text-emerald-400">
            {formatCurrency(Math.max(0, freeBalance), "USD")}
          </p>
          <p className="text-sm text-emerald-400/60 font-medium">
            {formatCurrency(Math.max(0, freeBalance) * exchangeRate, "IDR")}
          </p>
          {totalAllocatedUSD > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {formatCurrency(totalAllocatedUSD, "USD")} di kantong
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-gray-800 p-4 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Pending
          </p>
          <p className="text-xl font-bold text-yellow-400">
            {formatCurrency(totalPending, "USD")}
          </p>
          <p className="text-sm text-yellow-400/60 font-medium">
            {formatCurrency(totalPending * exchangeRate, "IDR")}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {pendingGroups.length} minggu pending
          </p>
        </div>
      </div>

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
      {needs.length > 0 && (
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
            <span className="font-medium text-white">{needs.length}</span>
          </div>
          <div className="mt-1 flex justify-between text-gray-300">
            <span>Terpenuhi</span>
            <span className="font-medium text-emerald-400">{needsFulfilled} / {needs.length}</span>
          </div>
          <div className="mt-1 flex justify-between text-gray-300">
            <span>Dialokasikan</span>
            <span className="font-medium text-white">
              {formatCurrency(totalAllocatedUSD, "USD")}
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
