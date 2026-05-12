import { useEffect, useState } from 'react';
import { GraduationCap, Users } from 'lucide-react';
import { syncApi } from '../../services/api';
import type { SyncedBatch, SyncedDpiRecord } from '../../types/sync';

// ── Batch status pill ─────────────────────────────────────────────────
// Batches come from SpringBoot — no status field exists yet.
// The pill just shows trainee count for now.

// ── Main page ─────────────────────────────────────────────────────────
export default function TraineePage() {
  const [batches, setBatches] = useState<SyncedBatch[]>([]);
  const [selected, setSelected] = useState<SyncedBatch | null>(null);
  const [trainees, setTrainees] = useState<SyncedDpiRecord[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingTrainees, setLoadingTrainees] = useState(false);
  const [batchError, setBatchError] = useState('');

  useEffect(() => {
    syncApi.batches()
      .then(({ data }) => {
        setBatches(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .catch(() => setBatchError('Failed to load batches.'))
      .finally(() => setLoadingBatches(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoadingTrainees(true);
    syncApi.dpi(selected.batch_name)
      .then(({ data }) => setTrainees(data))
      .catch(() => setTrainees([]))
      .finally(() => setLoadingTrainees(false));
  }, [selected]);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">Batches & Trainees</h1>
        <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400 mt-0.5">
          Trainee rosters synced from SpringBoot — select a batch to view its trainees
        </p>
      </div>

      {loadingBatches ? (
        <div className="flex justify-center py-24">
          <span className="w-6 h-6 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : batchError ? (
        <p className="text-sm text-red-500">{batchError}</p>
      ) : (
        <>
          {/* Batch cards */}
          {batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed
              border-tcs-gray-200 dark:border-tcs-gray-700 text-center mb-6">
              <GraduationCap size={28} className="text-tcs-gray-300 dark:text-tcs-gray-600 mb-3" />
              <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400">
                No batches synced yet. Trigger a sync from the Training Data page.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 mb-6">
              {batches.map((b) => (
                <button
                  key={b.batch_name}
                  onClick={() => setSelected(b)}
                  className={[
                    'flex flex-col items-start px-4 py-3 rounded-xl border text-left transition-all cursor-pointer',
                    selected?.batch_name === b.batch_name
                      ? 'border-tcs-blue bg-tcs-blue/5 dark:bg-tcs-blue/10 shadow-sm'
                      : 'border-tcs-gray-200 dark:border-tcs-gray-700 bg-tcs-white dark:bg-tcs-gray-800 hover:border-tcs-blue/50',
                  ].join(' ')}
                >
                  <span className="text-sm font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">
                    {b.batch_name}
                  </span>
                  <span className="text-xs text-tcs-gray-400 dark:text-tcs-gray-500 mt-0.5">
                    {b.trainee_count} trainees · {b.subjects.length} subjects
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Trainee table */}
          {selected && (
            <>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-base font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">
                  Trainees in {selected.batch_name}
                </h2>
                <span className="text-xs text-tcs-gray-400 dark:text-tcs-gray-500">
                  {trainees.length} records
                </span>
              </div>

              {loadingTrainees ? (
                <div className="flex justify-center py-16">
                  <span className="w-5 h-5 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />
                </div>
              ) : trainees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed
                  border-tcs-gray-200 dark:border-tcs-gray-700 text-center">
                  <Users size={24} className="text-tcs-gray-300 dark:text-tcs-gray-600 mb-2" />
                  <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400">
                    No trainees synced for this batch yet.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-tcs-gray-200 dark:border-tcs-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-tcs-gray-50 dark:bg-tcs-gray-900 border-b border-tcs-gray-200 dark:border-tcs-gray-700">
                        <th className="text-left px-4 py-3 font-medium text-tcs-gray-600 dark:text-tcs-gray-400">Trainee ID</th>
                        <th className="text-left px-4 py-3 font-medium text-tcs-gray-600 dark:text-tcs-gray-400">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-tcs-gray-600 dark:text-tcs-gray-400">DPI Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tcs-gray-100 dark:divide-tcs-gray-700">
                      {trainees.map((t) => (
                        <tr key={t.trainee_id} className="hover:bg-tcs-gray-50 dark:hover:bg-tcs-gray-800 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-tcs-gray-700 dark:text-tcs-gray-300">{t.trainee_id}</td>
                          <td className="px-4 py-3 font-medium text-tcs-gray-900 dark:text-tcs-gray-100">{t.trainee_name}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                              bg-tcs-blue/10 text-tcs-blue dark:bg-tcs-blue/20 dark:text-tcs-blue-light">
                              {t.dpi}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
