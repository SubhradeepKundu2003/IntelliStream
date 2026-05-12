import { useEffect, useState } from 'react';
import { GitBranch, Pencil, Plus, Trash2 } from 'lucide-react';
import { streamTemplatesApi } from '../../services/api';
import type { StreamTemplate, SubjectWeight } from '../../types/streams';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

const ALL_SUBJECTS = ['java', 'python', 'sql', 'cybersecurity', 'agile', 'aiml', 'webtech', 'cloud'] as const;

const SUBJECT_LABELS: Record<string, string> = {
  java: 'Java', python: 'Python', sql: 'SQL',
  cybersecurity: 'Cybersecurity', agile: 'Agile',
  aiml: 'AI / ML', webtech: 'Webtech', cloud: 'Cloud',
};

// ── Stream form modal ─────────────────────────────────────────────────
interface StreamFormState {
  name: string;
  description: string;
  is_mandatory: boolean;
  intake_pct: string;
}

function StreamFormModal({
  isOpen, onClose, onSave, initial, title,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: StreamFormState) => Promise<void>;
  initial?: StreamFormState;
  title: string;
}) {
  const blank: StreamFormState = { name: '', description: '', is_mandatory: false, intake_pct: '' };
  const [form, setForm] = useState<StreamFormState>(blank);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (isOpen) setForm(initial ?? blank); }, [isOpen]);

  const set = (k: keyof StreamFormState, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    const pct = parseFloat(form.intake_pct);
    if (isNaN(pct) || pct < 0 || pct > 100) { setError('Intake % must be 0–100'); return; }
    setError('');
    setLoading(true);
    try {
      await onSave(form);
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
        <Input label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} error={error && !form.name.trim() ? error : ''} autoFocus />
        <Input label="Description (optional)" value={form.description} onChange={(e) => set('description', e.target.value)} />
        <Input label="Intake %" type="number" min={0} max={100} step={0.1} value={form.intake_pct} onChange={(e) => set('intake_pct', e.target.value)} error={error && form.name.trim() ? error : ''} />
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.is_mandatory}
            onChange={(e) => set('is_mandatory', e.target.checked)}
            className="w-4 h-4 accent-tcs-blue"
          />
          <span className="text-sm text-tcs-gray-700 dark:text-tcs-gray-300">Mandatory stream</span>
        </label>
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={loading} onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Subject weights panel ─────────────────────────────────────────────
function SubjectWeightsPanel({ stream }: { stream: StreamTemplate }) {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'sme';

  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setSaved(false);
    streamTemplatesApi.getSubjects(stream.id)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        ALL_SUBJECTS.forEach((s) => {
          const found = data.find((w: SubjectWeight) => w.subject_name === s);
          map[s] = found ? String(found.weight_pct) : '0';
        });
        setValues(map);
      })
      .catch(() => setError('Failed to load subject weights.'))
      .finally(() => setLoading(false));
  }, [stream.id]);

  const total = ALL_SUBJECTS.reduce((sum, s) => sum + (parseFloat(values[s] ?? '0') || 0), 0);
  const totalOk = Math.abs(total - 100) <= 0.1;

  const distributeEvenly = () => {
    const even = (100 / ALL_SUBJECTS.length).toFixed(2);
    const map: Record<string, string> = {};
    ALL_SUBJECTS.forEach((s, i) => {
      map[s] = i === ALL_SUBJECTS.length - 1
        ? String(parseFloat((100 - parseFloat(even) * (ALL_SUBJECTS.length - 1)).toFixed(2)))
        : even;
    });
    setValues(map);
  };

  const handleSave = async () => {
    if (!totalOk) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await streamTemplatesApi.setSubjects(
        stream.id,
        ALL_SUBJECTS.map((s) => ({ subject_name: s, weight_pct: parseFloat(parseFloat(values[s] ?? '0').toFixed(2)) })),
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save weights.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-tcs-gray-200 dark:border-tcs-gray-700 p-5
      bg-tcs-white dark:bg-tcs-gray-800 h-fit">
      <h3 className="text-sm font-semibold text-tcs-gray-900 dark:text-tcs-gray-100 mb-4">
        {stream.name} — Subject Weights
      </h3>

      {loading ? (
        <div className="flex justify-center py-8">
          <span className="w-5 h-5 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {ALL_SUBJECTS.map((subject) => (
            <div key={subject} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm text-tcs-gray-700 dark:text-tcs-gray-300">
                {SUBJECT_LABELS[subject]}
              </span>
              <div className="flex-1 relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={values[subject] ?? '0'}
                  onChange={(e) => setValues((prev) => ({ ...prev, [subject]: e.target.value }))}
                  disabled={!canEdit}
                  className="w-full px-3 py-1.5 pr-8 text-sm rounded-lg border outline-none transition-colors
                    bg-tcs-white text-tcs-gray-900 border-tcs-gray-300
                    dark:bg-tcs-gray-900 dark:text-tcs-gray-100 dark:border-tcs-gray-700
                    focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-tcs-gray-400">%</span>
              </div>
              <div className="w-16 h-1.5 rounded-full bg-tcs-gray-100 dark:bg-tcs-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-tcs-blue transition-all"
                  style={{ width: `${Math.min(100, parseFloat(values[subject] ?? '0') || 0)}%` }}
                />
              </div>
            </div>
          ))}

          <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold mt-2
            ${totalOk
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
            <span>Total</span>
            <span>{total.toFixed(1)}% / 100% {totalOk ? '✓' : ''}</span>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {canEdit && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={distributeEvenly}
                className="text-xs text-tcs-blue hover:underline cursor-pointer"
              >
                Distribute evenly
              </button>
              <div className="flex items-center gap-3">
                {saved && <span className="text-xs text-green-600 dark:text-green-400">Saved ✓</span>}
                <Button size="sm" loading={saving} disabled={!totalOk} onClick={handleSave}>
                  Save Weights
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function StreamTemplatesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const [streams, setStreams] = useState<StreamTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<StreamTemplate | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<StreamTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadStreams = () => {
    setLoading(true);
    streamTemplatesApi.list()
      .then(({ data }) => { setStreams(data); })
      .catch(() => setError('Failed to load streams.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStreams(); }, []);

  const handleCreate = async (form: StreamFormState) => {
    const { data } = await streamTemplatesApi.create({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      is_mandatory: form.is_mandatory,
      intake_pct: parseFloat(form.intake_pct),
    });
    setStreams((prev) => [...prev, data]);
    setSelected(data);
  };

  const handleUpdate = async (form: StreamFormState) => {
    if (!editTarget) return;
    const { data } = await streamTemplatesApi.update(editTarget.id, {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      is_mandatory: form.is_mandatory,
      intake_pct: parseFloat(form.intake_pct),
    });
    setStreams((prev) => prev.map((s) => (s.id === data.id ? data : s)));
    if (selected?.id === data.id) setSelected(data);
  };

  const handleDelete = async (stream: StreamTemplate) => {
    setDeletingId(stream.id);
    try {
      await streamTemplatesApi.remove(stream.id);
      setStreams((prev) => prev.filter((s) => s.id !== stream.id));
      if (selected?.id === stream.id) setSelected(null);
    } catch {
      // ignore — mandatory stream rejection is shown by backend
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <StreamFormModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={handleCreate}
        title="Add Stream Template"
      />
      <StreamFormModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleUpdate}
        initial={editTarget ? {
          name: editTarget.name,
          description: editTarget.description ?? '',
          is_mandatory: editTarget.is_mandatory,
          intake_pct: String(editTarget.intake_pct),
        } : undefined}
        title="Edit Stream Template"
      />

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">Stream Templates</h1>
          <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400 mt-0.5">
            Define global stream tracks and their subject weightages for allocation
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus size={15} /> Add Stream
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <span className="w-6 h-6 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <div className="flex gap-6 items-start">
          {/* Left — stream list */}
          <div className="flex-1 min-w-0">
            {streams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed
                border-tcs-gray-200 dark:border-tcs-gray-700 text-center">
                <GitBranch size={28} className="text-tcs-gray-300 dark:text-tcs-gray-600 mb-3" />
                <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400">No stream templates yet.</p>
                {canManage && (
                  <Button size="sm" className="mt-4" onClick={() => setShowAdd(true)}>
                    <Plus size={14} /> Add First Stream
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-tcs-gray-200 dark:border-tcs-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-tcs-gray-50 dark:bg-tcs-gray-900 border-b border-tcs-gray-200 dark:border-tcs-gray-700">
                      <th className="text-left px-4 py-3 font-medium text-tcs-gray-600 dark:text-tcs-gray-400">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-tcs-gray-600 dark:text-tcs-gray-400">Mandatory</th>
                      <th className="text-left px-4 py-3 font-medium text-tcs-gray-600 dark:text-tcs-gray-400">Intake %</th>
                      <th className="text-left px-4 py-3 font-medium text-tcs-gray-600 dark:text-tcs-gray-400">Status</th>
                      {canManage && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tcs-gray-100 dark:divide-tcs-gray-700">
                    {streams.map((stream) => (
                      <tr
                        key={stream.id}
                        onClick={() => setSelected(stream)}
                        className={[
                          'cursor-pointer transition-colors',
                          selected?.id === stream.id
                            ? 'bg-tcs-blue/5 dark:bg-tcs-blue/10'
                            : 'hover:bg-tcs-gray-50 dark:hover:bg-tcs-gray-800',
                        ].join(' ')}
                      >
                        <td className="px-4 py-3 font-medium text-tcs-gray-900 dark:text-tcs-gray-100">
                          <div className="flex items-center gap-2">
                            <GitBranch size={14} className="text-tcs-blue shrink-0" />
                            {stream.name}
                          </div>
                          {stream.description && (
                            <p className="text-xs text-tcs-gray-400 dark:text-tcs-gray-500 mt-0.5 pl-5">{stream.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {stream.is_mandatory
                            ? <Badge variant="admin" label="Mandatory" />
                            : <span className="text-tcs-gray-400 dark:text-tcs-gray-500 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-tcs-gray-700 dark:text-tcs-gray-300 font-medium">
                          {stream.intake_pct}%
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={stream.is_active ? 'active' : 'inactive'} />
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setEditTarget(stream)}
                                className="p-1.5 rounded-lg text-tcs-gray-400 hover:text-tcs-gray-700 hover:bg-tcs-gray-100
                                  dark:hover:text-tcs-gray-200 dark:hover:bg-tcs-gray-700 transition-colors cursor-pointer"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                disabled={deletingId === stream.id || stream.is_mandatory}
                                onClick={() => handleDelete(stream)}
                                title={stream.is_mandatory ? 'Cannot delete a mandatory stream' : 'Delete stream'}
                                className="p-1.5 rounded-lg text-tcs-gray-400 hover:text-red-600 hover:bg-red-50
                                  dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors cursor-pointer
                                  disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right — subject weights */}
          {selected && (
            <div className="w-80 shrink-0">
              <SubjectWeightsPanel stream={selected} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
