import { useState, useMemo } from 'react';
import { useLogStore, useRateStore } from '../store';
import {
  generateId,
  formatCurrency,
  formatHours,
  formatDateShort,
  groupLogsByWeek,
  calculateEarnings,
} from '../utils';

function parseDuration(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed.includes(':')) {
    const [h, m] = trimmed.split(':').map(Number);
    return (h || 0) + (m || 0) / 60;
  }
  return parseFloat(trimmed) || 0;
}

function formatDurationDisplay(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} menit`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
}

export default function LogPage() {
  const logs = useLogStore((s) => s.logs);
  const addLog = useLogStore((s) => s.addLog);
  const updateLog = useLogStore((s) => s.updateLog);
  const removeLog = useLogStore((s) => s.removeLog);
  const rate = useRateStore((s) => s.rate);
  const currency = useRateStore((s) => s.currency);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [durationRaw, setDurationRaw] = useState('');
  const [project, setProject] = useState('');

  const weekGroups = useMemo(() => groupLogsByWeek(logs), [logs]);
  const activeGroup = useMemo(() => weekGroups.find((g) => g.status === 'active'), [weekGroups]);
  const pastGroups = useMemo(() => weekGroups.filter((g) => g.status !== 'active'), [weekGroups]);

  const resetForm = () => {
    setEditingId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setDescription('');
    setDurationRaw('');
    setProject('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const duration = parseDuration(durationRaw);
    if (!description.trim() || duration <= 0) return;

    if (editingId) {
      updateLog(editingId, {
        date,
        description: description.trim(),
        duration,
        project: project.trim() || undefined,
      });
    } else {
      addLog({
        id: generateId(),
        date,
        description: description.trim(),
        duration,
        project: project.trim() || undefined,
      });
    }

    resetForm();
  };

  const handleEdit = (log: (typeof logs)[0]) => {
    setEditingId(log.id);
    setDate(log.date);
    setDescription(log.description);
    const h = Math.floor(log.duration);
    const m = Math.round((log.duration - h) * 60);
    setDurationRaw(`${h}:${m.toString().padStart(2, '0')}`);
    setProject(log.project || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    removeLog(id);
    if (editingId === id) resetForm();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">
        {editingId ? 'Edit Log' : 'Tambah Log'}
      </h1>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-2xl bg-gray-800 p-5 shadow-lg space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-400">Tanggal</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-400">Deskripsi</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contoh: Design landing page"
            className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white placeholder-gray-600 outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-400">Durasi</label>
          <input
            type="text"
            value={durationRaw}
            onChange={(e) => setDurationRaw(e.target.value)}
            placeholder="1:30 atau 1.5"
            className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white placeholder-gray-600 outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-400">
            Proyek <span className="text-gray-600">(opsional)</span>
          </label>
          <input
            type="text"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="Nama proyek"
            className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-white placeholder-gray-600 outline-none ring-1 ring-gray-700 focus:ring-emerald-500 transition-shadow"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-emerald-500 py-2.5 font-semibold text-white hover:bg-emerald-600 transition-colors"
          >
            {editingId ? 'Simpan Perubahan' : 'Tambah Log'}
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

      {/* Current Week Logs */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Minggu Ini ({activeGroup?.logs.length ?? 0} log)
        </h2>

        {!activeGroup || activeGroup.logs.length === 0 ? (
          <div className="rounded-2xl bg-gray-800 p-8 text-center shadow-lg">
            <p className="text-gray-500">Belum ada log minggu ini.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {activeGroup.logs.map((log) => (
              <li key={log.id} className="rounded-2xl bg-gray-800 p-4 shadow-lg">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{log.description}</p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {log.date}
                      {log.project ? (
                        <span className="ml-2 inline-block rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                          {log.project}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="ml-4 text-right shrink-0">
                    <p className="font-semibold text-emerald-400">
                      {formatCurrency(log.duration * rate, currency)}
                    </p>
                    <p className="text-xs text-gray-500">{formatDurationDisplay(log.duration)}</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleEdit(log)}
                    className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-600 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(log.id)}
                    className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Past Week Groups (Pending / Cleared) */}
      {pastGroups.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Riwayat Mingguan
          </h2>

          <ul className="space-y-3">
            {pastGroups.map((group) => {
              const groupEarnings = calculateEarnings(group.totalHours, rate);
              const isPending = group.status === 'pending';
              return (
                <li key={group.weekStart} className="rounded-2xl bg-gray-800 p-4 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {formatDateShort(group.weekStart)} - {formatDateShort(group.weekEnd)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {group.logs.length} log · {formatHours(group.totalHours)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${isPending ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        {formatCurrency(groupEarnings.net, currency)}
                      </p>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          isPending
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {isPending ? `Cair ${formatDateShort(group.clearDate)}` : 'Cleared'}
                      </span>
                    </div>
                  </div>

                  {/* Collapsed log list */}
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                      Lihat detail log
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {group.logs.map((log) => (
                        <li
                          key={log.id}
                          className="flex items-center justify-between rounded-xl bg-gray-900/50 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-300 truncate">{log.description}</p>
                            <p className="text-xs text-gray-500">
                              {log.date}
                              {log.project ? ` · ${log.project}` : ''}
                            </p>
                          </div>
                          <div className="ml-3 text-right shrink-0">
                            <p className="text-sm text-gray-300">
                              {formatCurrency(log.duration * rate, currency)}
                            </p>
                            <p className="text-xs text-gray-500">{formatDurationDisplay(log.duration)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
