import { useEffect, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

import {
  getManagerLeaveRequests,
  approveManagerLeaveRequest,
  rejectManagerLeaveRequest,
  type ManagerLeaveRequest,
} from '@/lib/api';

const formatDate = (value: string) => {
  if (!value) return '—';

  return new Date(value).toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  );
};

const leaveLabel = (type: ManagerLeaveRequest['leave_type']) => {
  switch (type) {
    case 'annual':
      return 'Annual Leave';
    case 'sick':
      return 'Sick Leave';
    case 'personal':
      return 'Personal Leave';
    case 'emergency':
      return 'Emergency Leave';
    default:
      return type;
  }
};

export default function LeaveApprovalCenter() {
  const { toast } = useToast();

  const [requests, setRequests] = useState<
    ManagerLeaveRequest[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [processingId, setProcessingId] =
    useState<number | null>(null);

  const [rejectingId, setRejectingId] =
    useState<number | null>(null);

  const [rejectionReason, setRejectionReason] =
    useState('');

  const loadRequests = async () => {
    try {
      setLoading(true);

      const data =
        await getManagerLeaveRequests();

      setRequests(data);
    } catch (error) {
      console.error(
        'Failed to load manager leave requests:',
        error,
      );

      toast({
        title: 'Unable to load leave requests',
        description:
          error instanceof Error
            ? error.message
            : 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      setProcessingId(id);

      const updated =
        await approveManagerLeaveRequest(id);

      setRequests((current) =>
        current.filter(
          (request) => request.id !== updated.id,
        ),
      );

      toast({
        title: 'Leave approved',
        description:
          'The worker leave request has been approved.',
      });
    } catch (error) {
      console.error(
        'Failed to approve leave:',
        error,
      );

      toast({
        title: 'Approval failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to approve leave request.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (id: number) => {
    setRejectingId(id);
    setRejectionReason('');
  };

  const closeRejectDialog = () => {
    if (processingId !== null) return;

    setRejectingId(null);
    setRejectionReason('');
  };

  const handleReject = async () => {
    if (rejectingId === null) return;

    const reason =
      rejectionReason.trim();

    if (!reason) {
      toast({
        title: 'Reason required',
        description:
          'Please enter a reason for rejecting this leave request.',
        variant: 'destructive',
      });

      return;
    }

    try {
      setProcessingId(rejectingId);

      const updated =
        await rejectManagerLeaveRequest(
          rejectingId,
          reason,
        );

      setRequests((current) =>
        current.filter(
          (request) => request.id !== updated.id,
        ),
      );

      toast({
        title: 'Leave rejected',
        description:
          'The worker has been notified through the updated request status.',
      });

      closeRejectDialog();
    } catch (error) {
      console.error(
        'Failed to reject leave:',
        error,
      );

      toast({
        title: 'Rejection failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to reject leave request.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <>
      <section className="space-y-6">
        {/* Header */}
        <div className="ops-card p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                  Workforce
                </p>

                <h1 className="mt-1 font-display text-2xl font-semibold">
                  Leave requests
                </h1>

                <p className="mt-1 text-sm text-muted-foreground">
                  Review and approve leave requests from workers in your mine.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />

              <div>
                <p className="text-[10px] text-muted-foreground">
                  Pending
                </p>

                <p className="text-sm font-semibold">
                  {requests.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="ops-card flex min-h-[280px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading leave requests...
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div className="ops-card flex min-h-[280px] flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <h2 className="mt-4 text-base font-semibold">
              No pending leave requests
            </h2>

            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              All worker leave requests for your mine have been reviewed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const processing =
                processingId === request.id;

              return (
                <div
                  key={request.id}
                  className="ops-card p-5"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    {/* Worker + request */}
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <h2 className="truncate text-base font-semibold">
                            {request.worker_name}
                          </h2>

                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {request.employee_code}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
                            Leave type
                          </p>

                          <p className="mt-1 text-sm font-semibold">
                            {leaveLabel(
                              request.leave_type,
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
                            Dates
                          </p>

                          <p className="mt-1 text-sm font-semibold">
                            {formatDate(
                              request.start_date,
                            )}{' '}
                            →{' '}
                            {formatDate(
                              request.end_date,
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
                            Duration
                          </p>

                          <p className="mt-1 text-sm font-semibold">
                            {request.days}{' '}
                            {request.days === 1
                              ? 'working day'
                              : 'working days'}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
                            Status
                          </p>

                          <span className="mt-1 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-400">
                            Pending
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 rounded-lg border border-border bg-background/30 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
                          Reason
                        </p>

                        <p className="mt-2 text-sm leading-6 text-foreground">
                          {request.reason}
                        </p>
                      </div>

                      <p className="mt-3 text-xs text-muted-foreground">
                        Submitted{' '}
                        {formatDate(
                          request.submitted_at,
                        )}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                      <Button
                        type="button"
                        disabled={processing}
                        onClick={() =>
                          handleApprove(
                            request.id,
                          )
                        }
                        className="gap-2"
                      >
                        {processing &&
                        processingId ===
                          request.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}

                        Approve
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={processing}
                        onClick={() =>
                          openRejectDialog(
                            request.id,
                          )
                        }
                        className="gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Reject dialog */}
      {rejectingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                Leave review
              </p>

              <h2 className="mt-1 text-lg font-semibold">
                Reject leave request
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Enter a reason. The reason will be stored with the leave request.
              </p>
            </div>

            <textarea
              value={rejectionReason}
              onChange={(event) =>
                setRejectionReason(
                  event.target.value,
                )
              }
              rows={4}
              autoFocus
              placeholder="Example: Operational staffing requirement during this period."
              className="mt-5 w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary"
            />

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={processingId !== null}
                onClick={
                  closeRejectDialog
                }
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={
                  processingId !== null ||
                  !rejectionReason.trim()
                }
                onClick={
                  handleReject
                }
              >
                {processingId !== null ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  'Confirm rejection'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}