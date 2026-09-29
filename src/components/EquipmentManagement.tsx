import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Truck,
  Wrench,
  XCircle,
  Clock3,
} from 'lucide-react';

import {  Edit, Trash2, X } from "lucide-react";
import {
  createEquipment,
  getMineEquipment,
  getSafetyMonitoring,
  updateEquipmentStatus,
  type EquipmentApi,
  type SafetyMonitoringResponse,
} from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';


// ======================================================
// STATUS HELPERS
// ======================================================

function statusLabel(
  status: EquipmentApi['status'],
) {
  switch (status) {
    case 'AVAILABLE':
      return 'Available';

    case 'IN_USE':
      return 'In use';

    case 'MAINTENANCE':
      return 'Maintenance';

    case 'OUT_OF_SERVICE':
      return 'Out of service';

    default:
      return status;
  }
}


function statusTone(
  status: EquipmentApi['status'],
) {
  switch (status) {
    case 'AVAILABLE':
      return 'success';

    case 'IN_USE':
      return 'info';

    case 'MAINTENANCE':
      return 'warning';

    case 'OUT_OF_SERVICE':
      return 'danger';

    default:
      return 'neutral';
  }
}


function StatusBadge({
  status,
}: {
  status: EquipmentApi['status'];
}) {

  const tone = statusTone(status);

  const classes: Record<string, string> = {
    success:
      'border-emerald-400/25 bg-emerald-400/10 text-emerald-400',

    info:
      'border-blue-400/25 bg-blue-400/10 text-blue-400',

    warning:
      'border-amber-400/25 bg-amber-400/10 text-amber-400',

    danger:
      'border-red-400/25 bg-red-400/10 text-red-400',

    neutral:
      'border-border bg-secondary text-muted-foreground',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />

      {statusLabel(status)}
    </span>
  );
}


// ======================================================
// MAIN COMPONENT
// ======================================================

export default function EquipmentManagement() {

  const { toast } = useToast();

  const [equipment, setEquipment] =
    useState<EquipmentApi[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [search, setSearch] =
    useState('');

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [updatingId, setUpdatingId] =
    useState<number | null>(null);
const [monitoring, setMonitoring] =
  useState<SafetyMonitoringResponse | null>(null);

const [monitoringLoading, setMonitoringLoading] =
  useState(true);

  const [form, setForm] = useState({
    equipmentCode: '',
    name: '',
    equipmentType: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    location: '',
  });


  // ====================================================
  // LOAD EQUIPMENT
  // ====================================================

  async function loadEquipment(
    refresh = false,
  ) {

    try {

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data =
        await getMineEquipment();

      setEquipment(data);

    } catch (error) {

      console.error(
        'Failed to load equipment:',
        error,
      );

      toast({
        title: 'Unable to load equipment',
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
  }


  useEffect(() => {
    loadEquipment();
    loadSafetyMonitoring();
  }, []);

async function loadSafetyMonitoring() {
  try {
    setMonitoringLoading(true);

    const data = await getSafetyMonitoring();

    setMonitoring(data);
  } catch (error) {
    console.error(
      'Failed to load safety monitoring:',
      error,
    );

    toast({
      title: 'Unable to load safety monitoring',
      description:
        error instanceof Error
          ? error.message
          : 'Please try again.',
      variant: 'destructive',
    });
  } finally {
    setMonitoringLoading(false);
  }
}
  // ====================================================
  // SEARCH
  // ====================================================

  const filteredEquipment =
    useMemo(() => {

      const query =
        search.trim().toLowerCase();

      if (!query) {
        return equipment;
      }

      return equipment.filter((item) =>
        [
          item.equipment_code,
          item.name,
          item.equipment_type,
          item.manufacturer,
          item.model,
          item.location,
          item.assigned_worker_name,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query),
          ),
      );

    }, [equipment, search]);


  // ====================================================
  // CREATE
  // ====================================================

  async function handleCreate(
    event: React.FormEvent<HTMLFormElement>,
  ) {

    event.preventDefault();

    if (
      !form.equipmentCode.trim() ||
      !form.name.trim() ||
      !form.equipmentType.trim()
    ) {

      toast({
        title: 'Required fields missing',
        description:
          'Equipment code, name and type are required.',
        variant: 'destructive',
      });

      return;
    }

    try {

      setSubmitting(true);

      const created =
        await createEquipment({
          equipmentCode:
            form.equipmentCode.trim(),

          name:
            form.name.trim(),

          equipmentType:
            form.equipmentType.trim(),

          manufacturer:
            form.manufacturer.trim() || undefined,

          model:
            form.model.trim() || undefined,

          serialNumber:
            form.serialNumber.trim() || undefined,

          location:
            form.location.trim() || undefined,
        });

      setEquipment((previous) => [
        created,
        ...previous,
      ]);

      setForm({
        equipmentCode: '',
        name: '',
        equipmentType: '',
        manufacturer: '',
        model: '',
        serialNumber: '',
        location: '',
      });

      setShowCreateForm(false);

      toast({
        title: 'Equipment created',
        description:
          `${created.name} was added successfully.`,
      });

    } catch (error) {

      console.error(
        'Create equipment failed:',
        error,
      );

      toast({
        title: 'Unable to create equipment',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
        variant: 'destructive',
      });

    } finally {

      setSubmitting(false);
    }
  }


  // ====================================================
  // STATUS CHANGE
  // ====================================================

  async function handleStatusChange(
    item: EquipmentApi,
    status: EquipmentApi['status'],
  ) {

    try {

      setUpdatingId(item.id);

      const updated =
        await updateEquipmentStatus(
          item.id,
          status,
        );

      setEquipment((previous) =>
        previous.map((equipmentItem) =>
          equipmentItem.id === updated.id
            ? {
                ...equipmentItem,
                ...updated,
              }
            : equipmentItem,
        ),
      );

      toast({
        title: 'Equipment status updated',
        description:
          `${updated.name} is now ${statusLabel(updated.status)}.`,
      });

    } catch (error) {

      console.error(
        'Equipment status update failed:',
        error,
      );

      toast({
        title: 'Status update failed',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
        variant: 'destructive',
      });

    } finally {

      setUpdatingId(null);
    }
  }


  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {

    return (
      <div className="flex min-h-[500px] items-center justify-center">

        <div className="text-center">

          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />

          <p className="mt-4 text-sm font-semibold">
            Loading equipment
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Fetching live equipment data from MINEXA.
          </p>

        </div>

      </div>
    );
  }


  // ====================================================
  // COUNTS
  // ====================================================

  const total =
    equipment.length;

  const available =
    equipment.filter(
      (item) => item.status === 'AVAILABLE',
    ).length;

  const inUse =
    equipment.filter(
      (item) => item.status === 'IN_USE',
    ).length;

  const maintenance =
    equipment.filter(
      (item) => item.status === 'MAINTENANCE',
    ).length;

  const outOfService =
    equipment.filter(
      (item) =>
        item.status === 'OUT_OF_SERVICE',
    ).length;


  // ====================================================
  // UI
  // ====================================================

  return (

    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

        <div>

          <p className="text-xs text-muted-foreground">
            Assets & safety operations
          </p>

          <h1 className="mt-2 font-display text-2xl font-semibold">
            Equipment
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Manage mine equipment using live backend data.
          </p>

        </div>


        <div className="flex gap-2">

          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
  await Promise.all([
    loadEquipment(true),
    loadSafetyMonitoring(),
  ]);
}}
            disabled={refreshing}
          >

            <RefreshCw
              className={
                refreshing
                  ? 'h-3.5 w-3.5 animate-spin'
                  : 'h-3.5 w-3.5'
              }
            />

            {refreshing
              ? 'Refreshing...'
              : 'Refresh'}
          </Button>


          <Button
            size="sm"
            onClick={() =>
              setShowCreateForm(
                (value) => !value,
              )
            }
          >

            {showCreateForm
              ? <X className="h-3.5 w-3.5" />
              : <Plus className="h-3.5 w-3.5" />}

            {showCreateForm
              ? 'Close'
              : 'Add equipment'}
          </Button>

        </div>

      </div>


      {/* SUMMARY */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

        <Metric
          label="Total equipment"
          value={total}
          icon={Truck}
        />

        <Metric
          label="Available"
          value={available}
          icon={CheckCircle2}
          tone="success"
        />

        <Metric
          label="In use"
          value={inUse}
          icon={Truck}
          tone="info"
        />

        <Metric
          label="Maintenance"
          value={maintenance}
          icon={Wrench}
          tone="warning"
        />

        <Metric
          label="Out of service"
          value={outOfService}
          icon={XCircle}
          tone="danger"
        />

      </div>

{/* SAFETY MONITORING */}

<div className="space-y-3">
  <div>
    <p className="text-xs text-muted-foreground">
      Equipment safety intelligence
    </p>

    <h2 className="mt-1 font-display text-lg font-semibold">
      Safety Monitoring
    </h2>
  </div>

  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
    <Metric
      label="Unsafe"
      value={monitoringLoading ? 0 : monitoring?.summary.unsafe ?? 0}
      icon={XCircle}
      tone="danger"
    />

    <Metric
      label="Overdue"
      value={monitoringLoading ? 0 : monitoring?.summary.overdue ?? 0}
      icon={AlertCircle}
      tone="warning"
    />

    <Metric
      label="Due soon"
      value={monitoringLoading ? 0 : monitoring?.summary.due_soon ?? 0}
      icon={Clock3}
      tone="warning"
    />

    <Metric
      label="Not scheduled"
      value={
        monitoringLoading
          ? 0
          : monitoring?.summary.not_scheduled ?? 0
      }
      icon={AlertCircle}
      tone="info"
    />

    <Metric
      label="Safe"
      value={monitoringLoading ? 0 : monitoring?.summary.ok ?? 0}
      icon={CheckCircle2}
      tone="success"
    />
  </div>
</div>
      {/* CREATE FORM */}

      {showCreateForm && (

        <form
          onSubmit={handleCreate}
          className="ops-card space-y-5 p-5"
        >

          <div>

            <h2 className="font-display text-base font-semibold">
              Register equipment
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Add a machine to your mine's equipment register.
            </p>

          </div>


          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            <Field
              label="Equipment code"
              value={form.equipmentCode}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  equipmentCode: value,
                }))
              }
              placeholder="EXC-002"
              required
            />

            <Field
              label="Equipment name"
              value={form.name}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  name: value,
                }))
              }
              placeholder="Excavator 02"
              required
            />

            <Field
              label="Equipment type"
              value={form.equipmentType}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  equipmentType: value,
                }))
              }
              placeholder="EXCAVATOR"
              required
            />

            <Field
              label="Manufacturer"
              value={form.manufacturer}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  manufacturer: value,
                }))
              }
              placeholder="CAT"
            />

            <Field
              label="Model"
              value={form.model}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  model: value,
                }))
              }
              placeholder="320"
            />

            <Field
              label="Serial number"
              value={form.serialNumber}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  serialNumber: value,
                }))
              }
              placeholder="CAT320-002"
            />

            <Field
              label="Location"
              value={form.location}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  location: value,
                }))
              }
              placeholder="East Mining Zone"
            />

          </div>


          <div className="flex justify-end">

            <Button
              type="submit"
              disabled={submitting}
            >

              {submitting && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              {submitting
                ? 'Creating...'
                : 'Create equipment'}

            </Button>

          </div>

        </form>
      )}


      {/* SEARCH */}

      <div className="ops-card p-4">

        <div className="relative max-w-md">

          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search equipment..."
            className="pl-9"
          />

        </div>

      </div>


      {/* TABLE */}

      <div className="ops-card overflow-hidden">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[900px] text-left">

            <thead className="border-b border-border bg-secondary/40 text-[10px] uppercase tracking-[.14em] text-muted-foreground">

              <tr>

                <th className="px-5 py-3 font-semibold">
                  Equipment
                </th>

                <th className="px-5 py-3 font-semibold">
                  Type
                </th>

                <th className="px-5 py-3 font-semibold">
                  Status
                </th>

                <th className="px-5 py-3 font-semibold">
                  Location
                </th>

                <th className="px-5 py-3 font-semibold">
                  Assigned worker
                </th>

                <th className="px-5 py-3 font-semibold">
                  Service
                </th>

                <th className="px-5 py-3 font-semibold">
                  Action
                </th>

              </tr>

            </thead>


            <tbody className="divide-y divide-border/70">

              {filteredEquipment.map((item) => (

                <tr
                  key={item.id}
                  className="transition-colors hover:bg-secondary/30"
                >

                  <td className="px-5 py-4">

                    <div className="flex items-center gap-3">

                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">

                        <Truck className="h-4 w-4" />

                      </span>

                      <div>

                        <p className="text-xs font-semibold">
                          {item.name}
                        </p>

                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {item.equipment_code}
                        </p>

                      </div>

                    </div>

                  </td>


                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {item.equipment_type}
                  </td>


                  <td className="px-5 py-4">

                    <StatusBadge
                      status={item.status}
                    />

                  </td>


                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {item.location || '—'}
                  </td>


                  <td className="px-5 py-4">

                    {item.assigned_worker_name ? (

                      <div>

                        <p className="text-xs font-medium">
                          {item.assigned_worker_name}
                        </p>

                        <p className="font-mono text-[10px] text-muted-foreground">
                          {item.employee_code || '—'}
                        </p>

                      </div>

                    ) : (

                      <span className="text-xs text-muted-foreground">
                        Unassigned
                      </span>

                    )}

                  </td>


                  <td className="px-5 py-4 text-xs text-muted-foreground">

                    {item.next_service_date
                      ? new Date(
                          item.next_service_date,
                        ).toLocaleDateString()
                      : 'Not scheduled'}

                  </td>


                  <td className="px-5 py-4">

                    <div className="flex items-center gap-2">

                      {item.status === 'AVAILABLE' && (

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            updatingId === item.id
                          }
                          onClick={() =>
                            handleStatusChange(
                              item,
                              'MAINTENANCE',
                            )
                          }
                        >
                          Maintenance
                        </Button>

                      )}


                      {item.status === 'MAINTENANCE' && (

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            updatingId === item.id
                          }
                          onClick={() =>
                            handleStatusChange(
                              item,
                              'AVAILABLE',
                            )
                          }
                        >
                          Available
                        </Button>

                      )}


                      {item.status === 'IN_USE' && (

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            updatingId === item.id
                          }
                          onClick={() =>
                            handleStatusChange(
                              item,
                              'MAINTENANCE',
                            )
                          }
                        >
                          Service
                        </Button>

                      )}

                    </div>

                  </td>

                </tr>

              ))}


              {filteredEquipment.length === 0 && (

                <tr>

                  <td
                    colSpan={7}
                    className="px-5 py-14 text-center"
                  >

                    <Truck className="mx-auto h-8 w-8 text-muted-foreground" />

                    <p className="mt-3 text-sm font-semibold">
                      No equipment found
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Add equipment or change your search.
                    </p>

                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}


// ======================================================
// FIELD
// ======================================================

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {

  return (

    <div>

      <label className="mb-2 block text-xs font-semibold">
        {label}
      </label>

      <Input
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        required={required}
      />

    </div>
  );
}


// ======================================================
// METRIC
// ======================================================

function Metric({
  label,
  value,
  icon: Icon,
  tone = 'primary',
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone?: string;
}) {

  const toneClasses: Record<string, string> = {
    primary: 'text-primary',
    success: 'text-safety-success',
    info: 'text-safety-info',
    warning: 'text-safety-warning',
    danger: 'text-safety-danger',
  };

  return (

    <div className="ops-card p-5">

      <div className="flex items-center justify-between">

        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">

          <Icon
            className={`h-[18px] w-[18px] ${
              toneClasses[tone] ||
              toneClasses.primary
            }`}
          />

        </span>

        <span className="font-display text-2xl font-semibold">
          {value}
        </span>

      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {label}
      </p>

    </div>
  );
}