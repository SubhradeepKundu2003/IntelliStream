import { useCallback, useEffect, useState } from 'react';
import { ArrowUpDown, CheckCircle, Clock, GitBranch, Pencil, Percent, Plus, Sliders, Sparkles, Trash2, UserCircle, Users, XCircle } from 'lucide-react';
import { aiSuggestionsApi, authApi, streamsApi, syncApi } from '../services/api';
import type { SyncedBatch } from '../types/sync';
import type { BatchStream, SMEAssignment, StreamSuggestion, StreamSubjectWeight, WeightProposal } from '../types/streams';
import type { UserResponse } from '../types/auth';
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
  userRole,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  stream: BatchStream | null;
  subjects: string[];
  userRole: string;
  onSaved: (updated: BatchStream) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSme = userRole === 'sme';

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
          {isSme
            ? 'Propose new subject weights. Your change will be sent for manager approval before taking effect.'
            : 'Assign a percentage to each subject. All weights must total exactly 100%.'}
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
              <div className="w-20 h-2 rounded-full bg-tcs-gray-100 dark:bg-tcs-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-tcs-blue transition-all"
                  style={{ width: `${Math.min(100, parseFloat(values[subject] ?? '0') || 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

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
            <Button loading={loading} disabled={!totalOk} onClick={handleSave}>
              {isSme ? 'Submit for Approval' : 'Save Weights'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Review proposal modal (manager / admin) ──────────────────────────
function ReviewProposalModal({
  isOpen,
  onClose,
  stream,
  onReviewed,
}: {
  isOpen: boolean;
  onClose: () => void;
  stream: BatchStream | null;
  onReviewed: (streamId: number) => void;
}) {
  const [proposal, setProposal] = useState<WeightProposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !stream) return;
    setLoading(true);
    setError('');
    setProposal(null);
    setShowRejectInput(false);
    setRejectionReason('');
    streamsApi.listProposals(stream.batch_name, stream.id)
      .then(({ data }) => setProposal(data.find((p) => p.status === 'pending') ?? null))
      .catch(() => setError('Failed to load proposal.'))
      .finally(() => setLoading(false));
  }, [isOpen, stream]);

  const handleApprove = async () => {
    if (!stream || !proposal) return;
    setActionLoading('approve');
    try {
      await streamsApi.approveProposal(stream.batch_name, stream.id, proposal.id);
      onReviewed(stream.id);
      onClose();
    } catch {
      setError('Failed to approve proposal.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!stream || !proposal) return;
    setActionLoading('reject');
    try {
      await streamsApi.rejectProposal(stream.batch_name, stream.id, proposal.id, {
        rejection_reason: rejectionReason.trim() || undefined,
      });
      onReviewed(stream.id);
      onClose();
    } catch {
      setError('Failed to reject proposal.');
    } finally {
      setActionLoading(null);
    }
  };

  if (!stream) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Review Proposal — ${stream.name}`} width="w-full max-w-lg">
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="w-6 h-6 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !proposal ? (
          <p className="text-sm text-tcs-gray-500 py-4 text-center">No pending proposal found.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-tcs-gray-500 dark:text-tcs-gray-400">
              <Clock size={13} />
              <span>Proposed by <strong className="text-tcs-gray-700 dark:text-tcs-gray-300">{proposal.proposed_by_email}</strong></span>
              <span>·</span>
              <span>{new Date(proposal.created_at).toLocaleString()}</span>
            </div>

            <div className="rounded-lg border border-tcs-gray-200 dark:border-tcs-gray-700 overflow-hidden">
              <div className="px-4 py-2 bg-tcs-gray-50 dark:bg-tcs-gray-800 text-xs font-semibold text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wider">
                Proposed Weights
              </div>
              <div className="divide-y divide-tcs-gray-100 dark:divide-tcs-gray-700">
                {proposal.proposed_weights.map((w) => {
                  const current = stream.weights.find((cw) => cw.subject_name === w.subject_name);
                  const changed = current ? Math.abs(current.weight_pct - w.weight_pct) > 0.001 : true;
                  return (
                    <div key={w.subject_name} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-28 shrink-0 text-sm text-tcs-gray-800 dark:text-tcs-gray-200">{w.subject_name}</span>
                      <div className="flex-1 h-2 rounded-full bg-tcs-gray-100 dark:bg-tcs-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-tcs-blue" style={{ width: `${w.weight_pct}%` }} />
                      </div>
                      <span className={`text-sm font-medium w-14 text-right ${changed ? 'text-amber-600 dark:text-amber-400' : 'text-tcs-gray-700 dark:text-tcs-gray-300'}`}>
                        {w.weight_pct}%
                      </span>
                      {changed && current && (
                        <span className="text-xs text-tcs-gray-400 w-20 text-right">was {current.weight_pct}%</span>
                      )}
                      {changed && !current && (
                        <span className="text-xs text-tcs-gray-400 w-20 text-right">new</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {showRejectInput && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-tcs-gray-600 dark:text-tcs-gray-400">
                  Rejection reason (optional)
                </label>
                <textarea
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why the proposal is being rejected..."
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-none transition-colors
                    bg-tcs-white text-tcs-gray-900 dark:bg-tcs-gray-900 dark:text-tcs-gray-100
                    border-tcs-gray-300 dark:border-tcs-gray-700
                    focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <div className="flex gap-2">
                {showRejectInput ? (
                  <>
                    <Button variant="secondary" onClick={() => setShowRejectInput(false)}>Back</Button>
                    <Button
                      loading={actionLoading === 'reject'}
                      onClick={handleReject}
                      className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                    >
                      <XCircle size={14} />
                      Confirm Reject
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => setShowRejectInput(true)}
                      className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                    >
                      <XCircle size={14} />
                      Reject
                    </Button>
                    <Button
                      loading={actionLoading === 'approve'}
                      onClick={handleApprove}
                      className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                    >
                      <CheckCircle size={14} />
                      Approve
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Manage SMEs modal (manager / admin) ─────────────────────────────
function ManageSMEsModal({
  isOpen,
  onClose,
  stream,
  batchName,
}: {
  isOpen: boolean;
  onClose: () => void;
  stream: BatchStream | null;
  batchName: string;
}) {
  const [smes, setSmes] = useState<SMEAssignment[]>([]);
  const [allUsers, setAllUsers] = useState<UserResponse[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [removeLoadingId, setRemoveLoadingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !stream) return;
    setLoading(true);
    setError('');
    setSelectedUserId('');
    Promise.all([
      streamsApi.listStreamSmes(batchName, stream.id),
      authApi.users(),
    ])
      .then(([{ data: smeData }, { data: usersData }]) => {
        setSmes(smeData);
        setAllUsers(usersData.filter((u) => u.role === 'sme' && u.is_active));
      })
      .catch(() => setError('Failed to load SME data.'))
      .finally(() => setLoading(false));
  }, [isOpen, stream, batchName]);

  const assignedUserIds = new Set(smes.map((s) => s.user_id));
  const availableUsers = allUsers.filter((u) => !assignedUserIds.has(u.id));

  const handleAssign = async () => {
    if (!stream || selectedUserId === '') return;
    setAssignLoading(true);
    setError('');
    try {
      const { data } = await streamsApi.assignSme(batchName, stream.id, Number(selectedUserId));
      setSmes((prev) => [...prev, data]);
      setSelectedUserId('');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to assign SME.');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleRemove = async (userId: number) => {
    if (!stream) return;
    setRemoveLoadingId(userId);
    setError('');
    try {
      await streamsApi.removeSme(batchName, stream.id, userId);
      setSmes((prev) => prev.filter((s) => s.user_id !== userId));
    } catch {
      setError('Failed to remove SME.');
    } finally {
      setRemoveLoadingId(null);
    }
  };

  if (!stream) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Manage SMEs — ${stream.name}`} width="w-full max-w-lg">
      <div className="space-y-5">
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="w-6 h-6 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-tcs-gray-400 dark:text-tcs-gray-500 mb-2">
                Assigned SMEs
              </p>
              {smes.length === 0 ? (
                <p className="text-sm text-tcs-gray-400 dark:text-tcs-gray-500 py-4 text-center rounded-lg border border-dashed border-tcs-gray-200 dark:border-tcs-gray-700">
                  No SMEs assigned to this stream yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {smes.map((sme) => (
                    <div
                      key={sme.user_id}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg
                        bg-tcs-gray-50 dark:bg-tcs-gray-800
                        border border-tcs-gray-100 dark:border-tcs-gray-700"
                    >
                      <div className="flex items-center gap-2">
                        <UserCircle size={15} className="text-tcs-blue shrink-0" />
                        <span className="text-sm text-tcs-gray-800 dark:text-tcs-gray-200">{sme.user_email}</span>
                      </div>
                      <button
                        onClick={() => handleRemove(sme.user_id)}
                        disabled={removeLoadingId === sme.user_id}
                        className="p-1.5 rounded-md text-tcs-gray-400 hover:text-red-600 hover:bg-red-50
                          dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {removeLoadingId === sme.user_id
                          ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                          : <Trash2 size={13} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-tcs-gray-400 dark:text-tcs-gray-500 mb-2">
                Assign New SME
              </p>
              {availableUsers.length === 0 ? (
                <p className="text-sm text-tcs-gray-400 dark:text-tcs-gray-500">
                  All SME-role users are already assigned to this stream.
                </p>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border outline-none transition-colors
                      bg-tcs-white text-tcs-gray-900 dark:bg-tcs-gray-900 dark:text-tcs-gray-100
                      border-tcs-gray-300 dark:border-tcs-gray-700
                      focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20"
                  >
                    <option value="">Select an SME...</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.email}</option>
                    ))}
                  </select>
                  <Button loading={assignLoading} disabled={selectedUserId === ''} onClick={handleAssign}>
                    Assign
                  </Button>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex justify-end pt-1">
              <Button variant="secondary" onClick={onClose}>Done</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Set priority modal ───────────────────────────────────────────────
function SetPriorityModal({
  isOpen,
  onClose,
  stream,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  stream: BatchStream | null;
  onSaved: (updated: BatchStream) => void;
}) {
  const [value, setValue] = useState('0');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && stream) setValue(String(stream.priority));
  }, [isOpen, stream]);

  const handleSave = async () => {
    if (!stream) return;
    const priority = parseInt(value, 10);
    if (isNaN(priority) || priority < 0) {
      setError('Priority must be 0 (unranked) or a positive integer');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await streamsApi.setPriority(stream.batch_name, stream.id, priority);
      onSaved(data);
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to set priority.');
    } finally {
      setLoading(false);
    }
  };

  if (!stream) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Set Priority — ${stream.name}`}>
      <div className="space-y-4">
        <p className="text-xs text-tcs-gray-500 dark:text-tcs-gray-400">
          Set a priority rank for this stream. When a trainee qualifies for multiple streams,
          the stream with the lowest priority number is allocated first.
          Use <strong>0</strong> to leave this stream unranked (allocated last).
        </p>
        <Input
          label="Priority (0 = unranked, 1 = highest)"
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={loading} onClick={handleSave}>Save Priority</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Set trainee percentage modal ─────────────────────────────────────
function SetTraineePctModal({
  isOpen,
  onClose,
  stream,
  allStreams,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  stream: BatchStream | null;
  allStreams: BatchStream[];
  onSaved: (updated: BatchStream) => void;
}) {
  const [value, setValue] = useState('0');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && stream) { setValue(String(stream.trainee_pct ?? 0)); setError(''); }
  }, [isOpen, stream]);

  const otherTotal = stream
    ? allStreams.filter((s) => s.id !== stream.id).reduce((sum, s) => sum + (s.trainee_pct ?? 0), 0)
    : 0;
  const newTotal = otherTotal + (parseFloat(value) || 0);
  const remaining = parseFloat((100 - otherTotal).toFixed(2));
  const totalOk = Math.abs(newTotal - 100) <= 0.01;
  const totalOver = newTotal > 100.01;

  const handleSave = async () => {
    if (!stream) return;
    const pct = parseFloat(value);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setError('Percentage must be between 0 and 100');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await streamsApi.setTraineePct(stream.batch_name, stream.id, pct);
      onSaved(data);
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to set trainee percentage.');
    } finally {
      setLoading(false);
    }
  };

  if (!stream) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Set Trainee Percentage — ${stream.name}`}>
      <div className="space-y-4">
        <p className="text-xs text-tcs-gray-500 dark:text-tcs-gray-400">
          Assign what percentage of batch trainees should go into this stream.
          All streams in the batch must total exactly <strong>100%</strong>.
        </p>

        <div className="px-3 py-2.5 rounded-lg bg-tcs-gray-50 dark:bg-tcs-gray-800 text-xs space-y-1.5">
          <div className="flex justify-between text-tcs-gray-500 dark:text-tcs-gray-400">
            <span>Other streams total</span>
            <span className="font-medium">{otherTotal.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-tcs-gray-500 dark:text-tcs-gray-400">
            <span>Remaining for this stream</span>
            <span className={`font-semibold ${remaining < 0 ? 'text-red-500' : 'text-tcs-blue'}`}>{remaining.toFixed(2)}%</span>
          </div>
        </div>

        <Input
          label="Trainee Percentage (0 = unset)"
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />

        <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold
          ${totalOk
            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
            : totalOver
              ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>
          <span>Batch total</span>
          <span>
            {newTotal.toFixed(2)} / 100%&nbsp;
            {totalOk ? '✓' : totalOver ? `(+${(newTotal - 100).toFixed(2)})` : `(${(100 - newTotal).toFixed(2)} remaining)`}
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={loading} disabled={totalOver} onClick={handleSave}>Save Percentage</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── AI Suggestions modal (manager / admin) ───────────────────────────
function AISuggestionsModal({
  isOpen,
  onClose,
  batchName,
  onStreamAccepted,
}: {
  isOpen: boolean;
  onClose: () => void;
  batchName: string;
  onStreamAccepted: () => void;
}) {
  const [suggestions, setSuggestions] = useState<StreamSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [context, setContext] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !batchName) return;
    setLoading(true);
    setError('');
    aiSuggestionsApi.list(batchName)
      .then(({ data }) => {
        if (data.length > 0) {
          const latestGenId = data[0].generation_id;
          setSuggestions(data.filter((s) => s.generation_id === latestGenId));
        } else {
          setSuggestions([]);
        }
      })
      .catch(() => setError('Failed to load suggestions.'))
      .finally(() => setLoading(false));
  }, [isOpen, batchName]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const { data } = await aiSuggestionsApi.generate(batchName, {
        business_context: context.trim() || undefined,
      });
      setSuggestions(data);
      setContext('');
      setShowContext(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to generate. Ensure Ollama is running on port 11434.');
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = async (s: StreamSuggestion) => {
    setActionLoadingId(s.id);
    setError('');
    try {
      const { data } = await aiSuggestionsApi.accept(batchName, s.id);
      setSuggestions((prev) => prev.map((x) => (x.id === data.id ? data : x)));
      onStreamAccepted();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to accept suggestion.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleIgnore = async (s: StreamSuggestion) => {
    setActionLoadingId(s.id);
    setError('');
    try {
      const { data } = await aiSuggestionsApi.ignore(batchName, s.id);
      setSuggestions((prev) => prev.map((x) => (x.id === data.id ? data : x)));
    } catch {
      setError('Failed to ignore suggestion.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingCount = suggestions.filter((s) => s.status === 'pending').length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Stream Suggestions" width="w-full max-w-2xl">
      <div className="space-y-4">
        {/* Header description */}
        <p className="text-xs text-tcs-gray-500 dark:text-tcs-gray-400">
          AI analyses the batch subjects and business requirements to suggest streams with priorities and subject weights.
          Accept individual suggestions to instantly create the stream, or ignore ones that don't fit.
        </p>

        {/* Generate controls */}
        <div className="flex flex-col gap-2">
          {showContext && (
            <textarea
              rows={2}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Optional: add extra business context for the AI (e.g. 'Focus on cloud-native roles')…"
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-none transition-colors
                bg-tcs-white text-tcs-gray-900 dark:bg-tcs-gray-900 dark:text-tcs-gray-100
                border-tcs-gray-300 dark:border-tcs-gray-700
                focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20"
            />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowContext((v) => !v)}
              className="text-xs text-tcs-blue hover:underline cursor-pointer"
            >
              {showContext ? 'Hide context' : '+ Add context'}
            </button>
            <div className="flex-1" />
            <Button loading={generating} onClick={handleGenerate}>
              <Sparkles size={14} />
              {suggestions.length === 0 ? 'Generate Suggestions' : 'Regenerate'}
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Suggestions list */}
        {loading ? (
          <div className="flex justify-center py-10">
            <span className="w-6 h-6 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : generating ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="w-8 h-8 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400">
              AI is analysing batch requirements… this may take up to 60 s
            </p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 rounded-xl border border-dashed border-tcs-gray-200 dark:border-tcs-gray-700 text-center">
            <Sparkles size={28} className="text-tcs-gray-300 dark:text-tcs-gray-600" />
            <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400">
              No suggestions yet. Click <strong>Generate Suggestions</strong> to let the AI propose streams.
            </p>
          </div>
        ) : (
          <>
            {pendingCount > 0 && (
              <p className="text-xs text-tcs-gray-400 dark:text-tcs-gray-500">
                {pendingCount} pending suggestion{pendingCount !== 1 ? 's' : ''} — accept to create the stream, or ignore to dismiss.
              </p>
            )}
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {suggestions
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map((s) => (
                  <div
                    key={s.id}
                    className={[
                      'rounded-xl border p-4 transition-opacity',
                      s.status !== 'pending' ? 'opacity-60' : '',
                      'bg-tcs-white dark:bg-tcs-gray-800 border-tcs-gray-200 dark:border-tcs-gray-700',
                    ].join(' ')}
                  >
                    {/* Name + priority + status badge */}
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <GitBranch size={14} className="text-tcs-blue shrink-0" />
                      <span className="font-semibold text-sm text-tcs-gray-900 dark:text-tcs-gray-100">
                        {s.name}
                      </span>
                      {s.priority > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-tcs-blue/10 text-tcs-blue dark:bg-tcs-blue/20 font-medium">
                          P{s.priority}
                        </span>
                      )}
                      {s.status === 'accepted' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                          <CheckCircle size={11} /> Accepted
                        </span>
                      )}
                      {s.status === 'ignored' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-tcs-gray-100 text-tcs-gray-500 dark:bg-tcs-gray-700 dark:text-tcs-gray-400 font-medium">
                          <XCircle size={11} /> Ignored
                        </span>
                      )}
                    </div>

                    {/* AI reasoning */}
                    <p className="text-xs italic text-tcs-gray-500 dark:text-tcs-gray-400 mb-2.5">
                      {s.reasoning}
                    </p>

                    {/* Weight bars */}
                    {s.weights.length > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
                        {s.weights.map((w) => (
                          <div key={w.subject_name} className="flex items-center gap-1.5">
                            <span className="text-xs text-tcs-gray-600 dark:text-tcs-gray-400 capitalize">
                              {w.subject_name}
                            </span>
                            <div className="h-1.5 w-14 rounded-full bg-tcs-gray-100 dark:bg-tcs-gray-700 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-tcs-blue"
                                style={{ width: `${w.weight_pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-tcs-gray-700 dark:text-tcs-gray-300">
                              {w.weight_pct}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    {s.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleIgnore(s)}
                          disabled={actionLoadingId === s.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                            text-tcs-gray-500 hover:text-tcs-gray-700 hover:bg-tcs-gray-100
                            dark:hover:text-tcs-gray-300 dark:hover:bg-tcs-gray-700
                            transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {actionLoadingId === s.id
                            ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            : <XCircle size={13} />}
                          Ignore
                        </button>
                        <button
                          onClick={() => handleAccept(s)}
                          disabled={actionLoadingId === s.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                            bg-green-600 hover:bg-green-700 text-white
                            transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {actionLoadingId === s.id
                            ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                            : <CheckCircle size={13} />}
                          Accept
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Stream card ──────────────────────────────────────────────────────
function StreamCard({
  stream,
  canManage,
  isAssignedSme,
  onRename,
  onDelete,
  onSetWeights,
  onReviewProposal,
  onManageSmes,
  onSetPriority,
  onSetTraineePct,
}: {
  stream: BatchStream;
  canManage: boolean;
  isAssignedSme: boolean;
  onRename: (s: BatchStream) => void;
  onDelete: (s: BatchStream) => void;
  onSetWeights: (s: BatchStream) => void;
  onReviewProposal: (s: BatchStream) => void;
  onManageSmes: (s: BatchStream) => void;
  onSetPriority: (s: BatchStream) => void;
  onSetTraineePct: (s: BatchStream) => void;
}) {
  const hasWeights = stream.weights.length > 0;
  const isPending = stream.has_pending_proposal;
  const canEditWeights = canManage || isAssignedSme;

  return (
    <div className="rounded-xl border p-4
      bg-tcs-white dark:bg-tcs-gray-800
      border-tcs-gray-200 dark:border-tcs-gray-700">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <GitBranch size={15} className="text-tcs-blue shrink-0" />
          <span className="font-semibold text-tcs-gray-900 dark:text-tcs-gray-100 text-sm">
            {stream.name}
          </span>
          {stream.priority > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-tcs-blue/10 text-tcs-blue dark:bg-tcs-blue/20 dark:text-tcs-blue-light font-medium">
              P{stream.priority}
            </span>
          )}
          {stream.trainee_pct > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium">
              <Percent size={10} />
              {stream.trainee_pct}% trainees
            </span>
          )}
          {!hasWeights && !isPending && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">
              Weights needed
            </span>
          )}
          {isPending && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
              <Clock size={11} />
              Pending Approval
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isPending && canManage ? (
            <button
              onClick={() => onReviewProposal(stream)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20
                hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
            >
              <Clock size={13} />
              Review
            </button>
          ) : isPending && isAssignedSme ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
              text-tcs-gray-400 dark:text-tcs-gray-500 cursor-not-allowed select-none">
              <Sliders size={13} />
              Locked
            </span>
          ) : canEditWeights ? (
            <button
              onClick={() => onSetWeights(stream)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                text-tcs-blue hover:bg-tcs-blue/10 dark:hover:bg-tcs-blue/20 transition-colors cursor-pointer"
            >
              <Sliders size={13} />
              Weights
            </button>
          ) : null}
          {canManage && (
            <>
              <button
                onClick={() => onSetPriority(stream)}
                className="p-1.5 rounded-lg text-tcs-gray-400 hover:text-tcs-blue hover:bg-tcs-blue/10
                  dark:hover:bg-tcs-blue/20 transition-colors cursor-pointer"
                title="Set allocation priority"
              >
                <ArrowUpDown size={13} />
              </button>
              <button
                onClick={() => onSetTraineePct(stream)}
                className="p-1.5 rounded-lg text-tcs-gray-400 hover:text-purple-600 hover:bg-purple-50
                  dark:hover:text-purple-400 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                title="Set trainee percentage"
              >
                <Percent size={13} />
              </button>
              <button
                onClick={() => onManageSmes(stream)}
                className="p-1.5 rounded-lg text-tcs-gray-400 hover:text-tcs-blue hover:bg-tcs-blue/10
                  dark:hover:bg-tcs-blue/20 transition-colors cursor-pointer"
                title="Manage SMEs"
              >
                <Users size={13} />
              </button>
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
          {isPending ? 'Proposed weights are awaiting approval.' : 'No subject weights configured yet. Click Weights to set them.'}
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
  const [showAiModal, setShowAiModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<BatchStream | null>(null);
  const [weightsTarget, setWeightsTarget] = useState<BatchStream | null>(null);
  const [reviewTarget, setReviewTarget] = useState<BatchStream | null>(null);
  const [manageSmeTarget, setManageSmeTarget] = useState<BatchStream | null>(null);
  const [priorityTarget, setPriorityTarget] = useState<BatchStream | null>(null);
  const [traineePctTarget, setTraineePctTarget] = useState<BatchStream | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [mySmeStreamIds, setMySmeStreamIds] = useState<Set<number>>(new Set());

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

  useEffect(() => {
    if (!selectedBatch) return;
    streamsApi.myBatchSmeAssignments(selectedBatch.batch_name)
      .then(({ data }) => setMySmeStreamIds(new Set(data)))
      .catch(() => setMySmeStreamIds(new Set()));
  }, [selectedBatch]);

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

  const handleProposalReviewed = (streamId: number) => {
    if (selectedBatch) fetchStreams(selectedBatch.batch_name);
    void streamId;
  };

  const handlePrioritySaved = (updated: BatchStream) => {
    setStreams((prev) =>
      prev
        .map((s) => (s.id === updated.id ? updated : s))
        .sort((a, b) => {
          if (a.priority === 0 && b.priority === 0) return 0;
          if (a.priority === 0) return 1;
          if (b.priority === 0) return -1;
          return a.priority - b.priority;
        }),
    );
  };

  const handleTraineePctSaved = (updated: BatchStream) => {
    setStreams((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  return (
    <>
      <AISuggestionsModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        batchName={selectedBatch?.batch_name ?? ''}
        onStreamAccepted={() => selectedBatch && fetchStreams(selectedBatch.batch_name)}
      />
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
        userRole={user?.role ?? ''}
        onSaved={handleWeightsSaved}
      />
      <ReviewProposalModal
        isOpen={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        stream={reviewTarget}
        onReviewed={handleProposalReviewed}
      />
      <ManageSMEsModal
        isOpen={!!manageSmeTarget}
        onClose={() => setManageSmeTarget(null)}
        stream={manageSmeTarget}
        batchName={selectedBatch?.batch_name ?? ''}
      />
      <SetPriorityModal
        isOpen={!!priorityTarget}
        onClose={() => setPriorityTarget(null)}
        stream={priorityTarget}
        onSaved={handlePrioritySaved}
      />
      <SetTraineePctModal
        isOpen={!!traineePctTarget}
        onClose={() => setTraineePctTarget(null)}
        stream={traineePctTarget}
        allStreams={streams}
        onSaved={handleTraineePctSaved}
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
                  {streams.length > 0 && (() => {
                    const total = parseFloat(streams.reduce((sum, s) => sum + (s.trainee_pct ?? 0), 0).toFixed(2));
                    const isComplete = Math.abs(total - 100) <= 0.01;
                    const isOver = total > 100.01;
                    return (
                      <p className={`text-xs mt-0.5 font-medium ${isComplete ? 'text-green-600 dark:text-green-400' : isOver ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'}`}>
                        Trainee allocation: {total.toFixed(2)}% / 100%{isComplete ? ' ✓' : isOver ? ' (over-allocated)' : ' (incomplete)'}
                      </p>
                    );
                  })()}
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setShowAiModal(true)}
                    >
                      <Sparkles size={15} />
                      AI Suggestions
                    </Button>
                    <Button onClick={() => setShowAddModal(true)}>
                      <Plus size={15} />
                      Add Stream
                    </Button>
                  </div>
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
                    isAssignedSme={mySmeStreamIds.has(stream.id)}
                    onRename={setRenameTarget}
                    onDelete={(s) => {
                      if (deletingId !== null) return;
                      handleDeleteStream(s);
                    }}
                    onSetWeights={setWeightsTarget}
                    onReviewProposal={setReviewTarget}
                    onManageSmes={setManageSmeTarget}
                    onSetPriority={setPriorityTarget}
                    onSetTraineePct={setTraineePctTarget}
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
