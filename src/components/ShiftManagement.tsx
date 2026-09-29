import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Plus, RefreshCw, UserRoundCog } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  assignWorkerShift,
  createShift,
  getMineShifts,
  getMineWorkers,
  type ShiftApi,
  type WorkerApi,
} from '@/lib/api';

export default function ShiftManagement() {
  const { toast } = useToast();

  const [workers, setWorkers] = useState<WorkerApi[]>([]);
  const [shifts, setShifts] = useState<ShiftApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const [newShiftName, setNewShiftName] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('');
  const [newShiftEnd, setNewShiftEnd] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);

      const [workerData, shiftData] = await Promise.all([
        getMineWorkers(),
        getMineShifts(),
      ]);

      setWorkers(workerData);
      setShifts(shiftData);
    } catch (error) {
      toast({
        title: 'Unable to load shift management',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to load workers and shifts.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeShifts = useMemo(
    () => shifts.filter((shift) => shift.is_active),
    [shifts],
  );

  const handleCreateShift = async () => {
    if (!newShiftName.trim() || !newShiftStart || !newShiftEnd) {
      toast({
        title: 'Incomplete shift',
        description: 'Enter shift name, start time and end time.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setActionLoading(true);

      const shift = await createShift({
        name: newShiftName.trim(),
        startTime: newShiftStart,
        endTime: newShiftEnd,
      });

      setShifts((current) => [shift, ...current]);
      setNewShiftName('');
      setNewShiftStart('');
      setNewShiftEnd('');

      toast({
        title: 'Shift created',
        description: `${shift.name} can now be assigned to workers.`,
      });
    } catch (error) {
      toast({
        title: 'Could not create shift',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to create shift.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignShift = async () => {
    const workerId = Number(selectedWorkerId);
    const shiftId = Number(selectedShiftId);

    if (!workerId || !shiftId || !effectiveFrom) {
      toast({
        title: 'Incomplete assignment',
        description: 'Select worker, shift and effective date.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setActionLoading(true);

      const result = await assignWorkerShift({
        workerId,
        shiftId,
        effectiveFrom,
      });

      toast({
        title: 'Shift assigned',
        description: `${result.worker.name} is assigned to ${result.shift.name}.`,
      });

      setSelectedWorkerId('');
      setSelectedShiftId('');

      await loadData();
    } catch (error) {
      toast({
        title: 'Assignment failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to assign worker shift.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm font-semibold">
            Loading shift management
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Fetching workers and mine shifts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Workforce
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          Shift Management
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create mine shifts and assign a worker to an active shift.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="ops-card p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock3 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Create
              </p>
              <h2 className="font-display text-base font-semibold">
                New Shift
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              placeholder="e.g. Morning Shift"
              value={newShiftName}
              onChange={(event) => setNewShiftName(event.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-xs text-muted-foreground">
                  Start time
                </label>
                <Input
                  type="time"
                  value={newShiftStart}
                  onChange={(event) => setNewShiftStart(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs text-muted-foreground">
                  End time
                </label>
                <Input
                  type="time"
                  value={newShiftEnd}
                  onChange={(event) => setNewShiftEnd(event.target.value)}
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleCreateShift}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Shift
            </Button>
          </div>
        </section>

        <section className="ops-card p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRoundCog className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Assign
              </p>
              <h2 className="font-display text-base font-semibold">
                Assign Worker Shift
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs text-muted-foreground">
                Worker
              </label>
              <select
                value={selectedWorkerId}
                onChange={(event) => setSelectedWorkerId(event.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select worker</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.name} · {worker.employee_code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs text-muted-foreground">
                Active shift
              </label>
              <select
                value={selectedShiftId}
                onChange={(event) => setSelectedShiftId(event.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select shift</option>
                {activeShifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} · {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs text-muted-foreground">
                Effective from
              </label>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleAssignShift}
              disabled={
                actionLoading ||
                workers.length === 0 ||
                activeShifts.length === 0
              }
            >
              {actionLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <UserRoundCog className="h-4 w-4" />
              )}
              Assign Shift
            </Button>

            {workers.length === 0 && (
              <p className="text-xs text-safety-warning">
                No workers found in your mine.
              </p>
            )}

            {activeShifts.length === 0 && (
              <p className="text-xs text-safety-warning">
                Create a shift first.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="ops-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Mine shifts
            </p>
            <h2 className="mt-1 font-display text-base font-semibold">
              Available Shifts
            </h2>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={actionLoading}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <div className="divide-y divide-border">
          {shifts.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No shifts created yet.
            </div>
          ) : (
            shifts.map((shift) => (
              <div
                key={shift.id}
                className="flex items-center justify-between gap-4 p-5"
              >
                <div>
                  <p className="text-sm font-semibold">{shift.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}
                  </p>
                </div>

                <span
                  className={
                    shift.is_active
                      ? 'rounded-full border border-safety-success/25 bg-safety-success/10 px-2.5 py-1 text-[10px] font-semibold text-safety-success'
                      : 'rounded-full border border-border bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground'
                  }
                >
                  {shift.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
