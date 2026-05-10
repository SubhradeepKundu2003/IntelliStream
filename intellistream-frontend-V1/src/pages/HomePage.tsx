import { useAuth } from '../contexts/AuthContext';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">
          Welcome back{user ? `, ${user.email.split('@')[0]}` : ''}!
        </h1>
        <p className="text-tcs-gray-500 dark:text-tcs-gray-400 mt-1">
          You are signed in as{' '}
          {user && <Badge variant={user.role} />}
        </p>
      </div>

      {user?.role === 'admin' && (
        <div className="rounded-xl border border-tcs-gray-200 dark:border-tcs-gray-700
          bg-tcs-white dark:bg-tcs-gray-800 p-6">
          <h2 className="font-semibold text-tcs-gray-900 dark:text-tcs-gray-100 mb-1">Admin panel</h2>
          <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400 mb-4">
            Manage users, roles, and system configuration.
          </p>
          <Button onClick={() => navigate('/admin/users')}>Go to User Management</Button>
        </div>
      )}
    </div>
  );
}
