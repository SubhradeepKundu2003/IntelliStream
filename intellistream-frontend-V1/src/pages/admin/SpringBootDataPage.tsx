import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import { scoresUploadApi, syncApi } from '../../services/api';
import type { SyncedBatch, SyncedDpiRecord, SyncedSubjectScore, SyncStatus } from '../../types/sync';
import type { RowResult, ScoresUploadResult, StreamReference } from '../../types/scores_upload';
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

// ── Batch filter dropdown ────────────────────────────────────────────
function BatchFilter({ batches, value, onChange }: { batches: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mb-4 px-3 py-2 text-sm rounded-lg border outline-none transition-colors cursor-pointer
        bg-tcs-white text-tcs-gray-900 dark:bg-tcs-gray-800 dark:text-tcs-gray-100
        border-tcs-gray-300 dark:border-tcs-gray-700
        focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20"
    >
      <option value="">All Batches</option>
      {batches.map((b) => <option key={b} value={b}>{b}</option>)}
    </select>
  );
}

// ── Score chip (0–100 scale) ─────────────────────────────────────────
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

// ── DPI chip (0–5 scale) ─────────────────────────────────────────────
function DpiChip({ value }: { value: number }) {
  const color =
    value >= 4   ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
    value >= 2.5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                   'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${color}`}>
      {value.toFixed(1)}
    </span>
  );
}

// ── Batches tab ──────────────────────────────────────────────────────
function BatchesTable({ rows, onDelete }: { rows: SyncedBatch[]; onDelete: (batchName: string) => void }) {
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
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Trainees</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-tcs-gray-400">
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
                    {b.trainee_count}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => onDelete(b.batch_name)}
                      className="p-1.5 rounded text-tcs-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete batch"
                    >
                      <Trash2 size={14} />
                    </button>
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

// ── Upload modal ─────────────────────────────────────────────────────
function UploadModal({ onClose, onDone, batchNames }: {
  onClose: () => void;
  onDone: () => void;
  batchNames: string[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [batchInput, setBatchInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [existingInfo, setExistingInfo] = useState<{ dpi_count: number; has_existing: boolean; excel_managed: boolean } | null>(null);
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ScoresUploadResult | null>(null);
  const [uploadError, setUploadError] = useState('');

  const batchTrimmed = batchInput.trim();
  const filteredBatches = batchNames
    .filter((b) => !batchTrimmed || b.toLowerCase().includes(batchTrimmed.toLowerCase()))
    .slice(0, 6);

  const handleDownloadTemplate = async () => {
    try {
      const { data } = await scoresUploadApi.downloadTemplate();
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'employee_scores_template.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const doUpload = async () => {
    setUploading(true);
    setUploadError('');
    setResult(null);
    try {
      const { data } = await scoresUploadApi.uploadExcel(batchTrimmed, file!);
      setResult(data);
      if (data.rows_succeeded > 0) onDone();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setUploadError(msg ?? 'Upload failed. Check server logs.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !batchTrimmed) return;
    if (overrideConfirmed) { await doUpload(); return; }

    setChecking(true);
    try {
      const { data } = await scoresUploadApi.batchInfo(batchTrimmed);
      if (data.has_existing) {
        setExistingInfo(data);
        setChecking(false);
        return; // show override warning — don't upload yet
      }
    } catch { /* if check fails, proceed */ }
    setChecking(false);
    await doUpload();
  };

  const successRows = result?.row_results.filter((r: RowResult) => r.status === 'ok') ?? [];
  const errorRows  = result?.row_results.filter((r: RowResult) => r.status === 'error') ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-tcs-white dark:bg-tcs-gray-800 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">Upload Employee Scores</h2>
            <p className="text-xs text-tcs-gray-500 dark:text-tcs-gray-400 mt-0.5">
              Emp Id · Name · Sub Batch · DPI · Stream · Java · Python · WebTech · AIML · Agile · BizSkill
            </p>
          </div>
          <button onClick={onClose} className="text-tcs-gray-400 hover:text-tcs-gray-600 dark:hover:text-tcs-gray-200 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Batch free-text with suggestions */}
        <div className="relative mb-4">
          <label className="block text-xs font-medium text-tcs-gray-600 dark:text-tcs-gray-400 mb-1">
            Batch <span className="text-red-500">*</span>
            <span className="ml-1 font-normal text-tcs-gray-400">(type any number or pick existing)</span>
          </label>
          <input
            type="text"
            value={batchInput}
            onChange={(e) => { setBatchInput(e.target.value); setExistingInfo(null); setOverrideConfirmed(false); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="e.g. 47 or Batch 1"
            className="w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors
              bg-tcs-white text-tcs-gray-900 dark:bg-tcs-gray-700 dark:text-tcs-gray-100
              border-tcs-gray-300 dark:border-tcs-gray-600
              focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20"
          />
          {showSuggestions && filteredBatches.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border shadow-lg
              bg-tcs-white dark:bg-tcs-gray-700 border-tcs-gray-200 dark:border-tcs-gray-600 overflow-hidden">
              {filteredBatches.map((b) => (
                <button
                  key={b}
                  onMouseDown={() => { setBatchInput(b); setShowSuggestions(false); setExistingInfo(null); setOverrideConfirmed(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-tcs-gray-800 dark:text-tcs-gray-100
                    hover:bg-tcs-gray-100 dark:hover:bg-tcs-gray-600 cursor-pointer"
                >
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Override warning */}
        {existingInfo?.has_existing && !overrideConfirmed && (
          <div className="mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
              Batch "{batchTrimmed}" already has {existingInfo.dpi_count} trainee record{existingInfo.dpi_count !== 1 ? 's' : ''}.
              {existingInfo.excel_managed ? ' (Excel-managed)' : ' (from Deco sync)'}
              {' '}Uploading will override existing data for matching trainees.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setOverrideConfirmed(true); doUpload(); }}
                className="px-3 py-1 text-xs rounded-md bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
              >
                Upload Anyway
              </button>
              <button
                onClick={() => setExistingInfo(null)}
                className="px-3 py-1 text-xs rounded-md border border-tcs-gray-300 dark:border-tcs-gray-600
                  text-tcs-gray-600 dark:text-tcs-gray-300 hover:bg-tcs-gray-100 dark:hover:bg-tcs-gray-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Template download */}
        <button onClick={handleDownloadTemplate}
          className="flex items-center gap-2 text-xs text-tcs-blue hover:underline mb-4 cursor-pointer">
          <Download size={13} />Download Excel template
        </button>

        {/* File picker */}
        <div onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-tcs-gray-300 dark:border-tcs-gray-600 rounded-xl p-6
            flex flex-col items-center gap-2 cursor-pointer hover:border-tcs-blue transition-colors mb-4">
          <Upload size={22} className="text-tcs-gray-400" />
          <span className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400">
            {file ? file.name : 'Click to choose an .xlsx file'}
          </span>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setUploadError(''); }} />
        </div>

        {uploadError && <p className="text-xs text-red-500 mb-3">{uploadError}</p>}

        {/* Result summary */}
        {result && (
          <div className="mb-4 space-y-2">
            <div className="flex gap-4 text-xs">
              <span className="text-green-600 dark:text-green-400 font-medium">{result.rows_succeeded} saved</span>
              {result.rows_failed > 0 && <span className="text-red-500 font-medium">{result.rows_failed} failed</span>}
              <span className="text-tcs-gray-500 dark:text-tcs-gray-400">Data written directly — no sync needed</span>
            </div>
            {successRows.length > 0 && (
              <div className="max-h-28 overflow-y-auto rounded-lg bg-green-50 dark:bg-green-900/10 p-2 space-y-1">
                {successRows.map((r: RowResult) => (
                  <p key={r.row} className="text-xs text-green-700 dark:text-green-400">Row {r.row}: {r.trainee_id} — saved</p>
                ))}
              </div>
            )}
            {errorRows.length > 0 && (
              <div className="max-h-28 overflow-y-auto rounded-lg bg-red-50 dark:bg-red-900/10 p-2 space-y-1">
                {errorRows.map((r: RowResult) => (
                  <p key={r.row} className="text-xs text-red-600 dark:text-red-400">Row {r.row} ({r.trainee_id}): {r.detail}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          <Button size="sm" onClick={handleUpload} loading={uploading || checking}
            disabled={!file || !batchTrimmed || uploading || checking || (existingInfo?.has_existing === true && !overrideConfirmed)}>
            <Upload size={14} />Upload
          </Button>
        </div>
      </div>
    </div>
  );
}


// ── DPI Records tab ──────────────────────────────────────────────────
function DpiTable({ rows, batchNames, streamRefs }: {
  rows: SyncedDpiRecord[];
  batchNames: string[];
  streamRefs: StreamReference[];
}) {
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');

  const refMap = Object.fromEntries(streamRefs.map((r) => [r.trainee_id, r.stream_name]));

  const filtered = rows.filter((r) => {
    const matchesBatch = !batchFilter || r.batch_name === batchFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      r.trainee_id.toLowerCase().includes(q) ||
      r.trainee_name.toLowerCase().includes(q) ||
      r.batch_name.toLowerCase().includes(q) ||
      (r.location ?? '').toLowerCase().includes(q) ||
      (refMap[r.trainee_id] ?? '').toLowerCase().includes(q);
    return matchesBatch && matchesSearch;
  });

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <BatchFilter batches={batchNames} value={batchFilter} onChange={setBatchFilter} />
        <SearchInput value={search} onChange={setSearch} placeholder="Search by ID, name, location or stream…" />
      </div>
      <div className="rounded-xl border overflow-hidden bg-tcs-white dark:bg-tcs-gray-800 border-tcs-gray-200 dark:border-tcs-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-tcs-gray-200 dark:border-tcs-gray-700 bg-tcs-gray-50 dark:bg-tcs-gray-900/50">
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Batch</th>
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Sub Batch</th>
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Trainee ID</th>
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Name</th>
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Location</th>
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Stream (Ref.)</th>
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">DPI Score</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-tcs-gray-400">
                  {search || batchFilter ? 'No records match your filters.' : 'No DPI records found.'}
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr
                  key={d.id}
                  className="border-b last:border-0 border-tcs-gray-100 dark:border-tcs-gray-700/50
                    hover:bg-tcs-gray-50 dark:hover:bg-tcs-gray-700/30 transition-colors"
                >
                  <td className="px-5 py-3.5 text-tcs-gray-700 dark:text-tcs-gray-300">
                    {d.batch_name}
                  </td>
                  <td className="px-5 py-3.5 text-tcs-gray-600 dark:text-tcs-gray-400 font-mono text-xs">
                    {d.sub_batch ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-tcs-gray-600 dark:text-tcs-gray-400">
                    {d.trainee_id}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-tcs-gray-900 dark:text-tcs-gray-100">
                    {d.trainee_name}
                  </td>
                  <td className="px-5 py-3.5 text-tcs-gray-500 dark:text-tcs-gray-400">
                    {d.location ?? '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {refMap[d.trainee_id] ? (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium
                        bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        {refMap[d.trainee_id]}
                      </span>
                    ) : (
                      <span className="text-tcs-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <DpiChip value={d.dpi} />
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
function ScoresTable({ rows, batchNames }: { rows: SyncedSubjectScore[]; batchNames: string[] }) {
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const filtered = rows.filter((r) => {
    const matchesBatch = !batchFilter || r.batch_name === batchFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      r.batch_name.toLowerCase().includes(q) ||
      r.trainee_id.toLowerCase().includes(q) ||
      r.trainee_name.toLowerCase().includes(q) ||
      r.subject_name.toLowerCase().includes(q) ||
      (r.exam_name ?? '').toLowerCase().includes(q);
    return matchesBatch && matchesSearch;
  });

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <BatchFilter batches={batchNames} value={batchFilter} onChange={setBatchFilter} />
        <SearchInput value={search} onChange={setSearch} placeholder="Search by trainee, subject or exam…" />
      </div>
      <div className="rounded-xl border overflow-hidden bg-tcs-white dark:bg-tcs-gray-800 border-tcs-gray-200 dark:border-tcs-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-tcs-gray-200 dark:border-tcs-gray-700 bg-tcs-gray-50 dark:bg-tcs-gray-900/50">
              <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Batch</th>
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
                <td colSpan={6} className="text-center py-12 text-tcs-gray-400">
                  {search || batchFilter ? 'No scores match your filters.' : 'No subject scores found.'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b last:border-0 border-tcs-gray-100 dark:border-tcs-gray-700/50
                    hover:bg-tcs-gray-50 dark:hover:bg-tcs-gray-700/30 transition-colors"
                >
                  <td className="px-5 py-3.5 text-tcs-gray-700 dark:text-tcs-gray-300">
                    {s.batch_name}
                  </td>
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
  const [streamRefs, setStreamRefs] = useState<StreamReference[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [syncDialog, setSyncDialog] = useState<{ batches: { batch_name: string; trainee_count: number }[] } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [bRes, dRes, sRes, stRes, rRes] = await Promise.all([
        syncApi.batches(),
        syncApi.dpi(),
        syncApi.scores(),
        syncApi.status().catch(() => ({ data: null })),
        scoresUploadApi.streamReferences().catch(() => ({ data: [] })),
      ]);
      setBatches(bRes.data);
      setDpi(dRes.data);
      setScores(sRes.data);
      setStreamRefs(rRes.data as StreamReference[]);
      if (stRes.data) setSyncStatus(stRes.data as SyncStatus);
    } catch {
      setError('Failed to load synced data. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const doSync = async (preserveExcel: boolean) => {
    setSyncDialog(null);
    setSyncing(true);
    setSyncMsg('');
    try {
      const { data } = await syncApi.trigger(preserveExcel);
      setSyncMsg(`Synced — ${data.batches_synced} batches, ${data.dpi_records_synced} DPI, ${data.scores_synced} scores`);
      await fetchAll();
    } catch {
      setSyncMsg('Sync failed. Check server logs.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      const { data } = await scoresUploadApi.excelBatches();
      if (data.length > 0) {
        setSyncDialog({ batches: data });
        return;
      }
    } catch { /* if check fails, sync normally */ }
    await doSync(false);
  };

  const handleDeleteBatch = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await scoresUploadApi.deleteBatch(deleteTarget);
      setDeleteTarget(null);
      await fetchAll();
    } catch {
      // keep dialog open so user sees the failure
    } finally {
      setDeleting(false);
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
      {showUpload && (
        <UploadModal
          batchNames={batches.map((b) => b.batch_name)}
          onClose={() => setShowUpload(false)}
          onDone={() => { setShowUpload(false); fetchAll(); }}
        />
      )}

      {syncDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-tcs-white dark:bg-tcs-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-base font-semibold text-tcs-gray-900 dark:text-tcs-gray-100 mb-2">
              Excel-managed batches detected
            </h2>
            <p className="text-sm text-tcs-gray-600 dark:text-tcs-gray-300 mb-3">
              The following batch{syncDialog.batches.length > 1 ? 'es were' : ' was'} uploaded via Excel and will be overridden if you sync all:
            </p>
            <div className="rounded-lg bg-tcs-gray-50 dark:bg-tcs-gray-700/50 p-3 mb-4 space-y-1">
              {syncDialog.batches.map((b) => (
                <div key={b.batch_name} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-tcs-gray-800 dark:text-tcs-gray-100">{b.batch_name}</span>
                  <span className="text-xs text-tcs-gray-500 dark:text-tcs-gray-400">{b.trainee_count} trainees</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={() => doSync(true)}>
                Skip Excel batches — preserve uploaded data
              </Button>
              <Button size="sm" variant="secondary" onClick={() => doSync(false)}>
                Sync All — override Excel with Deco data
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSyncDialog(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-tcs-white dark:bg-tcs-gray-800 rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <Trash2 size={18} className="text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-base font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">Delete Batch</h2>
            </div>
            <p className="text-sm text-tcs-gray-600 dark:text-tcs-gray-300 mb-1">
              This will permanently delete all data for:
            </p>
            <p className="text-sm font-semibold text-tcs-gray-900 dark:text-tcs-gray-100 mb-4">
              "{deleteTarget}"
            </p>
            <p className="text-xs text-tcs-gray-500 dark:text-tcs-gray-400 mb-5">
              DPI records, subject scores, stream references, and the batch entry will all be removed. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button size="sm" onClick={handleDeleteBatch} loading={deleting}
                className="bg-red-600 hover:bg-red-700 text-white border-red-600">
                <Trash2 size={13} />Delete
              </Button>
            </div>
          </div>
        </div>
      )}

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
          <div className="flex gap-2">
            <Button onClick={() => setShowUpload(true)} variant="secondary">
              <Upload size={15} />
              Upload Excel
            </Button>
            <Button onClick={handleSyncNow} loading={syncing} variant="secondary">
              <RefreshCw size={15} />
              Sync Now
            </Button>
          </div>
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
          {activeTab === 'Batches'       && <BatchesTable rows={batches} onDelete={setDeleteTarget} />}
          {activeTab === 'DPI Records'   && <DpiTable rows={dpi} batchNames={batches.map((b) => b.batch_name)} streamRefs={streamRefs} />}
          {activeTab === 'Subject Scores' && <ScoresTable rows={scores} batchNames={batches.map((b) => b.batch_name)} />}
        </>
      )}
    </>
  );
}
