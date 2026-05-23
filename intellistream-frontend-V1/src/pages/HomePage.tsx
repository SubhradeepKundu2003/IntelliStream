import { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  Users,
  Layers,
  TrendingUp,
  Clock,
  Lock,
  GitBranch,
  Zap,
  AlertCircle,
  CheckCircle2,
  BarChart2,
  Activity,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { dashboardApi, syncApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { DashboardStats, ActivityItem } from '../types/dashboard';

// ── Colours ───────────────────────────────────────────────────────────
const STREAM_COLORS = [
  '#4e84c4', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316',
];

// ── Helpers ───────────────────────────────────────────────────────────
function fmtPct(rate: number) { return `${(rate * 100).toFixed(1)}%`; }

function fmtDate(iso: string | null) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── KPI Card ──────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon, accent, iconColor,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; accent: string; iconColor: string;
}) {
  return (
    <div className="rounded-2xl border border-tcs-gray-200 dark:border-tcs-gray-700
      bg-tcs-white dark:bg-tcs-gray-800 p-5 flex items-start gap-4 shadow-sm">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100 mt-0.5 leading-none">
          {value}
        </p>
        {sub && <p className="text-xs text-tcs-gray-400 dark:text-tcs-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Section card ─────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-tcs-gray-200 dark:border-tcs-gray-700
      bg-tcs-white dark:bg-tcs-gray-800 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-tcs-gray-100 dark:border-tcs-gray-700">
        <h2 className="text-sm font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Stream donut ─────────────────────────────────────────────────────
function StreamDonut({ data }: { data: { stream_name: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (data.length === 0) {
    return <p className="text-sm text-tcs-gray-400 text-center py-10">No allocations yet</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={210}>
        <PieChart>
          <Pie
            data={data} cx="50%" cy="50%"
            innerRadius={65} outerRadius={90}
            paddingAngle={2} dataKey="count" nameKey="stream_name"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={STREAM_COLORS[i % STREAM_COLORS.length]} />
            ))}
          </Pie>
          <text x="50%" y="46%" dominantBaseline="middle" textAnchor="middle"
            style={{ fontSize: 22, fontWeight: 700, fill: 'currentColor' }}>
            {total}
          </text>
          <text x="50%" y="56%" dominantBaseline="middle" textAnchor="middle"
            style={{ fontSize: 11, fill: '#737373' }}>
            trainees
          </text>
          <Tooltip
            formatter={(val) => [`${val ?? 0} trainees`, '']}
            contentStyle={{ borderRadius: 10, border: '1px solid #e5e5e5', fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {data.map((item, i) => (
          <div key={item.stream_name} className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: STREAM_COLORS[i % STREAM_COLORS.length] }} />
            <span className="text-xs text-tcs-gray-600 dark:text-tcs-gray-400 truncate">
              {item.stream_name}
            </span>
            <span className="text-xs font-semibold text-tcs-gray-800 dark:text-tcs-gray-200 ml-auto shrink-0">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Batch freeze / overview bar ───────────────────────────────────────
function BatchFreezeBar({ data }: { data: { batch_name: string; frozen: number; unfrozen: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-tcs-gray-400 text-center py-10">No allocation data yet</p>;
  }
  return (
    <>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis dataKey="batch_name" tick={{ fontSize: 11, fill: '#737373' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#737373' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: '1px solid #e5e5e5', fontSize: 12 }}
            cursor={{ fill: 'rgba(78,132,196,0.06)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(v) => <span style={{ color: '#525252' }}>{v === 'unfrozen' ? 'Active' : 'Frozen'}</span>} />
          <Bar dataKey="unfrozen" name="unfrozen" stackId="a" fill="#4e84c4" />
          <Bar dataKey="frozen"   name="frozen"   stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-tcs-gray-400 mt-2">Blue = active · Green = frozen</p>
    </>
  );
}

// ── Score by stream bar (batch view) ─────────────────────────────────
function ScoreByStreamBar({ data }: { data: { stream_name: string; avg_composite: number; count: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-tcs-gray-400 text-center py-10">Run allocation to see scores</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#737373' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="stream_name" tick={{ fontSize: 11, fill: '#737373' }} axisLine={false} tickLine={false} width={72} />
        <Tooltip
          formatter={(val, _name, props) => [
            `${val ?? 0} (${(props?.payload as { count?: number })?.count ?? 0} trainees)`,
            'Avg Composite',
          ]}
          contentStyle={{ borderRadius: 10, border: '1px solid #e5e5e5', fontSize: 12 }}
          cursor={{ fill: 'rgba(78,132,196,0.06)' }}
        />
        <Bar dataKey="avg_composite" fill="#4e84c4" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={STREAM_COLORS[i % STREAM_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Activity feed ────────────────────────────────────────────────────
function ActivityIcon({ type }: { type: ActivityItem['type'] }) {
  if (type === 'freeze') return (
    <span className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
      <Lock size={13} className="text-green-600 dark:text-green-400" />
    </span>
  );
  if (type === 'override') return (
    <span className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
      <GitBranch size={13} className="text-amber-600 dark:text-amber-400" />
    </span>
  );
  return (
    <span className="w-7 h-7 rounded-full bg-tcs-blue/10 dark:bg-tcs-blue/20 flex items-center justify-center shrink-0">
      <Zap size={13} className="text-tcs-blue" />
    </span>
  );
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-tcs-gray-400 text-center py-6">No recent activity</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <ActivityIcon type={item.type} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-tcs-gray-800 dark:text-tcs-gray-200 leading-snug">{item.message}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-tcs-gray-400">{timeAgo(item.timestamp)}</span>
              {item.actor && (
                <>
                  <span className="text-tcs-gray-300 dark:text-tcs-gray-600">·</span>
                  <span className="text-xs text-tcs-gray-400 truncate">{item.actor}</span>
                </>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── System / batch health ─────────────────────────────────────────────
function StatRow({
  label, value, sub, barPct, barColor,
}: {
  label: string; value: string; sub?: string; barPct?: number; barColor?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-tcs-gray-500 dark:text-tcs-gray-400">{label}</span>
        <span className="text-xs font-semibold text-tcs-gray-800 dark:text-tcs-gray-200">
          {value}{sub && <span className="font-normal text-tcs-gray-400"> ({sub})</span>}
        </span>
      </div>
      {barPct !== undefined && (
        <div className="h-1.5 rounded-full bg-tcs-gray-100 dark:bg-tcs-gray-700 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(barPct * 100, 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function SystemHealth({ stats }: { stats: DashboardStats }) {
  const sync = stats.sync_status;
  const syncOk = sync?.status === 'success';
  const cfg = stats.alloc_config;

  return (
    <div className="space-y-4">
      {/* Sync row */}
      <div className="flex items-center justify-between py-3 border-b border-tcs-gray-100 dark:border-tcs-gray-700">
        <div className="flex items-center gap-2">
          {syncOk
            ? <CheckCircle2 size={15} className="text-green-500" />
            : <AlertCircle size={15} className="text-tcs-gray-400" />}
          <span className="text-sm text-tcs-gray-700 dark:text-tcs-gray-300">Data Sync</span>
        </div>
        <div className="text-right">
          <span className={`text-xs font-medium ${syncOk ? 'text-green-600 dark:text-green-400' : 'text-tcs-gray-400'}`}>
            {sync ? (syncOk ? 'Healthy' : sync.status) : 'No sync yet'}
          </span>
          <p className="text-xs text-tcs-gray-400 mt-0.5">{fmtDate(sync?.last_sync_at ?? null)}</p>
        </div>
      </div>

      {/* Allocation breakdown */}
      <div className="space-y-2.5">
        <StatRow label="Total Allocation Records" value={stats.total_allocations.toString()} />
        <StatRow
          label="Allocated" value={`${Math.round(stats.allocation_rate * stats.total_allocations)}`}
          sub={fmtPct(stats.allocation_rate)} barPct={stats.allocation_rate} barColor="bg-tcs-blue"
        />
        <StatRow
          label="Frozen" value={stats.frozen_allocations.toString()}
          sub={fmtPct(stats.freeze_rate)} barPct={stats.freeze_rate} barColor="bg-green-500"
        />
        {stats.override_count > 0 && (
          <StatRow label="Manual Overrides" value={stats.override_count.toString()} />
        )}
      </div>

      {/* Batch allocation config */}
      {cfg && (
        <div className="pt-3 border-t border-tcs-gray-100 dark:border-tcs-gray-700 space-y-2">
          <p className="text-xs font-medium text-tcs-gray-500 dark:text-tcs-gray-400 uppercase tracking-wide">
            Allocation Weights
          </p>
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg bg-tcs-gray-50 dark:bg-tcs-gray-700/50 px-3 py-2 text-center">
              <p className="text-xs text-tcs-gray-400">Subject Score</p>
              <p className="text-sm font-bold text-tcs-blue">{Math.round(cfg.score_weight * 100)}%</p>
            </div>
            <div className="flex-1 rounded-lg bg-tcs-gray-50 dark:bg-tcs-gray-700/50 px-3 py-2 text-center">
              <p className="text-xs text-tcs-gray-400">DPI Score</p>
              <p className="text-sm font-bold text-purple-500">{Math.round(cfg.dpi_weight * 100)}%</p>
            </div>
          </div>
          {cfg.last_run_at && (
            <p className="text-xs text-tcs-gray-400">
              Last run: {fmtDate(cfg.last_run_at)}
              {cfg.run_by_email && ` by ${cfg.run_by_email}`}
            </p>
          )}
          {cfg.is_frozen && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <Lock size={12} />
              Frozen by {cfg.frozen_by_email} · {fmtDate(cfg.frozen_at)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Spinner ──────────────────────────────────────────────────────────
function Spinner() {
  return <span className="w-6 h-6 border-2 border-tcs-blue border-t-transparent rounded-full animate-spin" />;
}

// ── Main page ─────────────────────────────────────────────────────────
export default function HomePage() {
  const { user } = useAuth();
  const [batchList, setBatchList] = useState<string[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>(''); // '' = all batches
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Load batch list once
  useEffect(() => {
    syncApi.batches()
      .then(({ data }) => setBatchList(data.map((b) => b.batch_name).sort()))
      .catch(() => { /* non-fatal */ });
  }, []);

  const fetchStats = useCallback(async (batch: string, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const { data } = await dashboardApi.stats(batch || undefined);
      setStats(data);
    } catch {
      setError('Failed to load dashboard. Make sure the backend is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(selectedBatch); }, [fetchStats, selectedBatch]);

  const isBatchView = Boolean(selectedBatch);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">
            {greeting()}, {user?.email.split('@')[0]}
          </h1>
          <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400 mt-0.5">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => fetchStats(selectedBatch, true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
            text-tcs-gray-500 hover:bg-tcs-gray-100 dark:hover:bg-tcs-gray-700
            dark:text-tcs-gray-400 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Batch selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedBatch('')}
          className={[
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer',
            !selectedBatch
              ? 'bg-tcs-blue text-white'
              : 'text-tcs-gray-600 dark:text-tcs-gray-400 hover:bg-tcs-gray-100 dark:hover:bg-tcs-gray-700 border border-tcs-gray-200 dark:border-tcs-gray-700',
          ].join(' ')}
        >
          All Batches
        </button>
        {batchList.map((b) => (
          <button
            key={b}
            onClick={() => setSelectedBatch(b)}
            className={[
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer',
              selectedBatch === b
                ? 'bg-tcs-blue text-white'
                : 'text-tcs-gray-600 dark:text-tcs-gray-400 hover:bg-tcs-gray-100 dark:hover:bg-tcs-gray-700 border border-tcs-gray-200 dark:border-tcs-gray-700',
            ].join(' ')}
          >
            {b}
          </button>
        ))}
        {batchList.length === 0 && (
          <span className="text-xs text-tcs-gray-400">No batches synced yet</span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-20">
          <AlertCircle size={32} className="text-tcs-gray-300" />
          <p className="text-sm text-tcs-gray-500">{error}</p>
          <button onClick={() => fetchStats(selectedBatch)}
            className="text-sm text-tcs-blue hover:underline cursor-pointer">Retry</button>
        </div>
      )}

      {!loading && !error && stats && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Trainees"
              value={stats.total_trainees.toLocaleString()}
              sub={isBatchView ? `in ${selectedBatch}` : `across ${stats.active_batches} batches`}
              icon={<Users size={20} />}
              accent="bg-tcs-blue/10 dark:bg-tcs-blue/20"
              iconColor="text-tcs-blue"
            />

            {isBatchView ? (
              <KpiCard
                label="Avg Composite Score"
                value={stats.avg_composite_score !== null ? `${stats.avg_composite_score}` : '—'}
                sub={stats.avg_dpi_score !== null ? `avg DPI ${stats.avg_dpi_score}` : 'no scores yet'}
                icon={<BarChart2 size={20} />}
                accent="bg-purple-100 dark:bg-purple-900/30"
                iconColor="text-purple-600 dark:text-purple-400"
              />
            ) : (
              <KpiCard
                label="Active Batches"
                value={stats.active_batches}
                sub="synced from Deco"
                icon={<Layers size={20} />}
                accent="bg-purple-100 dark:bg-purple-900/30"
                iconColor="text-purple-600 dark:text-purple-400"
              />
            )}

            <KpiCard
              label="Allocation Rate"
              value={fmtPct(stats.allocation_rate)}
              sub={`${stats.total_allocations} records`}
              icon={<TrendingUp size={20} />}
              accent="bg-green-100 dark:bg-green-900/30"
              iconColor="text-green-600 dark:text-green-400"
            />

            <KpiCard
              label={isBatchView ? 'Pending SME Requests' : 'Pending SME Requests'}
              value={isBatchView && stats.override_count > 0
                ? stats.pending_sme_requests
                : stats.pending_sme_requests}
              sub={
                isBatchView
                  ? stats.override_count > 0
                    ? `${stats.override_count} manual override${stats.override_count !== 1 ? 's' : ''}`
                    : 'no overrides'
                  : stats.pending_sme_requests > 0 ? 'needs review' : 'all clear'
              }
              icon={isBatchView ? <Activity size={20} /> : <Clock size={20} />}
              accent={
                stats.pending_sme_requests > 0
                  ? 'bg-amber-100 dark:bg-amber-900/30'
                  : 'bg-tcs-gray-100 dark:bg-tcs-gray-700'
              }
              iconColor={
                stats.pending_sme_requests > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-tcs-gray-400'
              }
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title={isBatchView ? `Stream Distribution — ${selectedBatch}` : 'Stream Distribution (All Batches)'}>
              <StreamDonut data={stats.stream_distribution} />
            </Section>

            {isBatchView ? (
              <Section title={`Avg Composite Score by Stream — ${selectedBatch}`}>
                <ScoreByStreamBar data={stats.score_by_stream} />
                <p className="text-xs text-tcs-gray-400 mt-2">Score out of 100 · based on subject × DPI weights</p>
              </Section>
            ) : (
              <Section title="Batch Allocation Status">
                <BatchFreezeBar data={stats.batch_freeze_status} />
              </Section>
            )}
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title={isBatchView ? `Recent Activity — ${selectedBatch}` : 'Recent Activity'}>
              <ActivityFeed items={stats.recent_activity} />
            </Section>
            <Section title={isBatchView ? `Batch Health — ${selectedBatch}` : 'System Health'}>
              <SystemHealth stats={stats} />
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
