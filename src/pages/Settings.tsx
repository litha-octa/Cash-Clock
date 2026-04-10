import { useRateStore, useTargetStore } from '../store';

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

      {/* Info notice */}
      <div className="rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-300">
        Semua perubahan disimpan secara otomatis.
      </div>
    </div>
  );
}
