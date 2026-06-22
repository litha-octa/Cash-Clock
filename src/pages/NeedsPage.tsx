import { useState, useMemo, useEffect } from "react";
import {
  usePocketStore,
  useRateStore,
  useLogStore,
  useBalanceStore,
} from "../store";
import {
  calculateEarnings,
  formatCurrency,
  generateId,
  groupLogsByWeek,
  getLockedAmount,
  formatDateShort,
} from "../utils";
import type { Pocket } from "../types";

type PocketCurrency = "USD" | "IDR";
type PocketType = "permanen" | "goal";

function formatRupiahInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}

function parseRupiahInput(formatted: string): number {
  return Number(formatted.replace(/\D/g, "")) || 0;
}

function parseAmount(val: string, cur: PocketCurrency): number {
  return cur === "IDR" ? parseRupiahInput(val) : parseFloat(val) || 0;
}

const typeBadge: Record<PocketType, { label: string; cls: string }> = {
  permanen: { label: "Permanent", cls: "bg-blue-500/20 text-blue-400" },
  goal: { label: "Goal", cls: "bg-purple-500/20 text-purple-400" },
};

// Reusable currency input
function CurrencyInput({
  value,
  onChange,
  currency,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  currency: PocketCurrency;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  if (currency === "IDR") {
    return (
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatRupiahInput(e.target.value))}
        placeholder={placeholder || "50.000"}
        autoFocus={autoFocus}
        className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white placeholder-gray-600 outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
      />
    );
  }
  return (
    <input
      type="number"
      min={0}
      step={0.01}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "0.00"}
      autoFocus={autoFocus}
      className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white placeholder-gray-600 outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
    />
  );
}

export default function NeedsPage() {
  const pockets = usePocketStore((s) => s.pockets);
  const addPocket = usePocketStore((s) => s.addPocket);
  const updatePocket = usePocketStore((s) => s.updatePocket);
  const removePocket = usePocketStore((s) => s.removePocket);
  const topUp = usePocketStore((s) => s.topUp);
  const topUpFromPending = usePocketStore((s) => s.topUpFromPending);
  const withdrawFromPocket = usePocketStore((s) => s.withdrawFromPocket);
  const transferBetweenPockets = usePocketStore(
    (s) => s.transferBetweenPockets,
  );

  const rate = useRateStore((s) => s.rate);
  const exchangeRate = useRateStore((s) => s.exchangeRate);
  const logs = useLogStore((s) => s.logs);
  const manualBalance = useBalanceStore((s) => s.manualBalance);
  const setManualBalance = useBalanceStore((s) => s.setManualBalance);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [pocketType, setPocketType] = useState<PocketType>("permanen");
  const [targetAmount, setTargetAmount] = useState("");
  const [pocketCurrency, setPocketCurrency] = useState<PocketCurrency>("IDR");

  // Expanded card
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Top-up (Isi Saldo) modal
  const [topUpId, setTopUpId] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpSource, setTopUpSource] = useState<
    "balance" | "pending" | string
  >("balance");
  const [selectedPendingWeek, setSelectedPendingWeek] = useState<string | null>(
    null,
  );

  // Move (Pindahkan Saldo) modal
  const [moveId, setMoveId] = useState<string | null>(null);
  const [moveAmount, setMoveAmount] = useState("");
  const [moveDest, setMoveDest] = useState<"balance" | string>("balance");

  // Withdraw modal
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // Multi-withdraw modal
  const [showMultiWithdraw, setShowMultiWithdraw] = useState(false);
  const [mwPoolAmount, setMwPoolAmount] = useState("");
  const [mwPocketItems, setMwPocketItems] = useState<
    { id: string; amount: string }[]
  >([]);
  const [mwAddingPocket, setMwAddingPocket] = useState(false);
  const [mwStep, setMwStep] = useState<"input" | "confirm">("input");

  // Goal completion toast
  const [goalToast, setGoalToast] = useState<string | null>(null);

  useEffect(() => {
    if (goalToast) {
      const t = setTimeout(() => setGoalToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [goalToast]);

  // Balance calculations
  const weekGroups = useMemo(() => groupLogsByWeek(logs), [logs]);
  const totalClearedUSD = useMemo(
    () =>
      weekGroups
        .filter((g) => g.status === "cleared")
        .reduce((sum, g) => sum + calculateEarnings(g.totalHours, rate).net, 0),
    [weekGroups, rate],
  );
  const pendingGroups = useMemo(
    () => weekGroups.filter((g) => g.status === "pending"),
    [weekGroups],
  );
  const totalPendingUSD = useMemo(
    () =>
      pendingGroups.reduce(
        (sum, g) => sum + calculateEarnings(g.totalHours, rate).net,
        0,
      ),
    [pendingGroups, rate],
  );
  const totalPocketSaldoUSD = useMemo(
    () =>
      pockets.reduce(
        (sum, p) =>
          sum + (p.currency === "IDR" ? p.saldo / exchangeRate : p.saldo),
        0,
      ),
    [pockets, exchangeRate],
  );
  const totalLockedUSD = useMemo(
    () =>
      pockets.reduce((sum, p) => {
        const locked = getLockedAmount(p);
        return sum + (p.currency === "IDR" ? locked / exchangeRate : locked);
      }, 0),
    [pockets, exchangeRate],
  );

  const freeBalanceUSD = totalClearedUSD + manualBalance - totalPocketSaldoUSD;
  const freePendingUSD = totalPendingUSD - totalLockedUSD;

  // Helpers
  const toUSD = (amount: number, cur: PocketCurrency) =>
    cur === "IDR" ? amount / exchangeRate : amount;
  const fromUSD = (usd: number, cur: PocketCurrency) =>
    cur === "IDR" ? usd * exchangeRate : usd;

  const resetForm = () => {
    setEditingId(null);
    setNama("");
    setPocketType("permanen");
    setTargetAmount("");
    setPocketCurrency("IDR");
  };

  const handleCurrencySwitch = (cur: PocketCurrency) => {
    if (cur === pocketCurrency) return;
    setPocketCurrency(cur);
    setTargetAmount("");
  };

  // --- Form submit ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) return;
    const target = parseAmount(targetAmount, pocketCurrency);
    if (pocketType === "goal" && target <= 0) return;
    const targetFields =
      target > 0
        ? { target_awal: target, target_amount: target }
        : { target_awal: undefined, target_amount: undefined };
    if (editingId) {
      updatePocket(editingId, {
        nama: nama.trim(),
        currency: pocketCurrency,
        ...targetFields,
      });
    } else {
      addPocket({
        id: generateId(),
        nama: nama.trim(),
        saldo: 0,
        tipe: pocketType,
        ...targetFields,
        currency: pocketCurrency,
        created_at: new Date().toISOString(),
      });
    }
    resetForm();
  };

  const handleEdit = (pocket: Pocket) => {
    setEditingId(pocket.id);
    setNama(pocket.nama);
    setPocketType(pocket.tipe);
    setPocketCurrency(pocket.currency);
    setTargetAmount(
      pocket.target_awal
        ? pocket.currency === "IDR"
          ? formatRupiahInput(pocket.target_awal.toString())
          : pocket.target_awal.toString()
        : "",
    );
    setExpandedId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (pocket: Pocket) => {
    removePocket(pocket.id);
    if (editingId === pocket.id) resetForm();
    setExpandedId(null);
  };

  // --- Top-up (Isi Saldo) ---
  const openTopUp = (id: string) => {
    setTopUpId(id);
    setTopUpAmount("");
    setTopUpSource("balance");
    setSelectedPendingWeek(
      pendingGroups.length > 0 ? pendingGroups[0].weekStart : null,
    );
    setExpandedId(null);
  };

  const topUpPocket = topUpId ? pockets.find((p) => p.id === topUpId) : null;

  const handleTopUp = () => {
    if (!topUpId || !topUpPocket) return;
    const val = parseAmount(topUpAmount, topUpPocket.currency);
    if (val <= 0) return;
    const costUSD = toUSD(val, topUpPocket.currency);

    if (topUpSource === "balance") {
      if (costUSD > freeBalanceUSD + 0.001) return;
      topUp(topUpId, val);
    } else if (topUpSource === "pending") {
      if (costUSD > freePendingUSD + 0.001) return;
      const group = pendingGroups.find(
        (g) => g.weekStart === selectedPendingWeek,
      );
      if (!group) return;
      if (costUSD > calculateEarnings(group.totalHours, rate).net + 0.001)
        return;
      topUpFromPending(topUpId, val, group.clearDate);
    } else {
      // Source is another pocket
      const src = pockets.find((p) => p.id === topUpSource);
      if (!src) return;
      const locked = getLockedAmount(src);
      const srcAvail = src.saldo - locked;
      // Convert amount: user enters in destination pocket currency → convert to source currency
      const srcDeduct =
        src.currency === topUpPocket.currency
          ? val
          : fromUSD(costUSD, src.currency);
      if (srcDeduct > srcAvail + 0.001) return;
      transferBetweenPockets(src.id, topUpId, srcDeduct, val);
    }
    setTopUpId(null);
  };

  // Available balance for the selected top-up source
  const topUpSourceAvail = useMemo(() => {
    if (!topUpPocket) return 0;
    if (topUpSource === "balance") return Math.max(0, freeBalanceUSD);
    if (topUpSource === "pending") return Math.max(0, freePendingUSD);
    const src = pockets.find((p) => p.id === topUpSource);
    if (!src) return 0;
    const locked = getLockedAmount(src);
    const avail = Math.max(0, src.saldo - locked);
    return src.currency === "IDR" ? avail / exchangeRate : avail;
  }, [
    topUpSource,
    topUpPocket,
    freeBalanceUSD,
    freePendingUSD,
    pockets,
    exchangeRate,
  ]);

  // --- Move (Pindahkan Saldo) ---
  const openMove = (id: string) => {
    setMoveId(id);
    setMoveAmount("");
    setMoveDest("balance");
    setExpandedId(null);
  };

  const movePocket = moveId ? pockets.find((p) => p.id === moveId) : null;

  const handleMove = () => {
    if (!moveId || !movePocket) return;
    const val = parseAmount(moveAmount, movePocket.currency);
    if (val <= 0) return;
    const locked = getLockedAmount(movePocket);
    if (val > movePocket.saldo - locked + 0.001) return;

    if (moveDest === "balance") {
      // Move to pool: just withdraw from pocket
      withdrawFromPocket(moveId, val);
    } else {
      // Move to another pocket
      const dest = pockets.find((p) => p.id === moveDest);
      if (!dest) return;
      const destAdd =
        dest.currency === movePocket.currency
          ? val
          : fromUSD(toUSD(val, movePocket.currency), dest.currency);
      transferBetweenPockets(moveId, dest.id, val, destAdd);
    }
    setMoveId(null);
  };

  // --- Withdraw (Tarik Saldo) ---
  const openWithdraw = (id: string) => {
    setWithdrawId(id);
    setWithdrawAmount("");
    setExpandedId(null);
  };

  const withdrawPocket = withdrawId
    ? pockets.find((p) => p.id === withdrawId)
    : null;

  const handleWithdraw = () => {
    if (!withdrawId) return;
    const pocket = pockets.find((p) => p.id === withdrawId);
    if (!pocket) return;
    const val = parseAmount(withdrawAmount, pocket.currency);
    if (val <= 0) return;
    const locked = getLockedAmount(pocket);
    const actual = Math.min(val, Math.max(0, pocket.saldo - locked));
    if (actual <= 0) return;

    withdrawFromPocket(withdrawId, actual);

    if (pocket.tipe === "goal" && pocket.target_amount != null) {
      const newTarget = pocket.target_amount - actual;
      if (newTarget <= 0) {
        const spentUSD = toUSD(actual, pocket.currency);
        setManualBalance(manualBalance - spentUSD);
        setGoalToast(pocket.nama);
        setTimeout(() => removePocket(withdrawId), 100);
      }
    }
    setWithdrawId(null);
  };

  // --- Multi-withdraw ---
  const openMultiWithdraw = () => {
    setMwPoolAmount("");
    setMwPocketItems([]);
    setMwAddingPocket(false);
    setMwStep("input");
    setShowMultiWithdraw(true);
  };

  const mwPoolVal = useMemo(() => {
    const val = parseFloat(mwPoolAmount) || 0;
    return Math.min(val, Math.max(0, freeBalanceUSD));
  }, [mwPoolAmount, freeBalanceUSD]);

  const mwPocketEntries = useMemo(() => {
    return mwPocketItems
      .map((item) => {
        const pocket = pockets.find((p) => p.id === item.id);
        if (!pocket) return null;
        const locked = getLockedAmount(pocket);
        const maxAvail = Math.max(0, pocket.saldo - locked);
        const val = parseAmount(item.amount, pocket.currency);
        const actual = Math.min(val, maxAvail);
        return { pocket, locked, maxAvail, actual };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null && e.actual > 0);
  }, [mwPocketItems, pockets]);

  const mwTotalUSD = useMemo(
    () =>
      mwPoolVal +
      mwPocketEntries.reduce(
        (sum, e) =>
          sum +
          (e.pocket.currency === "IDR" ? e.actual / exchangeRate : e.actual),
        0,
      ),
    [mwPoolVal, mwPocketEntries, exchangeRate],
  );

  const mwHasItems = mwPoolVal > 0 || mwPocketEntries.length > 0;

  // Pockets available to add (not already selected, have available balance)
  const mwAvailablePockets = useMemo(() => {
    const selectedIds = new Set(mwPocketItems.map((i) => i.id));
    return pockets.filter(
      (p) => !selectedIds.has(p.id) && p.saldo - getLockedAmount(p) > 0,
    );
  }, [mwPocketItems, pockets]);

  const mwAddPocket = (id: string) => {
    const pocket = pockets.find((p) => p.id === id);
    if (!pocket) return;
    const locked = getLockedAmount(pocket);
    const maxAvail = Math.max(0, pocket.saldo - locked);
    const defaultAmount =
      pocket.currency === "IDR"
        ? formatRupiahInput(Math.floor(maxAvail).toString())
        : maxAvail.toFixed(2);
    setMwPocketItems((prev) => [...prev, { id, amount: defaultAmount }]);
    setMwAddingPocket(false);
  };

  const mwRemovePocket = (id: string) => {
    setMwPocketItems((prev) => prev.filter((i) => i.id !== id));
  };

  const mwSetPocketAmount = (id: string, amount: string) => {
    setMwPocketItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, amount } : i)),
    );
  };

  const handleMultiWithdraw = () => {
    const completedGoals: string[] = [];
    let balanceAdjust = 0;

    if (mwPoolVal > 0) {
      balanceAdjust -= mwPoolVal;
    }

    for (const entry of mwPocketEntries) {
      const { pocket, actual } = entry;
      withdrawFromPocket(pocket.id, actual);

      if (pocket.tipe === "goal" && pocket.target_amount != null) {
        const newTarget = pocket.target_amount - actual;
        if (newTarget <= 0) {
          const spentUSD =
            pocket.currency === "IDR" ? actual / exchangeRate : actual;
          balanceAdjust -= spentUSD;
          completedGoals.push(pocket.nama);
          setTimeout(() => removePocket(pocket.id), 100);
        }
      }
    }

    if (balanceAdjust !== 0) {
      setManualBalance(manualBalance + balanceAdjust);
    }
    if (completedGoals.length > 0) {
      setGoalToast(completedGoals.join(", "));
    }

    setShowMultiWithdraw(false);
  };

  // --- Card expand toggle ---
  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">
        {editingId ? "Edit Pocket" : "Pockets"}
      </h1>

      {/* Goal Toast */}
      {goalToast && (
        <div className="fixed top-4 left-4 right-4 z-[60] mx-auto max-w-lg animate-pulse rounded-2xl bg-emerald-500 p-4 text-center shadow-xl">
          <p className="text-lg font-bold text-white">
            Goal &lsquo;{goalToast}&rsquo; reached!
          </p>
        </div>
      )}

      {/* Balance Cards */}
      <div className="space-y-3">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/70 mb-1">
            Available Balance
          </p>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xl font-bold text-emerald-400">
                {formatCurrency(Math.max(0, freeBalanceUSD), "USD")}
              </p>
              <p className="text-sm text-emerald-400/60 font-medium">
                {formatCurrency(
                  Math.max(0, freeBalanceUSD) * exchangeRate,
                  "IDR",
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-yellow-400/70 mb-1">
            Pending Balance
          </p>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xl font-bold text-yellow-400">
                {formatCurrency(Math.max(0, freePendingUSD), "USD")}
              </p>
              <p className="text-sm text-yellow-400/60 font-medium">
                {formatCurrency(
                  Math.max(0, freePendingUSD) * exchangeRate,
                  "IDR",
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tarik Saldo Button */}
      {(freeBalanceUSD > 0 ||
        pockets.some((p) => p.saldo - getLockedAmount(p) > 0)) && (
        <button
          onClick={openMultiWithdraw}
          className="w-full rounded-2xl bg-yellow-500/10 border border-yellow-500/30 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/20 transition-colors"
        >
          Withdraw
        </button>
      )}

      {/* Create/Edit Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-gray-800 p-5 shadow-lg space-y-4"
      >
        <p className="text-sm font-medium text-gray-400">
          {editingId ? "Edit pocket" : "Create new pocket"}
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-400">
            Name
          </label>
          <input
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="e.g. Monthly expenses"
            className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white placeholder-gray-600 outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
          />
        </div>

        {!editingId && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">
              Pocket Type
            </label>
            <div className="flex rounded-xl bg-gray-900 ring-1 ring-gray-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setPocketType("permanen")}
                className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${pocketType === "permanen" ? "bg-blue-500 text-white" : "text-gray-400 hover:text-white"}`}
              >
                Permanent
              </button>
              <button
                type="button"
                onClick={() => setPocketType("goal")}
                className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${pocketType === "goal" ? "bg-purple-500 text-white" : "text-gray-400 hover:text-white"}`}
              >
                Goal
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-600">
              {pocketType === "permanen"
                ? "For recurring needs. No target."
                : "For saving towards a target. Automatically completes when target is reached."}
            </p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-400">
            Currency
          </label>
          <div className="flex rounded-xl bg-gray-900 ring-1 ring-gray-700 overflow-hidden w-fit">
            <button
              type="button"
              onClick={() => handleCurrencySwitch("IDR")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${pocketCurrency === "IDR" ? "bg-emerald-500 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Rp
            </button>
            <button
              type="button"
              onClick={() => handleCurrencySwitch("USD")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${pocketCurrency === "USD" ? "bg-emerald-500 text-white" : "text-gray-400 hover:text-white"}`}
            >
              $
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-400">
            Target{" "}
            {pocketType === "permanen" && (
              <span className="text-gray-600">(optional)</span>
            )}
          </label>
          <CurrencyInput
            value={targetAmount}
            onChange={setTargetAmount}
            currency={pocketCurrency}
            placeholder={pocketCurrency === "IDR" ? "5.000.000" : "0.00"}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-emerald-500 py-2.5 font-semibold text-white hover:bg-emerald-600 transition-colors"
          >
            {editingId ? "Save" : "Create Pocket"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl bg-gray-700 px-5 py-2.5 font-medium text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Pocket Grid */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Pocket List ({pockets.length})
        </h2>

        {pockets.length === 0 ? (
          <div className="rounded-2xl bg-gray-800 p-8 text-center shadow-lg">
            <p className="text-gray-500">
              No pockets yet. Create your first pocket!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pockets.map((pocket) => {
              const locked = getLockedAmount(pocket);
              const isGoal = pocket.tipe === "goal";
              const hasTarget =
                pocket.target_awal != null && pocket.target_awal > 0;
              const progress = hasTarget
                ? (pocket.saldo / pocket.target_awal!) * 100
                : 0;
              const remaining = hasTarget
                ? Math.max(0, pocket.target_awal! - pocket.saldo)
                : 0;
              const isGoalFull =
                isGoal && hasTarget && pocket.saldo >= pocket.target_awal!;
              const isExpanded = expandedId === pocket.id;

              return (
                <div
                  key={pocket.id}
                  className={`rounded-2xl bg-gray-800 shadow-lg transition-all ${isGoalFull ? "ring-1 ring-emerald-500/30" : ""}`}
                >
                  {/* Card body - clickable */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => toggleExpand(pocket.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        {/* Type badge */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadge[pocket.tipe].cls}`}
                          >
                            {typeBadge[pocket.tipe].label}
                          </span>
                          {isGoalFull && (
                            <span className="inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                              Ready
                            </span>
                          )}
                          {locked > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-2.5 w-2.5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {formatCurrency(locked, pocket.currency)}
                            </span>
                          )}
                        </div>
                        {/* Name */}
                        <p className="font-medium text-white truncate">
                          {pocket.nama}
                        </p>
                      </div>

                      {/* Saldo - right aligned */}
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-lg font-bold text-emerald-400 leading-tight">
                          {formatCurrency(pocket.saldo, pocket.currency)}
                        </p>
                        {pocket.currency === "IDR" && (
                          <p className="text-xs text-gray-500">
                            {formatCurrency(pocket.saldo / exchangeRate, "USD")}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {hasTarget && (
                      <div className="mt-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${progress >= 100 ? "bg-emerald-500" : isGoal ? "bg-purple-500" : "bg-blue-500"}`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {formatCurrency(pocket.saldo, pocket.currency)} /{" "}
                          {formatCurrency(pocket.target_awal!, pocket.currency)}{" "}
                          · Remaining: {formatCurrency(remaining, pocket.currency)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Expanded actions */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-gray-700/50">
                      <div className="flex flex-wrap gap-2 pt-3">
                        <button
                          onClick={() => openTopUp(pocket.id)}
                          className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                        >
                          Top Up
                        </button>
                        <button
                          onClick={() => openMove(pocket.id)}
                          disabled={pocket.saldo - locked <= 0}
                          className="rounded-lg bg-cyan-500/20 px-3 py-2 text-xs font-medium text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Transfer
                        </button>
                        <button
                          onClick={() => openWithdraw(pocket.id)}
                          disabled={pocket.saldo - locked <= 0}
                          className="rounded-lg bg-yellow-500/10 px-3 py-2 text-xs font-medium text-yellow-400 hover:bg-yellow-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Withdraw
                        </button>
                        <button
                          onClick={() => handleEdit(pocket)}
                          className="rounded-lg bg-gray-700 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-600 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(pocket)}
                          className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== TOP-UP (ISI SALDO) MODAL ===== */}
      {topUpId && topUpPocket && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setTopUpId(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl bg-gray-800 p-5 pb-24 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">
              Top Up — {topUpPocket.nama}
            </h3>

            {/* Source selector */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Source
              </label>
              <select
                value={topUpSource}
                onChange={(e) => setTopUpSource(e.target.value)}
                className="w-full rounded-xl bg-gray-900 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
              >
                <option value="balance">
                  Available Balance —{" "}
                  {formatCurrency(Math.max(0, freeBalanceUSD), "USD")}
                </option>
                {pendingGroups.length > 0 && (
                  <option value="pending">
                    Pending Balance —{" "}
                    {formatCurrency(Math.max(0, freePendingUSD), "USD")}
                  </option>
                )}
                {pockets
                  .filter(
                    (p) => p.id !== topUpId && p.saldo - getLockedAmount(p) > 0,
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama} —{" "}
                      {formatCurrency(p.saldo - getLockedAmount(p), p.currency)}
                    </option>
                  ))}
              </select>
            </div>

            {/* Pending week selector */}
            {topUpSource === "pending" && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Select pending week
                  </label>
                  <select
                    value={selectedPendingWeek || ""}
                    onChange={(e) => setSelectedPendingWeek(e.target.value)}
                    className="w-full rounded-xl bg-gray-900 px-3 py-2 text-sm text-white outline-none ring-1 ring-gray-700 focus:ring-yellow-500 transition-shadow"
                  >
                    {pendingGroups.map((g) => {
                      const ge = calculateEarnings(g.totalHours, rate).net;
                      return (
                        <option key={g.weekStart} value={g.weekStart}>
                          {formatDateShort(g.weekStart)} -{" "}
                          {formatDateShort(g.weekEnd)} ·{" "}
                          {formatCurrency(ge, "USD")} · clears{" "}
                          {formatDateShort(g.clearDate)}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <p className="text-xs text-yellow-400/80 flex items-center gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 shrink-0"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Pending balance cannot be withdrawn until the pending period
                  ends
                </p>
              </>
            )}

            <p className="text-xs text-gray-400">
              Available: {formatCurrency(topUpSourceAvail, "USD")}
              {topUpPocket.currency === "IDR" && (
                <> ({formatCurrency(topUpSourceAvail * exchangeRate, "IDR")})</>
              )}
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-400">
                Amount ({topUpPocket.currency === "IDR" ? "Rp" : "$"})
              </label>
              <CurrencyInput
                value={topUpAmount}
                onChange={setTopUpAmount}
                currency={topUpPocket.currency}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleTopUp}
                className={`flex-1 rounded-xl py-2.5 font-semibold text-white transition-colors ${
                  topUpSource === "pending"
                    ? "bg-yellow-500 hover:bg-yellow-600"
                    : "bg-emerald-500 hover:bg-emerald-600"
                }`}
              >
                {topUpSource === "pending" ? "Top Up from Pending" : "Top Up"}
              </button>
              <button
                onClick={() => setTopUpId(null)}
                className="rounded-xl bg-gray-700 px-5 py-2.5 font-medium text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MOVE (PINDAHKAN SALDO) MODAL ===== */}
      {moveId && movePocket && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setMoveId(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl bg-gray-800 p-5 pb-24 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">
              Transfer Balance — {movePocket.nama}
            </h3>

            <p className="text-xs text-gray-400">
              Balance: {formatCurrency(movePocket.saldo, movePocket.currency)}
              {(() => {
                const l = getLockedAmount(movePocket);
                if (l <= 0) return null;
                return (
                  <>
                    {" "}
                    · Transferable:{" "}
                    {formatCurrency(movePocket.saldo - l, movePocket.currency)}
                  </>
                );
              })()}
            </p>

            {/* Destination selector */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Destination
              </label>
              <select
                value={moveDest}
                onChange={(e) => setMoveDest(e.target.value)}
                className="w-full rounded-xl bg-gray-900 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-gray-700 focus:ring-cyan-500 transition-shadow"
              >
                <option value="balance">Available Balance</option>
                {pockets
                  .filter((p) => p.id !== moveId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama} — {formatCurrency(p.saldo, p.currency)}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-400">
                Amount ({movePocket.currency === "IDR" ? "Rp" : "$"})
              </label>
              <CurrencyInput
                value={moveAmount}
                onChange={setMoveAmount}
                currency={movePocket.currency}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleMove}
                className="flex-1 rounded-xl bg-cyan-500 py-2.5 font-semibold text-white hover:bg-cyan-600 transition-colors"
              >
                Transfer
              </button>
              <button
                onClick={() => setMoveId(null)}
                className="rounded-xl bg-gray-700 px-5 py-2.5 font-medium text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== WITHDRAW (TARIK SALDO) MODAL ===== */}
      {withdrawId && withdrawPocket && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setWithdrawId(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl bg-gray-800 p-5 pb-24 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">
              Withdraw — {withdrawPocket.nama}
            </h3>

            <div className="space-y-1">
              <p className="text-xs text-gray-400">
                Pocket balance:{" "}
                {formatCurrency(withdrawPocket.saldo, withdrawPocket.currency)}
              </p>
              {(() => {
                const l = getLockedAmount(withdrawPocket);
                const maxW = Math.max(0, withdrawPocket.saldo - l);
                return (
                  <>
                    {l > 0 && (
                      <p className="text-xs text-yellow-400/80">
                        Locked: {formatCurrency(l, withdrawPocket.currency)}
                      </p>
                    )}
                    <p className="text-xs text-emerald-400">
                      Withdrawable:{" "}
                      {formatCurrency(maxW, withdrawPocket.currency)}
                    </p>
                  </>
                );
              })()}
              {withdrawPocket.tipe === "goal" &&
                withdrawPocket.target_amount != null && (
                  <p className="text-xs text-purple-400">
                    Remaining target:{" "}
                    {formatCurrency(
                      Math.max(0, withdrawPocket.target_amount),
                      withdrawPocket.currency,
                    )}
                  </p>
                )}
            </div>

            {withdrawPocket.tipe === "goal" && (
              <div className="rounded-lg bg-purple-500/10 px-3 py-2 text-xs text-purple-400">
                Withdrawal reduces remaining target. If target is reached, pocket
                is automatically deleted.
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-400">
                Amount ({withdrawPocket.currency === "IDR" ? "Rp" : "$"})
              </label>
              <CurrencyInput
                value={withdrawAmount}
                onChange={setWithdrawAmount}
                currency={withdrawPocket.currency}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleWithdraw}
                className="flex-1 rounded-xl bg-yellow-500 py-2.5 font-semibold text-white hover:bg-yellow-600 transition-colors"
              >
                Withdraw
              </button>
              <button
                onClick={() => setWithdrawId(null)}
                className="rounded-xl bg-gray-700 px-5 py-2.5 font-medium text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MULTI-WITHDRAW MODAL ===== */}
      {showMultiWithdraw && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setShowMultiWithdraw(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl bg-gray-800 p-5 pb-24 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {mwStep === "input" && (
              <>
                <h3 className="text-lg font-bold text-white">Withdraw</h3>

                {/* Pool input */}
                {freeBalanceUSD > 0 && (
                  <div className="rounded-xl bg-gray-900/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white text-sm">
                          Available Balance
                        </p>
                        <p className="text-xs text-gray-500">
                          Available:{" "}
                          {formatCurrency(Math.max(0, freeBalanceUSD), "USD")}
                          <span className="text-gray-600">
                            {" "}
                            (
                            {formatCurrency(
                              Math.max(0, freeBalanceUSD) * exchangeRate,
                              "IDR",
                            )}
                            )
                          </span>
                        </p>
                      </div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={mwPoolAmount}
                      onChange={(e) => setMwPoolAmount(e.target.value)}
                      placeholder="0.00"
                      autoFocus
                      className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white placeholder-gray-600 outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
                    />
                  </div>
                )}

                {/* Selected pockets */}
                {mwPocketItems.map((item) => {
                  const pocket = pockets.find((p) => p.id === item.id);
                  if (!pocket) return null;
                  const locked = getLockedAmount(pocket);
                  const maxAvail = Math.max(0, pocket.saldo - locked);
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl bg-gray-900/50 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadge[pocket.tipe].cls}`}
                            >
                              {typeBadge[pocket.tipe].label}
                            </span>
                            <p className="font-medium text-white text-sm truncate">
                              {pocket.nama}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Available:{" "}
                            {formatCurrency(maxAvail, pocket.currency)}
                            {locked > 0 && (
                              <span className="text-yellow-400/60">
                                {" "}
                                · {formatCurrency(locked, pocket.currency)}{" "}
                                locked
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => mwRemovePocket(item.id)}
                          className="shrink-0 ml-2 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <CurrencyInput
                            value={item.amount}
                            onChange={(v) => mwSetPocketAmount(item.id, v)}
                            currency={pocket.currency}
                            placeholder="0"
                          />
                        </div>
                        <button
                          onClick={() => {
                            const amt =
                              pocket.currency === "IDR"
                                ? formatRupiahInput(
                                    Math.floor(maxAvail).toString(),
                                  )
                                : maxAvail.toFixed(2);
                            mwSetPocketAmount(item.id, amt);
                          }}
                          className="shrink-0 rounded-xl bg-yellow-500/20 px-3 text-xs font-medium text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                        >
                          All
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add pocket button / picker */}
                {mwAvailablePockets.length > 0 &&
                  (mwAddingPocket ? (
                    <div className="rounded-xl bg-gray-900/50 p-3 space-y-2">
                      <p className="text-xs font-medium text-gray-400">
                        Select pocket:
                      </p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {mwAvailablePockets.map((p) => {
                          const locked = getLockedAmount(p);
                          const avail = Math.max(0, p.saldo - locked);
                          return (
                            <button
                              key={p.id}
                              onClick={() => mwAddPocket(p.id)}
                              className="w-full flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2.5 text-left hover:bg-gray-700 transition-colors"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadge[p.tipe].cls}`}
                                  >
                                    {typeBadge[p.tipe].label}
                                  </span>
                                  <p className="font-medium text-white text-sm truncate">
                                    {p.nama}
                                  </p>
                                </div>
                              </div>
                              <p className="text-xs text-emerald-400 shrink-0 ml-2">
                                {formatCurrency(avail, p.currency)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setMwAddingPocket(false)}
                        className="w-full rounded-lg bg-gray-800 py-2 text-xs text-gray-400 hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setMwAddingPocket(true)}
                      className="w-full rounded-xl border border-dashed border-gray-600 py-3 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors"
                    >
                      + Add Pocket
                    </button>
                  ))}

                <div className="flex gap-3">
                  <button
                    onClick={() => setMwStep("confirm")}
                    disabled={!mwHasItems}
                    className="flex-1 rounded-xl bg-yellow-500 py-2.5 font-semibold text-white hover:bg-yellow-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                  <button
                    onClick={() => setShowMultiWithdraw(false)}
                    className="rounded-xl bg-gray-700 px-5 py-2.5 font-medium text-gray-300 hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {mwStep === "confirm" && (
              <>
                <h3 className="text-lg font-bold text-white">
                  Confirm Withdrawal
                </h3>
                <p className="text-xs text-gray-400">
                  Review details before withdrawing.
                </p>

                <div className="space-y-2">
                  {mwPoolVal > 0 && (
                    <div className="flex items-center justify-between rounded-xl bg-gray-900/50 px-4 py-3">
                      <div>
                        <p className="font-medium text-white text-sm">
                          Available Balance
                        </p>
                        <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400">
                          Pool
                        </span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-bold text-yellow-400">
                          {formatCurrency(mwPoolVal, "USD")}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(mwPoolVal * exchangeRate, "IDR")}
                        </p>
                      </div>
                    </div>
                  )}

                  {mwPocketEntries.map((entry) => {
                    const usd =
                      entry.pocket.currency === "IDR"
                        ? entry.actual / exchangeRate
                        : entry.actual;
                    return (
                      <div
                        key={entry.pocket.id}
                        className="flex items-center justify-between rounded-xl bg-gray-900/50 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-white text-sm truncate">
                            {entry.pocket.nama}
                          </p>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadge[entry.pocket.tipe].cls}`}
                          >
                            {typeBadge[entry.pocket.tipe].label}
                          </span>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="font-bold text-yellow-400">
                            {formatCurrency(
                              entry.actual,
                              entry.pocket.currency,
                            )}
                          </p>
                          {entry.pocket.currency === "IDR" && (
                            <p className="text-xs text-gray-500">
                              {formatCurrency(usd, "USD")}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total */}
                <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-300">
                      Total Withdrawal
                    </p>
                    <div className="text-right">
                      <p className="text-lg font-bold text-yellow-400">
                        {formatCurrency(mwTotalUSD, "USD")}
                      </p>
                      <p className="text-sm text-yellow-400/60">
                        {formatCurrency(mwTotalUSD * exchangeRate, "IDR")}
                      </p>
                    </div>
                  </div>
                </div>

                {mwPocketEntries.some((e) => e.pocket.tipe === "goal") && (
                  <div className="rounded-lg bg-purple-500/10 px-3 py-2 text-xs text-purple-400">
                    Goal pockets that reach their target will be automatically deleted
                    after withdrawal.
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleMultiWithdraw}
                    className="flex-1 rounded-xl bg-yellow-500 py-2.5 font-semibold text-white hover:bg-yellow-600 transition-colors"
                  >
                    Withdraw {formatCurrency(mwTotalUSD, "USD")}
                  </button>
                  <button
                    onClick={() => setMwStep("input")}
                    className="rounded-xl bg-gray-700 px-5 py-2.5 font-medium text-gray-300 hover:bg-gray-600 transition-colors"
                  >
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {pockets.length > 0 && (
        <div className="rounded-2xl bg-gray-800 p-5 shadow-lg">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Summary
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between text-gray-300">
              <span>Total Pockets</span>
              <span className="font-medium text-white">{pockets.length}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Permanent</span>
              <span className="font-medium text-blue-400">
                {pockets.filter((p) => p.tipe === "permanen").length}
              </span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Goal</span>
              <span className="font-medium text-purple-400">
                {pockets.filter((p) => p.tipe === "goal").length}
              </span>
            </div>
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="flex justify-between text-gray-300">
                <span>Total in Pockets</span>
                <span className="font-medium text-white">
                  {formatCurrency(totalPocketSaldoUSD, "USD")}
                </span>
              </div>
              <div className="flex justify-between text-gray-300 mt-1">
                <span>Available Balance</span>
                <span className="font-bold text-emerald-400">
                  {formatCurrency(Math.max(0, freeBalanceUSD), "USD")}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
