import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Download, Plus, Trash2, Upload } from 'lucide-react';
import { brApi, syncApi } from '../../services/api';
import type {
  BRCreate,
  BRResponse,
  BRStreamCreate,
  BRSummary,
  BRUpdate,
  CapacityType,
  ExcelImportResult,
} from '../../types/business_requirements';
import type { SyncedBatch } from '../../types/sync';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

// ── Local draft type used in the form ────────────────────────────────

interface StreamDraft {
  _key: string;
  name: string;
  is_mandatory: boolean;
  capacity_type: CapacityType;
  capacity_value: number;
  roles_input: string;
  subjects_input: string;
}

// ── Default mandatory streams pre-populated on new BR ─────────────────

let _seq = 0;
const uid = () => String(++_seq);

const DEFAULT_STREAMS: Omit<StreamDraft, '_key'>[] = [
  { name: 'Java Development',        is_mandatory: true, capacity_type: 'percentage', capacity_value: 25, roles_input: 'Java Developer, Backend Engineer', subjects_input: 'Java, SQL' },
  { name: 'Python/Data Engineering',  is_mandatory: true, capacity_type: 'percentage', capacity_value: 20, roles_input: 'Data Analyst, Data Engineer',      subjects_input: 'Python' },
  { name: 'Cloud & DevOps',           is_mandatory: true, capacity_type: 'percentage', capacity_value: 20, roles_input: 'Cloud Engineer, DevOps Engineer',  subjects_input: 'Cloud' },
  { name: 'Cybersecurity',            is_mandatory: true, capacity_type: 'percentage', capacity_value: 15, roles_input: 'Security Analyst',                 subjects_input: 'Cybersecurity' },
  { name: 'Business Analysis',        is_mandatory: true, capacity_type: 'percentage', capacity_value: 10, roles_input: 'Business Analyst',                 subjects_input: 'Agile' },
  { name: 'AI/ML Engineering',        is_mandatory: true, capacity_type: 'percentage', capacity_value: 10, roles_input: 'ML Engineer, AI Researcher',       subjects_input: 'AIML, Python' },
];

// ── Helpers ────────────────────────────────────────────────────────────

function splitComma(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

function draftToCreate(d: StreamDraft): BRStreamCreate {
  return {
    name: d.name.trim(),
    is_mandatory: d.is_mandatory,
    capacity_type: d.capacity_type,
    capacity_value: d.capacity_value,
    roles_needed: splitComma(d.roles_input),
    subjects_needed: splitComma(d.subjects_input),
  };
}

function makeDefaultStreams(): StreamDraft[] {
  return DEFAULT_STREAMS.map((s) => ({ ...s, _key: uid() }));
}

function calcSeats(d: StreamDraft, count: number): string {
  if (!count) return '—';
  if (d.capacity_type === 'percentage') return `~${Math.round(count * d.capacity_value / 100)}`;
  return `${Math.round(d.capacity_value)}`;
}

function pctAllocated(streams: StreamDraft[]): number {
  return streams
    .filter((s) => s.capacity_type === 'percentage')
    .reduce((acc, s) => acc + (s.capacity_value || 0), 0);
}

// ── Stream table row (form) ────────────────────────────────────────────

function StreamRow({
  stream,
  traineeCount,
  onChange,
  onDelete,
}: {
  stream: StreamDraft;
  traineeCount: number;
  onChange: (key: string, patch: Partial<StreamDraft>) => void;
  onDelete: (key: string) => void;
}) {
  const inputCls =
    'w-full px-2 py-1 text-sm rounded border outline-none ' +
    'bg-tcs-white dark:bg-tcs-gray-900 ' +
    'text-tcs-gray-900 dark:text-tcs-gray-100 ' +
    'border-tcs-gray-300 dark:border-tcs-gray-700 ' +
    'focus:border-tcs-blue focus:ring-1 focus:ring-tcs-blue/20';

  return (
    <tr className="border-b border-tcs-gray-100 dark:border-tcs-gray-700/50">
      {/* Stream name */}
      <td className="px-2 py-1.5 min-w-[170px]">
        <input
          type="text"
          value={stream.name}
          onChange={(e) => onChange(stream._key, { name: e.target.value })}
          placeholder="Stream name"
          className={inputCls}
        />
      </td>

      {/* Mandatory checkbox */}
      <td className="px-2 py-1.5 text-center w-20">
        <input
          type="checkbox"
          checked={stream.is_mandatory}
          onChange={(e) => onChange(stream._key, { is_mandatory: e.target.checked })}
          className="w-4 h-4 accent-tcs-blue cursor-pointer"
          title="Mark as mandatory stream"
        />
      </td>

      {/* Capacity: type + value */}
      <td className="px-2 py-1.5 w-44">
        <div className="flex items-center gap-1">
          <select
            value={stream.capacity_type}
            onChange={(e) => onChange(stream._key, { capacity_type: e.target.value as CapacityType })}
            className="px-1.5 py-1 text-xs rounded border outline-none cursor-pointer
              bg-tcs-white dark:bg-tcs-gray-900
              text-tcs-gray-900 dark:text-tcs-gray-100
              border-tcs-gray-300 dark:border-tcs-gray-700
              focus:border-tcs-blue"
          >
            <option value="percentage">%</option>
            <option value="count">#</option>
          </select>
          <input
            type="number"
            min={0}
            max={stream.capacity_type === 'percentage' ? 100 : undefined}
            value={stream.capacity_value}
            onChange={(e) => onChange(stream._key, { capacity_value: parseFloat(e.target.value) || 0 })}
            className="w-16 px-2 py-1 text-sm rounded border outline-none
              bg-tcs-white dark:bg-tcs-gray-900
              text-tcs-gray-900 dark:text-tcs-gray-100
              border-tcs-gray-300 dark:border-tcs-gray-700
              focus:border-tcs-blue focus:ring-1 focus:ring-tcs-blue/20"
          />
          <span className="text-xs text-tcs-gray-400 dark:text-tcs-gray-500 shrink-0">
            {stream.capacity_type === 'percentage' ? '%' : 'seats'}
          </span>
        </div>
      </td>

      {/* Roles needed */}
      <td className="px-2 py-1.5 min-w-[180px]">
        <input
          type="text"
          value={stream.roles_input}
          onChange={(e) => onChange(stream._key, { roles_input: e.target.value })}
          placeholder="Role A, Role B"
          className={inputCls}
        />
      </td>

      {/* Subjects needed */}
      <td className="px-2 py-1.5 min-w-[160px]">
        <input
          type="text"
          value={stream.subjects_input}
          onChange={(e) => onChange(stream._key, { subjects_input: e.target.value })}
          placeholder="Java, SQL"
          className={inputCls}
        />
      </td>

      {/* Calculated seats */}
      <td className="px-2 py-1.5 text-center w-16">
        <span className="text-sm font-semibold text-tcs-blue dark:text-tcs-blue-light">
          {calcSeats(stream, traineeCount)}
        </span>
      </td>

      {/* Delete */}
      <td className="px-2 py-1.5 text-center w-10">
        <button
          type="button"
          onClick={() => onDelete(stream._key)}
          className="p-1 rounded text-tcs-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
          title="Remove stream"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}

// ── Form modal ─────────────────────────────────────────────────────────

interface BRFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  batches: SyncedBatch[];
  editBr?: BRResponse;
}

function BRFormModal({ isOpen, onClose, onSaved, batches, editBr }: BRFormModalProps) {
  const isEdit = !!editBr;

  const [title, setTitle] = useState('');
  const [batchName, setBatchName] = useState('');
  const [location, setLocation] = useState('');
  const [streams, setStreams] = useState<StreamDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setApiError('');
    setParseErrors([]);
    if (editBr) {
      setTitle(editBr.title);
      setBatchName(editBr.batch_name);
      setLocation(editBr.location ?? '');
      setStreams(
        editBr.streams.map((s) => ({
          _key: uid(),
          name: s.name,
          is_mandatory: s.is_mandatory,
          capacity_type: s.capacity_type,
          capacity_value: s.capacity_value,
          roles_input: s.roles_needed.join(', '),
          subjects_input: s.subjects_needed.join(', '),
        })),
      );
    } else {
      setTitle('');
      setBatchName(batches[0]?.batch_name ?? '');
      setLocation('');
      setStreams(makeDefaultStreams());
    }
  }, [isOpen, editBr, batches]);

  const selectedBatch = batches.find((b) => b.batch_name === batchName);
  const traineeCount = selectedBatch?.trainee_count ?? 0;

  const updateStream = (key: string, patch: Partial<StreamDraft>) =>
    setStreams((prev) => prev.map((s) => (s._key === key ? { ...s, ...patch } : s)));

  const deleteStream = (key: string) =>
    setStreams((prev) => prev.filter((s) => s._key !== key));

  const addStream = () =>
    setStreams((prev) => [
      ...prev,
      { _key: uid(), name: '', is_mandatory: false, capacity_type: 'percentage', capacity_value: 0, roles_input: '', subjects_input: '' },
    ]);

  const handleDownloadTemplate = async () => {
    setApiError('');
    try {
      const { data } = await brApi.downloadTemplate();
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'br_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setApiError('Failed to download template.');
    }
  };

  const handleUploadExcel = async (file: File) => {
    setUploading(true);
    setParseErrors([]);
    setApiError('');
    try {
      const { data }: { data: ExcelImportResult } = await brApi.parseExcel(file);
      setParseErrors(data.errors);
      if (data.streams.length > 0) {
        setStreams(
          data.streams.map((s) => ({
            _key: uid(),
            name: s.name,
            is_mandatory: s.is_mandatory,
            capacity_type: s.capacity_type,
            capacity_value: s.capacity_value,
            roles_input: s.roles_needed.join(', '),
            subjects_input: s.subjects_needed.join(', '),
          })),
        );
      }
    } catch {
      setApiError('Failed to parse the Excel file. Check the file format.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { setApiError('Title is required.'); return; }
    if (!batchName) { setApiError('Please select a batch.'); return; }
    if (streams.length === 0) { setApiError('Add at least one stream.'); return; }
    const emptyIdx = streams.findIndex((s) => !s.name.trim());
    if (emptyIdx !== -1) { setApiError(`Stream row ${emptyIdx + 1} is missing a name.`); return; }

    setSaving(true);
    setApiError('');
    try {
      const streamPayload = streams.map(draftToCreate);
      const locationVal = location.trim() || undefined;
      if (isEdit) {
        const body: BRUpdate = { title: title.trim(), location: locationVal, streams: streamPayload };
        await brApi.update(editBr!.id, body);
      } else {
        const body: BRCreate = { batch_name: batchName, title: title.trim(), location: locationVal, streams: streamPayload };
        await brApi.create(body);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setApiError(msg ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const pct = pctAllocated(streams);
  const pctOver = pct > 100;
  const pctExact = pct === 100;
  const hasPctStreams = streams.some((s) => s.capacity_type === 'percentage');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Business Requirement' : 'New Business Requirement'}
      width="w-full max-w-5xl"
    >
      <div className="space-y-4">
        {/* Batch + Title */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-tcs-gray-700 dark:text-tcs-gray-300">Batch</label>
            {isEdit ? (
              <div className="px-3 py-2 rounded-lg text-sm border bg-tcs-gray-50 dark:bg-tcs-gray-900/50 text-tcs-gray-700 dark:text-tcs-gray-300 border-tcs-gray-200 dark:border-tcs-gray-700">
                {batchName}
                {traineeCount > 0 && (
                  <span className="ml-2 text-xs text-tcs-gray-400">({traineeCount} trainees)</span>
                )}
              </div>
            ) : batches.length === 0 ? (
              <div className="px-3 py-2 rounded-lg text-sm border border-tcs-gray-200 dark:border-tcs-gray-700 text-tcs-gray-400">
                No batches synced — run a sync first
              </div>
            ) : (
              <select
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm border outline-none transition-colors cursor-pointer
                  bg-tcs-white dark:bg-tcs-gray-800 text-tcs-gray-900 dark:text-tcs-gray-100
                  border-tcs-gray-300 dark:border-tcs-gray-700
                  focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20"
              >
                {batches.map((b) => (
                  <option key={b.batch_name} value={b.batch_name}>
                    {b.batch_name} ({b.trainee_count} trainees)
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-tcs-gray-700 dark:text-tcs-gray-300">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q1 2025 Batch Allocation"
              className="px-3 py-2 rounded-lg text-sm border outline-none transition-colors
                bg-tcs-white dark:bg-tcs-gray-800 text-tcs-gray-900 dark:text-tcs-gray-100
                border-tcs-gray-300 dark:border-tcs-gray-700
                focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20"
            />
          </div>
        </div>

        {/* Location (lower priority — used as context for AI stream suggestions) */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-tcs-gray-700 dark:text-tcs-gray-300">
            Location
            <span className="ml-1.5 text-xs font-normal text-tcs-gray-400">(optional · used as context for AI stream suggestions)</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Bangalore, Chennai, Hyderabad"
            className="px-3 py-2 rounded-lg text-sm border outline-none transition-colors
              bg-tcs-white dark:bg-tcs-gray-800 text-tcs-gray-900 dark:text-tcs-gray-100
              border-tcs-gray-300 dark:border-tcs-gray-700
              focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20"
          />
        </div>

        {/* Excel tools row */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide">
            Excel
          </span>
          <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>
            <Download size={14} />
            Download Template
          </Button>
          <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
            <Upload size={14} />
            Upload Excel
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUploadExcel(f);
            }}
          />
          <span className="ml-auto text-xs text-tcs-gray-400 dark:text-tcs-gray-500">
            Upload replaces all rows below
          </span>
        </div>

        {/* Excel parse warnings */}
        {parseErrors.length > 0 && (
          <div className="rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 space-y-0.5">
            <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
              {parseErrors.length} row{parseErrors.length > 1 ? 's' : ''} skipped during import:
            </p>
            {parseErrors.map((e, i) => (
              <p key={i} className="text-xs text-yellow-600 dark:text-yellow-400">{e}</p>
            ))}
          </div>
        )}

        {/* Percentage allocation bar */}
        {hasPctStreams && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-tcs-gray-200 dark:bg-tcs-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pctOver ? 'bg-red-500' : pctExact ? 'bg-green-500' : 'bg-tcs-blue'}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span
              className={`text-xs font-semibold w-28 ${pctOver ? 'text-red-500' : pctExact ? 'text-green-600 dark:text-green-400' : 'text-tcs-gray-500 dark:text-tcs-gray-400'}`}
            >
              {pct.toFixed(0)}% of batch allocated
              {pctOver && ' (over 100%)'}
            </span>
          </div>
        )}

        {/* Streams table */}
        <div className="overflow-x-auto rounded-xl border border-tcs-gray-200 dark:border-tcs-gray-700 max-h-[45vh] overflow-y-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="sticky top-0 z-10 bg-tcs-gray-50 dark:bg-tcs-gray-900">
              <tr className="border-b border-tcs-gray-200 dark:border-tcs-gray-700">
                <th className="text-left px-2 py-2.5 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Stream Name</th>
                <th className="text-center px-2 py-2.5 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Mandatory</th>
                <th className="text-left px-2 py-2.5 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Capacity</th>
                <th className="text-left px-2 py-2.5 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Roles Needed</th>
                <th className="text-left px-2 py-2.5 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Subjects Needed</th>
                <th className="text-center px-2 py-2.5 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Seats</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="bg-tcs-white dark:bg-tcs-gray-800">
              {streams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-tcs-gray-400 text-sm">
                    No streams defined. Add one below or upload an Excel file.
                  </td>
                </tr>
              ) : (
                streams.map((s) => (
                  <StreamRow
                    key={s._key}
                    stream={s}
                    traineeCount={traineeCount}
                    onChange={updateStream}
                    onDelete={deleteStream}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add stream */}
        <button
          type="button"
          onClick={addStream}
          className="flex items-center gap-2 text-sm font-medium text-tcs-blue hover:text-tcs-blue-dark dark:hover:text-tcs-blue-light transition-colors cursor-pointer"
        >
          <Plus size={15} />
          Add Stream
        </button>

        {/* API error */}
        {apiError && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {apiError}
          </p>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-2 border-t border-tcs-gray-200 dark:border-tcs-gray-700">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSave} disabled={batches.length === 0 && !isEdit}>
            {isEdit ? 'Save Changes' : 'Create Requirement'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main page ──────────────────────────────────────────────────────────

export default function BusinessRequirementsPage() {
  const [brs, setBrs] = useState<BRSummary[]>([]);
  const [batches, setBatches] = useState<SyncedBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editBr, setEditBr] = useState<BRResponse | undefined>();
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [brRes, batchRes] = await Promise.all([
        brApi.list(batchFilter || undefined),
        syncApi.batches(),
      ]);
      setBrs(brRes.data);
      setBatches(batchRes.data);
    } catch {
      setError('Failed to load data. Ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [batchFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = () => { setEditBr(undefined); setShowForm(true); };

  const handleEdit = async (id: number) => {
    try {
      const { data } = await brApi.get(id);
      setEditBr(data);
      setShowForm(true);
    } catch {
      setError('Failed to load the business requirement.');
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await brApi.remove(id);
      setBrs((prev) => prev.filter((b) => b.id !== id));
    } catch {
      // silently ignore
    } finally {
      setDeleting(null);
    }
  };

  const batchNames = [...new Set(brs.map((b) => b.batch_name))].sort();

  return (
    <>
      <BRFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSaved={fetchAll}
        batches={batches}
        editBr={editBr}
      />

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">
            Business Requirements
          </h1>
          <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400 mt-0.5">
            Define stream capacity and role requirements per batch
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus size={16} />
          New Requirement
        </Button>
      </div>

      {/* Batch filter */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-tcs-gray-600 dark:text-tcs-gray-400 shrink-0">
          Filter by batch:
        </label>
        <select
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border outline-none transition-colors cursor-pointer
            bg-tcs-white dark:bg-tcs-gray-800 text-tcs-gray-900 dark:text-tcs-gray-100
            border-tcs-gray-300 dark:border-tcs-gray-700
            focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20"
        >
          <option value="">All Batches</option>
          {batchNames.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        {!loading && (
          <span className="text-xs text-tcs-gray-400 dark:text-tcs-gray-500">
            {brs.length} requirement{brs.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* List table */}
      <div className="rounded-xl border overflow-hidden bg-tcs-white dark:bg-tcs-gray-800 border-tcs-gray-200 dark:border-tcs-gray-700">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-6 h-6 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-sm text-red-500 mb-3">{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchAll}>Retry</Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tcs-gray-200 dark:border-tcs-gray-700 bg-tcs-gray-50 dark:bg-tcs-gray-900/50">
                <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Title</th>
                <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Batch</th>
                <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Location</th>
                <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Streams</th>
                <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Created</th>
                <th className="px-5 py-3 w-36" />
              </tr>
            </thead>
            <tbody>
              {brs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <BookOpen size={36} className="mx-auto mb-3 text-tcs-gray-300 dark:text-tcs-gray-600" />
                    <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400">
                      {batchFilter
                        ? `No requirements for batch "${batchFilter}".`
                        : 'No business requirements yet.'}
                    </p>
                    <button
                      onClick={handleCreate}
                      className="mt-3 text-sm text-tcs-blue hover:underline cursor-pointer"
                    >
                      Create the first one
                    </button>
                  </td>
                </tr>
              ) : (
                brs.map((br) => (
                  <tr
                    key={br.id}
                    className="border-b last:border-0 border-tcs-gray-100 dark:border-tcs-gray-700/50 hover:bg-tcs-gray-50 dark:hover:bg-tcs-gray-700/30 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-tcs-gray-900 dark:text-tcs-gray-100">
                      {br.title}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-tcs-blue/10 text-tcs-blue dark:bg-tcs-blue/20 dark:text-tcs-blue-light">
                        {br.batch_name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-tcs-gray-500 dark:text-tcs-gray-400">
                      {br.location ?? <span className="italic text-tcs-gray-300 dark:text-tcs-gray-600">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-tcs-gray-600 dark:text-tcs-gray-400">
                      {br.stream_count} stream{br.stream_count !== 1 ? 's' : ''}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-tcs-gray-500 dark:text-tcs-gray-400">
                      {new Date(br.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(br.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium
                            text-tcs-blue hover:bg-tcs-blue/10 dark:hover:bg-tcs-blue/20
                            transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(br.id)}
                          disabled={deleting === br.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium
                            text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400
                            disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          {deleting === br.id ? (
                            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                          ) : (
                            'Delete'
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
