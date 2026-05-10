import { useCallback, useEffect, useState } from 'react';
import { GitBranch, Pencil, Plus, Sliders, Trash2 } from 'lucide-react';
import { streamsApi, syncApi } from '../services/api';
import type { SyncedBatch } from '../types/sync';
import type { BatchStream, StreamSubjectWeight } from '../types/streams';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';

// ── Add / Rename stream modal ────────────────────────────────────────
function StreamNameModal({
  isOpen,
  onClose,
  onSave,
  initial,
  title,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  initial?: string;
  title: string;
}) {
  const [name, setName] = useState(initial ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (isOpen) setName(initial ?? ''); }, [isOpen, initial]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Stream name is required'); return; }
    setError('');
    setLoading(true);
    try {
      await onSave(name.trim());
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Failed to save stream.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <Input
          label="Stream Name"
          placeholder="e.g. AI Engineer"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={loading} onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Set weights modal ────────────────────────────────────────────────
function SetWeightsModal({
  isOpen,
  onClose,
  stream,
  subjects,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  stream: BatchStream | null;
  subjects: string[];
  onSaved: (updated: BatchStream) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !stream) return;
    const initial: Record<string, string> = {};
    subjects.forEach((s) => {
      const existing = stream.weights.find((w) => w.subject_name === s);
      initial[s] = existing ? String(existing.weight_pct) : '0';
    });
    setValues(initial);
    setApiError('');
  }, [isOpen, stream, subjects]);

  const total = subjects.reduce((sum, s) => sum + (parseFloat(values[s] ?? '0') || 0), 0);
  const totalOk = Math.abs(total - 100) <= 0.01;

  const distributeEvenly = () => {
    const even = (100 / subjects.length).toFixed(2);
    const distributed: Record<string, string> = {};
    subjects.forEach((s, i) => {
      distributed[s] = i === subjects.length - 1
        ? String(parseFloat((100 - parseFloat(even) * (subjects.length - 1)).toFixed(2)))
        : even;
    });
    setValues(distributed);
  };

  const handleSave = async () => {
    if (!stream) return;
    if (!totalOk) return;
    setApiError('');
    setLoading(true);
    try {
      const weights: StreamSubjectWeight[] = subjects.map((s) => ({
        subject_name: s,
        weight_pct: parseFloat(parseFloat(values[s] ?? '0').toFixed(2)),
      }));
      const { data } = await streamsApi.setWeights(stream.batch_name, stream.id, { weights });
      onSaved(data);
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setApiError(typeof detail === 'string' ? detail : JSON.stringify(detail) ?? 'Failed to save weights.');
    } finally {
      setLoading(false);
    }
  };

  if (!stream) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Set Weights — ${stream.name}`} width="w-full max-w-lg">
      <div className="space-y-4">
        <p className="text-xs text-tcs-gray-500 dark:text-tcs-gray-400">
          Assign a percentage to each subject. All weights must total exactly 100%.
        </p>

        <div className="space-y-2.5">
          {subjects.map((subject) => (
            <div key={subject} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm font-medium text-tcs-gray-800 dark:text-tcs-gray-200 truncate">
                {subject}
              </span>
              <div className="flex-1 relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={values[subject] ?? '0'}
                  onChange={(e) => setValues((prev) => ({ ...prev, [subject]: e.target.value }))}
                  className="w-full px-3 py-2 pr-8 text-sm rounded-lg border outline-none transition-colors
                    bg-tcs-white text-tcs-gray-900
                    dark:bg-tcs-gray-900 dark:text-tcs-gray-100
                    border-tcs-gray-300 dark:border-tcs-gray-700
                    focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tcs-gray-400">%</span>
              </div>
              {/* mini bar */}
              <div className="w-20 h-2 rounded-full bg-tcs-gray-100 dark:bg-tcs-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-tcs-blue transition-all"
                  style={{ width: `${Math.min(100, parseFloat(values[subject] ?? '0') || 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Total indicator */}
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold
          ${totalOk
            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
          <span>Total</span>
          <span>{total.toFixed(2)} / 100%  {totalOk ? '✓' : `(${total > 100 ? '+' : ''}${(total - 100).toFixed(2)})`}</span>
        </div>

        {apiError && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{apiError}</p>
        )}

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={distributeEvenly}
            className="text-xs text-tcs-blue hover:underline cursor-pointer"
          >
            Distribute evenly
          </button>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button loading={loading} disabled={!totalOk} onClick={handleSave}>Save Weights</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Stream card ──────────────────────────────────────────────────────
function StreamCard({
  stream,
  canManage,
  onRename,
  onDelete,
  onSetWeights,
}: {
  stream: BatchStream;
  canManage: boolean;
  onRename: (s: BatchStream) => void;
  onDelete: (s: BatchStream) => void;
  onSetWeights: (s: BatchStream) => void;
}) {
  const hasWeights = stream.weights.length > 0;

  return (
    <div className="rounded-xl border p-4
      bg-tcs-white dark:bg-tcs-gray-800
      border-tcs-gray-200 dark:border-tcs-gray-700">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <GitBranch size={15} className="text-tcs-blue shrink-0" />
          <span className="font-semibold text-tcs-gray-900 dark:text-tcs-gray-100 text-sm">
            {stream.name}
          </span>
          {!hasWeights && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">
              Weights needed
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onSetWeights(stream)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
              text-tcs-blue hover:bg-tcs-blue/10 dark:hover:bg-tcs-blue/20 transition-colors cursor-pointer"
          >
            <Sliders size={13} />
            Weights
          </button>
          {canManage && (
            <>
              <button
                onClick={() => onRename(stream)}
                className="p-1.5 rounded-lg text-tcs-gray-400 hover:text-tcs-gray-700 hover:bg-tcs-gray-100
                  dark:hover:text-tcs-gray-200 dark:hover:bg-tcs-gray-700 transition-colors cursor-pointer"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onDelete(stream)}
                className="p-1.5 rounded-lg text-tcs-gray-400 hover:text-red-600 hover:bg-red-50
                  dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {hasWeights ? (
        <div className="flex flex-wrap gap-2">
          {stream.weights.map((w) => (
            <div key={w.subject_name} className="flex items-center gap-1.5">
              <span className="text-xs text-tcs-gray-600 dark:text-tcs-gray-400">{w.subject_name}</span>
              <div className="h-1.5 w-16 rounded-full bg-tcs-gray-100 dark:bg-tcs-gray-700 overflow-hidden">
                <div className="h-full rounded-full bg-tcs-blue" style={{ width: `${w.weight_pct}%` }} />
              </div>
              <span className="text-xs font-medium text-tcs-gray-700 dark:text-tcs-gray-300">
                {w.weight_pct}%
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-tcs-gray-400 dark:text-tcs-gray-500">
          No subject weights configured yet. Click Weights to set them.
        </p>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────
export default function StreamManagementPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const [batches, setBatches] = useState<SyncedBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<SyncedBatch | null>(null);
  const [streams, setStreams] = useState<BatchStream[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [streamError, setStreamError] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<BatchStream | null>(null);
  const [weightsTarget, setWeightsTarget] = useState<BatchStream | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    syncApi.batches()
      .then(({ data }) => { setBatches(data); if (data.length > 0) setSelectedBatch(data[0]); })
      .catch(() => setBatchError('Failed to load batches.'))
      .finally(() => setLoadingBatches(false));
  }, []);

  const fetchStreams = useCallback(async (batchName: string) => {
    setLoadingStreams(true);
    setStreamError('');
    try {
      const { data } = await streamsApi.list(batchName);
      setStreams(data);
    } catch {
      setStreamError('Failed to load streams.');
    } finally {
      setLoadingStreams(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBatch) fetchStreams(selectedBatch.batch_name);
  }, [selectedBatch, fetchStreams]);

  const handleAddStream = async (name: string) => {
    if (!selectedBatch) return;
    const { data } = await streamsApi.create(selectedBatch.batch_name, { name });
    setStreams((prev) => [...prev, data]);
  };

  const handleRenameStream = async (name: string) => {
    if (!renameTarget || !selectedBatch) return;
    const { data } = await streamsApi.rename(selectedBatch.batch_name, renameTarget.id, { name });
    setStreams((prev) => prev.map((s) => (s.id === data.id ? data : s)));
  };

  const handleDeleteStream = async (stream: BatchStream) => {
    if (!selectedBatch) return;
    setDeletingId(stream.id);
    try {
      await streamsApi.remove(selectedBatch.batch_name, stream.id);
      setStreams((prev) => prev.filter((s) => s.id !== stream.id));
    } finally {
      setDeletingId(null);
    }
  };

  const handleWeightsSaved = (updated: BatchStream) => {
    setStreams((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  return (
    <>
      <StreamNameModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddStream}
        title="Add Stream"
      />
      <StreamNameModal
        isOpen={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        onSave={handleRenameStream}
        initial={renameTarget?.name}
        title="Rename Stream"
      />
      <SetWeightsModal
        isOpen={!!weightsTarget}
        onClose={() => setWeightsTarget(null)}
        stream={weightsTarget}
        subjects={selectedBatch?.subjects ?? []}
        onSaved={handleWeightsSaved}
      />

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">Stream Management</h1>
          <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400 mt-0.5">
            Configure stream tracks and subject weights for each batch
          </p>
        </div>
      </div>

      {loadingBatches ? (
        <div className="flex items-center justify-center py-24">
          <span className="w-6 h-6 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : batchError ? (
        <p className="text-sm text-red-500">{batchError}</p>
      ) : (
        <div className="flex gap-6 min-h-0">
          {/* Left — batch list */}
          <div className="w-52 shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-tcs-gray-400 dark:text-tcs-gray-500 mb-2 px-1">
              Batches
            </p>
            <div className="space-y-0.5">
              {batches.map((b) => {
                const active = selectedBatch?.batch_name === b.batch_name;
                return (
                  <button
                    key={b.batch_name}
                    onClick={() => setSelectedBatch(b)}
                    className={[
                      'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                      active
                        ? 'bg-tcs-blue text-tcs-white'
                        : 'text-tcs-gray-700 dark:text-tcs-gray-300 hover:bg-tcs-gray-100 dark:hover:bg-tcs-gray-800',
                    ].join(' ')}
                  >
                    {b.batch_name}
                  </button>
                );
              })}
            </div>

            {selectedBatch && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-tcs-gray-400 dark:text-tcs-gray-500 mb-2 px-1">
                  Subjects
                </p>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {selectedBatch.subjects.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 rounded-md text-xs font-medium
                        bg-tcs-blue/10 text-tcs-blue dark:bg-tcs-blue/20 dark:text-tcs-blue-light"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — streams */}
          <div className="flex-1 min-w-0">
            {selectedBatch && (
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">
                    {selectedBatch.batch_name}
                  </h2>
                  <p className="text-xs text-tcs-gray-500 dark:text-tcs-gray-400 mt-0.5">
                    {streams.length} stream{streams.length !== 1 ? 's' : ''} configured
                  </p>
                </div>
                {canManage && (
                  <Button onClick={() => setShowAddModal(true)}>
                    <Plus size={15} />
                    Add Stream
                  </Button>
                )}
              </div>
            )}

            {loadingStreams ? (
              <div className="flex items-center justify-center py-20">
                <span className="w-6 h-6 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />
              </div>
            ) : streamError ? (
              <p className="text-sm text-red-500">{streamError}</p>
            ) : streams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center
                rounded-xl border border-dashed
                border-tcs-gray-200 dark:border-tcs-gray-700">
                <GitBranch size={28} className="text-tcs-gray-300 dark:text-tcs-gray-600 mb-3" />
                <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400">No streams yet for this batch.</p>
                {canManage && (
                  <Button size="sm" className="mt-4" onClick={() => setShowAddModal(true)}>
                    <Plus size={14} /> Add First Stream
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {streams.map((stream) => (
                  <StreamCard
                    key={stream.id}
                    stream={stream}
                    canManage={canManage}
                    onRename={setRenameTarget}
                    onDelete={(s) => {
                      if (deletingId !== null) return;
                      handleDeleteStream(s);
                    }}
                    onSetWeights={setWeightsTarget}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
