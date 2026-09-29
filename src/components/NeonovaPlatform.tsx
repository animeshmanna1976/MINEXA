import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getCurrentUser,
  loginUser,
  registerUser,
  getMines,
} from '@/lib/api';

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  Download,
  FileBarChart,
  FileText,
  Filter,
  Gauge,
  HardHat,
  Laptop,
  Layers3,
  LineChart,
  LogOut,
  Map,
  MapPin,
  Menu,
  MessageSquareWarning,
  Minus,
  MonitorCog,
  MoreHorizontal,
  MousePointer2,
  Plus,
  RadioTower,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Target,
  Thermometer,
  Truck,
  Users,
  Wrench,
  X,
  Zap,
  HeartPulse,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import heroBg from '@/assets/hero-bg.jpg';
import LeaveManagementForm from '@/components/LeaveManagementForm';
import WorkerHealth from './WorkerHealth';
import ApplicationStatus from './ApplicationStatus';
import AdminApprovalCenter from './AdminApprovalCenter';
import ManagerApprovalCenter from './ManagerApprovalCenter';
import LeaveApprovalCenter from './LeaveApprovalCenter';
import SafetyVerificationCenter from './SafetyVerificationCenter';
import ChangePassword from './ChangePassword';
import EquipmentManagement from './EquipmentManagement';
import ShiftManagement from './ShiftManagement';
import {
  getMineIncidents,
  createIncident,
  updateIncidentStatus,
  resolveIncident,
  closeIncident,
  getManagerDashboard,
  getWorkerDashboard,
  getMineEquipment,
  getMineWorkers,
  getAllWorkers,
  getAnalyticsSummary,
  getAdminAnalyticsSummary,
  getReportsSummary,
  getMineAttendance,
  getSafetyDashboard,
  getAdminDashboard,
  getAdminReportsSummary,
  checkInWorker,
  checkOutWorker,
  type WorkerDashboardData,
  type IncidentApi,
  type ManagerDashboardData,
  type EquipmentApi,
  type WorkerApi,
  type AnalyticsSummary,
  type ReportsSummary,
  type AttendanceApi,
  type SafetyDashboardData,
  type AdminDashboardData,
  type AdminAnalyticsSummary,
  type AdminReportsSummary,
} from '@/lib/api';

type Role = 'admin' | 'manager' | 'safety' | 'worker';
type View = 'dashboard' | 'mine' | 'safety' | 'workers' | 'equipment' | 'shifts' | 'analytics' | 'reports' | 'admin' | 'leave' | 'settings' |'health'| 'safety-verification'|'worker-approvals'| 'leave-approvals'|'application-status';
type AuthUser = {
  id: number;
  name: string;
  email: string | null;
  role:
    | 'PLATFORM_ADMIN'
    | 'MINE_MANAGER'
    | 'SAFETY_OFFICER'
    | 'FIELD_WORKER';
  workerId: number | null;
  loginId?: string | null;
  mustChangePassword?: boolean;
};

type WorkerEmergencyType =
  | 'MEDICAL'
  | 'ACCIDENT'
  | 'FIRE'
  | 'GAS_LEAK'
  | 'GROUND_COLLAPSE'
  | 'EQUIPMENT_FAILURE'
  | 'TRAPPED_WORKER'
  | 'UNSAFE_AREA'
  | 'SECURITY'
  | 'OTHER';

const MINEXA_API_BASE = 'http://localhost:3000/api/v1';

function getWorkerAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('minexa_token');

  return {
    'Content-Type': 'application/json',
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
  };
}

async function getWorkerRiskScore(workerId: number): Promise<number | null> {
  try {
    const response = await fetch(
      `${MINEXA_API_BASE}/risk/worker/${workerId}`,
      {
        method: 'GET',
        headers: getWorkerAuthHeaders(),
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const score = Number(data?.assessment?.risk_score);

    return Number.isFinite(score) ? score : null;
  } catch (error) {
    console.error('Failed to load worker risk:', error);
    return null;
  }
}

async function sendWorkerEmergency(payload: {
  emergencyType: WorkerEmergencyType;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
}) {
  const response = await fetch(
    `${MINEXA_API_BASE}/emergency`,
    {
      method: 'POST',
      headers: getWorkerAuthHeaders(),
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || 'Failed to send emergency alert',
    );
  }

  return data?.emergency ?? data;
}
const backendRoleToAppRole: Record<
  string,
  Role
> = {
  PLATFORM_ADMIN: 'admin',
  MINE_MANAGER: 'manager',
  SAFETY_OFFICER: 'safety',
  FIELD_WORKER: 'worker',
};

const mapBackendRoleToAppRole = (
  backendRole: string,
): Role => {
  const appRole =
    backendRoleToAppRole[backendRole];

  if (!appRole) {
    throw new Error(
      `Unsupported account role: ${backendRole}`,
    );
  }

  return appRole;
};
const roleMeta: Record<Role, { label: string; description: string; icon: React.ElementType; color: string; defaultView: View }> = {
  admin: { label: 'Platform Admin', description: 'System governance & access', icon: MonitorCog, color: 'text-neonova-blue', defaultView: 'dashboard' },
  manager: { label: 'Mine Manager', description: 'Operations command center', icon: Building2, color: 'text-safety-success', defaultView: 'dashboard' },
  safety: { label: 'Safety Officer', description: 'Incident response & compliance', icon: ShieldCheck, color: 'text-safety-warning', defaultView: 'dashboard' },
  worker: { label: 'Field Worker', description: 'Personal safety & tasks', icon: HardHat, color: 'text-safety-info', defaultView: 'dashboard' },
};

const navItems: { id: View; label: string; icon: React.ElementType; section?: string }[] = [
  { id: 'dashboard', label: 'Command center', icon: Command, section: 'Workspace' },
  { id: 'mine', label: 'Live mine map', icon: Map },
  { id: 'safety', label: 'Safety & alerts', icon: ShieldCheck },
  { id: 'workers', label: 'Workforce', icon: Users },
  { id: 'shifts', label: 'Shift management', icon: Clock3, section: 'Workforce' },
  {
  id: 'leave-approvals',
  label: 'Leave requests',
  icon: CalendarDays,
  section: 'Workforce',
},
  {
  id: 'application-status',
  label: 'Application status',
  icon: ShieldCheck,
  section: 'Worker services',
},

{
  id: 'worker-approvals',
  label: 'Worker approvals',
  icon: UserCheck,
  section: 'Workforce',
},
{
  id: 'safety-verification',
  label: 'Safety verification',
  icon: ShieldCheck,
  section: 'Safety',
},
  { id: 'equipment', label: 'Equipment', icon: Truck },
  { id: 'analytics', label: 'Analytics', icon: LineChart, section: 'Insights' },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'admin', label: 'Administration', icon: Settings, section: 'System' },
  { id: 'leave', label: 'Leave management', icon: CalendarDays, section: 'My work' },
  {
  id: 'health',
  label: 'Health & Fitness',
  icon: HeartPulse,
  section: 'Worker services',
},

];

const roleAccess: Record<Role, View[]> = {
  admin: ['dashboard', 'workers', 'analytics', 'reports', 'admin', 'settings'],
  manager: ['dashboard', 'mine', 'safety', 'workers', 'shifts', 'equipment', 'analytics', 'reports', 'settings','worker-approvals','leave-approvals',],
  safety: [
  'dashboard',
  'mine',
  'safety',
  'workers',
  'equipment',
  'analytics',
  'reports',
  'settings',
  'safety-verification'
],
  worker: ['dashboard', 'leave', 'settings','health','application-status',],
};

const alerts = [
  { id: 1, severity: 'critical', title: 'Gas concentration above threshold', location: 'Zone B · Tunnel 03', time: '2 min ago', reading: '4.8% CH₄', score: 92, workers: 12, action: 'Evacuate Zone B and dispatch response team.' },
  { id: 2, severity: 'warning', title: 'High temperature detected', location: 'Crusher Bay · Sensor T-18', time: '18 min ago', reading: '68°C', score: 64, workers: 4, action: 'Inspect cooling system within 15 minutes.' },
  { id: 3, severity: 'warning', title: 'Worker inactive for 22 minutes', location: 'North Ramp · John D.', time: '31 min ago', reading: 'No motion', score: 58, workers: 1, action: 'Contact worker and verify location.' },
  { id: 4, severity: 'info', title: 'High vibration detected', location: 'Haul Road · Truck TR-08', time: '46 min ago', reading: '7.2 mm/s', score: 38, workers: 0, action: 'Schedule equipment inspection before next shift.' },
];

const workers = [
  { id: 'NW-0428', name: 'Arjun Mehta', role: 'Drill Operator', zone: 'Zone A', status: 'On site', lastSeen: 'Just now', score: 98, shift: 'A · 06:00–14:00' },
  { id: 'NW-0391', name: 'Priya Sharma', role: 'Safety Technician', zone: 'Zone B', status: 'On site', lastSeen: '2 min ago', score: 96, shift: 'A · 06:00–14:00' },
  { id: 'NW-0512', name: 'John Dsouza', role: 'Haul Truck Driver', zone: 'North Ramp', status: 'Review', lastSeen: '31 min ago', score: 74, shift: 'A · 06:00–14:00' },
  { id: 'NW-0286', name: 'Kavita Rao', role: 'Geologist', zone: 'Zone C', status: 'On site', lastSeen: '8 min ago', score: 99, shift: 'B · 14:00–22:00' },
  { id: 'NW-0447', name: 'Ravi Kumar', role: 'Maintenance Lead', zone: 'Workshop', status: 'On site', lastSeen: '12 min ago', score: 91, shift: 'A · 06:00–14:00' },
  { id: 'NW-0634', name: 'Neha Verma', role: 'Blasting Supervisor', zone: 'Zone D', status: 'Off site', lastSeen: 'Yesterday', score: 93, shift: 'C · 22:00–06:00' },
];

const equipment = [
  { id: 'TR-08', name: 'Caterpillar 777G', type: 'Haul truck', zone: 'North Ramp', status: 'Operational', health: 94, maintenance: '12 Jun 2025', temp: '71°C', vibration: '7.2 mm/s' },
  { id: 'EX-14', name: 'Komatsu PC490', type: 'Excavator', zone: 'Zone A', status: 'Operational', health: 88, maintenance: '02 Jun 2025', temp: '64°C', vibration: '3.8 mm/s' },
  { id: 'DR-03', name: 'Sandvik DL422i', type: 'Drill rig', zone: 'Zone B', status: 'Maintenance', health: 62, maintenance: 'In progress', temp: '—', vibration: '—' },
  { id: 'LD-07', name: 'Volvo L220H', type: 'Wheel loader', zone: 'Crusher Bay', status: 'Operational', health: 91, maintenance: '28 May 2025', temp: '68°C', vibration: '2.4 mm/s' },
  { id: 'WT-02', name: 'Water Cart 777', type: 'Support vehicle', zone: 'Zone C', status: 'Out of service', health: 24, maintenance: 'Overdue', temp: '—', vibration: '—' },
];

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

function LogoMark({ light = false }: { light?: boolean }) {
  return <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-[0_0_22px_hsl(var(--primary)/.25)]"><Zap className="h-5 w-5 fill-current" /></div><div><div className={cx('font-display text-lg font-semibold tracking-[0.14em]', light ? 'text-foreground' : 'text-foreground')}>NEONOVA</div><div className="text-[9px] font-medium uppercase tracking-[0.19em] text-muted-foreground">Mine intelligence</div></div></div>;
}

function StatusDot({ status }: { status: 'success' | 'warning' | 'danger' | 'info' }) {
  return <span className={cx('inline-block h-2 w-2 rounded-full', `bg-safety-${status}`)} />;
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  return <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', tone === 'neutral' ? 'border-border bg-secondary text-muted-foreground' : `border-safety-${tone}/25 bg-safety-${tone}/10 text-safety-${tone}`)}>{children}</span>;
}

function MetricCard({ label, value, change, trend, icon: Icon, tone = 'primary' }: { label: string; value: string; change: string; trend: 'up' | 'down' | 'flat'; icon: React.ElementType; tone?: 'primary' | 'success' | 'warning' | 'info' | 'danger' }) {
  const toneClass = tone === 'primary' ? 'text-primary' : `text-safety-${tone}`;
  return <div className="ops-card group p-5 transition-transform hover:-translate-y-0.5">
    <div className="mb-5 flex items-start justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Icon className={cx('h-[18px] w-[18px]', toneClass)} /></span><span className={cx('flex items-center gap-1 text-[11px] font-semibold', trend === 'down' ? 'text-safety-danger' : trend === 'flat' ? 'text-muted-foreground' : 'text-safety-success')}>{trend === 'up' ? <ArrowUpRight className="h-3.5 w-3.5" /> : trend === 'down' ? <ArrowDownRight className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}{change}</span></div>
    <p className="text-xs font-medium text-muted-foreground">{label}</p><div className="mt-1 flex items-baseline gap-2"><p className="font-display text-2xl font-semibold tracking-tight text-foreground">{value}</p></div>
  </div>;
}

function PanelTitle({ icon: Icon, eyebrow, title, action }: { icon: React.ElementType; eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><div>{eyebrow && <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>}<h2 className="font-display text-base font-semibold text-foreground">{title}</h2></div></div>{action}</div>;
}

function Landing({ onExplore, onDemo }: { onExplore: () => void; onDemo: () => void }) {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="absolute inset-x-0 top-0 z-20"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 lg:px-10"><LogoMark light /><nav className="hidden items-center gap-8 text-xs font-medium text-muted-foreground lg:flex"><a href="#platform" className="transition-colors hover:text-foreground">Platform</a><a href="#signals" className="transition-colors hover:text-foreground">Operations</a><a href="#enterprise" className="transition-colors hover:text-foreground">Enterprise</a></nav><div className="flex items-center gap-3"><Button variant="ghost" size="sm" onClick={onExplore} className="hidden text-muted-foreground hover:text-foreground sm:inline-flex">Sign in</Button><Button size="sm" onClick={onExplore}>Explore platform <ChevronRight className="h-4 w-4" /></Button></div></div></header>
    <main>
      <section className="relative min-h-[720px] overflow-hidden border-b border-border/60 lg:min-h-[780px]"><img src={heroBg} alt="Open pit mine operations" className="absolute inset-0 h-full w-full object-cover object-center opacity-35" /><div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--background))_0%,hsl(var(--background)/.92)_38%,hsl(var(--background)/.38)_100%)]" /><div className="relative mx-auto grid min-h-[720px] max-w-[1440px] items-center px-5 pb-12 pt-28 lg:min-h-[780px] lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:px-10"><div className="max-w-2xl"><Badge tone="success"><span className="live-pulse"><StatusDot status="success" /></span> Platform telemetry live</Badge><h1 className="mt-7 max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-foreground sm:text-6xl lg:text-[72px]">Intelligent mine safety <span className="text-primary">& operations.</span></h1><p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Real-time monitoring, AI-powered risk prediction, and faster response for safer mining.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><Button size="lg" onClick={onExplore}>Explore platform <ArrowUpRight className="h-4 w-4" /></Button><Button size="lg" variant="outline" onClick={onDemo}><MousePointer2 className="h-4 w-4" /> Watch demo</Button></div><div className="mt-12 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-border/60 pt-5 text-[11px] font-medium text-muted-foreground"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> ISO-ready workflows</span><span className="flex items-center gap-2"><RadioTower className="h-4 w-4 text-primary" /> 24/7 telemetry</span><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Role-based access</span></div></div><div className="relative mt-10 lg:mt-24"><div className="absolute -inset-5 rounded-3xl border border-primary/10 bg-primary/5 blur-2xl" /><div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface/95 shadow-2xl backdrop-blur-md"><div className="flex items-center justify-between border-b border-border/60 px-4 py-3"><div className="flex items-center gap-2 text-[11px] font-semibold"><span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" /> Live operations snapshot</div><span className="text-[10px] text-muted-foreground">12 Jun 2025 · 18:42:08</span></div><div className="grid grid-cols-[1.15fr_.85fr] gap-px bg-border/60"><div className="relative min-h-[280px] overflow-hidden bg-[#0d1920] p-4"><div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(hsl(var(--primary)/.09) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/.09) 1px, transparent 1px)', backgroundSize: '34px 34px' }} /><div className="relative flex items-center justify-between"><span className="rounded bg-background/80 px-2 py-1 text-[10px] font-semibold text-foreground">Pit 04 · Active view</span><Badge tone="success"><StatusDot status="success" /> Stable</Badge></div><div className="relative mt-5 h-48"><svg viewBox="0 0 500 220" className="h-full w-full"><path d="M20 174 L105 126 L145 139 L204 83 L265 111 L318 52 L400 87 L475 30" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" opacity=".9" /><path d="M20 193 L109 153 L158 166 L210 111 L270 136 L321 78 L406 110 L475 57" fill="none" stroke="hsl(var(--secondary))" strokeWidth="1.5" opacity=".5" /><path d="M62 182 L121 143 L179 158 L233 103 L291 127 L343 70 L427 102" fill="none" stroke="hsl(var(--primary)/.25)" strokeWidth="22" /><circle cx="204" cy="83" r="6" fill="hsl(var(--primary))" /><circle cx="318" cy="52" r="6" fill="hsl(var(--danger))" /><circle cx="400" cy="87" r="6" fill="hsl(var(--warning))" /><circle cx="145" cy="139" r="5" fill="hsl(var(--secondary))" /><circle cx="204" cy="83" r="12" fill="none" stroke="hsl(var(--primary)/.35)" /></svg></div><div className="relative flex items-center gap-4 text-[9px] text-muted-foreground"><span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-primary" /> sensors 86</span><span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-secondary" /> workers 1,248</span><span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-safety-danger" /> critical 01</span></div></div><div className="bg-surface p-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Safety index</p><div className="mt-4 flex items-center gap-3"><div className="relative flex h-20 w-20 items-center justify-center rounded-full" style={{ background: 'conic-gradient(hsl(var(--primary)) 0 94.2%, hsl(var(--secondary)) 94.2% 100%)' }}><div className="flex h-[66px] w-[66px] items-center justify-center rounded-full bg-surface"><span className="font-display text-lg font-semibold">94.2</span></div></div><div><p className="text-xs font-semibold text-primary">Excellent</p><p className="mt-1 text-[10px] text-muted-foreground">+2.4% vs last week</p></div></div><div className="mt-8 space-y-3"><div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Equipment uptime</span><b>93.4%</b></div><div className="h-1.5 rounded-full bg-secondary"><div className="h-full w-[93%] rounded-full bg-primary" /></div><div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Sensors online</span><b>98.7%</b></div><div className="h-1.5 rounded-full bg-secondary"><div className="h-full w-[98%] rounded-full bg-secondary" /></div></div></div></div></div></div></div></section>
      <section id="signals" className="border-b border-border/60 bg-surface/35"><div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-x divide-border/60 px-5 lg:grid-cols-4 lg:px-10"><div className="px-4 py-7 first:pl-0"><p className="font-display text-2xl font-semibold">94.2%</p><p className="mt-1 text-[11px] text-muted-foreground">Overall safety score</p></div><div className="px-4 py-7 lg:px-8"><p className="font-display text-2xl font-semibold">1,248</p><p className="mt-1 text-[11px] text-muted-foreground">Workers on-site</p></div><div className="px-4 py-7 lg:px-8"><p className="font-display text-2xl font-semibold">86<span className="text-muted-foreground">/92</span></p><p className="mt-1 text-[11px] text-muted-foreground">Equipment operational</p></div><div className="px-4 py-7 lg:pl-8"><p className="font-display text-2xl font-semibold text-primary">98.7%</p><p className="mt-1 text-[11px] text-muted-foreground">Sensors online</p></div></div></section>
      <section id="platform" className="mx-auto max-w-[1440px] px-5 py-24 lg:px-10"><div className="max-w-xl"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">One operational truth</p><h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">From first signal to safer decisions.</h2><p className="mt-4 leading-7 text-muted-foreground">NEONOVA connects every layer of mine operations so teams can move from monitor to respond with clarity.</p></div><div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 sm:grid-cols-2 lg:grid-cols-4">{[['01', 'Predict risk', 'See risk patterns before they become incidents.', Sparkles, 'text-primary'], ['02', 'Monitor everything', 'One clear view across people, places, and machines.', Activity, 'text-secondary'], ['03', 'Respond faster', 'Route the right action to the right team, instantly.', Zap, 'text-safety-warning'], ['04', 'Improve productivity', 'Turn operational data into measurable momentum.', Target, 'text-safety-success']].map(([number, title, copy, Icon, color]) => <div key={number as string} className="bg-surface p-7 transition-colors hover:bg-surface-secondary"><span className="font-mono text-xs text-muted-foreground">/{number as string}</span><div className={cx('mt-10', color as string)}>{React.createElement(Icon as React.ElementType, { className: 'h-6 w-6' })}</div><h3 className="mt-5 font-display text-lg font-semibold">{title as string}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{copy as string}</p></div>)}</div></section>
      <section id="enterprise" className="border-t border-border/60 bg-surface/35"><div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-8 px-5 py-20 lg:flex-row lg:items-center lg:px-10"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">Built for the shift ahead</p><h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight">Make every shift safer, smarter, and more accountable.</h2></div><Button size="lg" onClick={onExplore}>Enter the command center <ArrowUpRight className="h-4 w-4" /></Button></div></section>
    </main><footer className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-10"><LogoMark /><span>© 2025 NEONOVA Technologies · Intelligent mine operations</span></footer>
  </div>;
}

function Login({
  onLogin,
  onSignup,
}: {
  onLogin: (role: Role, user: AuthUser) => void;
  onSignup: () => void;
}) {
const [identifier, setIdentifier] =
  useState('');
const [password, setPassword] = useState('');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const { toast } = useToast();

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError('');

    if (!identifier.trim() || !password) {
      setError(
        'Please enter your User ID or Email and password.',
      );
      return;
    }

    try {
      setLoading(true);

      const data = await loginUser(
        identifier.trim(),
        password,
      );

      let appRole: Role;

switch (data.user.role) {
  case 'PLATFORM_ADMIN':
    appRole = 'admin';
    break;

  case 'MINE_MANAGER':
    appRole = 'manager';
    break;

  case 'SAFETY_OFFICER':
    appRole = 'safety';
    break;

  case 'FIELD_WORKER':
    appRole = 'worker';
    break;

  default:
    throw new Error(
      `Unsupported account role: ${data.user.role}`,
    );
}

      localStorage.setItem(
        'minexa_token',
        data.token,
      );

      localStorage.setItem(
        'minexa_user',
        JSON.stringify(data.user),
      );

onLogin(appRole, {
  id: data.user.id,
  name: data.user.name,
  email: data.user.email,
  role: data.user.role,
  workerId: data.user.workerId,
  loginId: data.user.loginId,
  mustChangePassword:
    data.user.mustChangePassword,
});
    } catch (err) {
      console.error(
        'Login failed:',
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Login failed. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

return (
  <div className="grid min-h-screen bg-background lg:grid-cols-[.9fr_1.1fr]">
    <div className="relative hidden overflow-hidden lg:block">
      <img
        src={heroBg}
        alt="Mine operations at dusk"
        className="absolute inset-0 h-full w-full object-cover opacity-50"
      />

      <div className="absolute inset-0 bg-[linear-gradient(145deg,hsl(var(--background)/.35),hsl(var(--background)))]" />

      <div className="relative flex h-full flex-col justify-between p-10">
        <LogoMark />

        <div className="max-w-md">
          <Badge tone="success">
            <StatusDot status="success" />
            Secure operations access
          </Badge>

          <h1 className="mt-6 font-display text-4xl font-semibold leading-tight">
            Every signal matters when safety is on the line.
          </h1>

          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            A shared operational view for the people who
            monitor, detect, predict, alert, respond, and
            analyze.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Protected by role-based access controls
        </p>
      </div>
    </div>

    <div className="flex min-h-screen items-center justify-center p-5 sm:p-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 lg:hidden">
          <LogoMark />
        </div>

        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">
          Welcome back
        </p>

        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          Sign in to NEONOVA
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          Use your work credentials to access your mine.
        </p>

        {error && (
          <div className="mt-6 rounded-lg border border-safety-danger/30 bg-safety-danger/10 p-3">
            <p className="text-xs leading-5 text-safety-danger">
              {error}
            </p>
          </div>
        )}

        <form
          className="mt-8 space-y-5"
          onSubmit={handleSubmit}
        >
          <div>
            <label
              htmlFor="identifier"
              className="mb-2 block text-xs font-semibold text-foreground"
            >
              User ID or Email
            </label>

            <Input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="MW-TEST02 or you@minexa.com"
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-xs font-semibold text-foreground"
              >
                Password
              </label>

              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-[11px] text-primary"
                disabled={loading}
                onClick={() =>
                  toast({
                    title: 'Password reset requested',
                    description:
                      'A secure reset link would be sent to your work email.',
                  })
                }
              >
                Forgot password?
              </Button>
            </div>

            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="remember"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-border bg-secondary accent-primary"
              disabled={loading}
            />

            <label
              htmlFor="remember"
              className="text-xs text-muted-foreground"
            >
              Keep me signed in
            </label>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading
              ? 'Signing in...'
              : 'Continue to workspace'}

            {!loading && (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </form>

        <div className="my-7 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />

          <span className="whitespace-nowrap">
            Or continue with
          </span>

          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() =>
              toast({
                title: 'Google sign in',
                description:
                  'SSO connection is ready for your organization.',
              })
            }
          >
            <span className="font-display text-sm font-bold">
              G
            </span>

            Google
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() =>
              toast({
                title: 'Microsoft sign in',
                description:
                  'SSO connection is ready for your organization.',
              })
            }
          >
            <Laptop className="h-4 w-4" />

            Microsoft
          </Button>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          New to NEONOVA?{' '}

          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs font-medium text-primary"
            onClick={onSignup}
          >
            Create account
          </Button>
        </p>
      </div>
    </div>
  </div>
);
}
function RoleSelect({ onSelect, onBack }: { onSelect: (role: Role) => void; onBack: () => void }) {
  return <div className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-10"><div className="mx-auto max-w-5xl"><div className="flex items-center justify-between"><LogoMark /><Button variant="ghost" size="sm" onClick={onBack}><ArrowDownRight className="h-4 w-4 rotate-45" /> Back</Button></div><div className="mx-auto mt-20 max-w-2xl text-center"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">Workspace access</p><h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">Choose your operating view.</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">Your role shapes the signals, workflows, and decisions surfaced in the command center.</p></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{(Object.keys(roleMeta) as Role[]).map((role) => { const meta = roleMeta[role]; const Icon = meta.icon; return <Button key={role} variant="outline" className="group flex h-auto min-h-[220px] flex-col items-start justify-between rounded-2xl p-5 text-left hover:border-primary/60 hover:bg-surface" onClick={() => onSelect(role)}><div className="flex w-full items-start justify-between"><span className={cx('flex h-11 w-11 items-center justify-center rounded-xl bg-secondary', meta.color)}><Icon className="h-5 w-5" /></span><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" /></div><span><span className="block font-display text-lg font-semibold text-foreground">{meta.label}</span><span className="mt-2 block text-xs leading-5 text-muted-foreground">{meta.description}</span></span></Button>; })}</div><p className="mt-12 text-center text-xs text-muted-foreground">Need a different access level? <span className="text-primary">Contact your site administrator.</span></p></div></div>;
}

function LiveMineMapView({
  toast,
  onIncidentSelect,
}: {
  toast: (args: {
    title: string;
    description: string;
  }) => void;
  onIncidentSelect: (incident: IncidentApi) => void;
}) {
  const [mineEquipment, setMineEquipment] = useState<EquipmentApi[]>([]);
  const [mineIncidents, setMineIncidents] = useState<IncidentApi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMapData = async () => {
      try {
        setLoading(true);

        const [equipmentData, incidentData] = await Promise.all([
          getMineEquipment(),
          getMineIncidents(),
        ]);

        setMineEquipment(equipmentData);
        setMineIncidents(incidentData);
      } catch (error) {
        console.error('Failed to load mine map data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMapData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-xl border border-border/70 bg-[#0d1920]">
        <p className="text-sm text-muted-foreground">
          Loading live mine data...
        </p>
      </div>
    );
  }

  return (
    <MapSurface
      equipment={mineEquipment}
      incidents={mineIncidents}
      onIncidentSelect={onIncidentSelect}
      onAlert={() =>
        toast({
          title: 'Map filters opened',
          description:
            'Filter by sensors, workers, equipment, or risk level.',
        })
      }
    />
  );
}

function MapSurface({
  compact = false,
  onAlert,
  onIncidentSelect,
  equipment = [],
  incidents = [],
}: {
  compact?: boolean;
  onAlert?: () => void;
  onIncidentSelect?: (incident: IncidentApi) => void;
  equipment?: EquipmentApi[];
  incidents?: IncidentApi[];
}) {
  const [zoom, setZoom] = useState(1);
  const [selectedPoint, setSelectedPoint] = useState<
  (typeof mapPoints)[number] | null
>(null);
  const mapPoints = [
   ...equipment
   .filter((item) => item.location)
   .map((item) => {
    const { x, y } = getMapCoordinates(item.location);

    return {
      id: `equipment-${item.id}`,
      x,
      y,
      type: 'equipment' as const,
      status: item.status,
      name: item.name,
      location: item.location!,
    };
  }),

...incidents
   .filter((item) => item.location)
   .map((item) => {
    const { x, y } = getMapCoordinates(item.location);

    return {
      id: `incident-${item.id}`,
      x,
      y,
      type: 'incident' as const,
      status: item.severity,
      name: item.title,
      location: item.location!,
    };
  }),
];
  return <div className={cx('relative overflow-hidden rounded-xl border border-border/70 bg-[#0d1920]', compact ? 'h-[260px]' : 'min-h-[520px]')}><div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(hsl(var(--primary)/.08) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/.08) 1px, transparent 1px)', backgroundSize: '38px 38px' }} /><div className="absolute inset-0 flex items-center justify-center overflow-hidden"><svg viewBox="0 0 900 500" className="h-full w-full transition-transform duration-300" style={{ transform: `scale(${zoom})` }}><path d="M24 404 L160 340 L245 355 L320 274 L432 313 L516 214 L634 257 L753 145 L878 179" fill="none" stroke="hsl(var(--primary)/.15)" strokeWidth="70" /><path d="M24 404 L160 340 L245 355 L320 274 L432 313 L516 214 L634 257 L753 145 L878 179" fill="none" stroke="hsl(var(--primary)/.7)" strokeWidth="2" /><path d="M46 460 L165 388 L274 402 L350 330 L456 361 L548 265 L662 302 L778 204 L894 235" fill="none" stroke="hsl(var(--secondary)/.4)" strokeWidth="2" /><path d="M92 323 L201 273 L290 291 L365 210 L472 243 L565 150 L682 192 L795 84" fill="none" stroke="hsl(var(--warning)/.38)" strokeWidth="2" strokeDasharray="7 7" /><path d="M20 128 L180 96 L260 130 L350 89 L457 121 L552 62 L681 110 L875 43" fill="none" stroke="hsl(var(--danger)/.25)" strokeWidth="2" /><text x="91" y="375" fill="hsl(var(--muted-foreground))" fontSize="14" fontWeight="600">ZONE A</text><text x="368" y="248" fill="hsl(var(--muted-foreground))" fontSize="14" fontWeight="600">ZONE B</text><text x="610" y="286" fill="hsl(var(--muted-foreground))" fontSize="14" fontWeight="600">ZONE C</text><text x="746" y="110" fill="hsl(var(--muted-foreground))" fontSize="14" fontWeight="600">ZONE D</text>
{mapPoints.map((point) => {
  const isIncident = point.type === 'incident';

  const isCritical = isIncident
    ? point.status === 'CRITICAL'
    : point.status === 'OUT_OF_SERVICE';

  const isWarning = isIncident
    ? point.status === 'HIGH'
    : point.status === 'MAINTENANCE';

  const fillColor = isCritical
    ? '#ff5c6c'
    : isWarning
    ? '#ffb52e'
    : '#20e887';

  const glowColor = isCritical
    ? 'rgba(255, 92, 108, 0.18)'
    : isWarning
    ? 'rgba(255, 181, 46, 0.18)'
    : 'rgba(32, 232, 135, 0.18)';

  return (
    <g
      key={point.id}
      className="cursor-pointer"
      onClick={() => setSelectedPoint(point)}
    >
      <circle
        cx={point.x}
        cy={point.y}
        r="18"
        fill={glowColor}
      />

      <circle
        cx={point.x}
        cy={point.y}
        r="7"
        fill={fillColor}
        stroke="#0d1920"
        strokeWidth="2"
      />

      <circle
        cx={point.x}
        cy={point.y}
        r="2.5"
        fill="#0d1920"
      />
    </g>
  );
})}
  </svg></div><div className="absolute inset-x-4 top-4 flex items-start justify-between"><div className="rounded-lg border border-border/70 bg-background/80 px-3 py-2 backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Live mine map</p><p className="mt-1 text-xs text-muted-foreground">Pit 04 · 2.4 km² monitored</p></div><div className="flex gap-1.5"><Button variant="outline" size="icon" className="h-8 w-8 bg-background/80" onClick={() => setZoom(Math.min(1.5, zoom + .1))} aria-label="Zoom in"><Plus className="h-3.5 w-3.5" /></Button><Button variant="outline" size="icon" className="h-8 w-8 bg-background/80" onClick={() => setZoom(Math.max(.8, zoom - .1))} aria-label="Zoom out"><Minus className="h-3.5 w-3.5" /></Button></div></div>{!compact && <><div className="absolute bottom-4 left-4 flex flex-wrap gap-3 rounded-lg border border-border/70 bg-background/85 px-3 py-2 text-[10px] text-muted-foreground backdrop-blur"><span className="flex items-center gap-1.5"><StatusDot status="success" /> Stable</span><span className="flex items-center gap-1.5"><StatusDot status="warning" /> Monitor</span><span className="flex items-center gap-1.5"><StatusDot status="danger" /> Critical</span><span className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-secondary" /> Worker / asset</span></div><Button variant="outline" size="sm" className="absolute bottom-4 right-4 bg-background/85" onClick={onAlert}><SlidersHorizontal className="h-3.5 w-3.5" /> Filters</Button></>}{selectedPoint && (
  <div className="absolute right-4 top-4 z-20 w-[280px] rounded-xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
          {selectedPoint.type === 'incident'
            ? 'Incident'
            : 'Equipment'}
        </p>

        <h3 className="mt-1 text-sm font-semibold text-foreground">
          {selectedPoint.name}
        </h3>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setSelectedPoint(null)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>

    <div className="mt-4 space-y-3 text-xs">
      <div>
        <p className="text-muted-foreground">Location</p>
        <p className="mt-1 font-medium text-foreground">
          {selectedPoint.location}
        </p>
      </div>

      <div>
        <p className="text-muted-foreground">
          {selectedPoint.type === 'incident'
            ? 'Severity'
            : 'Status'}
        </p>

        <p className="mt-1 font-medium text-foreground">
          {selectedPoint.status}
        </p>
      </div>
    </div>

    {selectedPoint.type === 'incident' ? (
      <Button
        className="mt-4 w-full"
        size="sm"
        onClick={() => {
  const incident = incidents.find(
    (item) => item.id === Number(selectedPoint.id.replace('incident-', ''))
  );

  setSelectedPoint(null);

  if (incident) {
    onIncidentSelect?.(incident);
  }
}}
      >
        Open incident
      </Button>
    ) : (
      <Button
        className="mt-4 w-full"
        size="sm"
        variant="outline"
        onClick={() => setSelectedPoint(null)}
      >
        Close
      </Button>
    )}
  </div>
)}</div>;
}
function getMapCoordinates(location?: string | null) {
  const value = (location || '').toLowerCase();

  if (value.includes('east') || value.includes('zone a')) {
    return { x: 160, y: 340 };
  }

  if (value.includes('haul') || value.includes('zone b')) {
    return { x: 320, y: 274 };
  }

  if (value.includes('conveyor') || value.includes('zone c')) {
    return { x: 516, y: 214 };
  }

  if (
    value.includes('crusher') ||
    value.includes('zone d')
  ) {
    return { x: 753, y: 145 };
  }

  return { x: 432, y: 313 };
}

function DashboardView({
  role,
  onNavigate,
  onAlert,
  user,
}: {
  role: Role;
  onNavigate: (view: View) => void;
  onAlert: (alert: IncidentApi | typeof alerts[number]) => void;
  user: AuthUser | null;
}) {
  const [dashboardData, setDashboardData] = useState<ManagerDashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  const [adminDashboardData, setAdminDashboardData] = useState<AdminDashboardData | null>(null);
  const [adminDashboardLoading, setAdminDashboardLoading] = useState(true);
  const [adminDashboardError, setAdminDashboardError] = useState('');

  const [safetyDashboardData, setSafetyDashboardData] = useState<SafetyDashboardData | null>(null);
  const [safetyDashboardLoading, setSafetyDashboardLoading] = useState(true);
  const [safetyDashboardError, setSafetyDashboardError] = useState('');

  const [recentIncidents, setRecentIncidents] = useState<IncidentApi[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [liveTrendData, setLiveTrendData] = useState<{ day: string; risk: number }[]>([]);
  const [mineEquipment, setMineEquipment] = useState<EquipmentApi[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      if (role === 'manager') {
        try {
          setDashboardLoading(true);
          setDashboardError('');

          const data = await getManagerDashboard();

          setDashboardData(data);
        } catch (error) {
          console.error('Failed to load manager dashboard:', error);

          setDashboardError(
            error instanceof Error
              ? error.message
              : 'Failed to load manager dashboard.',
          );
        } finally {
          setDashboardLoading(false);
        }

        return;
      }

      if (role === 'admin') {
        try {
          setAdminDashboardLoading(true);
          setAdminDashboardError('');

          const data = await getAdminDashboard();

          setAdminDashboardData(data);
        } catch (error) {
          console.error('Failed to load admin dashboard:', error);

          setAdminDashboardError(
            error instanceof Error
              ? error.message
              : 'Failed to load admin dashboard.',
          );
        } finally {
          setAdminDashboardLoading(false);
        }

        return;
      }

      setDashboardLoading(false);
      setAdminDashboardLoading(false);
    }

    loadDashboard();
  }, [role]);

useEffect(() => {
  if (role !== 'safety') {
    setSafetyDashboardLoading(false);
    return;
  }

  async function loadSafetyDashboard() {
    try {
      setSafetyDashboardLoading(true);
      setSafetyDashboardError('');

      const data = await getSafetyDashboard();

      setSafetyDashboardData(data);
    } catch (error) {
      console.error(
        'Failed to load safety dashboard:',
        error
      );

      setSafetyDashboardError(
        error instanceof Error
          ? error.message
          : 'Failed to load safety dashboard.'
      );
    } finally {
      setSafetyDashboardLoading(false);
    }
  }

  loadSafetyDashboard();
}, [role]);

  useEffect(() => {
    if (role !== 'manager') {
      setIncidentsLoading(false);
      return;
    }

    const loadIncidents = async () => {
      try {
        setIncidentsLoading(true);
        const data = await getMineIncidents();

        const sorted = [...data]
          .sort(
            (a, b) =>
              new Date(b.created_at || b.incident_date).getTime() -
              new Date(a.created_at || a.incident_date).getTime(),
          )
          .filter(
            (incident) =>
              incident.status !== 'RESOLVED' &&
              incident.status !== 'CLOSED',
          )
          .slice(0, 4);

        setRecentIncidents(sorted);
      } catch (error) {
        console.error('Failed to load incidents:', error);
      } finally {
        setIncidentsLoading(false);
      }
    };

    loadIncidents();
  }, [role]);

  useEffect(() => {
    if (recentIncidents.length === 0) {
      setLiveTrendData([]);
      return;
    }

    const severityWeight: Record<string, number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return date;
    });

    const trend = days.map((day) => {
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayRisk = recentIncidents
        .filter((incident) => {
          const incidentDate = new Date(
            incident.created_at || incident.incident_date,
          );

          return incidentDate >= day && incidentDate < nextDay;
        })
        .reduce(
          (total, incident) =>
            total + (severityWeight[incident.severity] || 0),
          0,
        );

      return {
        day: day.toLocaleDateString('en-IN', {
          weekday: 'short',
        }),
        risk: dayRisk,
      };
    });

    setLiveTrendData(trend);
  }, [recentIncidents]);

  useEffect(() => {
    if (role !== 'manager') {
      setEquipmentLoading(false);
      return;
    }

    const loadEquipment = async () => {
      try {
        setEquipmentLoading(true);
        const data = await getMineEquipment();
        setMineEquipment(data);
      } catch (error) {
        console.error('Failed to load mine equipment:', error);
      } finally {
        setEquipmentLoading(false);
      }
    };

    loadEquipment();
  }, [role]);

  if (role === 'worker') {
    return (
      <WorkerMobileView
        onNavigate={onNavigate}
        user={user}
      />
    );
  }

  if (role === 'admin') {
    if (adminDashboardLoading) {
      return (
        <div className="flex min-h-[500px] items-center justify-center">
          <div className="text-center">
            <RefreshCw className="mx-auto h-7 w-7 animate-spin text-primary" />
            <p className="mt-3 text-sm font-semibold">Loading platform dashboard</p>
            <p className="mt-1 text-xs text-muted-foreground">Fetching system-wide MINEXA data.</p>
          </div>
        </div>
      );
    }

    if (adminDashboardError || !adminDashboardData) {
      return (
        <div className="flex min-h-[500px] items-center justify-center">
          <div className="max-w-md text-center">
            <AlertCircle className="mx-auto h-7 w-7 text-safety-danger" />
            <p className="mt-3 text-sm font-semibold">Failed to load platform dashboard</p>
            <p className="mt-1 text-xs text-muted-foreground">{adminDashboardError || 'No admin dashboard data available.'}</p>
          </div>
        </div>
      );
    }

    const admin = adminDashboardData;

    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs text-muted-foreground">Platform governance</p>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Good morning, {user?.name || 'Platform Admin'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              System-wide overview of mines, identities, approvals, and incidents.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onNavigate('reports')}>
              <Download className="h-3.5 w-3.5" /> Export view
            </Button>
            <Button size="sm" onClick={() => onNavigate('admin')}>
              <Settings className="h-3.5 w-3.5" /> Administration
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Active mines"
            value={String(admin.mines.active ?? 0)}
            change={`${admin.mines.total ?? 0} total mines`}
            trend="up"
            icon={Map}
            tone="primary"
          />
          <MetricCard
            label="Total workers"
            value={String(admin.workers.total ?? 0)}
            change={`${admin.users.active ?? 0} active identities`}
            trend="up"
            icon={Users}
            tone="info"
          />
          <MetricCard
            label="Pending registrations"
            value={String(admin.registrations.pending ?? 0)}
            change={`${admin.registrations.under_review ?? 0} under review`}
            trend="flat"
            icon={UserCheck}
            tone="warning"
          />
          <MetricCard
            label="Active incidents"
            value={String(admin.incidents.active ?? 0)}
            change={`${admin.incidents.critical ?? 0} critical`}
            trend="down"
            icon={AlertTriangle}
            tone="danger"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="ops-card p-5">
            <PanelTitle icon={Users} eyebrow="Identity management" title="User accounts" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-secondary/40 p-4">
                <p className="text-[10px] text-muted-foreground">Total accounts</p>
                <p className="mt-2 font-display text-2xl font-semibold">{admin.users.total ?? 0}</p>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-[10px] text-muted-foreground">Active accounts</p>
                <p className="mt-2 font-display text-2xl font-semibold text-primary">{admin.users.active ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="ops-card p-5">
            <PanelTitle icon={FileText} eyebrow="Registration workflow" title="Approval queue" />
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Pending</span><span className="font-semibold text-safety-warning">{admin.registrations.pending ?? 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Under review</span><span className="font-semibold">{admin.registrations.under_review ?? 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Rejected</span><span className="font-semibold text-safety-danger">{admin.registrations.rejected ?? 0}</span></div>
            </div>
          </div>
        </div>

        <div className="ops-card p-5">
          <PanelTitle icon={ShieldAlert} eyebrow="Safety overview" title="Platform incidents" action={<Button variant="ghost" size="sm" onClick={() => onNavigate('safety')}>Review incidents <ChevronRight className="h-4 w-4" /></Button>} />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-secondary/40 p-4"><p className="text-[10px] text-muted-foreground">Total incidents</p><p className="mt-2 font-display text-2xl font-semibold">{admin.incidents.total ?? 0}</p></div>
            <div className="rounded-lg border border-warning/20 bg-warning/5 p-4"><p className="text-[10px] text-muted-foreground">Active</p><p className="mt-2 font-display text-2xl font-semibold">{admin.incidents.active ?? 0}</p></div>
            <div className="rounded-lg border border-safety-danger/20 bg-safety-danger/5 p-4"><p className="text-[10px] text-muted-foreground">Critical</p><p className="mt-2 font-display text-2xl font-semibold text-safety-danger">{admin.incidents.critical ?? 0}</p></div>
          </div>
        </div>
      </div>
    );
  }

  if (role === 'safety') {
  if (safetyDashboardLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-primary" />

          <p className="mt-3 text-sm font-semibold">
            Loading safety dashboard
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Fetching live safety information.
          </p>
        </div>
      </div>
    );
  }

  if (safetyDashboardError || !safetyDashboardData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-7 w-7 text-safety-danger" />

          <p className="mt-3 text-sm font-semibold">
            Failed to load safety dashboard
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {safetyDashboardError ||
              'No safety dashboard data available.'}
          </p>
        </div>
      </div>
    );
  }

  const safety = safetyDashboardData;

  return (
    <div className="space-y-6">

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs text-muted-foreground">
            Safety operations
          </p>

          <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
            Good evening, {user?.name || 'Safety Officer'}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Live safety, health, and incident overview.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => onNavigate('safety')}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Open safety center
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <MetricCard
  label="Active incidents"
  value={String(safety.incidents.active)}
  change={`${safety.incidents.high_risk} high risk`}
  trend="down"
  icon={AlertTriangle}
  tone="danger"
/>

<MetricCard
  label="High-risk incidents"
  value={String(safety.incidents.high_risk)}
  change="Requires attention"
  trend="flat"
  icon={ShieldAlert}
  tone="warning"
/>

        <MetricCard
          label="Workers checked in"
          value={String(safety.attendance.checked_in)}
          change={`${safety.attendance.late} late`}
          trend="up"
          icon={Users}
          tone="info"
        />

        <MetricCard
          label="Workers needing attention"
          value={String(
            safety.workersNeedingAttention.length
          )}
          change={`${safety.health.unfit} unfit`}
          trend="flat"
          icon={HeartPulse}
          tone="warning"
        />

      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        <div className="ops-card p-5">
          <PanelTitle
            icon={HeartPulse}
            eyebrow="Worker health"
            title="Medical fitness overview"
          />

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-safety-danger/20 bg-safety-danger/5 p-4">
              <p className="text-[10px] text-muted-foreground">Unfit</p>
              <p className="mt-2 font-display text-2xl font-semibold text-safety-danger">
                {safety.health.unfit}
              </p>
            </div>

            <div className="rounded-lg border border-safety-warning/20 bg-safety-warning/5 p-4">
              <p className="text-[10px] text-muted-foreground">Restricted</p>
              <p className="mt-2 font-display text-2xl font-semibold text-safety-warning">
                {safety.health.restricted}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-secondary/40 p-4">
              <p className="text-[10px] text-muted-foreground">Pending review</p>
              <p className="mt-2 font-display text-2xl font-semibold">
                {safety.health.pending}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-secondary/40 p-4">
              <p className="text-[10px] text-muted-foreground">Fitness expired</p>
              <p className="mt-2 font-display text-2xl font-semibold">
                {safety.health.expired}
              </p>
            </div>

          </div>
        </div>

        <div className="ops-card p-5">
          <PanelTitle
            icon={Users}
            eyebrow="Today's presence"
            title="Attendance"
          />

          <div className="mt-5 space-y-5">

            <div>
              <p className="text-xs text-muted-foreground">
                Workers checked in
              </p>

              <p className="mt-1 font-display text-3xl font-semibold">
                {safety.attendance.checked_in}
              </p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                Late attendance
              </p>

              <p className="mt-1 font-display text-2xl font-semibold text-safety-warning">
                {safety.attendance.late}
              </p>
            </div>

          </div>
        </div>

      </div>

      <div className="ops-card overflow-hidden">

        <div className="border-b border-border p-5">
          <PanelTitle
            icon={HeartPulse}
            eyebrow="Action required"
            title="Workers needing attention"
          />
        </div>

        {safety.workersNeedingAttention.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-primary" />

            <p className="mt-3 text-sm font-semibold">
              No workers need immediate attention
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              No problematic health records were found.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">

            {safety.workersNeedingAttention.map(
              (worker) => (
                <div
                  key={worker.worker_id}
                  className="flex items-center gap-4 px-5 py-4"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-semibold text-primary">
                    {worker.name
                      .split(' ')
                      .map((name) => name[0])
                      .join('')
                      .slice(0, 2)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {worker.name}
                    </p>

                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {worker.employee_code}
                    </p>
                  </div>

                  <Badge
                    tone={
                      worker.medical_status === 'UNFIT'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {worker.medical_status.replace(
                      /_/g,
                      ' '
                    )}
                  </Badge>

                  {worker.fitness_expiry_date && (
                    <span className="hidden text-[10px] text-muted-foreground sm:block">
                      Expires{' '}
                      {new Date(
                        worker.fitness_expiry_date
                      ).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )
            )}

          </div>
        )}

      </div>

    </div>
  );
}

  if (dashboardLoading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm font-semibold">Loading command center</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Fetching live mine operations data.
          </p>
        </div>
      </div>
    );
  }

  if (dashboardError || !dashboardData) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-7 w-7 text-safety-danger" />
          <p className="mt-3 text-sm font-semibold">Failed to load command center</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {dashboardError || 'No manager dashboard data available.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}· Shift A
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Good morning, {user?.name || 'Mine Manager'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Here’s the operational picture for <span className="text-foreground">Pit 04</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onNavigate('reports')}>
            <Download className="h-3.5 w-3.5" /> Export view
          </Button>
          <Button size="sm" onClick={() => onNavigate('safety')}>
            <AlertTriangle className="h-3.5 w-3.5" /> Review alerts{' '}
            <span className="rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px]">
              {dashboardData.incidents.open ?? 0}
            </span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active workers"
          value={String(dashboardData.workers.total_workers ?? 0)}
          change="Total workers"
          trend="up"
          icon={Users}
          tone="info"
        />
        <MetricCard
          label="Checked in"
          value={String(dashboardData.attendance.checked_in ?? 0)}
          change="Currently on shift"
          trend="up"
          icon={ShieldCheck}
          tone="success"
        />
        <MetricCard
          label="Open incidents"
          value={String(dashboardData.incidents.open ?? 0)}
          change={`${dashboardData.incidents.critical ?? 0} critical`}
          trend="flat"
          icon={AlertTriangle}
          tone="warning"
        />
        <MetricCard
          label="Active shifts"
          value={String(dashboardData.shifts.active_shifts ?? 0)}
          change="Currently active"
          trend="up"
          icon={Activity}
          tone="primary"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,.75fr)]">
        <div className="ops-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <PanelTitle
              icon={Map}
              eyebrow="Monitor"
              title="Live mine map"
              action={
                <Button variant="ghost" size="sm" onClick={() => onNavigate('mine')}>
                  Open full map <ChevronRight className="h-4 w-4" />
                </Button>
              }
            />
          </div>
          <MapSurface
            compact
            equipment={mineEquipment}
            incidents={recentIncidents}
            onAlert={() => onNavigate('mine')}
            onIncidentSelect={onAlert}
          />
        </div>

        <div className="ops-card p-5">
          <PanelTitle
            icon={Bell}
            eyebrow="Respond"
            title="Active alerts"
            action={
              <Button variant="ghost" size="sm" onClick={() => onNavigate('safety')}>
                View all <ChevronRight className="h-4 w-4" />
              </Button>
            }
          />
          <div className="space-y-1">
            {incidentsLoading ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                Loading alerts...
              </div>
            ) : recentIncidents.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No active incidents
              </div>
            ) : (
              recentIncidents.map((incident) => (
                <Button
                  variant="ghost"
                  key={incident.id}
                  className="flex h-auto w-full items-start justify-start gap-3 rounded-lg px-2.5 py-3 text-left hover:bg-secondary"
                  onClick={() => onAlert(incident)}
                >
                  <span
                    className={cx(
                      'mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                      incident.severity === 'CRITICAL'
                        ? 'bg-safety-danger/10 text-safety-danger'
                        : incident.severity === 'HIGH'
                        ? 'bg-safety-warning/10 text-safety-warning'
                        : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {incident.title}
                    </span>
                    <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                      {incident.location || 'Unknown location'} ·{' '}
                      {new Date(
                        incident.created_at || incident.incident_date,
                      ).toLocaleString('en-IN')}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <div className="ops-card p-5">
          <PanelTitle
            icon={Activity}
            eyebrow="Analyze"
            title="Risk trend"
            action={<Badge tone="neutral">7-day incident trend</Badge>}
          />
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liveTrendData}>
                <defs>
                  <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={.25} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))', fontSize: 11 }} />
                <Area type="monotone" dataKey="risk" stroke="hsl(var(--primary))" fill="url(#riskFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ops-card p-5">
          <PanelTitle icon={Zap} eyebrow="Operations" title="Shift status" />
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-xs text-muted-foreground">Active shifts</p>
              <p className="mt-1 font-display text-3xl font-semibold">
                {dashboardData.shifts.active_shifts ?? 0}
              </p>
            </div>
            <div className="border-t border-border pt-5">
              <p className="text-xs text-muted-foreground">Workers currently checked in</p>
              <p className="mt-1 font-display text-3xl font-semibold">
                {dashboardData.attendance.checked_in ?? 0}
              </p>
            </div>
            <div className="border-t border-border pt-5">
              <p className="text-xs text-muted-foreground">Workers checked out</p>
              <p className="mt-1 font-semibold">
                {dashboardData.attendance.checked_out ?? 0}
              </p>
            </div>
          </div>
          <div className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
            <span className="text-primary">Live</span> · attendance and shift data
          </div>
        </div>
      </div>
    </div>
  );
}


function formatWorkerTime(value?: string | null) {
  if (!value) return '--';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}


function getWorkerHealthReviewKey(workerId?: number | null) {
  if (!workerId) return null;
  const today = new Date().toISOString().slice(0, 10);
  return `minexa_health_reviewed_${workerId}_${today}`;
}

function hasReviewedWorkerHealth(workerId?: number | null) {
  const key = getWorkerHealthReviewKey(workerId);
  return key ? localStorage.getItem(key) === 'true' : false;
}

function markWorkerHealthReviewed(workerId?: number | null) {
  const key = getWorkerHealthReviewKey(workerId);
  if (key) {
    localStorage.setItem(key, 'true');
  }
}

function WorkerMobileView({
  onNavigate,
  user,
}: {
  onNavigate: (view: View) => void;
  user: AuthUser | null;
}) {

  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<WorkerDashboardData | null>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const [emergencyType, setEmergencyType] = useState<WorkerEmergencyType>('OTHER');
  const [sosDescription, setSosDescription] = useState('');
  const [attendanceActionLoading, setAttendanceActionLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;

    async function loadWorkerCommandCenter() {
      try {
        setLoading(true);

        const data = await getWorkerDashboard();

        if (cancelled) return;

        setDashboard(data);

        if (data.worker?.id) {
          const score = await getWorkerRiskScore(data.worker.id);
          if (!cancelled) {
            setRiskScore(score);
          }
        }
      } catch (error) {
        console.error('Worker command center load failed:', error);

        if (!cancelled) {
          toast({
            title: 'Unable to load command center',
            description:
              error instanceof Error
                ? error.message
                : 'Failed to load worker dashboard.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWorkerCommandCenter();

    return () => {
      cancelled = true;
    };
  }, [toast, user?.workerId]);


  const refreshWorkerDashboard = async () => {
    const data = await getWorkerDashboard();
    setDashboard(data);
    return data;
  };

  const handleCheckIn = async () => {
    if (!dashboard?.shift) {
      toast({
        title: 'No active shift',
        description:
          'A Mine Manager must assign you an active shift before you can mark attendance.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setAttendanceActionLoading(true);

      await checkInWorker();
      await refreshWorkerDashboard();

      toast({
        title: 'Attendance marked',
        description: 'Your check-in has been recorded successfully.',
      });
    } catch (error) {
      console.error('Worker check-in failed:', error);

      toast({
        title: 'Check-in failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to mark attendance.',
        variant: 'destructive',
      });
    } finally {
      setAttendanceActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!dashboard?.attendance?.check_in) {
      toast({
        title: 'Check-in required',
        description: 'You must check in before checking out.',
        variant: 'destructive',
      });
      return;
    }

    if (dashboard.attendance.check_out) {
      return;
    }

    try {
      setAttendanceActionLoading(true);

      await checkOutWorker();
      await refreshWorkerDashboard();

      toast({
        title: 'Checked out',
        description: 'Your attendance has been updated successfully.',
      });
    } catch (error) {
      console.error('Worker check-out failed:', error);

      toast({
        title: 'Check-out failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to check out.',
        variant: 'destructive',
      });
    } finally {
      setAttendanceActionLoading(false);
    }
  };

  const handleRefreshDashboard = async () => {
    try {
      setLoading(true);

      const data = await refreshWorkerDashboard();

      if (data.worker?.id) {
        const score = await getWorkerRiskScore(data.worker.id);
        setRiskScore(score);
      }

      toast({
        title: 'Command center refreshed',
        description:
          'Your latest shift, attendance, and safety data is now shown.',
      });
    } catch (error) {
      toast({
        title: 'Refresh failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to refresh worker data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencySOS = async () => {
    try {
      setSosSending(true);

      const sendEmergency = async (
        coordinates?: GeolocationCoordinates,
      ) => {
        await sendWorkerEmergency({
          emergencyType,
          description:
            sosDescription.trim() ||
            'Emergency SOS activated by field worker.',
          location: coordinates
            ? 'Current device location'
            : 'Location unavailable',
          ...(coordinates
            ? {
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
              }
            : {}),
        });
      };

      if ('geolocation' in navigator) {
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                await sendEmergency(position.coords);
                resolve();
              } catch (error) {
                reject(error);
              }
            },
            async () => {
              try {
                await sendEmergency();
                resolve();
              } catch (error) {
                reject(error);
              }
            },
            {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 30000,
            },
          );
        });
      } else {
        await sendEmergency();
      }

      setSosOpen(false);
      setSosDescription('');

      toast({
        title: 'Emergency SOS sent',
        description:
          'Your emergency alert has been sent to the mine response team.',
      });
    } catch (error) {
      console.error('Emergency SOS failed:', error);

      toast({
        title: 'SOS failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to send emergency alert.',
        variant: 'destructive',
      });
    } finally {
      setSosSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm font-semibold">Loading command center</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Fetching your live shift and safety data.
          </p>
        </div>
      </div>
    );
  }

  const workerName = dashboard?.worker.name ?? user?.name ?? 'Worker';
  const mineName = dashboard?.worker.mine.name ?? 'Mine';
  const shift = dashboard?.shift;
  const activeIncidents = dashboard?.incidents.active ?? 0;
  const pendingLeave = dashboard?.leave.pending ?? 0;
  const healthStatus = dashboard?.health?.medical_status ?? 'PENDING';

  const safetyScore =
    riskScore !== null
      ? Math.max(0, Math.min(100, 100 - riskScore))
      : null;

  const safetyTone =
    safetyScore === null
      ? 'neutral'
      : safetyScore >= 75
        ? 'success'
        : safetyScore >= 50
          ? 'warning'
          : 'danger';

  const safetyLabel =
    safetyScore === null
      ? 'Assessment pending'
      : safetyScore >= 75
        ? 'Safe to operate'
        : safetyScore >= 50
          ? 'Monitor closely'
          : 'High risk';

  const attendanceStatus = dashboard?.attendance?.status ?? 'NOT MARKED';

  const shiftTime = shift
    ? `${shift.start_time.slice(0, 5)} – ${shift.end_time.slice(0, 5)}`
    : 'No active shift';


 const healthReviewedToday = hasReviewedWorkerHealth(dashboard?.worker?.id);



 const tasks = [


   {


     title: 'Complete pre-shift safety check',


     done: attendanceStatus === 'PRESENT' || attendanceStatus === 'LATE',


     action: () => {


       toast({


         title: 'Pre-shift check',


         description: 'Pre-shift safety check completed.',


       });


     },


   },


   {


     title: 'Review current health status',


     done: healthReviewedToday,


     action: () => {


       markWorkerHealthReviewed(dashboard?.worker?.id);


       onNavigate('health');


     },


   },


   {


     title: 'Complete today’s shift',


     done: Boolean(dashboard?.attendance?.check_out),


     action: () => {


       if (dashboard?.attendance?.check_out) {


         toast({


           title: 'Shift complete',


           description: 'Today’s shift has already been completed.',


         });


         return;


       }



       handleCheckOut();


     },


   },


 ];

  const completedTasks = tasks.filter((task) => task.done).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {mineName} · Command Center
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold">
            Good evening, {workerName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Stay aware. Stay connected.
          </p>
        </div>

        <Button
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={handleRefreshDashboard}
          disabled={loading}
          aria-label="Refresh worker command center"
          title="Refresh"
        >
          <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary/10 p-5">
        <div className="flex items-start justify-between">
          <div>
            <Badge tone={safetyTone as 'neutral' | 'success' | 'warning' | 'danger'}>
              <StatusDot
                status={
                  safetyScore === null
                    ? 'info'
                    : safetyScore >= 75
                      ? 'success'
                      : safetyScore >= 50
                        ? 'warning'
                        : 'danger'
                }
              />
              {safetyLabel}
            </Badge>

            <p className="mt-4 text-xs text-muted-foreground">
              Personal safety score
            </p>

            <p className="mt-1 font-display text-4xl font-semibold text-primary">
              {safetyScore !== null ? safetyScore : '—'}
              {safetyScore !== null && (
                <span className="text-lg text-muted-foreground">/100</span>
              )}
            </p>
          </div>

          <ShieldCheck className="h-9 w-9 text-primary" />
        </div>

        <div className="mt-5 h-1.5 rounded-full bg-primary/15">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${safetyScore ?? 0}%` }}
          />
        </div>

        <p className="mt-2 text-[10px] text-muted-foreground">
          {riskScore !== null
            ? `Current risk score: ${Math.round(riskScore)}`
            : 'Risk assessment not available yet'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="ops-card p-4">
          <MapPin className="h-4 w-4 text-secondary" />
          <p className="mt-5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Current mine
          </p>
          <p className="mt-1 font-display text-lg font-semibold">
            {mineName}
          </p>
          <p className="mt-1 text-[10px] text-primary">
            Worker ID · {dashboard?.worker.employeeCode ?? '—'}
          </p>
        </div>

        <div className="ops-card p-4">
          <Clock3 className="h-4 w-4 text-safety-warning" />
          <p className="mt-5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Current shift
          </p>
          <p className="mt-1 font-display text-lg font-semibold">
            {shift?.name ?? 'No active shift'}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {shiftTime}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Active incidents"
          value={String(activeIncidents)}
          change={activeIncidents > 0 ? 'Needs attention' : 'No open incidents'}
          trend={activeIncidents > 0 ? 'down' : 'flat'}
          icon={AlertTriangle}
          tone={activeIncidents > 0 ? 'danger' : 'success'}
        />
        <div className="ops-card p-5">
          <div className="mb-4 flex items-start justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <CheckCircle2 className="h-[18px] w-[18px] text-safety-success" />
            </span>

            <span
              className={cx(
                'flex items-center gap-1 text-[11px] font-semibold',
                dashboard?.attendance?.check_out
                  ? 'text-safety-success'
                  : dashboard?.attendance?.check_in
                    ? 'text-primary'
                    : 'text-muted-foreground',
              )}
            >
              {dashboard?.attendance?.check_out
                ? 'Completed today'
                : dashboard?.attendance?.check_in
                  ? 'Checked in'
                  : 'Not marked'}
            </span>
          </div>

          <p className="text-xs font-medium text-muted-foreground">
            Attendance
          </p>

          <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">
            {attendanceStatus}
          </p>

          <p className="mt-1 text-[11px] text-muted-foreground">
            {dashboard?.attendance?.check_in
              ? `Checked in ${formatWorkerTime(dashboard.attendance.check_in)}`
              : 'Attendance has not been marked today.'}
          </p>

          <div className="mt-4">
            {!dashboard?.attendance ? (
              <Button
                className="w-full"
                onClick={handleCheckIn}
                disabled={attendanceActionLoading || !shift}
              >
                {attendanceActionLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {attendanceActionLoading ? 'Marking...' : 'Mark Attendance'}
              </Button>
            ) : !dashboard.attendance.check_out ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCheckOut}
                disabled={attendanceActionLoading}
              >
                {attendanceActionLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                {attendanceActionLoading ? 'Checking out...' : 'Check Out'}
              </Button>
            ) : (
              <div className="rounded-lg bg-safety-success/10 px-3 py-2 text-center text-[11px] font-semibold text-safety-success">
                Shift attendance completed
              </div>
            )}
          </div>

          {!shift && !dashboard?.attendance?.check_in && (
            <p className="mt-2 text-[10px] text-safety-warning">
              No active shift assigned. Contact your Mine Manager.
            </p>
          )}
        </div>
        <MetricCard
          label="Pending leave"
          value={String(pendingLeave)}
          change={pendingLeave > 0 ? 'Awaiting approval' : 'Nothing pending'}
          trend={pendingLeave > 0 ? 'down' : 'flat'}
          icon={CalendarDays}
          tone={pendingLeave > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className="ops-card p-5">
        <PanelTitle
          icon={CheckCircle2}
          eyebrow="Today"
          title="Your tasks"
          action={
            <Badge tone="success">
              {completedTasks} / {tasks.length} done
            </Badge>
          }
        />

        <div className="space-y-3">
          {tasks.map((task) => (
            <Button
              key={task.title}
              variant="ghost"
              className="flex h-auto w-full justify-start gap-3 rounded-lg border border-border/60 px-3 py-3 text-left"
              onClick={() => {
                if (task.done) {
                  toast({
                    title: 'Task complete',
                    description: task.title,
                  });
                  return;
                }

                task.action?.();
              }}
              disabled={false}
            >
              <span
                className={cx(
                  'flex h-5 w-5 items-center justify-center rounded-full border',
                  task.done
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-transparent',
                )}
              >
                {task.done ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-border" />
                )}
              </span>
              <span
                className={cx(
                  'text-xs',
                  task.done && 'text-muted-foreground line-through',
                )}
              >
                {task.title}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <Button
        variant="danger"
        size="lg"
        className="h-14 w-full"
        onClick={() => setSosOpen(true)}
      >
        <AlertTriangle className="h-5 w-5" />
        Emergency SOS
      </Button>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => onNavigate('leave')}
      >
        <CalendarDays className="h-4 w-4" />
        Manage leave
      </Button>

      {sosOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-safety-danger/30 bg-surface p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge tone="danger">
                  <AlertTriangle className="h-3 w-3" />
                  Emergency
                </Badge>
                <h2 className="mt-3 font-display text-xl font-semibold">
                  Activate Emergency SOS?
                </h2>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  This sends a CRITICAL emergency alert to the mine response team.
                </p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSosOpen(false)}
                disabled={sosSending}
                aria-label="Close SOS dialog"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold">
                  Emergency type
                </label>
                <select
                  value={emergencyType}
                  onChange={(event) =>
                    setEmergencyType(
                      event.target.value as WorkerEmergencyType,
                    )
                  }
                  disabled={sosSending}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="MEDICAL">Medical emergency</option>
                  <option value="ACCIDENT">Accident</option>
                  <option value="FIRE">Fire</option>
                  <option value="GAS_LEAK">Gas leak</option>
                  <option value="GROUND_COLLAPSE">Ground collapse</option>
                  <option value="EQUIPMENT_FAILURE">Equipment failure</option>
                  <option value="TRAPPED_WORKER">Trapped worker</option>
                  <option value="UNSAFE_AREA">Unsafe area</option>
                  <option value="SECURITY">Security</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold">
                  Details
                </label>
                <textarea
                  value={sosDescription}
                  onChange={(event) => setSosDescription(event.target.value)}
                  placeholder="Briefly describe what happened..."
                  disabled={sosSending}
                  rows={4}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-safety-danger"
                />
              </div>

              <div className="rounded-lg border border-safety-danger/20 bg-safety-danger/10 p-3 text-xs leading-5 text-muted-foreground">
                GPS location will be attached when your browser allows it. The SOS is still sent when location permission is unavailable.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSosOpen(false)}
                  disabled={sosSending}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleEmergencySOS}
                  disabled={sosSending}
                >
                  <AlertTriangle className="h-4 w-4" />
                  {sosSending ? 'Sending SOS...' : 'Send SOS'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SafetyView({
  onSelect,
}: {
  onSelect: (incident: IncidentApi) => void;
}) {
  const [tab, setTab] = useState('All');
  const [incidents, setIncidents] = useState<IncidentApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const tabs = ['All', 'Critical', 'Warning', 'Information'];

  async function loadIncidents() {
    try {
      setLoading(true);
      setError('');
      const data = await getMineIncidents();
      setIncidents(data);
    } catch (err) {
      console.error('Failed to load incidents:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load safety incidents.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateIncident(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!incidentForm.title.trim()) {
      setError('Incident title is required.');
      return;
    }

    if (!incidentForm.description.trim()) {
      setError('Incident description is required.');
      return;
    }

    try {
      setCreating(true);
      setError('');

      await createIncident({
        incidentType: incidentForm.incidentType,
        title: incidentForm.title.trim(),
        description: incidentForm.description.trim(),
        location: incidentForm.location.trim() || undefined,
        severity: incidentForm.severity,
      });

      setIncidentForm({
        incidentType: 'NEAR_MISS',
        title: '',
        description: '',
        location: '',
        severity: 'MEDIUM',
      });

      setShowCreateForm(false);
      await loadIncidents();
    } catch (err) {
      console.error('Failed to create incident:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create incident.',
      );
    } finally {
      setCreating(false);
    }
  }

  const [incidentForm, setIncidentForm] = useState({
    incidentType: 'NEAR_MISS' as
      | 'ACCIDENT'
      | 'HAZARD'
      | 'NEAR_MISS'
      | 'UNSAFE_CONDITION'
      | 'SAFETY_VIOLATION',
    title: '',
    description: '',
    location: '',
    severity: 'MEDIUM' as
      | 'LOW'
      | 'MEDIUM'
      | 'HIGH'
      | 'CRITICAL',
  });

  useEffect(() => {
    loadIncidents();
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'All') return incidents;
    if (tab === 'Critical') {
      return incidents.filter((incident) => incident.severity === 'CRITICAL');
    }
    if (tab === 'Warning') {
      return incidents.filter(
        (incident) =>
          incident.severity === 'HIGH' || incident.severity === 'MEDIUM',
      );
    }
    if (tab === 'Information') {
      return incidents.filter((incident) => incident.severity === 'LOW');
    }
    return incidents;
  }, [incidents, tab]);

  function getTabCount(item: string) {
    if (item === 'All') return incidents.length;
    if (item === 'Critical') {
      return incidents.filter((incident) => incident.severity === 'CRITICAL').length;
    }
    if (item === 'Warning') {
      return incidents.filter(
        (incident) =>
          incident.severity === 'HIGH' || incident.severity === 'MEDIUM',
      ).length;
    }
    if (item === 'Information') {
      return incidents.filter((incident) => incident.severity === 'LOW').length;
    }
    return 0;
  }

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs text-muted-foreground">
            Real-time incident response
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold">
            Safety & alerts
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Prioritize what needs attention across the mine.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadIncidents}
            disabled={loading}
          >
            <RefreshCw
              className={
                loading
                  ? 'h-3.5 w-3.5 animate-spin'
                  : 'h-3.5 w-3.5'
              }
            />
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>

          <Button
            size="sm"
            onClick={() => setShowCreateForm((value) => !value)}
          >
            <MessageSquareWarning className="h-3.5 w-3.5" />
            {showCreateForm ? 'Close form' : 'Create incident'}
          </Button>
        </div>
      </div>

      {showCreateForm && (
        <div className="ops-card p-5">
          <div className="mb-5">
            <p className="text-xs text-primary">Incident reporting</p>
            <h2 className="mt-1 font-display text-lg font-semibold">
              Report a new incident
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Submit a safety event for this mine.
            </p>
          </div>

          <form onSubmit={handleCreateIncident} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold">
                  Incident type
                </label>
                <select
                  value={incidentForm.incidentType}
                  onChange={(e) =>
                    setIncidentForm((prev) => ({
                      ...prev,
                      incidentType: e.target.value as typeof prev.incidentType,
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="ACCIDENT">Accident</option>
                  <option value="HAZARD">Hazard</option>
                  <option value="NEAR_MISS">Near Miss</option>
                  <option value="UNSAFE_CONDITION">Unsafe Condition</option>
                  <option value="SAFETY_VIOLATION">Safety Violation</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold">
                  Severity
                </label>
                <select
                  value={incidentForm.severity}
                  onChange={(e) =>
                    setIncidentForm((prev) => ({
                      ...prev,
                      severity: e.target.value as typeof prev.severity,
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="incident-title" className="mb-2 block text-xs font-semibold">
                Incident title
              </label>
              <Input
                id="incident-title"
                value={incidentForm.title}
                onChange={(e) =>
                  setIncidentForm((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                placeholder="Example: Loose rock near conveyor"
              />
            </div>

            <div>
              <label htmlFor="incident-location" className="mb-2 block text-xs font-semibold">
                Location
              </label>
              <Input
                id="incident-location"
                value={incidentForm.location}
                onChange={(e) =>
                  setIncidentForm((prev) => ({
                    ...prev,
                    location: e.target.value,
                  }))
                }
                placeholder="Example: Conveyor Area B"
              />
            </div>

            <div>
              <label htmlFor="incident-description" className="mb-2 block text-xs font-semibold">
                Description
              </label>
              <textarea
                id="incident-description"
                value={incidentForm.description}
                onChange={(e) =>
                  setIncidentForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe what happened, what was observed, and any immediate risk."
                className="min-h-[120px] w-full rounded-md border border-border bg-background px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateForm(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Submit incident'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-safety-danger/30 bg-safety-danger/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-safety-danger" />
            <div>
              <p className="text-sm font-semibold text-safety-danger">
                Unable to load incidents
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="ops-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 border-b border-border p-3">
          {tabs.map((item) => (
            <Button
              key={item}
              variant={tab === item ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTab(item)}
              className={cx(tab === item && 'text-primary')}
            >
              {item}
              {item !== 'All' && (
                <span className="ml-1 rounded-full bg-background px-1.5 text-[10px]">
                  {getTabCount(item)}
                </span>
              )}
            </Button>
          ))}
        </div>

        {loading && (
          <div className="p-10 text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />
            <p className="mt-3 text-sm font-semibold">
              Loading safety incidents
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Fetching live incident data from MINEXA.
            </p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="p-10 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 text-sm font-semibold">No incidents found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              There are no incidents matching the selected filter.
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="divide-y divide-border/70">
            {filtered.map((incident) => {
              const isCritical = incident.severity === 'CRITICAL';
              const isHigh = incident.severity === 'HIGH';
              const isMedium = incident.severity === 'MEDIUM';

              const badgeTone: 'danger' | 'warning' | 'info' =
                isCritical || isHigh
                  ? 'danger'
                  : isMedium
                  ? 'warning'
                  : 'info';

              const iconBackground =
                isCritical || isHigh
                  ? 'bg-safety-danger/10 text-safety-danger'
                  : isMedium
                  ? 'bg-safety-warning/10 text-safety-warning'
                  : 'bg-secondary text-secondary-foreground';

              return (
                <Button
                  variant="ghost"
                  key={incident.id}
                  className="flex h-auto w-full items-start justify-start gap-4 rounded-none px-5 py-5 text-left hover:bg-secondary/50"
                  onClick={() => onSelect(incident)}
                >
                  <span
                    className={cx(
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      iconBackground,
                    )}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {incident.title}
                      </span>
                      <Badge tone={badgeTone}>{incident.severity}</Badge>
                      <Badge
                        tone={
                          incident.status === 'CLOSED'
                            ? 'neutral'
                            : incident.status === 'RESOLVED'
                            ? 'success'
                            : 'warning'
                        }
                      >
                        {incident.status.replace(/_/g, ' ')}
                      </Badge>
                    </span>

                    <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {incident.location || 'Location not specified'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        {new Date(incident.incident_date).toLocaleString()}
                      </span>
                      <span>
                        Type:{' '}
                        <b className="text-foreground">
                          {incident.incident_type.replace(/_/g, ' ')}
                        </b>
                      </span>
                    </span>

                    {incident.description && (
                      <span className="mt-2 block line-clamp-2 text-[11px] text-muted-foreground">
                        {incident.description}
                      </span>
                    )}
                  </span>

                  <span className="hidden text-right sm:block">
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                      Status
                    </span>
                    <span
                      className={cx(
                        'mt-1 block text-xs font-semibold',
                        incident.status === 'RESOLVED' ||
                          incident.status === 'CLOSED'
                          ? 'text-safety-success'
                          : incident.severity === 'CRITICAL'
                          ? 'text-safety-danger'
                          : 'text-safety-warning',
                      )}
                    >
                      {incident.status.replace(/_/g, ' ')}
                    </span>
                  </span>

                  <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkersView({
  onSelect,
  role,
}: {
  onSelect: (worker: WorkerApi) => void;
  role: Role;
}) {
  const [search, setSearch] = useState('');
  const [workerData, setWorkerData] = useState<WorkerApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attendanceData, setAttendanceData] = useState<AttendanceApi[]>([]);

  useEffect(() => {
    const loadWorkers = async () => {
      try {
        setLoading(true);
        setError('');

        const workersPromise =
          role === 'admin'
            ? getAllWorkers()
            : getMineWorkers();

        const attendancePromise =
          role === 'admin'
            ? Promise.resolve([] as AttendanceApi[])
            : getMineAttendance();

        const [workers, attendance] = await Promise.all([
          workersPromise,
          attendancePromise,
        ]);

        setWorkerData(workers);
        setAttendanceData(attendance);
      } catch (err) {
        console.error('Failed to load workers:', err);

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load workers.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadWorkers();
  }, [role]);

  const filteredWorkers = workerData.filter((worker) =>
    `${worker.name} ${worker.employee_code} ${worker.department ?? ''} ${worker.designation ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
const todayDate = new Date();
const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

const todayAttendance = attendanceData.filter(
  (record) =>
    String(record.attendance_date).slice(0, 10) === today
);

const workerIdsWithAttendance = new Set(
  todayAttendance.map((record) => record.worker_id)
);

const onSiteCount = todayAttendance.filter(
  (record) =>
    record.check_in &&
    !record.check_out
).length;

const absentCount =
  workerData.length - workerIdsWithAttendance.size;
  return (
    <div className="space-y-6">

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs text-muted-foreground">
            People & presence
          </p>

          <h1 className="mt-2 font-display text-2xl font-semibold">
            Workforce
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Know where your teams are and how they’re doing.
          </p>
        </div>

        <Button size="sm">
          <Users className="h-3.5 w-3.5" />
          Add worker
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">

        <MetricCard
          label="Total workers"
          value={loading ? '...' : String(workerData.length)}
          change={role === 'admin' ? 'All mines' : 'Current mine'}
          trend="up"
          icon={Users}
          tone="info"
        />

<MetricCard
  label="On site"
  value={role === 'admin' ? '—' : String(onSiteCount)}
  change={role === 'admin' ? 'Attendance is mine-scoped' : `${todayAttendance.length} attendance records today`}
  trend="up"
  icon={MapPin}
  tone="success"
/>

<MetricCard
  label="Absent"
  value={role === 'admin' ? '—' : String(Math.max(0, absentCount))}
  change={role === 'admin' ? 'Attendance is mine-scoped' : 'No attendance record today'}
  trend="flat"
  icon={Clock3}
  tone="warning"
/>

        <MetricCard
          label="Contractors"
          value="—"
          change="Not available in worker API"
          trend="flat"
          icon={HardHat}
          tone="primary"
        />

      </div>

      <div className="ops-card overflow-hidden">

        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              placeholder="Search workers"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-3.5 w-3.5" />
              Status
            </Button>

            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </div>

        {loading && (
          <div className="p-10 text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />

            <p className="mt-3 text-sm font-semibold">
              Loading workers
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Fetching live workforce data from MINEXA.
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="p-10 text-center">
            <AlertCircle className="mx-auto h-7 w-7 text-safety-danger" />

            <p className="mt-3 text-sm font-semibold">
              Failed to load workers
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              {error}
            </p>
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">

              <thead className="border-b border-border bg-secondary/40 text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                <tr>
                  {[
                    'Worker',
                    'Role',
                    'Department',
                    ...(role === 'admin' ? ['Mine'] : []),
                    'Status',
                    'Phone',
                    'Employee code',
                    '',
                  ].map((head) => (
                    <th
                      key={head}
                      className="px-5 py-3 font-semibold"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-border/70">

                {filteredWorkers.map((worker) => (
                  <tr
                    key={worker.id}
                    className="transition-colors hover:bg-secondary/30"
                  >

                    <td className="px-5 py-4">
                      <Button
                        variant="ghost"
                        className="h-auto justify-start gap-3 p-0 text-left"
                        onClick={() => onSelect(worker)}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-display text-xs font-semibold text-primary">
                          {worker.name
                            .split(' ')
                            .map((name) => name[0])
                            .join('')
                            .slice(0, 2)}
                        </span>

                        <span>
                          <span className="block text-xs font-semibold text-foreground">
                            {worker.name}
                          </span>

                          <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                            ID #{worker.id}
                          </span>
                        </span>
                      </Button>
                    </td>

                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {worker.designation || '—'}
                    </td>

                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {worker.department || '—'}
                    </td>

                    {role === 'admin' && (
                      <td className="px-5 py-4 text-xs text-muted-foreground">
                        {worker.mine_name || worker.mine_code || '—'}
                      </td>
                    )}

                    <td className="px-5 py-4">
                      <Badge
                        tone={
                          worker.account_status === 'ACTIVE'
                            ? 'success'
                            : 'warning'
                        }
                      >
                        <StatusDot
                          status={
                            worker.account_status === 'ACTIVE'
                              ? 'success'
                              : 'warning'
                          }
                        />
                        {worker.account_status
                          ? worker.account_status.replace(/_/g, ' ')
                          : 'ACTIVE'}
                      </Badge>
                    </td>

                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {worker.phone || '—'}
                    </td>

                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                      {worker.employee_code}
                    </td>

                    <td className="px-5 py-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onSelect(worker)}
                        aria-label={`Open ${worker.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </td>

                  </tr>
                ))}

              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && filteredWorkers.length === 0 && (
          <div className="p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />

            <p className="mt-3 text-sm font-semibold">
              No workers found
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Try a different worker name or employee code.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

function EquipmentView({ onSelect }: { onSelect: (asset: typeof equipment[number]) => void }) {
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs text-muted-foreground">Assets & maintenance</p><h1 className="mt-2 font-display text-2xl font-semibold">Equipment</h1><p className="mt-2 text-sm text-muted-foreground">Predict maintenance before downtime impacts production.</p></div><Button size="sm"><Wrench className="h-3.5 w-3.5" /> Schedule service</Button></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Total equipment" value="92" change="Across 4 zones" trend="flat" icon={Truck} tone="primary" /><MetricCard label="Operational" value="86" change="93.4% uptime" trend="up" icon={CheckCircle2} tone="success" /><MetricCard label="Under maintenance" value="04" change="2 due today" trend="flat" icon={Wrench} tone="warning" /><MetricCard label="Out of service" value="02" change="1 critical" trend="down" icon={AlertCircle} tone="danger" /></div><div className="ops-card overflow-hidden"><div className="flex items-center justify-between border-b border-border p-4"><div className="flex items-center gap-2"><Table2 className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Asset health register</span></div><Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> Export fleet</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="border-b border-border bg-secondary/40 text-[10px] uppercase tracking-[.14em] text-muted-foreground"><tr>{['Asset', 'Type', 'Zone', 'Status', 'Health', 'Last maintenance', ''].map((head) => <th key={head} className="px-5 py-3 font-semibold">{head}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{equipment.map((asset) => <tr key={asset.id} className="transition-colors hover:bg-secondary/30"><td className="px-5 py-4"><Button variant="ghost" className="h-auto justify-start gap-3 p-0 text-left" onClick={() => onSelect(asset)}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary"><Truck className="h-4 w-4" /></span><span><span className="block text-xs font-semibold text-foreground">{asset.name}</span><span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{asset.id}</span></span></Button></td><td className="px-5 py-4 text-xs text-muted-foreground">{asset.type}</td><td className="px-5 py-4 text-xs text-muted-foreground">{asset.zone}</td><td className="px-5 py-4"><Badge tone={asset.status === 'Operational' ? 'success' : asset.status === 'Maintenance' ? 'warning' : 'danger'}><StatusDot status={asset.status === 'Operational' ? 'success' : asset.status === 'Maintenance' ? 'warning' : 'danger'} /> {asset.status}</Badge></td><td className="px-5 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-secondary"><div className={cx('h-full rounded-full', asset.health > 80 ? 'bg-primary' : asset.health > 50 ? 'bg-safety-warning' : 'bg-safety-danger')} style={{ width: `${asset.health}%` }} /></div><span className="text-xs font-semibold">{asset.health}%</span></div></td><td className="px-5 py-4 text-xs text-muted-foreground">{asset.maintenance}</td><td className="px-5 py-4"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSelect(asset)} aria-label={`Open ${asset.name}`}><MoreHorizontal className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div></div></div>;
}

function AnalyticsView({ role }: { role: Role }) {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [adminAnalytics, setAdminAnalytics] = useState<AdminAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        setError('');

        if (role === 'admin') {
          const result = await getAdminAnalyticsSummary();
          setAdminAnalytics(result);
          setData(null);
          return;
        }

        const result = await getAnalyticsSummary();
        setData(result);
        setAdminAnalytics(null);
      } catch (err) {
        console.error('Failed to load analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics.');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [role]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm font-semibold">Loading analytics</p>
          <p className="mt-1 text-xs text-muted-foreground">Fetching live operational data.</p>
        </div>
      </div>
    );
  }

  if (error || (role === 'admin' && !adminAnalytics) || (role !== 'admin' && !data)) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-7 w-7 text-safety-danger" />
          <p className="mt-3 text-sm font-semibold">Failed to load analytics</p>
          <p className="mt-1 text-xs text-muted-foreground">{error || 'No analytics data available.'}</p>
        </div>
      </div>
    );
  }

  if (role === 'admin' && adminAnalytics) {
    const equipmentUptime =
      adminAnalytics.equipment.total > 0
        ? ((adminAnalytics.equipment.operational / adminAnalytics.equipment.total) * 100).toFixed(1)
        : '0.0';

    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs text-muted-foreground">Platform intelligence</p>
            <h1 className="mt-2 font-display text-2xl font-semibold">Analytics</h1>
            <p className="mt-2 text-sm text-muted-foreground">Platform-wide operational and safety analytics.</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
            Platform-wide view
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total mines"
            value={String(adminAnalytics.mines.total)}
            change={`${adminAnalytics.mines.active} active`}
            trend="flat"
            icon={Building2}
            tone="primary"
          />
          <MetricCard
            label="Total workers"
            value={String(adminAnalytics.workers.total)}
            change="Across all mines"
            trend="flat"
            icon={Users}
            tone="success"
          />
          <MetricCard
            label="Active incidents"
            value={String(adminAnalytics.incidents.active)}
            change={`${adminAnalytics.incidents.critical} critical`}
            trend={adminAnalytics.incidents.critical > 0 ? 'down' : 'flat'}
            icon={AlertTriangle}
            tone="danger"
          />
          <MetricCard
            label="Equipment uptime"
            value={`${equipmentUptime}%`}
            change={`${adminAnalytics.equipment.outOfService} out of service`}
            trend="up"
            icon={Wrench}
            tone="primary"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="ops-card p-5">
            <PanelTitle icon={ShieldAlert} eyebrow="Safety" title="Incident overview" />
            <div className="mt-5 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total incidents</span>
                <span className="font-display text-xl font-semibold">{adminAnalytics.incidents.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active incidents</span>
                <Badge tone={adminAnalytics.incidents.active > 0 ? 'warning' : 'success'}>
                  {adminAnalytics.incidents.active}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">High-risk incidents</span>
                <Badge tone="warning">{adminAnalytics.incidents.highRisk}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Critical incidents</span>
                <Badge tone="danger">{adminAnalytics.incidents.critical}</Badge>
              </div>
            </div>
          </div>

          <div className="ops-card p-5">
            <PanelTitle icon={Wrench} eyebrow="Assets" title="Equipment status" />
            <div className="mt-5 space-y-5">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Operational</span>
                  <span className="font-semibold">{adminAnalytics.equipment.operational}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${
                        adminAnalytics.equipment.total > 0
                          ? (adminAnalytics.equipment.operational / adminAnalytics.equipment.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Maintenance</span>
                  <span className="font-semibold">{adminAnalytics.equipment.maintenance}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-safety-warning"
                    style={{
                      width: `${
                        adminAnalytics.equipment.total > 0
                          ? (adminAnalytics.equipment.maintenance / adminAnalytics.equipment.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Out of service</span>
                  <span className="font-semibold">{adminAnalytics.equipment.outOfService}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-safety-danger"
                    style={{
                      width: `${
                        adminAnalytics.equipment.total > 0
                          ? (adminAnalytics.equipment.outOfService / adminAnalytics.equipment.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="ops-card p-5">
          <PanelTitle icon={Users} eyebrow="Attendance" title="Platform attendance" />
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Attendance records"
              value={String(adminAnalytics.attendance.records)}
              change="All mines"
              trend="flat"
              icon={Users}
              tone="primary"
            />
            <MetricCard
              label="Today's records"
              value={String(adminAnalytics.attendance.todayRecords)}
              change="Today"
              trend="flat"
              icon={Clock3}
              tone="info"
            />
            <MetricCard
              label="Late today"
              value={String(adminAnalytics.attendance.todayLate)}
              change="Today's attendance"
              trend={adminAnalytics.attendance.todayLate > 0 ? 'down' : 'flat'}
              icon={AlertCircle}
              tone={adminAnalytics.attendance.todayLate > 0 ? 'warning' : 'success'}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const chartData = data.trend;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs text-muted-foreground">Operational intelligence</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">Analytics</h1>
          <p className="mt-2 text-sm text-muted-foreground">Live mine performance and safety analytics.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <CalendarDays className="h-3.5 w-3.5" />
            Last 7 days
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="h-3.5 w-3.5" />
            Pit 04
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Incidents"
          value={String(data.incidents.total)}
          change={`${data.incidents.open} open`}
          trend="down"
          icon={AlertTriangle}
          tone="danger"
        />
        <MetricCard
          label="Critical incidents"
          value={String(data.incidents.critical)}
          change="Live incident data"
          trend="flat"
          icon={ShieldAlert}
          tone="warning"
        />
        <MetricCard
          label="Equipment uptime"
          value={`${data.equipment.uptime}%`}
          change={`${data.equipment.outOfService} out of service`}
          trend="up"
          icon={Wrench}
          tone="primary"
        />
        <MetricCard
          label="Workers checked in"
          value={String(data.attendance.checkedIn)}
          change={`${data.attendance.late} late`}
          trend="up"
          icon={Users}
          tone="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <div className="ops-card p-5">
          <PanelTitle icon={Activity} eyebrow="Safety signal" title="Incident trend" />
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={chartData}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--surface))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    color: 'hsl(var(--foreground))',
                    fontSize: 11,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="incidents"
                  name="Incidents"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="highRiskIncidents"
                  name="High risk"
                  stroke="hsl(var(--danger))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--danger))', r: 3 }}
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ops-card p-5">
          <PanelTitle icon={Wrench} eyebrow="Assets" title="Equipment status" />
          <div className="mt-5 space-y-5">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Operational</span>
                <span className="font-semibold">{data.equipment.operational}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${data.equipment.total > 0 ? (data.equipment.operational / data.equipment.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Maintenance</span>
                <span className="font-semibold">{data.equipment.maintenance}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-safety-warning"
                  style={{
                    width: `${data.equipment.total > 0 ? (data.equipment.maintenance / data.equipment.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Out of service</span>
                <span className="font-semibold">{data.equipment.outOfService}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-safety-danger"
                  style={{
                    width: `${data.equipment.total > 0 ? (data.equipment.outOfService / data.equipment.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsView({ role }: { role: Role }) {
  const { toast } = useToast();

const [data, setData] =useState<ReportsSummary | null>(null);

const [adminData, setAdminData] =useState<AdminReportsSummary | null>(null);

const [loading, setLoading] =useState(true);

const [error, setError] =useState('');

 useEffect(() => {
  const loadReports = async () => {
    try {
      setLoading(true);
      setError('');

      if (role === 'admin') {
        const result =
          await getAdminReportsSummary();

        setAdminData(result);
        setData(null);

        return;
      }

      const result =
        await getReportsSummary();

      setData(result);
      setAdminData(null);

    } catch (err) {
      console.error(
        'Failed to load reports:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load reports.'
      );
    } finally {
      setLoading(false);
    }
  };

  loadReports();
}, [role]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-primary" />

          <p className="mt-3 text-sm font-semibold">
            Loading reports
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Fetching live operational records.
          </p>
        </div>
      </div>
    );
  }

 if (
  error ||
  (role === 'admin' && !adminData) ||
  (role !== 'admin' && !data)
) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-7 w-7 text-safety-danger" />

          <p className="mt-3 text-sm font-semibold">
            Failed to load reports
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {error || 'No report data available.'}
          </p>
        </div>
      </div>
    );
  }
if (role === 'admin' && adminData) {
  const totalIncidents = adminData.incidents.total;
  const closedIncidents = adminData.incidents.closed;
  const highPriority = adminData.incidents.highPriority;

  const totalEquipment = adminData.equipment.total;
  const operationalEquipment =
    adminData.equipment.operational;
  const outOfService =
    adminData.equipment.outOfService;

  const incidentClosureRate =
    totalIncidents > 0
      ? Math.round(
          (closedIncidents / totalIncidents) * 100
        )
      : 0;

  const equipmentCoverage =
    totalEquipment > 0
      ? Math.round(
          (operationalEquipment /
            totalEquipment) *
            100
        )
      : 0;

  return (
    <div className="space-y-6">

      <div>
        <p className="text-xs text-muted-foreground">
          Platform reporting
        </p>

        <h1 className="mt-2 font-display text-2xl font-semibold">
          Reports
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Platform-wide operational and compliance records.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <MetricCard
          label="Total mines"
          value={String(adminData.mines.total)}
          change={`${adminData.mines.active} active`}
          trend="flat"
          icon={Building2}
          tone="primary"
        />

        <MetricCard
          label="Total workers"
          value={String(adminData.workers.total)}
          change="Across all mines"
          trend="flat"
          icon={Users}
          tone="success"
        />

        <MetricCard
          label="Total incidents"
          value={String(totalIncidents)}
          change={`${highPriority} high priority`}
          trend="down"
          icon={AlertTriangle}
          tone="danger"
        />

        <MetricCard
          label="Equipment coverage"
          value={`${equipmentCoverage}%`}
          change={`${outOfService} out of service`}
          trend="up"
          icon={Wrench}
          tone="primary"
        />

      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        <div className="ops-card p-5">
          <PanelTitle
            icon={ShieldCheck}
            eyebrow="Incident compliance"
            title="Platform incident status"
          />

          <div className="mt-5 space-y-5">

            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Incidents closed
                </span>

                <span className="font-semibold">
                  {closedIncidents} / {totalIncidents}
                </span>
              </div>

              <div className="mt-2 h-2 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${incidentClosureRate}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Active incidents
              </span>

              <Badge
                tone={
                  adminData.incidents.active > 0
                    ? 'warning'
                    : 'success'
                }
              >
                {adminData.incidents.active}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Critical incidents
              </span>

              <Badge tone="danger">
                {adminData.incidents.critical}
              </Badge>
            </div>

          </div>
        </div>

        <div className="ops-card p-5">
          <PanelTitle
            icon={Wrench}
            eyebrow="Equipment"
            title="Platform asset status"
          />

          <div className="mt-5 space-y-5">

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Total equipment
              </span>

              <span className="font-semibold">
                {totalEquipment}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Operational
              </span>

              <span className="font-semibold text-safety-success">
                {operationalEquipment}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Maintenance
              </span>

              <span className="font-semibold text-safety-warning">
                {adminData.equipment.maintenance}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Out of service
              </span>

              <span className="font-semibold text-safety-danger">
                {outOfService}
              </span>
            </div>

          </div>
        </div>

      </div>

      <div className="ops-card p-5">

        <PanelTitle
          icon={Users}
          eyebrow="Attendance"
          title="Platform attendance"
        />

        <div className="mt-5 grid gap-4 sm:grid-cols-3">

          <MetricCard
            label="Attendance records"
            value={String(
              adminData.attendance.records
            )}
            change="All mines"
            trend="flat"
            icon={Users}
            tone="primary"
          />

          <MetricCard
            label="Today's records"
            value={String(
              adminData.attendance.todayRecords
            )}
            change="Today"
            trend="flat"
            icon={Clock3}
            tone="info"
          />

          <MetricCard
            label="Late today"
            value={String(
              adminData.attendance.todayLate
            )}
            change="Today's attendance"
            trend={
              adminData.attendance.todayLate > 0
                ? 'down'
                : 'flat'
            }
            icon={Clock3}
            tone={
              adminData.attendance.todayLate > 0
                ? 'warning'
                : 'success'
            }
          />

        </div>

      </div>

      <div className="ops-card overflow-hidden">

        <div className="flex items-center justify-between border-b border-border p-4">

          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />

            <span className="text-sm font-semibold">
              Recent platform incidents
            </span>
          </div>

          <span className="text-[10px] text-muted-foreground">
            Latest 10 records
          </span>

        </div>

        {adminData.recentIncidents.length === 0 ? (
          <div className="p-10 text-center">

            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />

            <p className="mt-3 text-sm font-semibold">
              No incident records
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              No incidents are available across the platform.
            </p>

          </div>
        ) : (
          <div className="divide-y divide-border/70">

            {adminData.recentIncidents.map(
              (incident) => (
                <div
                  key={incident.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
                >

                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <FileText className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">

                    <p className="text-sm font-semibold">
                      {incident.title}
                    </p>

                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {incident.mine_name ||
                        'Unknown mine'}
                      {incident.mine_code
                        ? ` · ${incident.mine_code}`
                        : ''}
                    </p>

                  </div>

                  <div className="flex items-center gap-2">

                    <Badge
                      tone={
                        incident.severity ===
                        'CRITICAL'
                          ? 'danger'
                          : incident.severity ===
                            'HIGH'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {incident.severity}
                    </Badge>

                    <Badge
                      tone={
                        incident.status ===
                        'CLOSED'
                          ? 'success'
                          : incident.status ===
                            'RESOLVED'
                          ? 'success'
                          : 'warning'
                      }
                    >
                      {incident.status}
                    </Badge>

                  </div>

                </div>
              )
            )}

          </div>
        )}

      </div>

    </div>
  );
}
  const {
    totalIncidents,
    closedIncidents,
    highPriority,
    totalEquipment,
    operationalEquipment,
    outOfService,
    attendanceRecords,
    lateRecords,
  } = data.summary;

  const incidentClosureRate =
    totalIncidents > 0
      ? Math.round(
          (closedIncidents / totalIncidents) * 100
        )
      : 0;

  const equipmentCoverage =
    totalEquipment > 0
      ? Math.round(
          (operationalEquipment / totalEquipment) * 100
        )
      : 0;

  return (
    <div className="space-y-6">

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs text-muted-foreground">
            Evidence & accountability
          </p>

          <h1 className="mt-2 font-display text-2xl font-semibold">
            Reports
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Generate a clear record of live operational activity.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast({
                title: 'Schedule report',
                description:
                  'Report scheduling will be connected next.',
              })
            }
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Schedule
          </Button>

          <Button
            size="sm"
            onClick={() =>
              toast({
                title: 'Report builder',
                description:
                  'Choose a report type to generate from live data.',
              })
            }
          >
            <FileText className="h-3.5 w-3.5" />
            Generate report
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">

        <MetricCard
          label="Total incidents"
          value={String(totalIncidents)}
          change={`${highPriority} high priority`}
          trend="down"
          icon={AlertTriangle}
          tone="danger"
        />

        <MetricCard
          label="Incident closure"
          value={`${incidentClosureRate}%`}
          change={`${closedIncidents} closed`}
          trend="up"
          icon={CheckCircle2}
          tone="success"
        />

        <MetricCard
          label="Equipment coverage"
          value={`${equipmentCoverage}%`}
          change={`${outOfService} out of service`}
          trend="up"
          icon={Wrench}
          tone="primary"
        />

      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        <div className="ops-card p-5">
          <PanelTitle
            icon={Activity}
            eyebrow="Operational snapshot"
            title="Current mine status"
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">

            <div className="rounded-lg border border-border bg-secondary/40 p-4">
              <p className="text-[10px] text-muted-foreground">
                Operational equipment
              </p>

              <p className="mt-2 font-display text-2xl font-semibold">
                {operationalEquipment}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-secondary/40 p-4">
              <p className="text-[10px] text-muted-foreground">
                Out of service
              </p>

              <p className="mt-2 font-display text-2xl font-semibold text-safety-danger">
                {outOfService}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-secondary/40 p-4">
              <p className="text-[10px] text-muted-foreground">
                Attendance records · 7 days
              </p>

              <p className="mt-2 font-display text-2xl font-semibold">
                {attendanceRecords}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-secondary/40 p-4">
              <p className="text-[10px] text-muted-foreground">
                Late attendance
              </p>

              <p className="mt-2 font-display text-2xl font-semibold text-safety-warning">
                {lateRecords}
              </p>
            </div>

          </div>
        </div>

        <div className="ops-card p-5">
          <PanelTitle
            icon={ShieldCheck}
            eyebrow="Compliance"
            title="Incident compliance"
          />

          <div className="mt-5">

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Incidents closed
              </span>

              <span className="font-semibold">
                {closedIncidents} / {totalIncidents}
              </span>
            </div>

            <div className="mt-2 h-2 rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${incidentClosureRate}%`,
                }}
              />
            </div>

            <div className="mt-6 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                High priority incidents
              </span>

              <span className="font-semibold text-safety-danger">
                {highPriority}
              </span>
            </div>

            <div className="mt-6 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Equipment available/active
              </span>

              <span className="font-semibold">
                {operationalEquipment}
              </span>
            </div>

          </div>
        </div>

      </div>

      <div className="ops-card overflow-hidden">

        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />

            <span className="text-sm font-semibold">
              Recent incident records
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast({
                title: 'Export started',
                description:
                  'Live incident records are being prepared.',
              })
            }
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>

        {data.recentIncidents.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />

            <p className="mt-3 text-sm font-semibold">
              No incident records
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              There are no incidents available for this mine.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">

            {data.recentIncidents.map((incident) => (

              <div
                key={incident.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
              >

                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <FileText className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">

                  <p className="text-sm font-semibold">
                    {incident.title}
                  </p>

                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {incident.incident_type.replace(/_/g, ' ')}
                    {' · '}
                    {incident.location || 'Unknown location'}
                    {' · '}
                    {new Date(
                      incident.incident_date
                    ).toLocaleString()}
                  </p>

                </div>

                <Badge
                  tone={
                    incident.severity === 'CRITICAL' ||
                    incident.severity === 'HIGH'
                      ? 'danger'
                      : incident.severity === 'MEDIUM'
                      ? 'warning'
                      : 'info'
                  }
                >
                  {incident.severity}
                </Badge>

                <Badge
                  tone={
                    incident.status === 'CLOSED'
                      ? 'success'
                      : incident.status === 'RESOLVED'
                      ? 'info'
                      : 'warning'
                  }
                >
                  {incident.status.replace(/_/g, ' ')}
                </Badge>

              </div>

            ))}

          </div>
        )}

      </div>

    </div>
  );
}

function AdminView() {
  const { toast } = useToast(); const sections = [['Users', '1,486 active identities', Users], ['Roles & permissions', '4 role policies configured', ShieldCheck], ['Mines & zones', '3 sites · 14 zones', Map], ['Sensors', '2,184 registered · 98.7% online', RadioTower], ['Integrations', '6 connected services', Layers3], ['Notifications', '12 routing rules active', Bell], ['Audit logs', '24 events in the last hour', FileText], ['System health', 'All services operational', Activity]] as const;
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs text-muted-foreground">Platform governance</p><h1 className="mt-2 font-display text-2xl font-semibold">Administration</h1><p className="mt-2 text-sm text-muted-foreground">Configure the operating system behind your mine.</p></div><Button size="sm" onClick={() => toast({ title: 'Invite user', description: 'The invite workflow is ready to connect to your identity provider.' })}><Users className="h-3.5 w-3.5" /> Invite user</Button></div><div className="ops-card p-5"><PanelTitle icon={Settings} eyebrow="System control" title="Manage your workspace" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{sections.map(([title, description, Icon]) => <Button variant="outline" className="flex h-auto min-h-[132px] flex-col items-start justify-between p-4 text-left hover:border-primary/50 hover:bg-secondary" key={title} onClick={() => toast({ title, description })}><span className="flex w-full items-center justify-between"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-primary"><Icon className="h-4 w-4" /></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></span><span><span className="block text-xs font-semibold">{title}</span><span className="mt-1 block text-[10px] leading-4 text-muted-foreground">{description}</span></span></Button>)}</div></div><div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><div className="ops-card p-5"><PanelTitle icon={Activity} eyebrow="Status" title="System health" /><div className="space-y-4">{[['Telemetry ingestion', 'Operational', 'success'], ['Alert routing', 'Operational', 'success'], ['Report generation', 'Operational', 'success'], ['Data warehouse sync', 'Degraded · 2 min delay', 'warning']].map(([name, status, tone]) => <div className="flex items-center justify-between border-b border-border/60 pb-3 last:border-0 last:pb-0" key={name}><span className="text-xs text-muted-foreground">{name}</span><span className={cx('flex items-center gap-2 text-[11px] font-semibold', tone === 'success' ? 'text-primary' : 'text-safety-warning')}><StatusDot status={tone as 'success' | 'warning'} /> {status}</span></div>)}</div></div><div className="ops-card p-5"><PanelTitle icon={FileText} eyebrow="Governance" title="Recent audit activity" /><div className="space-y-1">{['Role policy updated for Safety Officer', 'New sensor group added to Zone C', 'Report export completed by Priya Sharma', 'Maintenance threshold changed for TR-08'].map((item, i) => <div key={item} className="flex items-center gap-3 rounded-lg px-2 py-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary"><Activity className="h-3.5 w-3.5 text-primary" /></span><div className="flex-1"><p className="text-xs font-medium">{item}</p><p className="mt-1 text-[10px] text-muted-foreground">{i + 1} hour{ i ? 's' : '' } ago · system event</p></div></div>)}</div></div></div></div>;
}

function DetailDrawer({
  alert,
  worker,
  asset,
  onClose,
  onNavigate,
  onIncidentUpdated,
}: {
  alert:
    | IncidentApi
    | typeof alerts[number]
    | null;
  worker: WorkerApi | null;
  asset: typeof equipment[number] | null;
  onClose: () => void;
  onNavigate: (view: View) => void;
  onIncidentUpdated?: () => void;
}) {
  const { toast } = useToast();
  const [updatingIncident, setUpdatingIncident] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  if (!alert && !worker && !asset) {
    return null;
  }

  const isLiveIncident =
    alert !== null &&
    'incident_type' in alert;

  async function handleStartInvestigation(incident: IncidentApi) {
    try {
      setUpdatingIncident(true);
      await updateIncidentStatus(incident.id, 'UNDER_INVESTIGATION');
      toast({
        title: 'Investigation started',
        description: `${incident.title} is now under investigation.`,
      });
      onIncidentUpdated?.();
      onClose();
    } catch (err) {
      console.error('Failed to start investigation:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to start investigation.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingIncident(false);
    }
  }

  async function handleResolve(incident: IncidentApi) {
    if (!resolutionNotes.trim()) {
      toast({
        title: 'Notes required',
        description: 'Resolution notes are required before resolving an incident.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUpdatingIncident(true);
      await resolveIncident(incident.id, resolutionNotes.trim());
      setResolutionNotes('');
      toast({
        title: 'Incident resolved',
        description: `${incident.title} has been marked as resolved.`,
      });
      onIncidentUpdated?.();
      onClose();
    } catch (err) {
      console.error('Failed to resolve incident:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to resolve incident.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingIncident(false);
    }
  }

  async function handleCloseIncident(incident: IncidentApi) {
    try {
      setUpdatingIncident(true);
      await closeIncident(incident.id);
      toast({
        title: 'Incident closed',
        description: `${incident.title} has been closed.`,
      });
      onIncidentUpdated?.();
      onClose();
    } catch (err) {
      console.error('Failed to close incident:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to close incident.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingIncident(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
              {alert
                ? isLiveIncident
                  ? 'Incident detail'
                  : 'Alert detail'
                : worker
                  ? 'Worker profile'
                  : 'Equipment detail'}
            </p>

            <h2 className="mt-1 font-display text-lg font-semibold">
              {alert?.title ??
                worker?.name ??
                asset?.name}
            </h2>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close details"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>


       {alert && 'incident_type' in alert && (
          <div className="space-y-5 pt-5">

            <div className="flex flex-wrap gap-2">
              <Badge
                tone={
                  alert.severity === 'CRITICAL' ||
                  alert.severity === 'HIGH'
                    ? 'danger'
                    : alert.severity === 'MEDIUM'
                      ? 'warning'
                      : 'info'
                }
              >
                {alert.severity}
              </Badge>

              <Badge
                tone={
                  alert.status === 'CLOSED'
                    ? 'neutral'
                    : alert.status === 'RESOLVED'
                      ? 'success'
                      : 'warning'
                }
              >
                {alert.status.replace(/_/g, ' ')}
              </Badge>
            </div>


            <div className="grid grid-cols-2 gap-3">

              <div className="rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-[10px] text-muted-foreground">
                  Incident type
                </p>

                <p className="mt-2 text-sm font-semibold">
                  {alert.incident_type.replace(/_/g, ' ')}
                </p>
              </div>


              <div className="rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-[10px] text-muted-foreground">
                  Severity
                </p>

                <p className="mt-2 text-sm font-semibold">
                  {alert.severity}
                </p>
              </div>


              <div className="rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-[10px] text-muted-foreground">
                  Location
                </p>

                <p className="mt-2 text-sm font-semibold">
                  {alert.location ??
                    'Not specified'}
                </p>
              </div>


              <div className="rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-[10px] text-muted-foreground">
                  Reported
                </p>

                <p className="mt-2 text-sm font-semibold">
                  {new Date(
                    alert.incident_date,
                  ).toLocaleString()}
                </p>
              </div>

            </div>


            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-semibold">
                Description
              </p>

              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {alert.description ||
                  'No description provided.'}
              </p>
            </div>


            {alert.resolution_notes && (
              <div className="rounded-lg border border-primary/25 bg-primary/10 p-4">
                <p className="text-xs font-semibold text-primary">
                  Resolution notes
                </p>

                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {alert.resolution_notes}
                </p>
              </div>
            )}

            <div className="space-y-3 pt-2">
              {alert.status === 'OPEN' && (
                <Button
                  className="w-full"
                  disabled={updatingIncident}
                  onClick={() => handleStartInvestigation(alert)}
                >
                  <Search className="h-4 w-4" />
                  {updatingIncident ? 'Updating...' : 'Start investigation'}
                </Button>
              )}

              {alert.status === 'UNDER_INVESTIGATION' && (
                <>
                  <div>
                    <label
                      htmlFor="resolution-notes"
                      className="mb-2 block text-xs font-semibold"
                    >
                      Resolution notes
                    </label>
                    <textarea
                      id="resolution-notes"
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Describe corrective action, inspection, and outcome..."
                      className="min-h-[110px] w-full rounded-md border border-border bg-background px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                    />
                  </div>

                  <Button
                    className="w-full"
                    disabled={updatingIncident}
                    onClick={() => handleResolve(alert)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {updatingIncident ? 'Resolving...' : 'Mark as resolved'}
                  </Button>
                </>
              )}

              {alert.status === 'RESOLVED' && (
                <Button
                  className="w-full"
                  disabled={updatingIncident}
                  onClick={() => handleCloseIncident(alert)}
                >
                  <Check className="h-4 w-4" />
                  {updatingIncident ? 'Closing...' : 'Close incident'}
                </Button>
              )}

              {alert.status === 'CLOSED' && (
                <div className="rounded-lg border border-primary/25 bg-primary/10 p-3 text-center">
                  <CheckCircle2 className="mx-auto h-5 w-5 text-primary" />
                  <p className="mt-2 text-xs font-semibold text-primary">
                    Incident closed
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    No further action is required.
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => onNavigate('reports')}
              >
                <ArrowUpRight className="h-4 w-4" />
                View incident reports
              </Button>
            </div>

          </div>
        )}


        {alert && !('incident_type' in alert) && (
          <div className="space-y-5 pt-5">

            <Badge
              tone={
                alert.severity === 'critical'
                  ? 'danger'
                  : alert.severity === 'warning'
                    ? 'warning'
                    : 'info'
              }
            >
              <StatusDot
                status={
                  alert.severity === 'critical'
                    ? 'danger'
                    : alert.severity === 'warning'
                      ? 'warning'
                      : 'info'
                }
              />

              {alert.severity} · {alert.time}
            </Badge>


            <div className="grid grid-cols-2 gap-3">

              {[
                [
                  'Risk score',
                  `${alert.score}/100`,
                ],
                [
                  'Reading',
                  alert.reading,
                ],
                [
                  'Affected workers',
                  `${alert.workers}`,
                ],
                [
                  'Location',
                  alert.location,
                ],
              ].map(([label, value]) => (
                <div
                  className="rounded-lg border border-border bg-secondary/50 p-3"
                  key={label}
                >
                  <p className="text-[10px] text-muted-foreground">
                    {label}
                  </p>

                  <p className="mt-2 text-sm font-semibold">
                    {value}
                  </p>
                </div>
              ))}

            </div>


            <div className="rounded-lg border border-safety-warning/25 bg-safety-warning/10 p-4">

              <p className="flex items-center gap-2 text-xs font-semibold text-safety-warning">
                <Zap className="h-3.5 w-3.5" />
                Recommended action
              </p>

              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {alert.action}
              </p>

            </div>


            <div className="grid grid-cols-2 gap-3">

              <Button onClick={onClose}>
                <Check className="h-4 w-4" />
                Acknowledge
              </Button>

              <Button
                variant="danger"
                onClick={() =>
                  onNavigate('reports')
                }
              >
                <ArrowUpRight className="h-4 w-4" />
                Escalate
              </Button>

            </div>

          </div>
        )}


       {worker && (
  <div className="space-y-5 pt-5">

    <div className="flex items-center gap-4">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary font-display text-lg font-semibold text-primary">
        {worker.name
          .split(' ')
          .map((name) => name[0])
          .join('')
          .slice(0, 2)}
      </span>

      <div>
        <p className="text-sm font-semibold">
          {worker.name}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {worker.designation || 'Field Worker'}
        </p>

        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {worker.employee_code}
        </p>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">

      <div className="rounded-lg border border-border bg-secondary/50 p-3">
        <p className="text-[10px] text-muted-foreground">
          Department
        </p>

        <p className="mt-2 text-sm font-semibold">
          {worker.department || '—'}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-secondary/50 p-3">
        <p className="text-[10px] text-muted-foreground">
          Mine
        </p>

        <p className="mt-2 text-sm font-semibold">
          {worker.mine_name || '—'}
        </p>
      </div>

    </div>

    <div className="rounded-lg border border-border p-4">

      <p className="text-xs font-semibold">
        Worker information
      </p>

      <div className="mt-4 space-y-3 text-xs">

        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <span className="text-muted-foreground">
            Phone
          </span>

          <span className="font-medium">
            {worker.phone || '—'}
          </span>
        </div>

        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <span className="text-muted-foreground">
            Employee code
          </span>

          <span className="font-mono font-medium">
            {worker.employee_code}
          </span>
        </div>

        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <span className="text-muted-foreground">
            Department
          </span>

          <span className="font-medium">
            {worker.department || '—'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            Designation
          </span>

          <span className="font-medium">
            {worker.designation || '—'}
          </span>
        </div>

      </div>
    </div>

    <Button
      className="w-full"
      onClick={() => onNavigate('safety')}
    >
      <ShieldCheck className="h-4 w-4" />
      View safety history
    </Button>

  </div>
)}


        {asset && (
          <div className="space-y-5 pt-5">

            <div className="grid grid-cols-2 gap-3">

              {[
                ['Health score', `${asset.health}%`],
                ['Operating hours', '8,420 h'],
                ['Temperature', asset.temp],
                ['Vibration', asset.vibration],
                ['Fuel level', '68%'],
                ['Next service', 'In 42 h'],
              ].map(([label, value]) => (
                <div
                  className="rounded-lg border border-border bg-secondary/50 p-3"
                  key={label}
                >
                  <p className="text-[10px] text-muted-foreground">
                    {label}
                  </p>

                  <p className="mt-2 text-sm font-semibold">
                    {value}
                  </p>
                </div>
              ))}

            </div>


            <div className="rounded-lg border border-primary/25 bg-primary/10 p-4">

              <p className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Predictive maintenance
              </p>

              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Based on vibration and thermal telemetry,
                schedule a bearing inspection in the next
                42 operating hours.
              </p>

            </div>


            <Button
              className="w-full"
              onClick={onClose}
            >
              <Wrench className="h-4 w-4" />
              Schedule maintenance
            </Button>

          </div>
        )}

      </aside>
    </div>
  );
}
function Signup({
  onBack,
  onLogin,
}: {
  onBack: () => void;
  onLogin: () => void;
}) {
  const [selectedRole, setSelectedRole] = useState<
    'FIELD_WORKER' | 'MINE_MANAGER' | 'SAFETY_OFFICER' | null
  >(null);

  const [mines, setMines] = useState<
    {
      id: number;
      name: string;
      mine_code: string;
      location: string | null;
      status: 'ACTIVE' | 'INACTIVE';
    }[]
  >([]);

  const [loadingMines, setLoadingMines] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [registrationId, setRegistrationId] = useState<number | null>(
    null
  );

  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
  

    mineId: '',
    employeeId: '',
    department: '',
    designation: '',

    certificationNumber: '',
    safetyTrainingId: '',
  });

  useEffect(() => {
    const loadMines = async () => {
      try {
        setLoadingMines(true);

        const data = await getMines();

        setMines(data);
      } catch (err) {
        console.error('Failed to load mines:', err);

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load mines.'
        );
      } finally {
        setLoadingMines(false);
      }
    };

    loadMines();
  }, []);

  const updateField = (
    field: keyof typeof form,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const selectRole = (
    role:
      | 'FIELD_WORKER'
      | 'MINE_MANAGER'
      | 'SAFETY_OFFICER'
  ) => {
    setSelectedRole(role);
    setError('');
  };

  const submitRegistration = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError('');

    if (!selectedRole) {
      setError('Please select a role.');
      return;
    }
if (!form.name.trim()) {
  setError('Full name is required.');
  return;
}

if (!form.phone.trim()) {
  setError('Phone number is required.');
  return;
}
  

    if (!form.mineId) {
      setError('Please select your mine.');
      return;
    }

    if (
      selectedRole === 'FIELD_WORKER' &&
      !form.employeeId.trim()
    ) {
      setError('Employee ID is required for Field Workers.');
      return;
    }
    

    if (
      selectedRole === 'SAFETY_OFFICER' &&
      !form.certificationNumber.trim()
    ) {
      setError(
        'Safety certification number is required.'
      );
      return;
    }

    try {
      setSubmitting(true);

      const result = await registerUser({
        name: form.name.trim(),
       email: form.email.trim() || undefined,
        phone: form.phone.trim(),
        

        requestedRole: selectedRole,

        mineId: Number(form.mineId),

        employeeId:
          form.employeeId.trim() || undefined,

        department:
          form.department.trim() || undefined,

        designation:
          form.designation.trim() || undefined,

        certificationNumber:
          form.certificationNumber.trim() || undefined,

        safetyTrainingId:
          form.safetyTrainingId.trim() || undefined,
      });

      setRegistrationId(
        result.registration?.id ?? null
      );

      setSubmitted(true);
    } catch (err) {
      console.error('Registration failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Registration failed.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#05090d] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-2xl">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 md:p-12 text-center shadow-2xl">

            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/10 border border-emerald-400/30">
              <svg
                className="h-8 w-8 text-emerald-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  d="M20 6 9 17l-5-5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <p className="text-sm uppercase tracking-[0.25em] text-emerald-400 mb-3">
              Registration Submitted
            </p>

            <h1 className="text-3xl md:text-4xl font-semibold">
              Your MINEXA application is under review
            </h1>

            <p className="mt-4 text-slate-400 leading-7">
              Your registration has been successfully
              submitted. An authorized MINEXA reviewer
              will verify your application before your
              account is activated.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-6 text-left">
              <div className="flex justify-between gap-4 py-2">
                <span className="text-slate-400">
                  Application ID
                </span>

                <span className="font-mono text-white">
                  {registrationId
                    ? `REG-${String(registrationId).padStart(
                        5,
                        '0'
                      )}`
                    : 'Processing'}
                </span>
              </div>

              <div className="flex justify-between gap-4 py-2">
                <span className="text-slate-400">
                  Requested Role
                </span>

                <span className="text-white">
                  {selectedRole === 'FIELD_WORKER'
                    ? 'Field Worker'
                    : selectedRole === 'MINE_MANAGER'
                    ? 'Mine Manager'
                    : 'Safety Officer'}
                </span>
              </div>

              <div className="flex justify-between gap-4 py-2">
                <span className="text-slate-400">
                  Status
                </span>

                <span className="text-amber-400 font-medium">
                  Pending Approval
                </span>
              </div>
            </div>

            <div className="mt-8">
              <button
                type="button"
                onClick={onLogin}
                className="w-full rounded-xl bg-emerald-400 px-6 py-3.5 font-medium text-black hover:bg-emerald-300 transition"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedRole) {
    return (
      <div className="min-h-screen bg-[#05090d] text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">

          <button
            type="button"
            onClick={onBack}
            className="text-slate-400 hover:text-white transition"
          >
            ← Back
          </button>

          <div className="mx-auto mt-12 max-w-3xl text-center">
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
              Join MINEXA
            </p>

            <h1 className="mt-4 text-4xl md:text-5xl font-semibold">
              What are you joining as?
            </h1>

            <p className="mt-4 text-slate-400">
              Choose the role you are applying for.
              Your role will be assigned after approval.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">

            <button
              type="button"
              onClick={() =>
                selectRole('FIELD_WORKER')
              }
              className="group rounded-3xl border border-white/10 bg-white/[0.03] p-7 text-left transition hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-emerald-400/[0.04]"
            >
              <div className="text-4xl">🦺</div>

              <h2 className="mt-6 text-xl font-semibold">
                Field Worker
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Access personal safety, health,
                tasks, leave and field operations.
              </p>

              <div className="mt-7 text-sm font-medium text-emerald-400">
                Apply as Field Worker →
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                selectRole('MINE_MANAGER')
              }
              className="group rounded-3xl border border-white/10 bg-white/[0.03] p-7 text-left transition hover:-translate-y-1 hover:border-blue-400/40 hover:bg-blue-400/[0.04]"
            >
              <div className="text-4xl">🏭</div>

              <h2 className="mt-6 text-xl font-semibold">
                Mine Manager
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Manage mine operations, workers,
                equipment and operational approvals.
              </p>

              <div className="mt-7 text-sm font-medium text-blue-400">
                Apply as Mine Manager →
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                selectRole('SAFETY_OFFICER')
              }
              className="group rounded-3xl border border-white/10 bg-white/[0.03] p-7 text-left transition hover:-translate-y-1 hover:border-amber-400/40 hover:bg-amber-400/[0.04]"
            >
              <div className="text-4xl">🛡️</div>

              <h2 className="mt-6 text-xl font-semibold">
                Safety Officer
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Manage safety verification,
                compliance and worker safety reviews.
              </p>

              <div className="mt-7 text-sm font-medium text-amber-400">
                Apply as Safety Officer →
              </div>
            </button>

          </div>

          <p className="mt-10 text-center text-sm text-slate-500">
            Platform Admin accounts are created through
            controlled administration and cannot be
            requested through public signup.
          </p>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onLogin}
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05090d] text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">

        <button
          type="button"
          onClick={() => {
            setSelectedRole(null);
            setError('');
          }}
          className="text-slate-400 hover:text-white transition"
        >
          ← Change role
        </button>

        <div className="mt-10">
          <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
            MINEXA Registration
          </p>

          <h1 className="mt-3 text-4xl font-semibold">
            Create your account
          </h1>

          <p className="mt-3 text-slate-400">
            Applying as{' '}
            <span className="text-white font-medium">
              {selectedRole === 'FIELD_WORKER'
                ? 'Field Worker'
                : selectedRole === 'MINE_MANAGER'
                ? 'Mine Manager'
                : 'Safety Officer'}
            </span>
          </p>
        </div>

        {error && (
          <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form
          onSubmit={submitRegistration}
          className="mt-8 space-y-6"
        >

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <h2 className="text-lg font-semibold">
              Personal Information
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-slate-300">
                  Full name
                </label>

                <input
                  value={form.name}
                  onChange={(e) =>
                    updateField(
                      'name',
                      e.target.value
                    )
                  }
                  required
                  placeholder="Enter your full name"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-slate-600 focus:border-emerald-400/60"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Work email
                </label>

<input
 type="email"
 value={form.email}
 onChange={(e) =>
   updateField('email', e.target.value)
 }
 required={selectedRole !== 'FIELD_WORKER'}
 placeholder={
   selectedRole === 'FIELD_WORKER'
     ? 'name@company.com (optional)'
     : 'name@company.com'
 }
 className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-slate-600 focus:border-emerald-400/60"
/>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Phone
                </label>

                <input
                  value={form.phone}
                  onChange={(e) =>
                    updateField(
                      'phone',
                      e.target.value
                    )
                  }
                  required
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-slate-600 focus:border-emerald-400/60"
                />
              </div>





            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <h2 className="text-lg font-semibold">
              Organization
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Mine
                </label>

                <select
                  value={form.mineId}
                  onChange={(e) =>
                    updateField(
                      'mineId',
                      e.target.value
                    )
                  }
                  required
                  disabled={loadingMines}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-emerald-400/60"
                >
                  <option value="">
                    {loadingMines
                      ? 'Loading mines...'
                      : 'Select mine'}
                  </option>

                  {mines.map((mine) => (
                    <option
                      key={mine.id}
                      value={mine.id}
                    >
                      {mine.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRole === 'FIELD_WORKER' && (
                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Employee ID
                  </label>

                  <input
                    value={form.employeeId}
                    onChange={(e) =>
                      updateField(
                        'employeeId',
                        e.target.value
                      )
                    }
                    required
                    placeholder="e.g. MW-1055"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-slate-600 focus:border-emerald-400/60"
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Department
                </label>

                <input
                  value={form.department}
                  onChange={(e) =>
                    updateField(
                      'department',
                      e.target.value
                    )
                  }
                  placeholder="Operations"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-slate-600 focus:border-emerald-400/60"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Designation
                </label>

                <input
                  value={form.designation}
                  onChange={(e) =>
                    updateField(
                      'designation',
                      e.target.value
                    )
                  }
                  placeholder="Your designation"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-slate-600 focus:border-emerald-400/60"
                />
              </div>

            </div>
          </section>

          {(selectedRole === 'FIELD_WORKER' ||
            selectedRole === 'SAFETY_OFFICER') && (
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <h2 className="text-lg font-semibold">
                Safety Information
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">

                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Safety Training ID
                  </label>

                  <input
                    value={form.safetyTrainingId}
                    onChange={(e) =>
                      updateField(
                        'safetyTrainingId',
                        e.target.value
                      )
                    }
                    placeholder="e.g. ST-1055"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-slate-600 focus:border-emerald-400/60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Certification Number
                  </label>

                  <input
                    value={form.certificationNumber}
                    onChange={(e) =>
                      updateField(
                        'certificationNumber',
                        e.target.value
                      )
                    }
                    required={
                      selectedRole ===
                      'SAFETY_OFFICER'
                    }
                    placeholder="Certification ID"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-slate-600 focus:border-emerald-400/60"
                  />
                </div>

              </div>
            </section>
          )}

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">

            <div className="flex items-start gap-3 text-sm text-slate-400">
              <span className="mt-0.5 text-emerald-400">
                ✓
              </span>

              <p>
                By submitting this application, you
                understand that your requested role is
                subject to MINEXA approval and
                verification.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-xl bg-emerald-400 px-6 py-3.5 font-medium text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? 'Submitting application...'
                : 'Submit registration'}
            </button>

          </div>
        </form>

      </div>
    </div>
  );
}
function AppShell({
  role,
  user,
  onLogout,
}: {
  role: Role;
  user: AuthUser | null;
  onLogout: () => void;
}) {
  const [activeView, setActiveView] = useState<View>(roleMeta[role].defaultView); const [sidebarOpen, setSidebarOpen] = useState(false); const [notifications, setNotifications] = useState(false);const [liveNotifications, setLiveNotifications] = useState<IncidentApi[]>([]);
  const [liveAlertCount, setLiveAlertCount] = useState(0);
  const [selectedAlert, setSelectedAlert] = useState<IncidentApi | typeof alerts[number] | null>(null); 
const [selectedWorker, setSelectedWorker] = useState<WorkerApi | null>(null); const [selectedAsset, setSelectedAsset] = useState<typeof equipment[number] | null>(null);
  const [search, setSearch] = useState(''); const { toast } = useToast(); const meta = roleMeta[role]; const RoleIcon = meta.icon;

  const loadNotifications = async () => {
    try {
      const incidents = await getMineIncidents();

      const activeIncidents = incidents.filter(
        (incident) =>
          incident.status === 'OPEN' ||
          incident.status === 'UNDER_INVESTIGATION'
      );

      const sorted = [...activeIncidents]
  .sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  )
  .slice(0, 3);

setLiveAlertCount(activeIncidents.length);
setLiveNotifications(sorted);
    } catch (error) {
      console.error(
        'Failed to load notification incidents:',
        error
      );
    }
  };

  useEffect(() => {
    if (role !== 'manager' && role !== 'safety') {
      return;
    }
    loadNotifications();
  }, [role]);

  const filteredNav = useMemo(() => navItems.filter((item) => roleAccess[role].includes(item.id)), [role]);
  const selectView = (view: View) => { if (!roleAccess[role].includes(view)) { toast({ title: 'Access restricted', description: `This workspace is not available to the ${meta.label.toLowerCase()} role.`, variant: 'destructive' }); return; } setActiveView(view); setSidebarOpen(false); };
  const pageTitle = navItems.find((item) => item.id === activeView)?.label ?? 'Command center';
  return <div className="min-h-screen bg-background text-foreground"><div className={cx('fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity lg:hidden', sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0')} onClick={() => setSidebarOpen(false)} /><aside className={cx('fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-border bg-surface transition-transform lg:translate-x-0', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}><div className="flex h-[76px] items-center border-b border-border px-5"><LogoMark /></div><div className="flex-1 overflow-y-auto px-3 py-5"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Navigation</p><nav className="space-y-1">{filteredNav.map((item, index) => { const Icon = item.icon; return <React.Fragment key={item.id}>{item.section && index !== 0 && <p className="mb-3 mt-7 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">{item.section}</p>}<Button variant={activeView === item.id ? 'secondary' : 'ghost'} onClick={() => selectView(item.id)} className={cx('w-full justify-start gap-3 px-3 text-xs', activeView === item.id && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary')}><Icon className="h-4 w-4" />{item.label}{item.id === 'safety' && <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-safety-danger/15 px-1.5 text-[10px] font-bold text-safety-danger">{liveAlertCount}</span>}</Button></React.Fragment>})}</nav></div><div className="border-t border-border p-3"><Button variant="ghost" className="w-full justify-start gap-3 px-3 text-xs" onClick={() => selectView('settings')}><Settings className="h-4 w-4" /> Workspace settings</Button><div className="mt-2 flex items-center gap-3 rounded-lg bg-secondary/60 p-3"><span className={cx('flex h-8 w-8 items-center justify-center rounded-full bg-background', meta.color)}><RoleIcon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{user?.name ?? 'Worker'}</p><p className="truncate text-[10px] text-muted-foreground">{meta.label}</p></div><Button variant="ghost" size="icon" className="h-7 w-7" onClick={onLogout} aria-label="Log out"><LogOut className="h-3.5 w-3.5" /></Button></div></div></aside><div className="lg:pl-[268px]"><header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></Button><div className="hidden sm:block"><p className="text-[10px] uppercase tracking-[.16em] text-muted-foreground">Workspace / <span className="text-foreground">{pageTitle}</span></p><div className="mt-1 flex items-center gap-2 text-xs font-semibold"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Pit 04 · Jharkhand Operations</div></div><div className="sm:hidden"><LogoMark /></div></div><div className="flex items-center gap-2"><div className="relative hidden w-56 md:block"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workspace" className="h-9 pl-9 text-xs" /></div><Button variant="ghost" size="icon" className="relative" onClick={() => setNotifications(!notifications)} aria-label="Notifications"><Bell className="h-[18px] w-[18px]" />{liveAlertCount > 0 && (<span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-safety-danger" />)}</Button><Button variant="outline" size="sm" className="hidden gap-2 sm:inline-flex"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">HK</span><ChevronDown className="h-3 w-3" /></Button></div></header><main className="mx-auto max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8">{activeView === 'dashboard' && <DashboardView role={role}   user={user}
  onNavigate={selectView}
  onAlert={setSelectedAlert}/>}
  {activeView === 'mine' && <div className="space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs text-muted-foreground">Spatial operations</p><h1 className="mt-2 font-display text-2xl font-semibold">Live mine map</h1><p className="mt-2 text-sm text-muted-foreground">Monitor zones, people, equipment, and risk in one view.</p></div><div className="flex gap-2"><Button variant="outline" size="sm"><RadioTower className="h-3.5 w-3.5" /> Sensor filter</Button><Button variant="outline" size="sm"><Users className="h-3.5 w-3.5" /> Worker filter</Button><Button variant="outline" size="sm"><AlertTriangle className="h-3.5 w-3.5" /> Risk level</Button></div></div>
<LiveMineMapView
  toast={toast}
  onIncidentSelect={setSelectedAlert}
/>
    </div>}{activeView === 'safety' && <SafetyView onSelect={setSelectedAlert} />}{activeView === 'workers' && <WorkersView role={role} onSelect={setSelectedWorker} />}{activeView === 'worker-approvals' && ( <ManagerApprovalCenter />)}{activeView === 'leave-approvals' && (<LeaveApprovalCenter />)}{activeView === 'safety-verification' && (<SafetyVerificationCenter />)}{activeView === 'health' && <WorkerHealth />}{activeView === 'application-status' && (<ApplicationStatus />)}{activeView === 'leave' && (  
  <div className="space-y-6">
    <div>
      <p className="text-xs text-muted-foreground">
        My work
      </p>

      <h1 className="mt-2 font-display text-2xl font-semibold">
        Leave management
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">
        Apply for leave and track your leave requests.
      </p>
    </div>

    <LeaveManagementForm />
  </div>
)}{activeView === 'shifts' && <ShiftManagement />}{activeView === 'equipment' && (<EquipmentManagement />)}{activeView === 'analytics' && <AnalyticsView role={role} />}{activeView === 'reports' && (<ReportsView role={role} />)} {activeView === 'admin' && (
  <AdminApprovalCenter />
)}{activeView === 'settings' && <div className="ops-card max-w-2xl p-6"><PanelTitle icon={Settings} eyebrow="Workspace" title="Settings" /><div className="space-y-4"><div className="flex items-center justify-between rounded-lg border border-border p-4"><div><p className="text-sm font-semibold">Live alert sounds</p><p className="mt-1 text-xs text-muted-foreground">Play a sound when a critical alert is received.</p></div><input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" /></div><div className="flex items-center justify-between rounded-lg border border-border p-4"><div><p className="text-sm font-semibold">Compact data density</p><p className="mt-1 text-xs text-muted-foreground">Show more operational rows in tables.</p></div><input type="checkbox" className="h-4 w-4 accent-primary" /></div><Button onClick={() => toast({ title: 'Settings saved', description: 'Workspace preferences updated.' })}>Save preferences</Button></div></div>}</main></div>{notifications && <div className="fixed right-4 top-[84px] z-40 w-[min(360px,calc(100vw-32px))] rounded-xl border border-border bg-surface p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">Notifications</p><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setNotifications(false)} aria-label="Close notifications"><X className="h-3.5 w-3.5" /></Button></div><div className="space-y-2">
{liveNotifications.length === 0 ? (
  <div className="px-2 py-5 text-center text-xs text-muted-foreground">
    No recent incidents
  </div>
) : (
  liveNotifications.map((incident) => (
    <Button
      key={incident.id}
      variant="ghost"
      className="flex h-auto w-full justify-start gap-3 rounded-lg p-2 text-left"
      onClick={() => {
        setSelectedAlert(incident);
        setNotifications(false);
      }}
    >
      <StatusDot
        status={
          incident.severity === 'CRITICAL' ||
          incident.severity === 'HIGH'
            ? 'danger'
            : incident.severity === 'MEDIUM'
            ? 'warning'
            : 'info'
        }
      />

      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">
          {incident.title}
        </span>

        <span className="mt-1 block text-[10px] text-muted-foreground">
          {incident.location || 'Unknown location'} ·{' '}
          {new Date(incident.created_at).toLocaleString()}
        </span>
      </span>
    </Button>
  ))
)}</div></div>}<DetailDrawer alert={selectedAlert} worker={selectedWorker} asset={selectedAsset} onClose={() => { setSelectedAlert(null); setSelectedWorker(null); setSelectedAsset(null); }} onNavigate={(view) => { setSelectedAlert(null); selectView(view); }} onIncidentUpdated={loadNotifications} /></div>;
}

export default function NeonovaPlatform() {
  const [screen, setScreen] =
    useState<
      'landing' | 'login' | 'signup' |'change-password' |'app'  
    >('landing');

  const [role, setRole] =
    useState<Role>('manager');

  const [currentUser, setCurrentUser] =
    useState<AuthUser | null>(null);

  const [checkingSession, setCheckingSession] =
    useState(true);

  const { toast } = useToast();

  useEffect(() => {
    const restoreSession = async () => {
      const token =
        localStorage.getItem('minexa_token');

      if (!token) {
        setCheckingSession(false);
        return;
      }

      try {
        const user =
          await getCurrentUser();

        const appRole =
          mapBackendRoleToAppRole(
            user.role,
          );

        setCurrentUser({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          workerId: user.workerId,
          loginId: user.loginId,
          mustChangePassword: user.mustChangePassword,
        });

        setRole(appRole);
        

if (user.mustChangePassword) {
  setScreen('change-password');
} else {
  setScreen('app');
}
      } catch (error) {
        console.error(
          'Session restoration failed:',
          error,
        );

        localStorage.removeItem(
          'minexa_token',
        );

        localStorage.removeItem(
          'minexa_user',
        );

        setCurrentUser(null);
        setScreen('login');
      } finally {
        setCheckingSession(false);
      }
    };

    restoreSession();
  }, []);

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />

          <p className="text-sm font-semibold">
            Restoring secure session...
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Verifying your MINEXA account.
          </p>
        </div>
      </div>
    );
  }

  if (screen === 'landing') {
    return (
      <Landing
        onExplore={() =>
          setScreen('login')
        }
        onDemo={() =>
          toast({
            title: 'Demo mode',
            description:
              'Explore the platform with the Mine Manager workspace.',
          })
        }
      />
    );
  }

  if (screen === 'login') {
    return (
      <Login
onLogin={(
  authenticatedRole,
  authenticatedUser,
) => {
  setCurrentUser(
    authenticatedUser,
  );

  setRole(
    authenticatedRole,
  );

  if (authenticatedUser.mustChangePassword) {
    setScreen('change-password');
  } else {
    setScreen('app');
  }
}}


        onSignup={() => setScreen('signup')}
      />
    );
  }
if (screen === 'change-password') {
  return (
    <ChangePassword
      onPasswordChanged={() => {
        setCurrentUser((previousUser) =>
          previousUser
            ? {
                ...previousUser,
                mustChangePassword: false,
              }
            : previousUser
        );

        setScreen('app');
      }}
    />
  );
}
  if (screen === 'signup') {
    return (
      <Signup
        onBack={() => setScreen('login')}
        onLogin={() => setScreen('login')}
      />
    );
  }

  return (
    <AppShell
      role={role}
      user={currentUser}
      onLogout={() => {
        localStorage.removeItem(
          'minexa_token',
        );

        localStorage.removeItem(
          'minexa_user',
        );

        setCurrentUser(null);
        setRole('manager');
        setScreen('landing');
      }}
    />
  );
}