import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { z } from 'zod';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useToast } from '@/hooks/use-toast';

import {
   cancelLeaveRequest,
  createLeaveRequest,
  getLeaveRequests,
   getLeaveBalance,
  type LeaveBalanceApi,
} from '@/lib/api';

const leaveRequestSchema = z
  .object({
    leaveType: z.enum(
      ['annual', 'sick', 'personal', 'emergency'],
      {
        required_error: 'Select a leave type.',
      },
    ),

    startDate: z
      .string()
      .min(1, 'Select a start date.'),

    endDate: z
      .string()
      .min(1, 'Select an end date.'),

    reason: z
      .string()
      .trim()
      .min(
        10,
        'Add at least 10 characters explaining your request.',
      )
      .max(
        500,
        'Reason must be 500 characters or fewer.',
      ),
  })
  .superRefine((request, context) => {
    const start = new Date(
      `${request.startDate}T00:00:00`,
    );

    const end = new Date(
      `${request.endDate}T00:00:00`,
    );

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return;
    }

    if (end < start) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message:
          'End date must be on or after the start date.',
      });
    }
  });

type LeaveType =
  | 'annual'
  | 'sick'
  | 'personal'
  | 'emergency';

type LeaveStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

type LeaveRequest = {
  id: number;
  workerId: number;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  submittedAt: string;
   rejectionReason?: string | null;
};

type LeaveForm = {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
};

const leaveLabels: Record<LeaveType, string> = {
  annual: 'Annual leave',
  sick: 'Sick leave',
  personal: 'Personal leave',
  emergency: 'Emergency leave',
};



const initialForm: LeaveForm = {
  leaveType: '',
  startDate: '',
  endDate: '',
  reason: '',
};



const getWorkingDays = (
  startDate: string,
  endDate: string,
) => {
  if (!startDate || !endDate) {
    return 0;
  }

  const start = new Date(
    `${startDate}T00:00:00`,
  );

  const end = new Date(
    `${endDate}T00:00:00`,
  );

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return 0;
  }

  if (end < start) {
    return 0;
  }

  let days = 0;

  const current = new Date(start);

  while (current <= end) {
    const day = current.getDay();

    // Sunday = 0
    // Saturday = 6
    if (day !== 0 && day !== 6) {
      days += 1;
    }

    current.setDate(
      current.getDate() + 1,
    );
  }

  return days;
};

const formatDate = (date: string) => {
  if (!date) return '-';

  const rawDate = String(date);

  const parsedDate =
    rawDate.length === 10
      ? new Date(`${rawDate}T00:00:00`)
      : new Date(rawDate);

  if (Number.isNaN(parsedDate.getTime())) {
    console.error('Invalid date received:', date);
    return '-';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate);
};

const formatSubmittedDate = (date: string) => {
  if (!date) return '-';

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    console.error('Invalid submitted date:', date);
    return '-';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate);
};

const getStatusStyles = (
  status: LeaveStatus,
) => {
  switch (status) {
    case 'approved':
      return 'bg-primary/10 text-primary border-primary/20';

    case 'rejected':
      return 'bg-safety-danger/10 text-safety-danger border-safety-danger/20';

    case 'cancelled':
      return 'bg-muted text-muted-foreground border-border';

    default:
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  }
};

const mapApiRequest = (
  request: {
    id: number;
    worker_id: number;
    leave_type: LeaveType;
    start_date: string;
    end_date: string;
    days: number;
    reason: string;
    status: LeaveStatus;
    submitted_at: string;

    rejection_reason?: string | null;
  },
): LeaveRequest => ({
  id: request.id,
  workerId: request.worker_id,
  leaveType: request.leave_type,
  startDate: request.start_date,
  endDate: request.end_date,
  days: request.days,
  reason: request.reason,
  status: request.status,
  submittedAt: request.submitted_at,

  rejectionReason:
    request.rejection_reason ?? null,
});

export default function LeaveManagementForm() {
  const [form, setForm] =
    useState<LeaveForm>(initialForm);

  const [requests, setRequests] =
    useState<LeaveRequest[]>([]);

  const [balances, setBalances] =
    useState<LeaveBalanceApi[]>([]);

  const [balanceLoading, setBalanceLoading] =
    useState(true);

  const [showForm, setShowForm] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);
  const [cancellingId, setCancellingId] =
  useState<number | null>(null);

  const {
    toast,
  } = useToast();

  // --------------------------------------------------
  // LOAD LEAVE REQUESTS FROM EXPRESS + POSTGRESQL
  // --------------------------------------------------

  useEffect(() => {
    const loadLeaveData =
      async () => {
        try {
          setLoading(true);
          setBalanceLoading(true);

          const [
            leaveRequests,
            leaveBalance,
          ] = await Promise.all([
            getLeaveRequests(),
            getLeaveBalance(),
          ]);

          setRequests(
            leaveRequests.map(mapApiRequest),
          );

          setBalances(
            leaveBalance.balances,
          );
        } catch (error) {
          console.error(
            'Unable to load worker leave data:',
            error,
          );

          toast({
            title:
              'Unable to load leave information',
            description:
              error instanceof Error
                ? error.message
                : 'Make sure the MINEXA backend is running.',
            variant: 'destructive',
          });
        } finally {
          setLoading(false);
          setBalanceLoading(false);
        }
      };

    loadLeaveData();
  }, [toast]);

  // --------------------------------------------------
  // CALCULATE WORKING DAYS
  // --------------------------------------------------

  const duration = useMemo(
    () =>
      getWorkingDays(
        form.startDate,
        form.endDate,
      ),
    [
      form.startDate,
      form.endDate,
    ],
  );

  // --------------------------------------------------
  // UPDATE FORM FIELD
  // --------------------------------------------------

  const updateField = (
    field: keyof LeaveForm,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // --------------------------------------------------
  // LIVE LEAVE BALANCE HELPERS
  // --------------------------------------------------

  const getBalance = (
    type: LeaveType,
  ): LeaveBalanceApi => {
    const found = balances.find(
      (balance) =>
        balance.leaveType === type,
    );
    if (found) return found;

    const defaultAllocations: Record<LeaveType, number> = {
      annual: 18,
      sick: 12,
      personal: 6,
      emergency: 5,
    };

    const days = defaultAllocations[type] ?? 12;
    return {
      leaveType: type,
      allocatedDays: days,
      approvedDays: 0,
      pendingDays: 0,
      remainingDays: days,
    };
  };

  const selectedBalance =
    form.leaveType
      ? getBalance(
          form.leaveType as LeaveType,
        ) ?? null
      : null;

  const getRemainingBalance = (
    type: LeaveType,
  ) =>
    getBalance(type)?.remainingDays ?? 0;

  const getAllocatedDays = (
    type: LeaveType,
  ) =>
    getBalance(type)?.allocatedDays ?? 0;

  const getApprovedDays = (
    type: LeaveType,
  ) =>
    getBalance(type)?.approvedDays ?? 0;

  const getPendingDays = (
    type: LeaveType,
  ) =>
    getBalance(type)?.pendingDays ?? 0;

  // --------------------------------------------------
  // SUBMIT LEAVE REQUEST
  // --------------------------------------------------

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const result =
      leaveRequestSchema.safeParse(
        form,
      );

    if (!result.success) {
      toast({
        title:
          'Review your leave request',
        description:
          result.error.issues[0]
            ?.message ??
          'Complete all required fields.',
        variant:
          'destructive',
      });

      return;
    }

    const requestDays =
      getWorkingDays(
        result.data.startDate,
        result.data.endDate,
      );

    if (requestDays === 0) {
      toast({
        title:
          'Invalid leave duration',
        description:
          'Select at least one working day.',
        variant:
          'destructive',
      });

      return;
    }

    const balance = getBalance(
      result.data.leaveType,
    );

    if (!balance) {
      toast({
        title: 'Leave balance unavailable',
        description:
          'No balance has been configured for this leave type.',
        variant: 'destructive',
      });

      return;
    }

    const remaining =
      balance.remainingDays;

    if (requestDays > remaining) {
      toast({
        title:
          'Insufficient leave balance',
        description:
          `Only ${remaining} day(s) are available for this leave type.`,
        variant:
          'destructive',
      });

      return;
    }

    try {
      setSubmitting(true);

      // Send request to Express
      const createdRequest =
  await createLeaveRequest({
    leaveType: result.data.leaveType,
    startDate: result.data.startDate,
    endDate: result.data.endDate,
    days: requestDays,
    reason: result.data.reason,
  });
      // Convert API response into UI format
      const newRequest =
        mapApiRequest(
          createdRequest,
        );

      // Add new request to the top
      setRequests(
        (current) => [
          newRequest,
          ...current,
        ],
      );

      // Refresh balance so pending days stay in sync.
      try {
        const updatedBalance =
          await getLeaveBalance();

        setBalances(
          updatedBalance.balances,
        );
      } catch (balanceError) {
        console.error(
          'Unable to refresh leave balance:',
          balanceError,
        );
      }

      // Reset form
      setForm(initialForm);

      setShowForm(false);

      toast({
        title:
          'Leave request submitted',
        description:
          'Your request has been saved and sent for supervisor approval.',
      });
    } catch (error) {
      console.error(
        'Unable to submit leave request:',
        error,
      );

      toast({
        title:
          'Submission failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to submit your leave request.',
        variant:
          'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------
  // CANCEL LEAVE REQUEST
  // --------------------------------------------------

  const cancelRequest = async (id: number) => {
  try {
    setCancellingId(id);

    const cancelledRequest =
      await cancelLeaveRequest(id);

    const updatedRequest =
      mapApiRequest(cancelledRequest);

    setRequests((current) =>
      current.map((request) =>
        request.id === id
          ? updatedRequest
          : request,
      ),
    );

    toast({
      title: 'Leave request cancelled',
      description:
        'The cancellation has been saved to the database.',
    });
  } catch (error) {
    console.error(
      'Unable to cancel leave request:',
      error,
    );

    toast({
      title: 'Cancellation failed',
      description:
        error instanceof Error
          ? error.message
          : 'Unable to cancel the leave request.',
      variant: 'destructive',
    });
  } finally {
    setCancellingId(null);
  }
};

  return (
    <section
      className="space-y-6"
      aria-labelledby="leave-management-title"
    >
      {/* ------------------------------------------- */}
      {/* HEADER                                      */}
      {/* ------------------------------------------- */}

      <div className="ops-card p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="h-4 w-4" />
            </span>

            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                People services
              </p>

              <h2
                id="leave-management-title"
                className="font-display text-base font-semibold text-foreground"
              >
                Leave management
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Apply for leave and track supervisor approval.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() =>
              setShowForm(
                (current) => !current,
              )
            }
            className="gap-2"
          >
            {showForm ? (
              <>
                <XCircle className="h-4 w-4" />
                Close
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Apply for leave
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ------------------------------------------- */}
      {/* LEAVE BALANCE                               */}
      {/* ------------------------------------------- */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(leaveLabels) as LeaveType[]).map(
          (type) => {
            const total = getAllocatedDays(type);
            const remaining = getRemainingBalance(type);
            const approved = getApprovedDays(type);
            const pending = getPendingDays(type);
            const usedPercent =
              total > 0
                ? Math.min(
                    (approved / total) * 100,
                    100,
                  )
                : 0;

            return (
              <div
                key={type}
                className="ops-card p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
                      {leaveLabels[type]}
                    </p>

                    {balanceLoading ? (
                      <p className="mt-2 text-2xl font-semibold text-muted-foreground">
                        —
                      </p>
                    ) : (
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {remaining}
                      </p>
                    )}

                    <p className="text-[11px] text-muted-foreground">
                      remaining of {total} days
                    </p>
                  </div>

                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {approved} approved
                  </span>
                  {pending > 0 && (
                    <span>
                      {pending} pending
                    </span>
                  )}
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${usedPercent}%`,
                    }}
                  />
                </div>
              </div>
            );
          },
        )}
      </div>

      {/* ------------------------------------------- */}
      {/* APPLY FORM                                  */}
      {/* ------------------------------------------- */}

      {showForm && (
        <div className="ops-card p-5">
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
              New request
            </p>

            <h3 className="mt-1 font-display text-lg font-semibold text-foreground">
              Apply for leave
            </h3>

            <p className="mt-1 text-xs text-muted-foreground">
              Your request will be sent to your supervisor for review.
            </p>
          </div>

          <form
            className="space-y-5"
            onSubmit={
              handleSubmit
            }
            noValidate
          >
            {/* Leave type */}

            <div>
              <label
                htmlFor="leave-type"
                className="mb-2 block text-xs font-semibold text-foreground"
              >
                Leave type
              </label>

              <Select
                value={
                  form.leaveType
                }
                onValueChange={(
                  value,
                ) =>
                  updateField(
                    'leaveType',
                    value,
                  )
                }
              >
                <SelectTrigger
                  id="leave-type"
                >
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="annual">
                    Annual leave
                  </SelectItem>

                  <SelectItem value="sick">
                    Sick leave
                  </SelectItem>

                  <SelectItem value="personal">
                    Personal leave
                  </SelectItem>

                  <SelectItem value="emergency">
                    Emergency leave
                  </SelectItem>
                </SelectContent>
              </Select>

              {selectedBalance && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {getRemainingBalance(
                    form.leaveType as LeaveType,
                  )}{' '}
                  day(s) currently available.
                </p>
              )}
            </div>

            {/* Dates */}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="leave-start"
                  className="mb-2 block text-xs font-semibold text-foreground"
                >
                  Start date
                </label>

                <input
                  id="leave-start"
                  type="date"
                  value={
                    form.startDate
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'startDate',
                      event.target
                        .value,
                    )
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label
                  htmlFor="leave-end"
                  className="mb-2 block text-xs font-semibold text-foreground"
                >
                  End date
                </label>

                <input
                  id="leave-end"
                  type="date"
                  min={
                    form.startDate ||
                    undefined
                  }
                  value={
                    form.endDate
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'endDate',
                      event.target
                        .value,
                    )
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Duration */}

            {duration > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                      Leave duration
                    </p>

                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {duration}{' '}
                      {duration ===
                      1
                        ? 'working day'
                        : 'working days'}
                    </p>
                  </div>

                  <Clock3 className="h-5 w-5 text-primary" />
                </div>

                <p className="mt-2 text-[11px] text-muted-foreground">
                  Weekends are excluded from the calculation.
                </p>
              </div>
            )}

            {/* Reason */}

            <div>
              <label
                htmlFor="leave-reason"
                className="mb-2 block text-xs font-semibold text-foreground"
              >
                Reason
              </label>

              <Textarea
                id="leave-reason"
                value={
                  form.reason
                }
                onChange={(
                  event,
                ) =>
                  updateField(
                    'reason',
                    event.target
                      .value,
                  )
                }
                maxLength={500}
                placeholder="Briefly explain the reason for your leave request"
                className="min-h-28"
              />

              <p className="mt-1 text-right text-[10px] text-muted-foreground">
                {form.reason.length}
                /500
              </p>
            </div>

            {/* Buttons */}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                className="gap-2"
                disabled={
                  submitting
                }
              >
                {submitting ? (
                  <>
                    <Clock3 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Submit leave request
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={
                  submitting
                }
                onClick={() => {
                  setForm(
                    initialForm,
                  );
                  setShowForm(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------- */}
      {/* REQUEST HISTORY                             */}
      {/* ------------------------------------------- */}

      <div className="ops-card p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
              History
            </p>

            <h3 className="mt-1 font-display text-base font-semibold">
              My leave requests
            </h3>
          </div>

          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Loading */}

        {loading ? (
          <div className="rounded-lg border border-border p-8 text-center">
            <Clock3 className="mx-auto h-6 w-6 animate-spin text-primary" />

            <p className="mt-3 text-sm font-semibold">
              Loading leave requests...
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Fetching your latest records.
            </p>
          </div>
        ) : requests.length === 0 ? (
          /* Empty */
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <CalendarDays className="mx-auto h-7 w-7 text-muted-foreground" />

            <p className="mt-3 text-sm font-semibold text-foreground">
              No leave requests yet
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Your submitted leave requests will appear here.
            </p>
          </div>
        ) : (
          /* Requests */
          <div className="space-y-3">
            {requests.map(
              (request) => (
                <div
                  key={
                    request.id
                  }
                  className="rounded-lg border border-border bg-background/30 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">
                          {
                            leaveLabels[
                              request
                                .leaveType
                            ]
                          }
                        </p>

                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getStatusStyles(
                            request.status,
                          )}`}
                        >
                          {
                            request.status
                          }
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(
                          request.startDate,
                        )}{' '}
                        →{' '}
                        {formatDate(
                          request.endDate,
                        )}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {request.days}{' '}
                        {request.days ===
                        1
                          ? 'working day'
                          : 'working days'}
                        {' • '}
                        Submitted{' '}
                        {formatSubmittedDate(
                          request.submittedAt,
                        )}
                      </p>

                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {
                          request.reason
                        }
                      </p>
                      {request.status === 'rejected' &&
  request.rejectionReason && (
    <div className="mt-3 rounded-lg border border-safety-danger/20 bg-safety-danger/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[.15em] text-safety-danger">
        Rejection reason
      </p>

      <p className="mt-1 text-xs leading-5 text-safety-danger/90">
        {request.rejectionReason}
      </p>
    </div>
  )}
                    </div>
{request.status === 'pending' && (
  <Button
    type="button"
    variant="outline"
    size="sm"
    disabled={cancellingId === request.id}
    onClick={() =>
      cancelRequest(request.id)
    }
  >
    {cancellingId === request.id
      ? 'Cancelling...'
      : 'Cancel request'}
  </Button>
)}
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