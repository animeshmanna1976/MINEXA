import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Droplets,
  FileCheck2,
  HeartPulse,
  Pencil,
  Save,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  getMyHealth,
  updateMyHealth,
} from '@/lib/api';
type FitnessStatus =
  | 'fit'
  | 'fit_restricted'
  | 'medical_review'
  | 'not_fit';

type CheckupStatus =
  | 'completed'
  | 'upcoming'
  | 'overdue';

type HealthCheckup = {
  id: string;
  name: string;
  date: string;
  status: CheckupStatus;
};

type HealthNotification = {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
};

type HealthData = {
  fitnessStatus: FitnessStatus;
  lastAssessmentDate: string;
  nextAssessmentDate: string;

  bloodGroup: string;
  restrictions: string;
  notes: string;

  healthScore: number;
  hydration: number;
  restScore: number;
  fatigueLevel: 'Low' | 'Moderate' | 'High';
  medicalCertificateValidUntil: string;
  checkups: HealthCheckup[];
  notifications: HealthNotification[];
};



const initialHealthData: HealthData = {
  fitnessStatus: 'fit',
  lastAssessmentDate: '2026-08-18',
  nextAssessmentDate: '2027-02-18',
  healthScore: 82,
  hydration: 80,
  restScore: 72,
  fatigueLevel: 'Moderate',
  medicalCertificateValidUntil: '2027-02-18',
  bloodGroup: '',
  restrictions: '',
  notes: '',

  checkups: [
    {
      id: 'hc-001',
      name: 'Periodic Medical Examination',
      date: '2026-09-18',
      status: 'upcoming',
    },
    {
      id: 'hc-002',
      name: 'Vision Screening',
      date: '2026-09-18',
      status: 'upcoming',
    },
    {
      id: 'hc-003',
      name: 'Respiratory Assessment',
      date: '2026-10-05',
      status: 'upcoming',
    },
    {
      id: 'hc-004',
      name: 'Previous Medical Assessment',
      date: '2026-08-18',
      status: 'completed',
    },
  ],

  notifications: [
    {
      id: 'n-001',
      title: 'Health checkup reminder',
      message:
        'Your periodic medical examination is due on 18 September 2026.',
      date: '2026-08-31',
      read: false,
    },
    {
      id: 'n-002',
      title: 'Wellness reminder',
      message:
        'Stay hydrated during your shift and follow the recommended break schedule.',
      date: '2026-08-31',
      read: false,
    },
  ],
};

const fitnessMeta: Record<
  FitnessStatus,
  {
    label: string;
    description: string;
    className: string;
    icon: typeof CheckCircle2;
  }
> = {
  fit: {
    label: 'Fit for duty',
    description: 'Current fitness status is valid.',
    className: 'text-primary',
    icon: CheckCircle2,
  },

  fit_restricted: {
    label: 'Fit with restrictions',
    description: 'Work restrictions may apply.',
    className: 'text-amber-500',
    icon: ShieldCheck,
  },

  medical_review: {
    label: 'Medical review required',
    description: 'Follow-up assessment is required.',
    className: 'text-orange-500',
    icon: Clock3,
  },

  not_fit: {
    label: 'Not fit for duty',
    description: 'Do not treat this status as a medical diagnosis.',
    className: 'text-safety-danger',
    icon: XCircle,
  },
};

const formatDate = (date: string | null | undefined) => {
  if (!date) return '-';

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate);
};

const getDaysUntil = (date: string) => {
  const today = new Date();
  const target = new Date(date);

  if (Number.isNaN(target.getTime())) {
    return 0;
  }

  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const difference =
    target.getTime() - today.getTime();

  return Math.ceil(
    difference / (1000 * 60 * 60 * 24),
  );
};

const getCheckupStatusClass = (status: CheckupStatus) => {
  switch (status) {
    case 'completed':
      return 'border-primary/20 bg-primary/10 text-primary';

    case 'overdue':
      return 'border-safety-danger/20 bg-safety-danger/10 text-safety-danger';

    default:
      return 'border-amber-500/20 bg-amber-500/10 text-amber-500';
  }
};

export default function WorkerHealth() {
  const [health, setHealth] =
    useState<HealthData>(initialHealthData);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const { toast } = useToast();
const [editing, setEditing] = useState(false);

const [saving, setSaving] = useState(false);

const [editForm, setEditForm] = useState({
  bloodGroup: '',
  medicalCheckDate: '',
  fitnessExpiryDate: '',
  restrictions: '',
  notes: '',
});
  useEffect(() => {
  let mounted = true;

  const loadHealth = async () => {
    try {
      setLoading(true);
      setError('');

      const apiHealth = await getMyHealth();
setEditForm({
  bloodGroup: apiHealth.blood_group || '',
  medicalCheckDate:
    apiHealth.medical_check_date
      ? apiHealth.medical_check_date.slice(0, 10)
      : '',
  fitnessExpiryDate:
    apiHealth.fitness_expiry_date
      ? apiHealth.fitness_expiry_date.slice(0, 10)
      : '',
  restrictions: apiHealth.restrictions || '',
  notes: apiHealth.notes || '',
});
      if (!mounted) return;

      setHealth((current) => ({
        ...current,

        fitnessStatus:
          apiHealth.medical_status ===
          'FIT'
            ? 'fit'
            : apiHealth.medical_status ===
              'FIT_WITH_RESTRICTIONS'
            ? 'fit_restricted'
            : apiHealth.medical_status ===
              'PENDING'
            ? 'medical_review'
            : 'not_fit',

        lastAssessmentDate:
          apiHealth.medical_check_date ||
          current.lastAssessmentDate,

        nextAssessmentDate:
          apiHealth.fitness_expiry_date ||
          current.nextAssessmentDate,

        medicalCertificateValidUntil:
          apiHealth.fitness_expiry_date ||
          current.medicalCertificateValidUntil,
bloodGroup:
  apiHealth.blood_group ||
  current.bloodGroup,

restrictions:
  apiHealth.restrictions ||
  current.restrictions,

notes:
  apiHealth.notes ||
  current.notes,
        // These are not currently supplied
        // by the backend, so preserve existing
        // frontend-only values for now.
        healthScore: current.healthScore,
        hydration: current.hydration,
        restScore: current.restScore,
        fatigueLevel: current.fatigueLevel,
        checkups: current.checkups,
        notifications: current.notifications,
      }));

    } catch (err) {
      console.error(
        'Failed to load worker health:',
        err
      );

      if (!mounted) return;

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load health profile.'
      );

    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  };

  loadHealth();

  return () => {
    mounted = false;
  };
}, []);
  
const handleSaveHealth = async () => {
  try {
    setSaving(true);

    const updated = await updateMyHealth({
      bloodGroup:
        editForm.bloodGroup.trim() || null,

      medicalCheckDate:
        editForm.medicalCheckDate || null,

      fitnessExpiryDate:
        editForm.fitnessExpiryDate || null,

      restrictions:
        editForm.restrictions.trim() || null,

      notes:
        editForm.notes.trim() || null,
    });

    setHealth((current) => ({
      ...current,

      bloodGroup:
        updated.blood_group || '',

      lastAssessmentDate:
        updated.medical_check_date ||
        current.lastAssessmentDate,

      nextAssessmentDate:
        updated.fitness_expiry_date ||
        current.nextAssessmentDate,

      medicalCertificateValidUntil:
        updated.fitness_expiry_date ||
        current.medicalCertificateValidUntil,

      restrictions:
        updated.restrictions || '',

      notes:
        updated.notes || '',
    }));

    setEditForm({
      bloodGroup: updated.blood_group || '',
      medicalCheckDate:
        updated.medical_check_date
          ? updated.medical_check_date.slice(0, 10)
          : '',
      fitnessExpiryDate:
        updated.fitness_expiry_date
          ? updated.fitness_expiry_date.slice(0, 10)
          : '',
      restrictions:
        updated.restrictions || '',
      notes:
        updated.notes || '',
    });

    setEditing(false);

    toast({
      title: 'Health details updated',
      description:
        'Your health profile has been saved successfully.',
    });

  } catch (err) {
    console.error(
      'Failed to update health profile:',
      err
    );

    toast({
      title: 'Update failed',
      description:
        err instanceof Error
          ? err.message
          : 'Unable to update your health profile.',
      variant: 'destructive',
    });

  } finally {
    setSaving(false);
  }
};
  const nextCheckup = useMemo(() => {
    return health.checkups
      .filter((item) => item.status === 'upcoming')
      .sort(
        (a, b) =>
          new Date(a.date).getTime() -
          new Date(b.date).getTime(),
      )[0];
  }, [health.checkups]);

  const nextCheckupDays = nextCheckup
    ? getDaysUntil(nextCheckup.date)
    : null;

  const unreadNotifications = health.notifications.filter(
    (notification) => !notification.read,
  ).length;

  const FitnessIcon =
    fitnessMeta[health.fitnessStatus].icon;

  if (loading) {
    return (
      <section className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />

          <p className="mt-3 text-sm font-semibold">
            Loading health profile...
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Fetching your latest medical fitness status.
          </p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex min-h-[400px] items-center justify-center">
        <div className="max-w-md text-center">
          <XCircle className="mx-auto h-7 w-7 text-safety-danger" />

          <p className="mt-3 text-sm font-semibold text-safety-danger">
            Unable to load health profile
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {error}
          </p>
        </div>
      </section>
    );
  }

  const markAllNotificationsRead = () => {
    setHealth((current) => ({
      ...current,
      notifications: current.notifications.map(
        (notification) => ({
          ...notification,
          read: true,
        }),
      ),
    }));

    toast({
      title: 'Notifications marked as read',
      description:
        'Your health notifications have been updated.',
    });
  };

  const addCheckupReminder = () => {
    if (!nextCheckup) return;

    const notification: HealthNotification = {
      id: crypto.randomUUID(),
      title: 'Health checkup reminder',
      message: `${nextCheckup.name} is scheduled for ${formatDate(
        nextCheckup.date,
      )}.`,
      date: new Date().toISOString(),
      read: false,
    };

    setHealth((current) => ({
      ...current,
      notifications: [
        notification,
        ...current.notifications,
      ],
    }));

    toast({
      title: 'Reminder added',
      description:
        'You will see this reminder in your health notifications.',
    });
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="ops-card p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HeartPulse className="h-5 w-5" />
            </span>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                Worker safety
              </p>

              <h1 className="mt-1 font-display text-xl font-semibold text-foreground">
                Health &amp; Fitness
              </h1>

              <p className="mt-1 text-xs text-muted-foreground">
                Health-check status, fitness certification and wellness reminders.
              </p>
            </div>
          </div>

<div className="flex items-center gap-2">
  <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
    <UserRound className="h-4 w-4 text-muted-foreground" />

    <div>
      <p className="text-[10px] text-muted-foreground">
        Worker
      </p>

      <p className="text-xs font-semibold">
        Himanshu Kumar · MW-1042
      </p>
    </div>
  </div>

  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={() => setEditing((current) => !current)}
    className="gap-2"
  >
    {editing ? (
      <>
        <X className="h-4 w-4" />
        Cancel
      </>
    ) : (
      <>
        <Pencil className="h-4 w-4" />
        Edit health
      </>
    )}
  </Button>
</div>
        </div>
      </div>
      
{editing && (
  <div className="ops-card p-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
          Health profile
        </p>

        <h2 className="mt-1 font-display text-lg font-semibold">
          Edit health details
        </h2>

        <p className="mt-1 text-xs text-muted-foreground">
          Update your self-managed health information.
          Medical fitness status is controlled by authorized
          safety personnel.
        </p>
      </div>

      <ShieldCheck className="h-5 w-5 text-primary" />
    </div>

    <div className="mt-6 grid gap-4 sm:grid-cols-2">

      {/* Blood group */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
          Blood group
        </label>

        <input
          type="text"
          value={editForm.bloodGroup}
          onChange={(event) =>
            setEditForm((current) => ({
              ...current,
              bloodGroup: event.target.value,
            }))
          }
          placeholder="e.g. B+"
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary"
        />
      </div>

      {/* Medical check date */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
          Medical check date
        </label>

        <input
          type="date"
          value={editForm.medicalCheckDate}
          onChange={(event) =>
            setEditForm((current) => ({
              ...current,
              medicalCheckDate:
                event.target.value,
            }))
          }
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary"
        />
      </div>

      {/* Fitness expiry */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
          Fitness expiry date
        </label>

        <input
          type="date"
          value={editForm.fitnessExpiryDate}
          onChange={(event) =>
            setEditForm((current) => ({
              ...current,
              fitnessExpiryDate:
                event.target.value,
            }))
          }
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary"
        />
      </div>

      {/* Restrictions */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
          Work restrictions
        </label>

        <input
          type="text"
          value={editForm.restrictions}
          onChange={(event) =>
            setEditForm((current) => ({
              ...current,
              restrictions:
                event.target.value,
            }))
          }
          placeholder="e.g. Avoid night shift"
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary"
        />
      </div>

    </div>

    {/* Notes */}
    <div className="mt-4">
      <label className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
        Health notes
      </label>

      <textarea
        value={editForm.notes}
        onChange={(event) =>
          setEditForm((current) => ({
            ...current,
            notes: event.target.value,
          }))
        }
        rows={4}
        placeholder="Add any relevant self-managed notes..."
        className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary"
      />
    </div>

    <div className="mt-5 flex justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => setEditing(false)}
        disabled={saving}
      >
        Cancel
      </Button>

      <Button
        type="button"
        onClick={handleSaveHealth}
        disabled={saving}
        className="gap-2"
      >
        <Save className="h-4 w-4" />

        {saving
          ? 'Saving...'
          : 'Save health details'}
      </Button>
    </div>
  </div>
)}
      {/* Main fitness status */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="ops-card p-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                Fitness status
              </p>

              <div className="mt-3 flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 ${fitnessMeta[
                    health.fitnessStatus
                  ].className}`}
                >
                  <FitnessIcon className="h-5 w-5" />
                </span>

                <div>
                  <h2
                    className={`font-display text-xl font-semibold ${fitnessMeta[
                      health.fitnessStatus
                    ].className}`}
                  >
                    {fitnessMeta[health.fitnessStatus].label}
                  </h2>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {fitnessMeta[health.fitnessStatus].description}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background/30 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
                Health score
              </p>

              <div className="mt-1 flex items-end gap-2">
                <span className="text-3xl font-semibold text-foreground">
                  {health.healthScore}
                </span>

                <span className="mb-1 text-xs text-muted-foreground">
                  / 100
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
                Last assessment
              </p>

              <p className="mt-2 text-sm font-semibold">
                {formatDate(health.lastAssessmentDate)}
              </p>

              <p className="mt-1 text-[11px] text-muted-foreground">
                Medical assessment recorded.
              </p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
                Next assessment
              </p>

              <p className="mt-2 text-sm font-semibold">
                {formatDate(health.nextAssessmentDate)}
              </p>

              <p className="mt-1 text-[11px] text-muted-foreground">
                Fitness certification review.
              </p>
            </div>
          </div>
        </div>

        {/* Certificate */}
        <div className="ops-card p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileCheck2 className="h-4 w-4" />
            </span>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
                Fitness certification
              </p>

              <h2 className="mt-1 text-sm font-semibold">
                Certificate valid
              </h2>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />

              <span className="text-xs font-semibold text-primary">
                Current
              </span>
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground">
              Valid until
            </p>

            <p className="mt-1 text-base font-semibold">
              {formatDate(
                health.medicalCertificateValidUntil,
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Wellness cards */}
      <div>
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
            Wellness
          </p>

          <h2 className="mt-1 font-display text-base font-semibold">
            Daily health indicators
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Hydration */}
          <div className="ops-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-cyan-500" />

                <span className="text-sm font-semibold">
                  Hydration
                </span>
              </div>

              <span className="text-sm font-semibold">
                {health.hydration}%
              </span>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-cyan-500 transition-all"
                style={{
                  width: `${health.hydration}%`,
                }}
              />
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground">
              Keep water intake consistent during long shifts.
            </p>
          </div>

          {/* Rest */}
          <div className="ops-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-amber-500" />

                <span className="text-sm font-semibold">
                  Rest
                </span>
              </div>

              <span className="text-sm font-semibold">
                {health.restScore}%
              </span>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{
                  width: `${health.restScore}%`,
                }}
              />
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground">
              Follow recommended break and sleep routines.
            </p>
          </div>

          {/* Fatigue */}
          <div className="ops-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />

                <span className="text-sm font-semibold">
                  Fatigue self-check
                </span>
              </div>

              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-500">
                {health.fatigueLevel}
              </span>
            </div>

            <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
              This is a self-reported wellness indicator, not a
              medical diagnosis.
            </p>
          </div>
        </div>
      </div>

      {/* Upcoming checkup */}
      <div className="ops-card p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="h-4 w-4" />
            </span>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                Upcoming health check
              </p>

              <h2 className="mt-1 text-base font-semibold">
                {nextCheckup?.name ?? 'No upcoming checkup'}
              </h2>

              {nextCheckup && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(nextCheckup.date)}
                  {nextCheckupDays !== null &&
                    nextCheckupDays >= 0 &&
                    ` · ${nextCheckupDays} day(s) remaining`}
                </p>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={addCheckupReminder}
            disabled={!nextCheckup}
            className="gap-2"
          >
            <Bell className="h-4 w-4" />
            Add reminder
          </Button>
        </div>
      </div>

      {/* Health checkup history */}
      <div className="ops-card p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
              Medical schedule
            </p>

            <h2 className="mt-1 text-base font-semibold">
              Health checkups
            </h2>
          </div>

          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="space-y-3">
          {health.checkups.map((checkup) => (
            <div
              key={checkup.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-background/30 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold">
                  {checkup.name}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(checkup.date)}
                </p>
              </div>

              <span
                className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${getCheckupStatusClass(
                  checkup.status,
                )}`}
              >
                {checkup.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="ops-card p-5">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </span>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
                Notifications
              </p>

              <h2 className="mt-1 text-base font-semibold">
                Health reminders
              </h2>
            </div>

            {unreadNotifications > 0 && (
              <span className="rounded-full bg-safety-danger/10 px-2 py-1 text-[10px] font-bold text-safety-danger">
                {unreadNotifications} unread
              </span>
            )}
          </div>

          {unreadNotifications > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={markAllNotificationsRead}
            >
              Mark all read
            </Button>
          )}
        </div>

        {health.notifications.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Bell className="mx-auto h-6 w-6 text-muted-foreground" />

            <p className="mt-3 text-sm font-semibold">
              No health notifications
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              New health reminders will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {health.notifications.map(
              (notification) => (
                <div
                  key={notification.id}
                  className={`rounded-lg border p-4 ${
                    notification.read
                      ? 'border-border bg-background/20'
                      : 'border-primary/20 bg-primary/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Bell
                      className={`mt-0.5 h-4 w-4 ${
                        notification.read
                          ? 'text-muted-foreground'
                          : 'text-primary'
                      }`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">
                          {notification.title}
                        </p>

                        {!notification.read && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">
                            New
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {notification.message}
                      </p>

                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {formatDate(
                          notification.date.slice(
                            0,
                            10,
                          ),
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

     
     
    </section>
  );
}
