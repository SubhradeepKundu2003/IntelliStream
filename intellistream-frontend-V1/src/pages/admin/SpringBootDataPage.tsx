import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { syncApi } from '../../services/api';
import type { SyncedBatch, SyncedDpiRecord, SyncedSubjectScore, SyncStatus } from '../../types/sync';
import Button from '../../components/ui/Button';

type Tab = 'Batches' | 'DPI Records' | 'Subject Scores';

// ── Shared spinner ───────────────────────────────────────────────────
function Spinner() {
  return <span className="w-6 h-6 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />;
}

// ── Search input ─────────────────────────────────────────────────────
function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-4 max-w-xs">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-tcs-gray-400 pointer-events-none" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none transition-colors
          bg-tcs-white text-tcs-gray-900 placeholder-tcs-gray-400
          dark:bg-tcs-gray-800 dark:text-tcs-gray-100 dark:placeholder-tcs-gray-600
          border-tcs-gray-300 dark:border-tcs-gray-700
          focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20"
      />
    </div>
  );
}

// ── Score chip ───────────────────────────────────────────────────────
function ScoreChip({ value }: { value: number }) {
  const pct = Math.round(value);
  const color =
    pct >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
    pct >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${color}`}>
      {value.toFixed(1)}
    </span>
  );
}

// ── Batches tab ──────────────────────────────────────────────────────
function BatchesTable({ rows }: { rows: SyncedBatch[] }) {
  const [search, setSearch] = useState('');
  const filtered = rows.filter((r) =>
    r.batch_name.toLowerCase().includes(search.toLowerCase()) ||
    r.subjects.some((s) => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <SearchInput value={search} onChange={setSearch} placeholder="Search batch or subject…" />
      <div className="rounded-xl border overflow-hidden bg-tcs-white dark:bg-tcs-gray-800 border-tcs-gray-200 dark:border-tcs-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-tcs-gray-200 dark:border-tcs-gray-700 bg-tcs-gray-50 dark:bg-tcs-gray-900/50">
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Batch Name</th>
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Subjects</th>
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Count</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-12 text-tcs-gray-400">
                  {search ? 'No batches match your search.' : 'No batches found.'}
                </td>
              </tr>
            ) : (
              filtered.map((b) => (
                <tr
                  key={b.id}
                  className="border-b last:border-0 border-tcs-gray-100 dark:border-tcs-gray-700/50
                    hover:bg-tcs-gray-50 dark:hover:bg-tcs-gray-700/30 transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-tcs-gray-900 dark:text-tcs-gray-100">
                    {b.batch_name}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {b.subjects.length === 0 ? (
                        <span className="text-tcs-gray-400 text-xs">—</span>
                      ) : (
                        b.subjects.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded-md text-xs font-medium
                              bg-tcs-blue/10 text-tcs-blue dark:bg-tcs-blue/20 dark:text-tcs-blue-light"
                          >
                            {s}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-tcs-gray-500 dark:text-tcs-gray-400">
                    {b.subjects.length}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── DPI Records tab ──────────────────────────────────────────────────
function DpiTable({ rows }: { rows: SyncedDpiRecord[] }) {
  const [search, setSearch] = useState('');
  const filtered = rows.filter((r) =>
    r.trainee_id.toLowerCase().includes(search.toLowerCase()) ||
    r.trainee_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <SearchInput value={search} onChange={setSearch} placeholder="Search by ID or name…" />
      <div className="rounded-xl border overflow-hidden bg-tcs-white dark:bg-tcs-gray-800 border-tcs-gray-200 dark:border-tcs-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-tcs-gray-200 dark:border-tcs-gray-700 bg-tcs-gray-50 dark:bg-tcs-gray-900/50">
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Trainee ID</th>
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Name</th>
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">DPI Score</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-12 text-tcs-gray-400">
                  {search ? 'No records match your search.' : 'No DPI records found.'}
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr
                  key={d.id}
                  className="border-b last:border-0 border-tcs-gray-100 dark:border-tcs-gray-700/50
                    hover:bg-tcs-gray-50 dark:hover:bg-tcs-gray-700/30 transition-colors"
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-tcs-gray-600 dark:text-tcs-gray-400">
                    {d.trainee_id}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-tcs-gray-900 dark:text-tcs-gray-100">
                    {d.trainee_name}
                  </td>
                  <td className="px-5 py-3.5">
                    <ScoreChip value={d.dpi} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Subject Scores tab ───────────────────────────────────────────────
function ScoresTable({ rows }: { rows: SyncedSubjectScore[] }) {
  const [search, setSearch] = useState('');
  const filtered = rows.filter((r) =>
    r.trainee_id.toLowerCase().includes(search.toLowerCase()) ||
    r.trainee_name.toLowerCase().includes(search.toLowerCase()) ||
    r.subject_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.exam_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <SearchInput value={search} onChange={setSearch} placeholder="Search by trainee, subject or exam…" />
      <div className="rounded-xl border overflow-hidden bg-tcs-white dark:bg-tcs-gray-800 border-tcs-gray-200 dark:border-tcs-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-tcs-gray-200 dark:border-tcs-gray-700 bg-tcs-gray-50 dark:bg-tcs-gray-900/50">
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Trainee ID</th>
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Name</th>
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Subject</th>
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Exam</th>
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Score</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-tcs-gray-400">
                  {search ? 'No scores match your search.' : 'No subject scores found.'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b last:border-0 border-tcs-gray-100 dark:border-tcs-gray-700/50
                    hover:bg-tcs-gray-50 dark:hover:bg-tcs-gray-700/30 transition-colors"
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-tcs-gray-600 dark:text-tcs-gray-400">
                    {s.trainee_id}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-tcs-gray-900 dark:text-tcs-gray-100">
                    {s.trainee_name}
                  </td>
                  <td className="px-5 py-3.5 text-tcs-gray-700 dark:text-tcs-gray-300">
                    {s.subject_name}
                  </td>
                  <td className="px-5 py-3.5 text-tcs-gray-500 dark:text-tcs-gray-400">
                    {s.exam_name ?? '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <ScoreChip value={s.score} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────
export default function SpringBootDataPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Batches');
  const [batches, setBatches] = useState<SyncedBatch[]>([]);
  const [dpi, setDpi] = useState<SyncedDpiRecord[]>([]);
  const [scores, setScores] = useState<SyncedSubjectScore[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [bRes, dRes, sRes, stRes] = await Promise.all([
        syncApi.batches(),
        syncApi.dpi(),
        syncApi.scores(),
        syncApi.status().catch(() => ({ data: null })),
      ]);
      setBatches(bRes.data);
      setDpi(dRes.data);
      setScores(sRes.data);
      if (stRes.data) setSyncStatus(stRes.data as SyncStatus);
    } catch {
      setError('Failed to load synced data. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const { data } = await syncApi.trigger();
      setSyncMsg(`Synced — ${data.batches_synced} batches, ${data.dpi_records_synced} DPI, ${data.scores_synced} scores`);
      await fetchAll();
    } catch {
      setSyncMsg('Sync failed. Check server logs.');
    } finally {
      setSyncing(false);
    }
  };

  const tabs: Tab[] = ['Batches', 'DPI Records', 'Subject Scores'];
  const counts: Record<Tab, number> = {
    'Batches': batches.length,
    'DPI Records': dpi.length,
    'Subject Scores': scores.length,
  };

  const lastSync = syncStatus?.last_sync_at
    ? new Date(syncStatus.last_sync_at).toLocaleString()
    : 'Never';
  const syncOk = syncStatus?.last_sync_status === 'success';

  return (
    <>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">
            Training Data
          </h1>
          <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400 mt-0.5">
            Live data synced from IntelliStream Deco (port 8081)
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button onClick={handleSyncNow} loading={syncing} variant="secondary">
            <RefreshCw size={15} />
            Sync Now
          </Button>
          <div className="flex items-center gap-2 text-xs text-tcs-gray-500 dark:text-tcs-gray-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${syncOk ? 'bg-green-500' : 'bg-tcs-gray-400'}`}
            />
            Last sync: {lastSync}
          </div>
          {syncMsg && (
            <p className={`text-xs ${syncMsg.includes('failed') ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
              {syncMsg}
            </p>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 mb-5 border-b border-tcs-gray-200 dark:border-tcs-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer',
              activeTab === tab
                ? 'border-tcs-blue text-tcs-blue'
                : 'border-transparent text-tcs-gray-500 dark:text-tcs-gray-400 hover:text-tcs-gray-900 dark:hover:text-tcs-gray-100',
            ].join(' ')}
          >
            {tab}
            {!loading && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium
                bg-tcs-gray-100 dark:bg-tcs-gray-700
                text-tcs-gray-600 dark:text-tcs-gray-400">
                {counts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner />
        </div>
      ) : error ? (
        <div className="text-center py-24">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchAll}>Retry</Button>
        </div>
      ) : (
        <>
          {activeTab === 'Batches'       && <BatchesTable rows={batches} />}
          {activeTab === 'DPI Records'   && <DpiTable rows={dpi} />}
          {activeTab === 'Subject Scores' && <ScoresTable rows={scores} />}
        </>
      )}
    </>
  );
}
