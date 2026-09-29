import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock3,
  Eye,
  FileCheck2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';

import {
  approveAdminRegistration,
  getAdminRegistrations,
  rejectAdminRegistration,
} from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type RegistrationRole =
  | 'FIELD_WORKER'
  | 'MINE_MANAGER'
  | 'SAFETY_OFFICER';

type RegistrationStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

type RegistrationRequest = {
  id: number;
  name: string;
  email?: string | null;
  phone: string ;

  requested_role: RegistrationRole;

  mine_id: number | null;
  mine_name?: string | null;

  employee_id?: string | null;
  department?: string | null;
  designation?: string | null;

  certification_number?: string | null;
  safety_training_id?: string | null;

  status: RegistrationStatus;

  rejection_reason?: string | null;

  submitted_at: string;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
};

type Filter =
  | 'ALL'
  | 'FIELD_WORKER'
  | 'MINE_MANAGER'
  | 'SAFETY_OFFICER';

const roleLabel = (role: RegistrationRole) => {
  switch (role) {
    case 'FIELD_WORKER':
      return 'Field Worker';
    case 'MINE_MANAGER':
      return 'Mine Manager';
    case 'SAFETY_OFFICER':
      return 'Safety Officer';
  }
};

const roleDescription = (role: RegistrationRole) => {
  switch (role) {
    case 'FIELD_WORKER':
      return 'Field access, worker services and mine operations';
    case 'MINE_MANAGER':
      return 'Mine operations and workforce management';
    case 'SAFETY_OFFICER':
      return 'Safety verification, compliance and incident response';
  }
};

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const statusClasses = (status: RegistrationStatus) => {
  switch (status) {
    case 'PENDING':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-400';

    case 'UNDER_REVIEW':
      return 'border-blue-400/20 bg-blue-400/10 text-blue-400';

    case 'APPROVED':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400';

    case 'REJECTED':
      return 'border-red-400/20 bg-red-400/10 text-red-400';

    default:
      return 'border-border bg-secondary text-muted-foreground';
  }
};

const roleClasses = (role: RegistrationRole) => {
  switch (role) {
    case 'FIELD_WORKER':
      return 'border-cyan-400/20 bg-cyan-400/10 text-cyan-400';

    case 'MINE_MANAGER':
      return 'border-blue-400/20 bg-blue-400/10 text-blue-400';

    case 'SAFETY_OFFICER':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-400';
  }
};

export default function AdminApprovalCenter() {
  const { toast } = useToast();

  const [registrations, setRegistrations] = useState<
    RegistrationRequest[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');

  const [filter, setFilter] = useState<Filter>('ALL');

  const [selected, setSelected] =
    useState<RegistrationRequest | null>(null);

  const [rejecting, setRejecting] = useState(false);

  const [rejectionReason, setRejectionReason] =
    useState('');

  const [processingId, setProcessingId] =
    useState<number | null>(null);

  const loadRegistrations = async (
    showRefresh = false
  ) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await getAdminRegistrations();

      setRegistrations(data as RegistrationRequest[]);
    } catch (error) {
      console.error(
        'Failed to load admin registrations:',
        error
      );

      toast({
        title: 'Unable to load applications',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRegistrations();
  }, []);

  const filteredRegistrations = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return registrations.filter((item) => {
      const matchesFilter =
        filter === 'ALL' ||
        item.requested_role === filter;

      if (!matchesFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        item.name,
        item.email,
        item.employee_id,
        item.mine_name,
        item.department,
        item.designation,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(normalizedSearch)
        );
    });
  }, [registrations, filter, search]);

  const counts = useMemo(() => {
    return {
      all: registrations.length,

      workers: registrations.filter(
        (item) =>
          item.requested_role === 'FIELD_WORKER'
      ).length,

      managers: registrations.filter(
        (item) =>
          item.requested_role === 'MINE_MANAGER'
      ).length,

      safety: registrations.filter(
        (item) =>
          item.requested_role === 'SAFETY_OFFICER'
      ).length,

      pending: registrations.filter(
        (item) => item.status === 'PENDING'
      ).length,

      underReview: registrations.filter(
        (item) =>
          item.status === 'UNDER_REVIEW'
      ).length,
    };
  }, [registrations]);

  const handleApprove = async (
    request: RegistrationRequest
  ) => {
    try {
      setProcessingId(request.id);

      const result =
        await approveAdminRegistration(request.id);

      toast({
        title: 'Application approved',
        description:
          result?.message ||
          'The application has been processed.',
      });

      setSelected(null);

      await loadRegistrations(true);
    } catch (error) {
      console.error(
        'Admin approval failed:',
        error
      );

      toast({
        title: 'Approval failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to approve this application.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selected) {
      return;
    }

    const reason =
      rejectionReason.trim();

    if (!reason) {
      toast({
        title: 'Rejection reason required',
        description:
          'Please provide a reason before rejecting the application.',
        variant: 'destructive',
      });

      return;
    }

    try {
      setProcessingId(selected.id);

      const result =
        await rejectAdminRegistration(
          selected.id,
          reason
        );

      toast({
        title: 'Application rejected',
        description:
          result?.message ||
          'The application has been rejected.',
      });

      setSelected(null);
      setRejecting(false);
      setRejectionReason('');

      await loadRegistrations(true);
    } catch (error) {
      console.error(
        'Admin rejection failed:',
        error
      );

      toast({
        title: 'Rejection failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to reject this application.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />

          <p className="text-sm font-semibold">
            Loading approval center...
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Fetching pending registration requests.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs text-muted-foreground">
              Platform governance
            </p>

            <h1 className="mt-2 font-display text-2xl font-semibold">
              Approval Center
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Review and control registration requests
              before identities receive access to MINEXA.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() =>
              loadRegistrations(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing
                  ? 'animate-spin'
                  : ''
              }`}
            />

            {refreshing
              ? 'Refreshing...'
              : 'Refresh queue'}
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard
            label="Open applications"
            value={counts.all}
            icon={FileCheck2}
          />

          <SummaryCard
            label="Pending"
            value={counts.pending}
            icon={Clock3}
          />

          <SummaryCard
            label="Under review"
            value={counts.underReview}
            icon={Eye}
          />

          <SummaryCard
            label="Workers"
            value={counts.workers}
            icon={UserCheck}
          />

          <SummaryCard
            label="Leadership"
            value={
              counts.managers +
              counts.safety
            }
            icon={ShieldCheck}
          />
        </div>

        {/* Search and filter */}
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search by applicant, email, employee ID or mine..."
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <FilterButton
                active={filter === 'ALL'}
                onClick={() => setFilter('ALL')}
              >
                All · {counts.all}
              </FilterButton>

              <FilterButton
                active={
                  filter === 'FIELD_WORKER'
                }
                onClick={() =>
                  setFilter('FIELD_WORKER')
                }
              >
                Workers · {counts.workers}
              </FilterButton>

              <FilterButton
                active={
                  filter === 'MINE_MANAGER'
                }
                onClick={() =>
                  setFilter('MINE_MANAGER')
                }
              >
                Managers · {counts.managers}
              </FilterButton>

              <FilterButton
                active={
                  filter === 'SAFETY_OFFICER'
                }
                onClick={() =>
                  setFilter('SAFETY_OFFICER')
                }
              >
                Safety · {counts.safety}
              </FilterButton>
            </div>
          </div>
        </div>

        {/* Queue */}
        <div className="space-y-3">
          {filteredRegistrations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <Check className="h-5 w-5 text-primary" />
              </div>

              <h3 className="mt-4 text-sm font-semibold">
                No matching applications
              </h3>

              <p className="mt-1 text-xs text-muted-foreground">
                The approval queue is clear for the
                current filter.
              </p>
            </div>
          ) : (
            filteredRegistrations.map(
              (request) => (
                <ApplicationRow
                  key={request.id}
                  request={request}
                  processing={
                    processingId === request.id
                  }
                  onView={() =>
                    setSelected(request)
                  }
                  onApprove={() =>
                    handleApprove(request)
                  }
                  onReject={() => {
                    setSelected(request);
                    setRejecting(true);
                    setRejectionReason('');
                  }}
                />
              )
            )
          )}
        </div>
      </div>

      {/* Review drawer */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
          onClick={() => {
            if (!processingId) {
              setSelected(null);
              setRejecting(false);
            }
          }}
        >
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-border bg-surface shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="border-b border-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                    Registration review
                  </p>

                  <h2 className="mt-2 font-display text-xl font-semibold">
                    {selected.name}
                  </h2>

                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    REG-
                    {String(
                      selected.id
                    ).padStart(5, '0')}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (!processingId) {
                      setSelected(null);
                      setRejecting(false);
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-6 p-5">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${roleClasses(
                    selected.requested_role
                  )}`}
                >
                  {roleLabel(
                    selected.requested_role
                  )}
                </span>

                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusClasses(
                    selected.status
                  )}`}
                >
                  {selected.status.replace(
                    '_',
                    ' '
                  )}
                </span>
              </div>

              <div>
                <p className="text-sm font-semibold">
                  Requested access
                </p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {roleDescription(
                    selected.requested_role
                  )}
                </p>
              </div>

              <DetailSection title="Identity">
                <DetailItem
                  label="Full name"
                  value={selected.name}
                />

                <DetailItem
                  label="Work email"
                  value={selected.email}
                />

                <DetailItem
                  label="Phone"
                  value={selected.phone}
                />
              </DetailSection>

              <DetailSection title="Organization">
                <DetailItem
                  label="Mine"
                  value={
                    selected.mine_name ||
                    `Mine #${selected.mine_id ?? '—'}`
                  }
                />

                <DetailItem
                  label="Department"
                  value={selected.department}
                />

                <DetailItem
                  label="Designation"
                  value={selected.designation}
                />

                {selected.requested_role ===
                  'FIELD_WORKER' && (
                  <DetailItem
                    label="Employee ID"
                    value={selected.employee_id}
                  />
                )}
              </DetailSection>

              {(selected.certification_number ||
                selected.safety_training_id) && (
                <DetailSection title="Verification">
                  <DetailItem
                    label="Certification number"
                    value={
                      selected.certification_number
                    }
                  />

                  <DetailItem
                    label="Safety training ID"
                    value={
                      selected.safety_training_id
                    }
                  />
                </DetailSection>
              )}

              <DetailSection title="Application">
                <DetailItem
                  label="Submitted"
                  value={formatDate(
                    selected.submitted_at
                  )}
                />

                <DetailItem
                  label="Application status"
                  value={selected.status}
                />
              </DetailSection>

              {selected.requested_role ===
                'FIELD_WORKER' && (
                <div className="rounded-xl border border-blue-400/20 bg-blue-400/5 p-4">
                  <p className="text-xs font-semibold text-blue-400">
                    Worker approval workflow
                  </p>

                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Administrative approval does not
                    activate a Field Worker. The worker
                    still requires the appropriate mine
                    and safety verification stage.
                  </p>
                </div>
              )}

              {/* Actions */}
              {!rejecting ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRejecting(true);
                      setRejectionReason('');
                    }}
                    disabled={
                      processingId !== null
                    }
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>

                  <Button
                    onClick={() =>
                      handleApprove(selected)
                    }
                    disabled={
                      processingId !== null
                    }
                  >
                    <Check className="h-4 w-4" />

                    {processingId === selected.id
                      ? 'Processing...'
                      : selected.requested_role ===
                        'FIELD_WORKER'
                      ? 'Approve organization'
                      : 'Approve & activate'}
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4">
                  <p className="text-sm font-semibold">
                    Reject application
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    This reason will be stored in the
                    registration audit trail.
                  </p>

                  <textarea
                    value={rejectionReason}
                    onChange={(event) =>
                      setRejectionReason(
                        event.target.value
                      )
                    }
                    rows={4}
                    placeholder="Explain why this application is being rejected..."
                    className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                    disabled={
                      processingId !== null
                    }
                  />

                  <div className="mt-3 flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setRejecting(false)
                      }
                      disabled={
                        processingId !== null
                      }
                    >
                      Cancel
                    </Button>

                    <Button
                      type="button"
                      variant="danger"
                      onClick={handleReject}
                      disabled={
                        processingId !== null
                      }
                    >
                      {processingId === selected.id
                        ? 'Rejecting...'
                        : 'Confirm rejection'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

/*
=================================================
SUMMARY CARD
=================================================
*/

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-primary">
          <Icon className="h-4 w-4" />
        </span>

        <span className="font-display text-xl font-semibold">
          {value}
        </span>
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

/*
=================================================
FILTER BUTTON
=================================================
*/

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      onClick={onClick}
      className={
        active
          ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
          : ''
      }
    >
      {children}
    </Button>
  );
}

/*
=================================================
APPLICATION ROW
=================================================
*/

function ApplicationRow({
  request,
  processing,
  onView,
  onApprove,
  onReject,
}: {
  request: RegistrationRequest;
  processing: boolean;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">
              {request.name}
            </h3>

            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${roleClasses(
                request.requested_role
              )}`}
            >
              {roleLabel(
                request.requested_role
              )}
            </span>

            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClasses(
                request.status
              )}`}
            >
              {request.status.replace(
                '_',
                ' '
              )}
            </span>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {request.email}
          </p>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
            <span>
              Mine:{' '}
              <span className="text-foreground">
                {request.mine_name ||
                  `Mine #${request.mine_id ?? '—'}`}
              </span>
            </span>

            {request.employee_id && (
              <span>
                Employee ID:{' '}
                <span className="font-mono text-foreground">
                  {request.employee_id}
                </span>
              </span>
            )}

            <span>
              Submitted:{' '}
              <span className="text-foreground">
                {formatDate(
                  request.submitted_at
                )}
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onView}
          >
            <Eye className="h-3.5 w-3.5" />
            Review
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onApprove}
            disabled={processing}
          >
            <Check className="h-3.5 w-3.5" />

            {processing
              ? 'Processing...'
              : request.requested_role ===
                'FIELD_WORKER'
              ? 'Approve'
              : 'Approve & activate'}
          </Button>

          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onReject}
            disabled={processing}
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

/*
=================================================
DETAIL SECTION
=================================================
*/

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold">
        {title}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

/*
=================================================
DETAIL ITEM
=================================================
*/

function DetailItem({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3">
      <p className="text-[10px] text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 break-words text-xs font-medium">
        {value || '—'}
      </p>
    </div>
  );
}