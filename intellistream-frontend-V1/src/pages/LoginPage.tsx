import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import ThemeToggle from '../components/ui/ThemeToggle';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Already logged in (shouldn't reach here due to GuestRoute, but just in case)
  if (user) {
    navigate(user.role === 'admin' ? '/admin/users' : '/home', { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    try {
      await login(email, password);
      // AuthContext sets user; redirect based on role
      const stored = localStorage.getItem('access_token');
      if (stored) {
        const payload = JSON.parse(atob(stored.split('.')[1]));
        navigate(payload.role === 'admin' ? '/admin/users' : '/home', { replace: true });
      }
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center
      bg-tcs-gray-50 dark:bg-tcs-gray-900 px-4">

      {/* Theme toggle – top-right */}
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl shadow-lg border
          bg-tcs-white dark:bg-tcs-gray-800
          border-tcs-gray-200 dark:border-tcs-gray-700
          px-8 py-10">

          {/* Branding */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-tcs-blue flex items-center justify-center">
              <span className="text-tcs-white font-bold text-lg">IS</span>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">IntelliStream</h1>
              <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400 mt-0.5">Sign in to your account</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth loading={loading} size="lg" className="mt-2">
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-tcs-gray-400 mt-6">
          © {new Date().getFullYear()} IntelliStream. All rights reserved.
        </p>
      </div>
    </div>
  );
}
