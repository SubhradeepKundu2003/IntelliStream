import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BookOpen, Database, GitBranch, GraduationCap, Layers, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from './ui/ThemeToggle';
import Badge from './ui/Badge';
import type { Role } from '../types/auth';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',        to: '/home',                  icon: <LayoutDashboard size={18} />, roles: ['admin', 'manager', 'sme'] },
  { label: 'Stream Management', to: '/streams',             icon: <GitBranch size={18} />,       roles: ['admin', 'manager', 'sme'] },
  { label: 'User Management',  to: '/admin/users',          icon: <Users size={18} />,           roles: ['admin'] },
  { label: 'Stream Templates', to: '/admin/stream-templates',      icon: <Layers size={18} />,        roles: ['admin', 'manager', 'sme'] },
  { label: 'Batch Management',   to: '/admin/trainees',           icon: <GraduationCap size={18} />, roles: ['admin', 'manager'] },
  { label: 'Training Data',    to: '/admin/training-data',         icon: <Database size={18} />,      roles: ['admin', 'manager'] },
  { label: 'Business Reqs',   to: '/admin/business-requirements', icon: <BookOpen size={18} />,      roles: ['admin', 'manager'] },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));

  return (
    <div className="flex h-full bg-tcs-gray-50 dark:bg-tcs-gray-900">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col h-full
        bg-tcs-white dark:bg-tcs-gray-800
        border-r border-tcs-gray-200 dark:border-tcs-gray-700">

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-tcs-gray-200 dark:border-tcs-gray-700">
          <div className="w-8 h-8 rounded-lg bg-tcs-blue flex items-center justify-center shrink-0">
            <span className="text-tcs-white text-xs font-bold">IS</span>
          </div>
          <span className="font-semibold text-tcs-gray-900 dark:text-tcs-gray-100 text-sm leading-tight">
            IntelliStream
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-tcs-blue text-tcs-white'
                    : 'text-tcs-gray-600 hover:bg-tcs-gray-100 hover:text-tcs-gray-900 dark:text-tcs-gray-400 dark:hover:bg-tcs-gray-700 dark:hover:text-tcs-gray-100',
                ].join(' ')
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-tcs-gray-200 dark:border-tcs-gray-700 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-tcs-blue/10 dark:bg-tcs-blue/20 flex items-center justify-center shrink-0">
              <span className="text-tcs-blue font-semibold text-xs uppercase">
                {user?.email[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-tcs-gray-900 dark:text-tcs-gray-100 truncate">{user?.email}</p>
              {user && <Badge variant={user.role} />}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
              text-tcs-gray-500 hover:bg-red-50 hover:text-red-600
              dark:text-tcs-gray-500 dark:hover:bg-red-900/20 dark:hover:text-red-400
              transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 shrink-0 flex items-center justify-end px-6
          bg-tcs-white dark:bg-tcs-gray-800
          border-b border-tcs-gray-200 dark:border-tcs-gray-700">
          <ThemeToggle />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
