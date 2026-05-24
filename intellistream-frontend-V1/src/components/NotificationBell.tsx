import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Trash2,
  UserCheck,
  UserMinus,
  GitMerge,
  ThumbsUp,
  ThumbsDown,
  Layers,
  ClipboardList,
  ClipboardCheck,
} from 'lucide-react';
import { notificationsApi } from '../services/api';
import type { Notification, NotificationType } from '../types/notifications';

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TYPE_META: Record<NotificationType, { icon: React.ReactNode; color: string }> = {
  proposal_submitted:    { icon: <GitMerge size={15} />,       color: 'text-tcs-blue' },
  proposal_approved:     { icon: <ThumbsUp size={15} />,       color: 'text-green-500' },
  proposal_rejected:     { icon: <ThumbsDown size={15} />,     color: 'text-red-500' },
  sme_assigned:          { icon: <UserCheck size={15} />,      color: 'text-indigo-500' },
  sme_removed:           { icon: <UserMinus size={15} />,      color: 'text-orange-500' },
  stream_deleted:        { icon: <Layers size={15} />,         color: 'text-red-400' },
  sme_request_submitted: { icon: <ClipboardList size={15} />,  color: 'text-tcs-blue' },
  sme_request_reviewed:  { icon: <ClipboardCheck size={15} />, color: 'text-green-500' },
};

const TYPE_ROUTE: Record<NotificationType, string> = {
  proposal_submitted:    '/streams',
  proposal_approved:     '/streams',
  proposal_rejected:     '/streams',
  sme_assigned:          '/streams',
  sme_removed:           '/streams',
  stream_deleted:        '/streams',
  sme_request_submitted: '/allocation',
  sme_request_reviewed:  '/allocation',
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const unread = notifications.filter((n) => !n.is_read).length;

  const load = useCallback(async () => {
    try {
      const { data } = await notificationsApi.list();
      setNotifications(data);
    } catch {
      // silently ignore — no disruption if notifications fail
    }
  }, []);

  // initial load + 30-second polling
  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  // close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleClick(n: Notification) {
    if (!n.is_read) {
      try {
        await notificationsApi.markRead(n.id);
        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
        );
      } catch { /* ignore */ }
    }
    setOpen(false);
    navigate(TYPE_ROUTE[n.type]);
  }

  async function markAllRead() {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
    } catch { /* ignore */ }
  }

  async function remove(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await notificationsApi.remove(id);
      setNotifications((prev) => prev.filter((x) => x.id !== id));
    } catch { /* ignore */ }
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-tcs-gray-500 hover:bg-tcs-gray-100 hover:text-tcs-gray-700
          dark:text-tcs-gray-400 dark:hover:bg-tcs-gray-700 dark:hover:text-tcs-gray-200 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 flex items-center justify-center
            rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[480px] flex flex-col
          rounded-xl shadow-xl border border-tcs-gray-200 dark:border-tcs-gray-700
          bg-tcs-white dark:bg-tcs-gray-800 z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3
            border-b border-tcs-gray-100 dark:border-tcs-gray-700 shrink-0">
            <span className="text-sm font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">
              Notifications {unread > 0 && <span className="text-tcs-blue">({unread} new)</span>}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-xs font-medium text-tcs-blue hover:underline"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-tcs-gray-400 dark:text-tcs-gray-600">
                <Bell size={32} className="mb-2 opacity-40" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const meta = TYPE_META[n.type];
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={[
                      'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
                      'border-b border-tcs-gray-100 dark:border-tcs-gray-700/50 last:border-0',
                      n.is_read
                        ? 'hover:bg-tcs-gray-50 dark:hover:bg-tcs-gray-700/30'
                        : 'bg-tcs-blue/5 dark:bg-tcs-blue/10 hover:bg-tcs-blue/10 dark:hover:bg-tcs-blue/15',
                    ].join(' ')}
                  >
                    {/* Icon */}
                    <div className={`mt-0.5 shrink-0 ${meta.color}`}>{meta.icon}</div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${n.is_read ? 'text-tcs-gray-700 dark:text-tcs-gray-300' : 'font-medium text-tcs-gray-900 dark:text-tcs-gray-100'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-tcs-gray-500 dark:text-tcs-gray-400 mt-0.5 leading-snug">
                        {n.message}
                      </p>
                      <p className="text-[11px] text-tcs-gray-400 dark:text-tcs-gray-600 mt-1">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>

                    {/* Unread dot + delete */}
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-tcs-blue" />
                      )}
                      <button
                        onClick={(e) => remove(n.id, e)}
                        className="p-1 rounded text-tcs-gray-300 hover:text-red-500 dark:text-tcs-gray-600 dark:hover:text-red-400 transition-colors"
                        aria-label="Dismiss"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
