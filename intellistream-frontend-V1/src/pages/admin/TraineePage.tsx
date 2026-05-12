import { useEffect, useRef, useState } from 'react';
import { Package, Pencil, Plus, Trash2, X } from 'lucide-react';
import { batchManagementApi } from '../../services/api';
import type { SpringBootBatch } from '../../types/batch_management';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';

// ── Subject tag input ─────────────────────────────────────────────────
function SubjectTagInput({
  subjects,
  onChange,
}: {
  subjects: string[];
  onChange: (s: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed || subjects.map((s) => s.toLowerCase()).includes(trimmed.toLowerCase())) return;
    onChange([...subjects, trimmed]);
    setDraft('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-tcs-gray-700 dark:text-tcs-gray-300">Subjects</label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Type a subject and press Enter"
          className="flex-1 px-3 py-2 text-sm rounded-lg border outline-none transition-colors
            bg-tcs-white text-tcs-gray-900 placeholder-tcs-gray-400
            dark:bg-tcs-gray-800 dark:text-tcs-gray-100 dark:placeholder-tcs-gray-600
            border-tcs-gray-300 dark:border-tcs-gray-700
            focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20"
        />
        <Button variant="secondary" size="sm" onClick={add} type="button">Add</Button>
      </div>
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {subjects.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium
                bg-tcs-blue/10 text-tcs-blue dark:bg-tcs-blue/20 dark:text-tcs-blue-light"
            >
              {s}
              <button
                type="button"
                onClick={() => onChange(subjects.filter((x) => x !== s))}
                className="hover:opacity-70 cursor-pointer"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Batch form modal ──────────────────────────────────────────────────
interface BatchFormState {
  batchName: string;
  traineeCount: string;
  subjects: string[];
}

function BatchFormModal({
  isOpen,
  onClose,
  onSave,
  initial,
  title,
  isEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SpringBootBatch) => Promise<void>;
  initial?: SpringBootBatch;
  title: string;
  isEdit?: boolean;
}) {
  const blank: BatchFormState = { batchName: '', traineeCount: '', subjects: [] };
  const [form, setForm] = useState<BatchFormState>(blank);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(
        initial
          ? { batchName: initial.batchName, traineeCount: String(initial.traineeCount), subjects: [...initial.subjects] }
          : blank,
      );
      setError('');
    }
  }, [isOpen]);

  const set = (k: keyof Omit<BatchFormState, 'subjects'>, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.batchName.trim()) { setError('Batch name is required.'); return; }
    const count = parseInt(form.traineeCount, 10);
    if (isNaN(count) || count < 0) { setError('Trainee count must be a valid non-negative number.'); return; }
    if (form.subjects.length === 0) { setError('At least one subject is required.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({ batchName: form.batchName.trim(), traineeCount: count, subjects: form.subjects });
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Failed to save batch.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <Input
          label="Batch Name"
          value={form.batchName}
          onChange={(e) => set('batchName', e.target.value)}
          disabled={isEdit}
          autoFocus={!isEdit}
          placeholder="e.g. Batch_2025_Q1"
        />
        <Input
          label="Trainee Count"
          type="number"
          min={0}
          value={form.traineeCount}
          onChange={(e) => set('traineeCount', e.target.value)}
          autoFocus={isEdit}
          placeholder="e.g. 50"
        />
        <SubjectTagInput
          subjects={form.subjects}
          onChange={(s) => setForm((prev) => ({ ...prev, subjects: s }))}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button loading={saving} onClick={handleSave} type="button">Save</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────
function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  batchName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  batchName: string;
}) {
  const [deleting, setDeleting] = useState(false);

  const handle = async () => {
    setDeleting(true);
    try { await onConfirm(); onClose(); } finally { setDeleting(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Batch">
      <div className="space-y-4">
        <p className="text-sm text-tcs-gray-700 dark:text-tcs-gray-300">
          Delete <span className="font-semibold">{batchName}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handle} type="button">Delete</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function TraineePage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [batches, setBatches] = useState<SpringBootBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SpringBootBatch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SpringBootBatch | null>(null);

  const load = () => {
    setLoading(true);
    setFetchError('');
    batchManagementApi
      .list()
      .then(({ data }) => setBatches(data))
      .catch(() => setFetchError('Failed to load batches. Make sure IntelliStream Deco is running.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data: SpringBootBatch) => {
    await batchManagementApi.create(data);
    load();
  };

  const handleUpdate = async (data: SpringBootBatch) => {
    await batchManagementApi.update(editTarget!.batchName, data);
    load();
  };

  const handleDelete = async () => {
    await batchManagementApi.remove(deleteTarget!.batchName);
    load();
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">Batch Management</h1>
          <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400 mt-0.5">
            Create and manage training batches and their subjects in IntelliStream Deco
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Create Batch
          </Button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-24">
          <span className="w-6 h-6 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : fetchError ? (
        <div className="text-center py-24">
          <p className="text-sm text-red-500 mb-3">{fetchError}</p>
          <Button variant="ghost" size="sm" onClick={load}>Retry</Button>
        </div>
      ) : batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed
          border-tcs-gray-200 dark:border-tcs-gray-700 text-center">
          <Package size={28} className="text-tcs-gray-300 dark:text-tcs-gray-600 mb-3" />
          <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400">No batches found.</p>
          {canEdit && (
            <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Create first batch
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-tcs-gray-200 dark:border-tcs-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-tcs-gray-50 dark:bg-tcs-gray-900/50 border-b border-tcs-gray-200 dark:border-tcs-gray-700">
                <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Batch Name</th>
                <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Trainees</th>
                <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Subjects</th>
                {canEdit && (
                  <th className="px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr
                  key={b.batchName}
                  className="border-b last:border-0 border-tcs-gray-100 dark:border-tcs-gray-700/50
                    hover:bg-tcs-gray-50 dark:hover:bg-tcs-gray-800/40 transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-tcs-gray-900 dark:text-tcs-gray-100">
                    {b.batchName}
                  </td>
                  <td className="px-5 py-3.5 text-tcs-gray-500 dark:text-tcs-gray-400">
                    {b.traineeCount}
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
                  {canEdit && (
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditTarget(b)}
                          className="p-1.5 rounded-lg text-tcs-gray-400 hover:text-tcs-blue hover:bg-tcs-blue/10
                            dark:hover:bg-tcs-blue/20 transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(b)}
                          className="p-1.5 rounded-lg text-tcs-gray-400 hover:text-red-500 hover:bg-red-50
                            dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={15} />
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

      {/* Modals */}
      <BatchFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        title="Create Batch"
      />
      <BatchFormModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleUpdate}
        initial={editTarget ?? undefined}
        title="Edit Batch"
        isEdit
      />
      <DeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        batchName={deleteTarget?.batchName ?? ''}
      />
    </>
  );
}
