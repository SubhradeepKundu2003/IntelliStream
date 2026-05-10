import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, UserX } from 'lucide-react';
import { authApi } from '../../services/api';
import type { Role, UserResponse } from '../../types/auth';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';

// ── Add-user form ────────────────────────────────────────────────────
function AddUserModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'manager' | 'sme'>('sme');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setEmail(''); setPassword(''); setRole('sme');
    setErrors({}); setApiError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const validate = () => {
    const e: typeof errors = {};
    if (!email) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Minimum 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setApiError('');
    setLoading(true);
    try {
      await authApi.register(email, password, role);
      reset();
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setApiError(msg ?? 'Failed to create user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New User">
      <div className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoFocus
        />
        <Input
          label="Password"
          type="password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-tcs-gray-700 dark:text-tcs-gray-300">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'manager' | 'sme')}
            className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors
              bg-tcs-white text-tcs-gray-900
              dark:bg-tcs-gray-800 dark:text-tcs-gray-100
              border-tcs-gray-300 dark:border-tcs-gray-700
              focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20"
          >
            <option value="sme">SME</option>
            <option value="manager">Manager</option>
          </select>
        </div>

        {apiError && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {apiError}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button loading={loading} onClick={handleSubmit}>Create User</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main page ────────────────────────────────────────────────────────
export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deactivating, setDeactivating] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await authApi.users();
      setUsers(data);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDeactivate = async (id: number) => {
    setDeactivating(id);
    try {
      await authApi.deactivateUser(id);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, is_active: false } : u)));
    } catch {
      // silently ignore – could add a toast here
    } finally {
      setDeactivating(null);
    }
  };

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={fetchUsers}
      />

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">User Management</h1>
          <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400 mt-0.5">
            {users.length} user{users.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          Add User
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-tcs-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by email or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none transition-colors
            bg-tcs-white text-tcs-gray-900 placeholder-tcs-gray-400
            dark:bg-tcs-gray-800 dark:text-tcs-gray-100 dark:placeholder-tcs-gray-600
            border-tcs-gray-300 dark:border-tcs-gray-700
            focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20"
        />
      </div>

      {/* Table card */}
      <div className="rounded-xl border overflow-hidden
        bg-tcs-white dark:bg-tcs-gray-800
        border-tcs-gray-200 dark:border-tcs-gray-700">

        {loading ? (
          <div className="flex items-center justify-center py-16 text-tcs-gray-400">
            <span className="w-6 h-6 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-sm text-red-500">{error}</p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={fetchUsers}>Retry</Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tcs-gray-200 dark:border-tcs-gray-700
                bg-tcs-gray-50 dark:bg-tcs-gray-900/50">
                <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Email</th>
                <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Role</th>
                <th className="text-left px-5 py-3 font-semibold text-tcs-gray-600 dark:text-tcs-gray-400">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-tcs-gray-400">
                    {search ? 'No users match your search.' : 'No users found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b last:border-0 border-tcs-gray-100 dark:border-tcs-gray-700/50
                      hover:bg-tcs-gray-50 dark:hover:bg-tcs-gray-700/30 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-tcs-blue/10 dark:bg-tcs-blue/20 flex items-center justify-center shrink-0">
                          <span className="text-tcs-blue text-xs font-semibold uppercase">{u.email[0]}</span>
                        </div>
                        <span className="text-tcs-gray-900 dark:text-tcs-gray-100 font-medium">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={u.role as Role} />
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={u.is_active ? 'active' : 'inactive'} label={u.is_active ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {u.email !== currentUser?.email && u.is_active && (
                        <button
                          onClick={() => handleDeactivate(u.id)}
                          disabled={deactivating === u.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                            text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400
                            disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          {deactivating === u.id ? (
                            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <UserX size={14} />
                          )}
                          Deactivate
                        </button>
                      )}
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
