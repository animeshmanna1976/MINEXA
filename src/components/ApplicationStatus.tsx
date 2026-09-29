import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  HardHat,
} from 'lucide-react';

type Application = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  employee_id: string | null;
  department: string | null;
  designation: string | null;
  status: string;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  mine_id: number;
  mine_name: string | null;
};

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'}/application/status`;

function formatDate(date: string | null) {
  if (!date) return '—';

  return new Date(date).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function ApplicationStatus() {
  const [application, setApplication] =
    useState<Application | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadApplicationStatus = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('minexa_token');

      if (!token) {
        throw new Error('Your session has expired. Please login again.');
      }

      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Failed to fetch application status.'
        );
      }

      setApplication(data.application);
    } catch (err) {
      console.error('Application status error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load application status.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplicationStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-semibold">
            Loading application status...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs text-muted-foreground">
            Worker services
          </p>

          <h1 className="mt-2 font-display text-2xl font-semibold">
            Application status
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Track your MINEXA registration and verification.
          </p>
        </div>

        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />

            <div>
              <p className="font-semibold">
                Unable to load application
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                {error}
              </p>

              <button
                onClick={loadApplicationStatus}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!application) {
    return null;
  }

  const status = application.status;

  const isRejected = status === 'REJECTED';
  const isApproved = status === 'APPROVED';
  const isUnderReview = status === 'UNDER_REVIEW';

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <p className="text-xs text-muted-foreground">
          Worker services
        </p>

        <h1 className="mt-2 font-display text-2xl font-semibold">
          Application status
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Track your MINEXA registration and verification.
        </p>
      </div>

      {/* APPLICATION SUMMARY */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Application
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              REG-
              {String(application.id).padStart(5, '0')}
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Submitted on {formatDate(application.submitted_at)}
            </p>
          </div>

          <div
            className={`inline-flex h-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
              isRejected
                ? 'bg-destructive/10 text-destructive'
                : isApproved
                ? 'bg-emerald-400/10 text-emerald-400'
                : 'bg-amber-400/10 text-amber-400'
            }`}
          >
            {isRejected ? (
              <AlertCircle className="h-4 w-4" />
            ) : isApproved ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Clock3 className="h-4 w-4" />
            )}

            {status === 'PENDING'
              ? 'Pending review'
              : status === 'UNDER_REVIEW'
              ? 'Under review'
              : status === 'APPROVED'
              ? 'Approved'
              : status === 'REJECTED'
              ? 'Rejected'
              : status}
          </div>
        </div>
      </div>

      {/* WORKER INFORMATION */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-3">
            <HardHat className="h-5 w-5 text-primary" />

            <div>
              <p className="text-xs text-muted-foreground">
                Worker
              </p>

              <p className="font-semibold">
                {application.name}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                Employee ID
              </span>

              <span className="font-medium">
                {application.employee_id || '—'}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                Email
              </span>

              <span className="break-all font-medium">
                {application.email}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                Phone
              </span>

              <span className="font-medium">
                {application.phone || '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />

            <div>
              <p className="text-xs text-muted-foreground">
                Mine assignment
              </p>

              <p className="font-semibold">
                {application.mine_name || '—'}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                Department
              </span>

              <span className="font-medium">
                {application.department || '—'}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                Designation
              </span>

              <span className="font-medium">
                {application.designation || '—'}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                Last reviewed
              </span>

              <span className="font-medium">
                {formatDate(application.reviewed_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TIMELINE */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-6 flex items-center gap-3">
          <UserCheck className="h-5 w-5 text-primary" />

          <div>
            <h2 className="font-semibold">
              Verification progress
            </h2>

            <p className="text-xs text-muted-foreground">
              Your registration moves through multiple verification stages.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* SUBMITTED */}
          <TimelineItem
            title="Registration submitted"
            description="Your MINEXA application has been received."
            done
          />

          {/* ADMIN */}
          <TimelineItem
            title="Platform Admin review"
            description={
              status === 'PENDING'
                ? 'Waiting for Platform Admin review.'
                : 'Platform Admin review completed.'
            }
            done={status !== 'PENDING'}
            active={status === 'PENDING'}
          />

          {/* MANAGER */}
          <TimelineItem
            title="Mine Manager review"
            description={
              status === 'UNDER_REVIEW' ||
              status === 'APPROVED'
                ? 'Mine Manager approval completed.'
                : 'Waiting for Mine Manager approval.'
            }
            done={
              status === 'UNDER_REVIEW' ||
              status === 'APPROVED'
            }
            active={false}
          />

          {/* SAFETY */}
          <TimelineItem
            title="Safety verification"
            description={
              status === 'APPROVED'
                ? 'Safety verification completed.'
                : isRejected
                ? 'Application was rejected during the verification process.'
                : 'Waiting for Safety Officer verification.'
            }
            done={status === 'APPROVED'}
            active={status === 'UNDER_REVIEW'}
            danger={isRejected}
          />

          {/* FINAL */}
          <TimelineItem
            title="Account activation"
            description={
              status === 'APPROVED'
                ? 'Your MINEXA account is active.'
                : 'Your account will be activated after successful verification.'
            }
            done={status === 'APPROVED'}
            active={status === 'APPROVED'}
          />
        </div>
      </div>

      {/* REJECTION */}
      {isRejected && application.rejection_reason && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />

            <div>
              <h2 className="font-semibold text-destructive">
                Application rejected
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                {application.rejection_reason}
              </p>

              <p className="mt-3 text-xs text-muted-foreground">
                Please contact your mine administrator if you
                believe this decision was incorrect.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineItem({
  title,
  description,
  done,
  active,
  danger,
}: {
  title: string;
  description: string;
  done: boolean;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full border ${
            danger
              ? 'border-destructive bg-destructive/10 text-destructive'
              : done
              ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
              : active
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-background text-muted-foreground'
          }`}
        >
          {danger ? (
            <AlertCircle className="h-4 w-4" />
          ) : done ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Clock3 className="h-4 w-4" />
          )}
        </div>

        <div className="mt-2 min-h-8 w-px bg-border" />
      </div>

      <div className="pb-4">
        <p className="font-semibold">{title}</p>

        <p className="mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}