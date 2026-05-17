import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, Brain, ChevronDown, ChevronRight, Info, Loader2,
  Play, RefreshCw, Sliders, UserCheck, UserX, X,
} from 'lucide-react';
import { allocationAiApi, allocationApi, streamsApi, syncApi } from '../services/api';
import type { AllocationAIRecommendation, AllocationConfig, AllocationRunResult, TraineeAllocation } from '../types/allocation';
import type { BatchStream } from '../types/streams';
import type { SyncedBatch } from '../types/sync';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';

// ── helpers ──────────────────────────────────────────────────────────────────

function dpiColor(dpi: number | null) {
  if (dpi === null) return 'text-tcs-gray-400';
  if (dpi >= 4) return 'text-green-600 dark:text-green-400';
  if (dpi >= 2.5) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number | null) {
  if (score === null) return 'bg-tcs-gray-100 dark:bg-tcs-gray-700 text-tcs-gray-500';
  if (score >= 70) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
}

function fmt(v: number | null, decimals = 1) {
  return v === null ? '—' : v.toFixed(decimals);
}

// ── Override modal ────────────────────────────────────────────────────────────

function OverrideModal({
  isOpen,
  onClose,
  trainee,
  streams,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  trainee: TraineeAllocation | null;
  streams: BatchStream[];
  onSave: (streamId: number, reason: string) => Promise<void>;
}) {
  const [streamId, setStreamId] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && trainee) {
      setStreamId(trainee.manual_stream_id ?? '');
      setReason(trainee.manual_override_reason ?? '');
      setError('');
    }
  }, [isOpen, trainee]);

  const handleSave = async () => {
    if (!streamId) { setError('Select a stream'); return; }
    if (!reason.trim()) { setError('Reason is required'); return; }
    setError('');
    setLoading(true);
    try {
      await onSave(Number(streamId), reason.trim());
      onClose();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Failed to save override');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Override — ${trainee?.trainee_name ?? ''}`}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-tcs-gray-700 dark:text-tcs-gray-300 mb-1">
            Assign Stream
          </label>
          <select
            value={streamId}
            onChange={(e) => setStreamId(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full rounded-lg border border-tcs-gray-300 dark:border-tcs-gray-600
              bg-tcs-white dark:bg-tcs-gray-700 text-tcs-gray-900 dark:text-tcs-gray-100
              px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tcs-blue"
          >
            <option value="">Select a stream…</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <Input
          label="Reason for override"
          placeholder="e.g. Business requirement — client specifically requested this trainee"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={error}
        />
        {error && !reason && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} loading={loading}>Save Override</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Score breakdown row ───────────────────────────────────────────────────────

function confidenceBadge(confidence: AllocationAIRecommendation['confidence']) {
  const styles = {
    high: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    low: 'bg-tcs-gray-100 dark:bg-tcs-gray-700 text-tcs-gray-500 dark:text-tcs-gray-400',
  };
  return styles[confidence] ?? styles.low;
}

function BreakdownRow({
  alloc,
  streams,
  aiRec,
}: {
  alloc: TraineeAllocation;
  streams: BatchStream[];
  aiRec?: AllocationAIRecommendation;
}) {
  const streamMap = Object.fromEntries(streams.map((s) => [s.id, s.name]));
  const subjects = Object.entries(alloc.score_breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <tr className="bg-tcs-gray-50 dark:bg-tcs-gray-900/50">
      <td colSpan={11} className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Subject scores */}
          <div>
            <p className="text-xs font-semibold text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide mb-2">
              Subject Avg Scores
            </p>
            {subjects.length === 0 ? (
              <p className="text-xs text-tcs-gray-400">No subject scores synced</p>
            ) : (
              <div className="space-y-1.5">
                {subjects.map(([subj, score]) => (
                  <div key={subj} className="flex items-center gap-3">
                    <span className="w-28 text-xs text-tcs-gray-600 dark:text-tcs-gray-400 capitalize">{subj}</span>
                    <div className="flex-1 h-2 bg-tcs-gray-200 dark:bg-tcs-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-tcs-blue rounded-full"
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-medium text-tcs-gray-700 dark:text-tcs-gray-300">
                      {score.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per-stream composite scores */}
          <div>
            <p className="text-xs font-semibold text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide mb-2">
              Stream Fit Scores
            </p>
            {alloc.all_stream_scores.length === 0 ? (
              <p className="text-xs text-tcs-gray-400">Run allocation to see stream scores</p>
            ) : (
              <div className="space-y-1.5">
                {alloc.all_stream_scores.map((ss) => (
                  <div key={ss.stream_id} className="flex items-center gap-3">
                    <span className="w-40 text-xs text-tcs-gray-600 dark:text-tcs-gray-400 truncate">
                      {streamMap[ss.stream_id] ?? ss.stream_name}
                    </span>
                    <div className="flex-1 h-2 bg-tcs-gray-200 dark:bg-tcs-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${Math.min(ss.composite, 100)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-medium text-tcs-gray-700 dark:text-tcs-gray-300">
                      {ss.composite.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Analysis */}
        {aiRec && (
          <div className="mt-4 pt-4 border-t border-tcs-gray-200 dark:border-tcs-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Brain size={12} className="text-tcs-blue" />
              <p className="text-xs font-semibold text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide">
                AI Analysis
              </p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${confidenceBadge(aiRec.confidence)}`}>
                {aiRec.confidence} confidence
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {!aiRec.agrees_with_algorithm && aiRec.recommended_stream_name && (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  Recommends: {aiRec.recommended_stream_name}
                </p>
              )}
              <p className="text-xs text-tcs-gray-600 dark:text-tcs-gray-400 leading-relaxed">
                {aiRec.reasoning}
              </p>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AllocationPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const [batches, setBatches] = useState<SyncedBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [streams, setStreams] = useState<BatchStream[]>([]);
  const [config, setConfig] = useState<AllocationConfig | null>(null);
  const [allocations, setAllocations] = useState<TraineeAllocation[]>([]);
  const [lastRunResult, setLastRunResult] = useState<AllocationRunResult | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<Map<string, AllocationAIRecommendation>>(new Map());

  // UI state
  const [loadingRun, setLoadingRun] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState('');
  const [aiError, setAiError] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [overrideTarget, setOverrideTarget] = useState<TraineeAllocation | null>(null);
  const [search, setSearch] = useState('');

  // Config edit state
  const [editScore, setEditScore] = useState(60);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState('');

  // Load batches on mount
  useEffect(() => {
    syncApi.batches().then((r) => setBatches(r.data)).catch(() => {});
  }, []);

  const loadBatchData = useCallback(async (batchName: string) => {
    setLoadingData(true);
    setError('');
    setAllocations([]);
    setLastRunResult(null);
    setAiRecommendations(new Map());
    try {
      const [cfgRes, allocRes, streamsRes, aiRes] = await Promise.all([
        allocationApi.getConfig(batchName),
        allocationApi.list(batchName),
        streamsApi.list(batchName),
        allocationAiApi.list(batchName).catch(() => ({ data: [] as AllocationAIRecommendation[] })),
      ]);
      setConfig(cfgRes.data);
      setEditScore(Math.round(cfgRes.data.score_weight * 100));
      setAllocations(allocRes.data);
      setStreams(streamsRes.data);
      setAiRecommendations(new Map(aiRes.data.map((r) => [r.employee_id, r])));
    } catch (e: unknown) {
      setError('Failed to load allocation data');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBatch) loadBatchData(selectedBatch);
  }, [selectedBatch, loadBatchData]);

  const handleRun = async () => {
    if (!selectedBatch) return;
    setLoadingRun(true);
    setError('');
    try {
      const res = await allocationApi.run(selectedBatch);
      setLastRunResult(res.data);
      await loadBatchData(selectedBatch);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Allocation run failed');
    } finally {
      setLoadingRun(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!selectedBatch) return;
    setLoadingAI(true);
    setAiError('');
    try {
      const res = await allocationAiApi.generate(selectedBatch);
      setAiRecommendations(new Map(res.data.map((r) => [r.employee_id, r])));
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAiError(detail ?? 'AI recommendation generation failed');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedBatch) return;
    const scoreW = editScore / 100;
    const dpiW = Math.round((100 - editScore)) / 100;
    if (Math.abs(scoreW + dpiW - 1.0) > 0.01) { setConfigError('Weights must sum to 100%'); return; }
    setSavingConfig(true);
    setConfigError('');
    try {
      const res = await allocationApi.updateConfig(selectedBatch, { score_weight: scoreW, dpi_weight: dpiW });
      setConfig(res.data);
    } catch {
      setConfigError('Failed to save config');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleOverrideSave = async (streamId: number, reason: string) => {
    if (!overrideTarget || !selectedBatch) return;
    const res = await allocationApi.setOverride(selectedBatch, overrideTarget.employee_id, { stream_id: streamId, reason });
    setAllocations((prev) => prev.map((a) => (a.employee_id === overrideTarget.employee_id ? res.data : a)));
  };

  const handleClearOverride = async (alloc: TraineeAllocation) => {
    if (!selectedBatch) return;
    const res = await allocationApi.clearOverride(selectedBatch, alloc.employee_id);
    setAllocations((prev) => prev.map((a) => (a.employee_id === alloc.employee_id ? res.data : a)));
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = allocations.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.trainee_name.toLowerCase().includes(q) ||
      a.employee_id.toLowerCase().includes(q) ||
      (a.effective_stream_name ?? '').toLowerCase().includes(q)
    );
  });

  const dpiWeight = config ? Math.round(config.dpi_weight * 100) : 40;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">
            Trainee Allocation
          </h1>
          <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400 mt-0.5">
            Score-based stream assignment with manual override support
          </p>
        </div>

        {/* Batch selector */}
        <select
          value={selectedBatch}
          onChange={(e) => { setSelectedBatch(e.target.value); setSearch(''); }}
          className="rounded-lg border border-tcs-gray-300 dark:border-tcs-gray-600
            bg-tcs-white dark:bg-tcs-gray-700 text-tcs-gray-900 dark:text-tcs-gray-100
            px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tcs-blue min-w-[200px]"
        >
          <option value="">Select a batch…</option>
          {batches.map((b) => (
            <option key={b.batch_name} value={b.batch_name}>{b.batch_name}</option>
          ))}
        </select>
      </div>

      {selectedBatch && (
        <>
          {/* Config + Run panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scoring weights */}
            <div className="rounded-xl border border-tcs-gray-200 dark:border-tcs-gray-700
              bg-tcs-white dark:bg-tcs-gray-800 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-tcs-blue" />
                <h2 className="text-sm font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">
                  Scoring Weights
                </h2>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-tcs-gray-600 dark:text-tcs-gray-400 mb-1">
                    <span>Subject Score weight</span>
                    <span className="font-semibold text-tcs-blue">{editScore}%</span>
                  </div>
                  <input
                    type="range"
                    min={0} max={100} step={5}
                    value={editScore}
                    onChange={(e) => setEditScore(Number(e.target.value))}
                    disabled={!canManage}
                    className="w-full accent-tcs-blue"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-4 text-xs">
                    <span className="text-tcs-gray-500 dark:text-tcs-gray-400">
                      DPI weight: <span className="font-semibold text-purple-600 dark:text-purple-400">{100 - editScore}%</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-tcs-gray-400">
                    <Info size={12} />
                    <span>DPI scale: 0–5</span>
                  </div>
                </div>

                {/* Visual split */}
                <div className="h-2 rounded-full overflow-hidden flex">
                  <div className="bg-tcs-blue transition-all" style={{ width: `${editScore}%` }} />
                  <div className="bg-purple-400 flex-1" />
                </div>

                {configError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{configError}</p>
                )}

                {canManage && (
                  <Button size="sm" onClick={handleSaveConfig} loading={savingConfig}>
                    Save Weights
                  </Button>
                )}
              </div>
            </div>

            {/* Run allocation */}
            <div className="rounded-xl border border-tcs-gray-200 dark:border-tcs-gray-700
              bg-tcs-white dark:bg-tcs-gray-800 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Play size={16} className="text-tcs-blue" />
                <h2 className="text-sm font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">
                  Allocation Engine
                </h2>
              </div>

              {config?.last_run_at ? (
                <div className="text-xs text-tcs-gray-500 dark:text-tcs-gray-400 space-y-0.5">
                  <p>Last run: <span className="font-medium text-tcs-gray-700 dark:text-tcs-gray-300">
                    {new Date(config.last_run_at).toLocaleString()}
                  </span></p>
                  <p>By: <span className="font-medium text-tcs-gray-700 dark:text-tcs-gray-300">
                    {config.run_by_email}
                  </span></p>
                </div>
              ) : (
                <p className="text-xs text-tcs-gray-400">Not run yet for this batch</p>
              )}

              {lastRunResult && (
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-full">
                    <UserCheck size={12} />
                    {lastRunResult.allocated} allocated
                  </div>
                  {lastRunResult.unallocated > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2.5 py-1 rounded-full">
                      <UserX size={12} />
                      {lastRunResult.unallocated} unallocated
                    </div>
                  )}
                </div>
              )}

              <div className="text-xs text-tcs-gray-400 space-y-0.5">
                <p>Formula: <code className="text-tcs-blue">composite = subject × {editScore}% + DPI × {100 - editScore}%</code></p>
                <p className="text-tcs-gray-400">Greedy fill by stream priority · manual overrides preserved on re-run</p>
              </div>

              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleRun} loading={loadingRun} disabled={!selectedBatch}>
                    <Play size={14} />
                    {config?.last_run_at ? 'Re-run Allocation' : 'Run Allocation'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleGenerateAI}
                    loading={loadingAI}
                    disabled={!selectedBatch || allocations.length === 0}
                    title={allocations.length === 0 ? 'Run allocation first' : 'Generate AI recommendations for each trainee'}
                  >
                    <Brain size={14} />
                    {aiRecommendations.size > 0 ? 'Refresh AI Recs' : 'Generate AI Recs'}
                  </Button>
                </div>
              )}
              {aiError && (
                <p className="text-xs text-red-600 dark:text-red-400">{aiError}</p>
              )}
              {aiRecommendations.size > 0 && (
                <div className="flex gap-2 text-xs flex-wrap">
                  <span className="text-tcs-gray-400">
                    AI analysed <span className="font-medium text-tcs-gray-600 dark:text-tcs-gray-300">{aiRecommendations.size}</span> trainees
                    {' · '}
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {[...aiRecommendations.values()].filter((r) => !r.agrees_with_algorithm).length} flagged
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl border border-tcs-gray-200 dark:border-tcs-gray-700 bg-tcs-white dark:bg-tcs-gray-800 overflow-hidden">
            {/* Table header */}
            <div className="px-5 py-4 border-b border-tcs-gray-200 dark:border-tcs-gray-700 flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">
                Allocation Results
                {allocations.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-tcs-gray-400">
                    {allocations.length} trainees
                    {allocations.filter((a) => a.manual_stream_id).length > 0 &&
                      ` · ${allocations.filter((a) => a.manual_stream_id).length} overridden`}
                    {[...aiRecommendations.values()].filter((r) => !r.agrees_with_algorithm).length > 0 &&
                      ` · ${[...aiRecommendations.values()].filter((r) => !r.agrees_with_algorithm).length} AI flagged`}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search trainee, stream…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-lg border border-tcs-gray-300 dark:border-tcs-gray-600
                    bg-tcs-white dark:bg-tcs-gray-700 text-tcs-gray-900 dark:text-tcs-gray-100
                    px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-tcs-blue w-52"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadBatchData(selectedBatch)}
                  disabled={loadingData}
                >
                  <RefreshCw size={14} className={loadingData ? 'animate-spin' : ''} />
                </Button>
              </div>
            </div>

            {loadingData ? (
              <div className="flex items-center justify-center py-16 text-tcs-gray-400">
                <Loader2 size={24} className="animate-spin mr-2" />
                Loading…
              </div>
            ) : allocations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-tcs-gray-400 gap-2">
                <Play size={32} className="opacity-30" />
                <p className="text-sm">Run allocation to populate this table</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-tcs-gray-200 dark:border-tcs-gray-700 bg-tcs-gray-50 dark:bg-tcs-gray-900/40">
                      <th className="w-8 px-3 py-3" />
                      <th className="px-4 py-3 text-left text-xs font-semibold text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide">Trainee</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide">DPI</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide">Subject</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide">Composite</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide">Suggested Stream</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide">AI Rec.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide">Manual Override</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide">Effective Stream</th>
                      {canManage && <th className="px-4 py-3 text-right text-xs font-semibold text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tcs-gray-100 dark:divide-tcs-gray-700/50">
                    {filtered.map((alloc) => {
                      const expanded = expandedRows.has(alloc.employee_id);
                      const isOverridden = alloc.manual_stream_id !== null;

                      return [
                        <tr
                          key={alloc.employee_id}
                          className="hover:bg-tcs-gray-50 dark:hover:bg-tcs-gray-700/30 transition-colors"
                        >
                          {/* Expand toggle */}
                          <td className="px-3 py-3">
                            <button
                              onClick={() => toggleRow(alloc.employee_id)}
                              className="text-tcs-gray-400 hover:text-tcs-gray-600 dark:hover:text-tcs-gray-300 transition-colors"
                            >
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </td>

                          {/* Trainee */}
                          <td className="px-4 py-3">
                            <p className="font-medium text-tcs-gray-900 dark:text-tcs-gray-100">{alloc.trainee_name}</p>
                            <p className="text-xs text-tcs-gray-400">{alloc.employee_id}</p>
                          </td>

                          {/* DPI */}
                          <td className="px-4 py-3 text-center">
                            <span className={`font-semibold ${dpiColor(alloc.dpi_score)}`}>
                              {fmt(alloc.dpi_score)}
                            </span>
                            <p className="text-xs text-tcs-gray-400">/5</p>
                          </td>

                          {/* Subject score */}
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${scoreBg(alloc.subject_score)}`}>
                              {fmt(alloc.subject_score)}
                            </span>
                          </td>

                          {/* Composite */}
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${scoreBg(alloc.composite_score)}`}>
                              {fmt(alloc.composite_score)}
                            </span>
                          </td>

                          {/* Suggested stream */}
                          <td className="px-4 py-3">
                            {alloc.suggested_stream_name ? (
                              <span className="text-tcs-gray-700 dark:text-tcs-gray-300">
                                {alloc.suggested_stream_name}
                              </span>
                            ) : (
                              <span className="text-tcs-gray-400 text-xs italic">Unallocated</span>
                            )}
                          </td>

                          {/* AI recommendation */}
                          <td className="px-4 py-3">
                            {(() => {
                              const rec = aiRecommendations.get(alloc.employee_id);
                              if (!rec) return <span className="text-tcs-gray-300 dark:text-tcs-gray-600 text-xs">—</span>;
                              if (rec.agrees_with_algorithm) {
                                return (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                                    <Brain size={10} />
                                    Agrees
                                  </span>
                                );
                              }
                              return (
                                <div>
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                                    <Brain size={10} />
                                    Differs
                                  </span>
                                  {rec.recommended_stream_name && (
                                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 max-w-[140px] truncate" title={rec.recommended_stream_name}>
                                      → {rec.recommended_stream_name}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Manual override */}
                          <td className="px-4 py-3">
                            {isOverridden ? (
                              <div>
                                <span className="text-purple-700 dark:text-purple-300 font-medium">
                                  {alloc.manual_stream_name}
                                </span>
                                <p className="text-xs text-tcs-gray-400 mt-0.5 max-w-[160px] truncate" title={alloc.manual_override_reason ?? ''}>
                                  {alloc.manual_override_reason}
                                </p>
                              </div>
                            ) : (
                              <span className="text-tcs-gray-400 text-xs italic">—</span>
                            )}
                          </td>

                          {/* Effective stream */}
                          <td className="px-4 py-3">
                            {alloc.effective_stream_name ? (
                              <div className="flex items-center gap-1.5">
                                <span className={`font-semibold ${isOverridden ? 'text-purple-700 dark:text-purple-300' : 'text-tcs-blue dark:text-tcs-blue-light'}`}>
                                  {alloc.effective_stream_name}
                                </span>
                                {isOverridden && (
                                  <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">manual</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-tcs-gray-400 text-xs italic">Unallocated</span>
                            )}
                          </td>

                          {/* Actions */}
                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setOverrideTarget(alloc)}
                                  className="text-xs"
                                >
                                  {isOverridden ? 'Edit' : 'Override'}
                                </Button>
                                {isOverridden && (
                                  <button
                                    onClick={() => handleClearOverride(alloc)}
                                    className="p-1.5 rounded text-tcs-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="Clear override"
                                  >
                                    <X size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>,
                        expanded && (
                          <BreakdownRow
                            key={`${alloc.employee_id}-breakdown`}
                            alloc={alloc}
                            streams={streams}
                            aiRec={aiRecommendations.get(alloc.employee_id)}
                          />
                        ),
                      ];
                    })}
                  </tbody>
                </table>

                {filtered.length === 0 && search && (
                  <div className="py-10 text-center text-sm text-tcs-gray-400">
                    No trainees match "{search}"
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {!selectedBatch && (
        <div className="flex flex-col items-center justify-center py-24 text-tcs-gray-400 gap-3">
          <UserCheck size={40} className="opacity-30" />
          <p className="text-sm">Select a batch to view and manage allocations</p>
        </div>
      )}

      <OverrideModal
        isOpen={overrideTarget !== null}
        onClose={() => setOverrideTarget(null)}
        trainee={overrideTarget}
        streams={streams}
        onSave={handleOverrideSave}
      />
    </div>
  );
}
