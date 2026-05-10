import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle,
  ChevronRight,
  Cloud,
  Code,
  Code2,
  Database,
  Download,
  GitBranch,
  Globe,
  GraduationCap,
  LayoutDashboard,
  Settings2,
  Shield,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ui/ThemeToggle';

// ─── Static data ──────────────────────────────────────────────────────────────

const PHASES = [
  {
    month: 'Months 1–2',
    title: 'Foundation Training',
    description:
      'Core technical and soft-skill subjects — Java, Python, SQL, Webtech, and Agile fundamentals.',
    icon: <BookOpen size={20} />,
    accent: 'text-tcs-blue bg-tcs-blue/10 dark:bg-tcs-blue/20',
  },
  {
    month: 'Month 3',
    title: 'Advanced Specialisation',
    description:
      'Deep coverage of Cybersecurity, AI/ML, Cloud computing, and full-stack development tracks.',
    icon: <Brain size={20} />,
    accent: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300',
  },
  {
    month: 'Assessment',
    title: 'Intelligence Analysis',
    description:
      'DPI and performance averages fetched via API. A weighted scoring engine determines optimal stream fit.',
    icon: <BarChart3 size={20} />,
    accent: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
  },
  {
    month: 'Month 4',
    title: 'Stream-Specific Training',
    description:
      'Trainees deep-dive into their allocated stream. Subject mix and weightages configured by business.',
    icon: <GitBranch size={20} />,
    accent: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300',
  },
];

const SUBJECTS = [
  { name: 'Java',            icon: <Code size={18} />,     accent: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' },
  { name: 'Python',          icon: <Code2 size={18} />,    accent: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300' },
  { name: 'SQL & Database',  icon: <Database size={18} />, accent: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300' },
  { name: 'Cybersecurity',   icon: <Shield size={18} />,   accent: 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-300' },
  { name: 'Agile & Scrum',   icon: <GitBranch size={18} />,accent: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  { name: 'AI / ML',         icon: <Brain size={18} />,    accent: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300' },
  { name: 'Web Technologies',icon: <Globe size={18} />,    accent: 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-300' },
  { name: 'Cloud Computing', icon: <Cloud size={18} />,    accent: 'bg-sky-50 text-sky-500 dark:bg-sky-900/30 dark:text-sky-300' },
];

const STREAMS_PREVIEW = [
  { name: 'Java Full Stack',     pct: 30, bar: 'bg-tcs-blue' },
  { name: 'Python / Data Eng.', pct: 25, bar: 'bg-indigo-500' },
  { name: 'AI / ML Engineering',pct: 20, bar: 'bg-purple-500' },
  { name: 'Cloud & DevOps',     pct: 15, bar: 'bg-green-500' },
  { name: 'Cybersecurity',      pct: 10, bar: 'bg-red-500' },
];

const MOCK_TRAINEES = [
  { initials: 'RK', name: 'Rahul K.', dpi: '8.7', score: '89',  stream: 'Java Full Stack',     sc: 'text-tcs-blue' },
  { initials: 'PS', name: 'Priya S.', dpi: '9.1', score: '93',  stream: 'AI / ML Engineering', sc: 'text-purple-500' },
  { initials: 'AM', name: 'Arun M.',  dpi: '7.9', score: '82',  stream: 'Cloud & DevOps',      sc: 'text-green-600' },
  { initials: 'NK', name: 'Neha K.', dpi: '8.3', score: '87',  stream: 'Cybersecurity',        sc: 'text-red-500' },
];

const ALLOCATION_STEPS = [
  {
    num: '01',
    title: 'Fetch Scores via API',
    desc: 'DPI and average performance scores are pulled automatically from integrated enterprise APIs for every trainee in the batch.',
    icon: <BarChart3 size={20} />,
  },
  {
    num: '02',
    title: 'Weighted Stream Matching',
    desc: "A configurable scoring engine compares each trainee's profile against stream subject weightages and business allocation targets.",
    icon: <Zap size={20} />,
  },
  {
    num: '03',
    title: 'Download & Adjust',
    desc: 'Get the full allocation sheet, override any assignment, tweak percentages, and export in the format you need.',
    icon: <Download size={20} />,
  },
];

const ROLES = [
  {
    key: 'SME',
    title: 'SME',
    subtitle: 'Subject Matter Expert',
    icon: <Settings2 size={22} />,
    accent: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300',
    can: [
      'Configure subject weightages per stream',
      'Review trainee score breakdowns',
      'Validate allocation recommendations',
    ],
    cannot: ['Cannot create or delete streams', 'Cannot modify trainee allocation'],
  },
  {
    key: 'Manager',
    title: 'Manager',
    subtitle: 'Training Manager',
    icon: <Users size={22} />,
    accent: 'bg-tcs-blue/10 text-tcs-blue dark:bg-tcs-blue/20 dark:text-tcs-blue-light',
    can: [
      'All SME capabilities included',
      'Create, archive and configure streams',
      'Manage trainee batch allocation',
      'Download and export allocation reports',
      'Adjust any data before final release',
    ],
    cannot: [],
  },
];

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-200 ${
        scrolled
          ? 'bg-tcs-white/90 dark:bg-tcs-gray-900/90 backdrop-blur-sm shadow-sm border-b border-tcs-gray-200 dark:border-tcs-gray-800'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-tcs-blue flex items-center justify-center">
            <span className="text-tcs-white text-xs font-bold">IS</span>
          </div>
          <span className="font-semibold text-tcs-gray-900 dark:text-tcs-gray-100 text-sm">IntelliStream</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: 'How it Works', href: '#how-it-works' },
            { label: 'Subjects',     href: '#subjects' },
            { label: 'Streams',      href: '#streams' },
            { label: 'Roles',        href: '#roles' },
          ].map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="text-sm font-medium text-tcs-gray-500 hover:text-tcs-blue dark:text-tcs-gray-400 dark:hover:text-tcs-blue-light transition-colors"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <Link
              to={user.role === 'admin' ? '/admin/users' : '/home'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-tcs-blue text-tcs-white hover:bg-tcs-blue-dark transition-colors"
            >
              <LayoutDashboard size={14} />
              Dashboard
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-tcs-blue text-tcs-white hover:bg-tcs-blue-dark transition-colors"
            >
              Sign In
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-28 pb-20 px-6 bg-tcs-white dark:bg-tcs-gray-900">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-14">
        {/* Copy */}
        <div className="flex-1 min-w-0">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-tcs-blue/10 text-tcs-blue dark:bg-tcs-blue/20 mb-5">
            MNC Fresher Training Platform
          </span>
          <h1 className="text-4xl lg:text-5xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100 leading-[1.15]">
            Intelligent Stream<br />
            <span className="text-tcs-blue">Allocation</span> for<br />
            Fresher Training
          </h1>
          <p className="mt-5 text-lg text-tcs-gray-500 dark:text-tcs-gray-400 max-w-lg leading-relaxed">
            A structured 4-month program that uses DPI scores, performance analytics, and
            configurable business rules to map freshers to the right specialisation stream — automatically.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-tcs-blue text-tcs-white hover:bg-tcs-blue-dark transition-colors shadow-sm"
            >
              Get Started
              <ArrowRight size={16} />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-semibold border border-tcs-gray-300 dark:border-tcs-gray-700 text-tcs-gray-700 dark:text-tcs-gray-300 hover:bg-tcs-gray-50 dark:hover:bg-tcs-gray-800 transition-colors"
            >
              How it works <ChevronRight size={15} />
            </a>
          </div>
        </div>

        {/* Mock allocation card */}
        <div className="w-full lg:w-[400px] shrink-0">
          <div className="rounded-2xl border shadow-2xl overflow-hidden bg-tcs-white dark:bg-tcs-gray-800 border-tcs-gray-200 dark:border-tcs-gray-700">
            {/* Header */}
            <div className="px-5 py-4 border-b border-tcs-gray-100 dark:border-tcs-gray-700 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-tcs-gray-400 dark:text-tcs-gray-500">Batch 2024 Q3</p>
                <p className="text-sm font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">
                  Allocation Analysis · 127 Trainees
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">Live</span>
              </div>
            </div>

            {/* Trainee rows */}
            <div className="divide-y divide-tcs-gray-100 dark:divide-tcs-gray-700/60">
              {MOCK_TRAINEES.map((t) => (
                <div key={t.initials} className="flex items-center gap-3 px-5 py-3 hover:bg-tcs-gray-50 dark:hover:bg-tcs-gray-700/30 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-tcs-blue/10 dark:bg-tcs-blue/20 flex items-center justify-center shrink-0">
                    <span className="text-tcs-blue text-[10px] font-bold">{t.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">{t.name}</p>
                    <p className="text-[11px] text-tcs-gray-400">DPI {t.dpi} · Avg {t.score}%</p>
                  </div>
                  <span className={`text-[11px] font-bold shrink-0 ${t.sc}`}>{t.stream}</span>
                </div>
              ))}
            </div>

            {/* Distribution bars */}
            <div className="px-5 py-4 bg-tcs-gray-50 dark:bg-tcs-gray-900/40 border-t border-tcs-gray-100 dark:border-tcs-gray-700">
              <p className="text-[10px] font-bold uppercase tracking-widest text-tcs-gray-400 mb-3">Stream Distribution</p>
              <div className="space-y-2">
                {STREAMS_PREVIEW.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className="w-32 text-[11px] text-tcs-gray-600 dark:text-tcs-gray-400 truncate">{s.name}</span>
                    <div className="flex-1 h-1.5 bg-tcs-gray-200 dark:bg-tcs-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full ${s.bar} rounded-full transition-all`} style={{ width: `${s.pct * 3.2}%` }} />
                    </div>
                    <span className="text-[11px] font-semibold text-tcs-gray-500 w-6 text-right">{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action row */}
            <div className="px-5 py-3.5 border-t border-tcs-gray-100 dark:border-tcs-gray-700 flex items-center gap-2">
              <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border border-tcs-gray-300 dark:border-tcs-gray-600 text-tcs-gray-600 dark:text-tcs-gray-400 hover:border-tcs-blue hover:text-tcs-blue transition-colors cursor-pointer">
                <Download size={12} />
                Download Report
              </button>
              <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-tcs-blue text-tcs-white hover:bg-tcs-blue-dark transition-colors cursor-pointer">
                View All
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '4',    label: 'Month Program',     icon: <GraduationCap size={22} /> },
  { value: '8+',   label: 'Core Subjects',     icon: <BookOpen size={22} /> },
  { value: 'API',  label: 'Score Integration', icon: <BarChart3 size={22} /> },
  { value: 'RBAC', label: 'Role-Based Access', icon: <Shield size={22} /> },
];

function StatsStrip() {
  return (
    <div className="border-y border-tcs-gray-200 dark:border-tcs-gray-700 bg-tcs-gray-50 dark:bg-tcs-gray-800/40">
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
        {STATS.map((s) => (
          <div key={s.label} className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-tcs-blue/10 dark:bg-tcs-blue/20 text-tcs-blue">{s.icon}</div>
            <div>
              <p className="text-2xl font-black text-tcs-gray-900 dark:text-tcs-gray-100">{s.value}</p>
              <p className="text-xs text-tcs-gray-500 dark:text-tcs-gray-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Training Journey ─────────────────────────────────────────────────────────

function TrainingJourney() {
  return (
    <section id="how-it-works" className="py-20 px-6 bg-tcs-white dark:bg-tcs-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-[11px] font-bold uppercase tracking-widest text-tcs-blue">Program Structure</span>
          <h2 className="mt-2 text-3xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">How IntelliStream Works</h2>
          <p className="mt-3 text-tcs-gray-500 dark:text-tcs-gray-400 max-w-xl mx-auto text-sm leading-relaxed">
            A data-driven pipeline that turns fresh hires into job-ready specialists across four structured phases.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PHASES.map((p, i) => (
            <div
              key={i}
              className="rounded-2xl border p-6 bg-tcs-white dark:bg-tcs-gray-800 border-tcs-gray-200 dark:border-tcs-gray-700 hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${p.accent}`}>
                {p.icon}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-tcs-gray-400">{p.month}</span>
              <h3 className="mt-1 font-semibold text-tcs-gray-900 dark:text-tcs-gray-100 text-sm">{p.title}</h3>
              <p className="mt-2 text-xs text-tcs-gray-500 dark:text-tcs-gray-400 leading-relaxed">{p.description}</p>
            </div>
          ))}
        </div>

        {/* Post-training note */}
        <div className="mt-8 flex items-center gap-3 p-4 rounded-xl bg-tcs-blue/5 dark:bg-tcs-blue/10 border border-tcs-blue/20">
          <ArrowRight size={18} className="text-tcs-blue shrink-0" />
          <p className="text-sm text-tcs-gray-600 dark:text-tcs-gray-400">
            <span className="font-semibold text-tcs-gray-900 dark:text-tcs-gray-200">After training: </span>
            Allocated trainees are released to RMG or directly to projects — fully trained and stream-ready.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Subjects ─────────────────────────────────────────────────────────────────

function SubjectsSection() {
  return (
    <section id="subjects" className="py-20 px-6 bg-tcs-gray-50 dark:bg-tcs-gray-800/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-[11px] font-bold uppercase tracking-widest text-tcs-blue">Core Curriculum</span>
          <h2 className="mt-2 text-3xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">Subjects Covered</h2>
          <p className="mt-3 text-tcs-gray-500 dark:text-tcs-gray-400 max-w-lg mx-auto text-sm leading-relaxed">
            The first three months build a strong foundation across all key technology domains before stream allocation.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {SUBJECTS.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-3 rounded-xl border p-4 bg-tcs-white dark:bg-tcs-gray-800 border-tcs-gray-200 dark:border-tcs-gray-700 hover:shadow-sm transition-shadow"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.accent}`}>
                {s.icon}
              </div>
              <span className="text-sm font-medium text-tcs-gray-800 dark:text-tcs-gray-200 leading-snug">{s.name}</span>
            </div>
          ))}
        </div>

        <p className="mt-5 text-center text-xs text-tcs-gray-400 dark:text-tcs-gray-600">
          Subject list is extensible — additional modules can be added based on business requirements.
        </p>
      </div>
    </section>
  );
}

// ─── Allocation Engine ────────────────────────────────────────────────────────

function AllocationEngine() {
  return (
    <section className="py-20 px-6 bg-tcs-white dark:bg-tcs-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-[11px] font-bold uppercase tracking-widest text-tcs-blue">Allocation Intelligence</span>
          <h2 className="mt-2 text-3xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">Smart Stream Matching</h2>
          <p className="mt-3 text-tcs-gray-500 dark:text-tcs-gray-400 max-w-md mx-auto text-sm leading-relaxed">
            Every allocation decision is backed by data — not guesswork.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          {ALLOCATION_STEPS.map((s) => (
            <div key={s.num}>
              <p className="text-6xl font-black text-tcs-gray-100 dark:text-tcs-gray-800 leading-none select-none mb-3">
                {s.num}
              </p>
              <div className="p-2.5 rounded-xl inline-flex bg-tcs-blue/10 dark:bg-tcs-blue/20 text-tcs-blue mb-3">
                {s.icon}
              </div>
              <h3 className="font-semibold text-tcs-gray-900 dark:text-tcs-gray-100 mb-2 text-sm">{s.title}</h3>
              <p className="text-sm text-tcs-gray-500 dark:text-tcs-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Feature pills */}
        <div className="mt-14 flex flex-wrap justify-center gap-3">
          {[
            'DPI Score Integration',
            'Average Score Weighting',
            'Configurable Allocation %',
            'Downloadable Excel/CSV',
            'Manual Override Support',
            'Batch-wise Analysis',
          ].map((tag) => (
            <span
              key={tag}
              className="px-4 py-2 rounded-full text-xs font-medium border border-tcs-gray-200 dark:border-tcs-gray-700 text-tcs-gray-600 dark:text-tcs-gray-400 bg-tcs-gray-50 dark:bg-tcs-gray-800"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Streams ──────────────────────────────────────────────────────────────────

function StreamsSection() {
  return (
    <section id="streams" className="py-20 px-6 bg-tcs-gray-50 dark:bg-tcs-gray-800/30">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-14 items-start">
        {/* Left text */}
        <div className="flex-1 lg:pt-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-tcs-blue">Stream Management</span>
          <h2 className="mt-2 text-3xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">Configurable by Business</h2>
          <p className="mt-4 text-tcs-gray-500 dark:text-tcs-gray-400 text-sm leading-relaxed">
            Stream composition isn't static. Business demand shifts — so does allocation. Create mandatory
            streams, define subject weightages, and set intake percentages per batch. Every setting is
            independently controllable.
          </p>
          <ul className="mt-7 space-y-3.5">
            {[
              'Add or archive streams on demand',
              'Set subject mix % per stream',
              'Define mandatory vs optional streams',
              'Control trainee intake % per stream',
              'Map stream subjects with weighted importance',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-tcs-blue mt-0.5 shrink-0" />
                <span className="text-sm text-tcs-gray-600 dark:text-tcs-gray-400">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: stream bars */}
        <div className="flex-1 w-full">
          <div className="rounded-2xl border overflow-hidden bg-tcs-white dark:bg-tcs-gray-800 border-tcs-gray-200 dark:border-tcs-gray-700">
            <div className="px-5 py-4 border-b border-tcs-gray-100 dark:border-tcs-gray-700 flex items-center justify-between">
              <span className="text-sm font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">Stream Allocation</span>
              <span className="text-xs text-tcs-gray-400 dark:text-tcs-gray-500">Business-configurable</span>
            </div>
            <div className="divide-y divide-tcs-gray-100 dark:divide-tcs-gray-700/60">
              {STREAMS_PREVIEW.map((s) => (
                <div key={s.name} className="flex items-center gap-4 px-5 py-4">
                  <div className={`w-2.5 h-2.5 rounded-full ${s.bar} shrink-0`} />
                  <span className="flex-1 text-sm font-medium text-tcs-gray-800 dark:text-tcs-gray-200">{s.name}</span>
                  <div className="w-32 h-2 bg-tcs-gray-100 dark:bg-tcs-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full ${s.bar} rounded-full`} style={{ width: `${s.pct * 3}%` }} />
                  </div>
                  <span className="text-xs font-bold text-tcs-gray-500 dark:text-tcs-gray-400 w-8 text-right">{s.pct}%</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-tcs-gray-50 dark:bg-tcs-gray-900/40 border-t border-tcs-gray-100 dark:border-tcs-gray-700">
              <p className="text-[11px] text-tcs-gray-400 dark:text-tcs-gray-600">
                * Percentages are set per batch based on business intake requirements
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Roles ────────────────────────────────────────────────────────────────────

function RolesSection() {
  return (
    <section id="roles" className="py-20 px-6 bg-tcs-white dark:bg-tcs-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-[11px] font-bold uppercase tracking-widest text-tcs-blue">Access Control</span>
          <h2 className="mt-2 text-3xl font-bold text-tcs-gray-900 dark:text-tcs-gray-100">Role-Based Permissions</h2>
          <p className="mt-3 text-tcs-gray-500 dark:text-tcs-gray-400 max-w-lg mx-auto text-sm leading-relaxed">
            Two purpose-built roles ensure each stakeholder can act within their scope — and no further.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {ROLES.map((r) => (
            <div
              key={r.key}
              className="rounded-2xl border p-7 bg-tcs-white dark:bg-tcs-gray-800 border-tcs-gray-200 dark:border-tcs-gray-700"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${r.accent}`}>
                  {r.icon}
                </div>
                <div>
                  <p className="font-bold text-tcs-gray-900 dark:text-tcs-gray-100">{r.title}</p>
                  <p className="text-xs text-tcs-gray-500 dark:text-tcs-gray-400">{r.subtitle}</p>
                </div>
              </div>
              <ul className="space-y-2.5">
                {r.can.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-tcs-gray-600 dark:text-tcs-gray-400">{item}</span>
                  </li>
                ))}
                {r.cannot.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 opacity-50 mt-3">
                    <div className="w-3.5 h-3.5 mt-0.5 shrink-0 rounded-full border-2 border-tcs-gray-300" />
                    <span className="text-sm text-tcs-gray-500">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="py-20 px-6 bg-tcs-blue">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-tcs-white leading-tight">
          Ready to streamline<br />your fresher training?
        </h2>
        <p className="mt-4 text-tcs-blue-light leading-relaxed text-sm">
          Start managing training batches, configuring streams, and making data-driven
          allocation decisions today.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 mt-8 px-8 py-3.5 rounded-xl text-sm font-semibold bg-tcs-white text-tcs-blue hover:bg-tcs-gray-100 transition-colors shadow-sm"
        >
          Sign in to IntelliStream
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer className="py-8 px-6 bg-tcs-gray-900">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-tcs-blue flex items-center justify-center">
            <span className="text-tcs-white text-[10px] font-bold">IS</span>
          </div>
          <span className="text-sm font-semibold text-tcs-gray-500">IntelliStream</span>
        </div>
        <p className="text-xs text-tcs-gray-600">
          © {new Date().getFullYear()} IntelliStream — Internal MNC Fresher Training Management Platform.
        </p>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-tcs-white dark:bg-tcs-gray-900">
      <Navbar />
      <main>
        <Hero />
        <StatsStrip />
        <TrainingJourney />
        <SubjectsSection />
        <AllocationEngine />
        <StreamsSection />
        <RolesSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
