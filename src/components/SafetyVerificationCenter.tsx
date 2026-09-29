import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';

import {
  getSafetyWorkerRegistrations,
  verifyWorkerRegistration,
  rejectSafetyRegistration,
} from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type RegistrationRequest = {
  id: number;
  name: string;
 email?: string | null;
  phone: string ;

  requested_role: 'FIELD_WORKER';

  mine_id: number | null;
  mine_name?: string | null;

  employee_id?: string | null;
  department?: string | null;
  designation?: string | null;

  certification_number?: string | null;
  safety_training_id?: string | null;

  status: 'PENDING' | 'UNDER_REVIEW';

  submitted_at: string;
};

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export default function SafetyVerificationCenter() {
  const { toast } = useToast();

  const [registrations, setRegistrations] = useState<
    RegistrationRequest[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');

  const [selected, setSelected] =
    useState<RegistrationRequest | null>(null);

  const [processingId, setProcessingId] =
    useState<number | null>(null);

  const [rejecting, setRejecting] = useState(false);

  const [rejectionReason, setRejectionReason] =
    useState('');

  const loadQueue = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data =
        await getSafetyWorkerRegistrations();

      setRegistrations(data as RegistrationRequest[]);
    } catch (error) {
      console.error(
        'Failed to load safety verification queue:',
        error
      );

      toast({
        title: 'Unable to load verification queue',
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
    loadQueue();
  }, []);

  const filteredRegistrations = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return registrations;
    }

    return registrations.filter((item) =>
      [
        item.name,
        item.email,
        item.employee_id,
        item.department,
        item.designation,
        item.certification_number,
        item.safety_training_id,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query)
        )
    );
  }, [registrations, search]);

  const handleVerify = async (
    request: RegistrationRequest
  ) => {
    try {
      setProcessingId(request.id);

      const result =
        await verifyWorkerRegistration(
          request.id
        );

      toast({
        title: 'Safety verification completed',
        description:
          result?.message ||
          'Worker account is now active.',
      });

      setSelected(null);

      await loadQueue(true);
    } catch (error) {
      console.error(
        'Safety verification failed:',
        error
      );

      toast({
        title: 'Verification failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to verify this worker.',
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
        title: 'Reason required',
        description:
          'Enter a reason before rejecting this worker.',
        variant: 'destructive',
      });

      return;
    }

    try {
      setProcessingId(selected.id);

      const result =
        await rejectSafetyRegistration(
          selected.id,
          reason
        );

      toast({
        title: 'Worker rejected',
        description:
          result?.message ||
          'Safety verification has been rejected.',
      });

      setSelected(null);
      setRejecting(false);
      setRejectionReason('');

      await loadQueue(true);
    } catch (error) {
      console.error(
        'Safety rejection failed:',
        error
      );

      toast({
        title: 'Rejection failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to reject this worker.',
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
            Loading safety verification...
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Fetching workers awaiting safety review.
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
              Safety governance
            </p>

            <h1 className="mt-2 font-display text-2xl font-semibold">
              Safety Verification
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Verify worker safety credentials before
              granting active MINEXA access.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => loadQueue(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={
                refreshing
                  ? 'h-4 w-4 animate-spin'
                  : 'h-4 w-4'
              }
            />

            {refreshing
              ? 'Refreshing...'
              : 'Refresh queue'}
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            icon={ShieldCheck}
            label="Awaiting verification"
            value={registrations.length}
          />

          <SummaryCard
            icon={Eye}
            label="Ready for review"
            value={registrations.length}
          />

<SummaryCard
  icon={Check}
  label="Workers ready for verification"
  value={registrations.length}
/>
        </div>

        {/* Search */}
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search worker, email, employee ID, certification..."
              className="pl-10"
            />
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
                No safety verifications pending
              </h3>

              <p className="mt-1 text-xs text-muted-foreground">
                Workers requiring safety verification
                will appear here.
              </p>
            </div>
          ) : (
            filteredRegistrations.map(
              (request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-border bg-surface p-5"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">
                          {request.name}
                        </h3>

                        <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-[10px] font-semibold text-blue-400">
                          UNDER REVIEW
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground">
                        {request.email}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
                        <span>
                          Employee ID:{' '}
                          <span className="font-mono text-foreground">
                            {request.employee_id ||
                              '—'}
                          </span>
                        </span>

                        <span>
                          Training:{' '}
                          <span className="text-foreground">
                            {request.safety_training_id ||
                              '—'}
                          </span>
                        </span>

                        <span>
                          Certification:{' '}
                          <span className="text-foreground">
                            {request.certification_number ||
                              '—'}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 xl:shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSelected(request)
                        }
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Review
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          handleVerify(request)
                        }
                        disabled={
                          processingId !== null
                        }
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />

                        {processingId === request.id
                          ? 'Verifying...'
                          : 'Verify'}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setSelected(request);
                          setRejecting(true);
                          setRejectionReason('');
                        }}
                        disabled={
                          processingId !== null
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
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
                    Safety review
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
                <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-[11px] font-semibold text-blue-400">
                  Under Review
                </span>

                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-400">
                  Manager Approved
                </span>
              </div>

              <DetailSection title="Identity">
                <DetailItem
                  label="Full name"
                  value={selected.name}
                />

                <DetailItem
                  label="Email"
                  value={selected.email}
                />

                <DetailItem
                  label="Phone"
                  value={selected.phone}
                />
              </DetailSection>

              <DetailSection title="Employment">
                <DetailItem
                  label="Employee ID"
                  value={selected.employee_id}
                />

                <DetailItem
                  label="Department"
                  value={selected.department}
                />

                <DetailItem
                  label="Designation"
                  value={selected.designation}
                />

                <DetailItem
                  label="Mine"
                  value={
                    selected.mine_name ||
                    `Mine #${selected.mine_id ?? '—'}`
                  }
                />
              </DetailSection>

              <DetailSection title="Safety credentials">
                <DetailItem
                  label="Safety Training ID"
                  value={
                    selected.safety_training_id
                  }
                />

                <DetailItem
                  label="Certification Number"
                  value={
                    selected.certification_number
                  }
                />
              </DetailSection>

              <DetailSection title="Application">
                <DetailItem
                  label="Submitted"
                  value={formatDate(
                    selected.submitted_at
                  )}
                />

                <DetailItem
                  label="Current status"
                  value={selected.status}
                />
              </DetailSection>

              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                <p className="text-xs font-semibold text-emerald-400">
                  Final activation step
                </p>

                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Verification will create the worker
                  profile, create the authenticated user
                  account, mark the registration approved,
                  and activate MINEXA access.
                </p>
              </div>

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
                      handleVerify(selected)
                    }
                    disabled={
                      processingId !== null
                    }
                  >
                    <ShieldCheck className="h-4 w-4" />

                    {processingId === selected.id
                      ? 'Verifying...'
                      : 'Verify & activate'}
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4">
                  <p className="text-sm font-semibold">
                    Reject safety verification
                  </p>

                  <textarea
                    value={rejectionReason}
                    onChange={(event) =>
                      setRejectionReason(
                        event.target.value
                      )
                    }
                    rows={4}
                    disabled={
                      processingId !== null
                    }
                    placeholder="Explain why the safety verification failed..."
                    className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
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
                      {processingId ===
                      selected.id
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

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
          <Icon className="h-4 w-4" />
        </span>

        <span className="font-display text-2xl font-semibold">
          {value}
        </span>
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="mb-3 text-xs font-semibold">
        {title}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

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