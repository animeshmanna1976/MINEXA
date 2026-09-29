const API_URL = 'http://localhost:3000/api/v1';

export type LeaveRequestApi = {
  id: number;
  worker_id: number;
  leave_type:
    | 'annual'
    | 'sick'
    | 'personal'
    | 'emergency';
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'cancelled';
  submitted_at: string;
    rejection_reason?: string | null;
};

// --------------------------------------------------
// AUTH HEADERS
// --------------------------------------------------

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('minexa_token');

  if (!token) {
    throw new Error('You are not logged in.');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// --------------------------------------------------
// GET LEAVE REQUESTS
// --------------------------------------------------

export async function getLeaveRequests(): Promise<
  LeaveRequestApi[]
> {
  const response = await fetch(
    `${API_URL}/leave-requests`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  if (!response.ok) {
    const errorData =
      await response
        .json()
        .catch(() => null);

    throw new Error(
      errorData?.message ??
        'Failed to fetch leave requests',
    );
  }

  const data = await response.json();

  return data.requests;
}

// --------------------------------------------------
// CREATE LEAVE REQUEST
// --------------------------------------------------

export async function createLeaveRequest(
  payload: {
    leaveType:
      | 'annual'
      | 'sick'
      | 'personal'
      | 'emergency';

    startDate: string;
    endDate: string;
    days: number;
    reason: string;
  },
): Promise<LeaveRequestApi> {
  const response = await fetch(
    `${API_URL}/leave-requests`,
    {
      method: 'POST',

      headers: getAuthHeaders(),

      body: JSON.stringify({
        leaveType: payload.leaveType,
        startDate: payload.startDate,
        endDate: payload.endDate,
        days: payload.days,
        reason: payload.reason,
      }),
    },
  );

  if (!response.ok) {
    const errorData =
      await response
        .json()
        .catch(() => null);

    throw new Error(
      errorData?.message ??
        'Failed to create leave request',
    );
  }

  const data = await response.json();

  return data.request;
}

// --------------------------------------------------
// CANCEL LEAVE REQUEST
// --------------------------------------------------

export async function cancelLeaveRequest(
  id: number,
): Promise<LeaveRequestApi> {
  const response = await fetch(
    `${API_URL}/leave-requests/${id}/cancel`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
    },
  );

  if (!response.ok) {
    const errorData =
      await response
        .json()
        .catch(() => null);

    throw new Error(
      errorData?.message ??
        'Failed to cancel leave request',
    );
  }

  const data = await response.json();

  return data.request;
}
export type LoginResponse = {
  status: 'success';
  message: string;
  token: string;
  user: {
    id: number;
    name: string;
    email: string | null;
    loginId: string | null;
    role: string;
    workerId: number | null;
    mustChangePassword: boolean;
  };
};

export async function loginUser(
  identifier: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(
    `${API_URL}/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier,
        password,
      }),
    },
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ??
        'Unable to login. Please check your credentials.',
    );
  }

  return data;
}
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/auth/change-password`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    },
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ??
        'Failed to change password.',
    );
  }
}

export type AuthUserApi = {
  id: number;
  name: string;
  email: string | null;
  loginId?: string | null;

  role:
    | 'PLATFORM_ADMIN'
    | 'MINE_MANAGER'
    | 'SAFETY_OFFICER'
    | 'FIELD_WORKER';

  workerId: number | null;

  employeeCode?: string | null;
  accountStatus?: string;
  isVerified?: boolean;
  verifiedAt?: string | null;
  mfaEnabled?: boolean;

  mustChangePassword?: boolean;
};

export async function getCurrentUser(): Promise<AuthUserApi> {
  const token = localStorage.getItem('minexa_token');

  if (!token) {
    throw new Error('No authentication token found.');
  }

  const response = await fetch(
    `${API_URL}/auth/me`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ??
        'Your session is no longer valid.',
    );
  }

  return data.user;
}
export async function getMineWorkers(): Promise<WorkerApi[]> {
  const response = await fetch(
    `${API_URL}/workers/mine`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || 'Failed to fetch mine workers'
    );
  }

  return data.workers ?? [];
}
export type AnalyticsSummary = {
  mine: {
    id: number;
  };

  incidents: {
    total: number;
    critical: number;
    open: number;
  };

  equipment: {
    total: number;
    operational: number;
    maintenance: number;
    outOfService: number;
    uptime: number;
  };

  attendance: {
    records: number;
    checkedIn: number;
    checkedOut: number;
    late: number;
  };

  trend: {
    day: string;
    incidents: number;
    highRiskIncidents: number;
  }[];
};

export type AdminAnalyticsSummary = {
  status: 'success';
  mines: {
    total: number;
    active: number;
  };
  workers: {
    total: number;
  };
  incidents: {
    total: number;
    active: number;
    highRisk: number;
    critical: number;
  };
  equipment: {
    total: number;
    operational: number;
    maintenance: number;
    outOfService: number;
  };
  attendance: {
    records: number;
    todayRecords: number;
    todayLate: number;
  };
};
/* =====================================================
   TYPES
===================================================== */

export type RegistrationRole =
  | 'FIELD_WORKER'
  | 'MINE_MANAGER'
  | 'SAFETY_OFFICER';

export type RegistrationStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type RegistrationRequest = {
  id: number;
  name: string;
  email?: string;
  phone: string | null;

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

export type Mine = {
  id: number;
  name: string;
  mine_code: string;
  location: string | null;
  status: 'ACTIVE' | 'INACTIVE';
};

export type RegisterPayload = {
  name: string;
  email?: string;
  phone: string;

  requestedRole: RegistrationRole;

  mineId: number;

  employeeId?: string;

  department?: string;

  designation?: string;

  certificationNumber?: string;

  safetyTrainingId?: string;
};

/* =====================================================
   TOKEN
===================================================== */

const getToken = (): string | null => {
  return localStorage.getItem('minexa_token');
};

const authHeaders = (): HeadersInit => {
  const token = getToken();

  return {
    'Content-Type': 'application/json',

    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
};

/* =====================================================
   MINE LIST
===================================================== */
export async function getAdminAnalyticsSummary() {
  const response = await fetch(
    `${API_URL}/analytics/admin-summary`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
      'Failed to load admin analytics.'
    );
  }

  return data as AdminAnalyticsSummary;
}
export async function getMines(): Promise<Mine[]> {
  const response = await fetch(`${API_URL}/mines`, {
    method: 'GET',
    headers: authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || 'Failed to fetch mines'
    );
  }

  return data.mines || data;
}

/* =====================================================
   REGISTER
===================================================== */

export async function registerUser(
  payload: RegisterPayload
) {
  const response = await fetch(
    `${API_URL}/auth/register`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(payload),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || 'Registration failed'
    );
  }

  return data;
}

/* =====================================================
   ADMIN — REGISTRATION QUEUE
===================================================== */

export async function getAdminRegistrations(): Promise<
  RegistrationRequest[]
> {
  const response = await fetch(
    `${API_URL}/admin/registrations`,
    {
      method: 'GET',
      headers: authHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to fetch registration requests'
    );
  }

  return data.registrations || [];
}

/* =====================================================
   ADMIN — APPROVE
===================================================== */

export async function approveAdminRegistration(
  registrationId: number
) {
  const response = await fetch(
    `${API_URL}/admin/registrations/${registrationId}/approve`,
    {
      method: 'POST',
      headers: authHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to approve registration'
    );
  }

  return data;
}

/* =====================================================
   ADMIN — REJECT
===================================================== */

export async function rejectAdminRegistration(
  registrationId: number,
  reason: string
) {
  const response = await fetch(
    `${API_URL}/admin/registrations/${registrationId}/reject`,
    {
      method: 'POST',
      headers: authHeaders(),

      body: JSON.stringify({
        reason,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to reject registration'
    );
  }

  return data;
}

/* =====================================================
   MANAGER — WORKER QUEUE
===================================================== */

export async function getManagerWorkerRegistrations(): Promise<
  RegistrationRequest[]
> {
  const response = await fetch(
    `${API_URL}/manager/worker-registrations`,
    {
      method: 'GET',
      headers: authHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to fetch worker registrations'
    );
  }

  return data.registrations || [];
}

/* =====================================================
   MANAGER — APPROVE WORKER
===================================================== */

export async function approveWorkerRegistration(
  registrationId: number
) {
  const response = await fetch(
    `${API_URL}/manager/worker-registrations/${registrationId}/approve`,
    {
      method: 'POST',
      headers: authHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to approve worker'
    );
  }

  return data;
}

/* =====================================================
   MANAGER — REJECT WORKER
===================================================== */

export async function rejectWorkerRegistration(
  registrationId: number,
  reason: string
) {
  const response = await fetch(
    `${API_URL}/manager/worker-registrations/${registrationId}/reject`,
    {
      method: 'POST',
      headers: authHeaders(),

      body: JSON.stringify({
        reason,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to reject worker'
    );
  }

  return data;
}

/* =====================================================
   SAFETY — VERIFICATION QUEUE
===================================================== */

export async function getSafetyWorkerRegistrations(): Promise<
  RegistrationRequest[]
> {
  const response = await fetch(
    `${API_URL}/safety/worker-registrations`,
    {
      method: 'GET',
      headers: authHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to fetch safety verification requests'
    );
  }

  return data.registrations || [];
}

/* =====================================================
   SAFETY — VERIFY
===================================================== */

export async function verifyWorkerRegistration(
  registrationId: number
) {
  const response = await fetch(
    `${API_URL}/safety/worker-registrations/${registrationId}/verify`,
    {
      method: 'POST',
      headers: authHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to verify worker'
    );
  }

  return data;
}

/* =====================================================
   SAFETY — REJECT
===================================================== */

export async function rejectSafetyRegistration(
  registrationId: number,
  reason: string
) {
  const response = await fetch(
    `${API_URL}/safety/worker-registrations/${registrationId}/reject`,
    {
      method: 'POST',
      headers: authHeaders(),

      body: JSON.stringify({
        reason,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to reject safety verification'
    );
  }

  return data;
}

// ======================================================
// EQUIPMENT
// ======================================================

export type EquipmentApi = {
  id: number;
  mine_id: number;
  equipment_code: string;
  name: string;
  equipment_type: string;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  status:
    | 'AVAILABLE'
    | 'IN_USE'
    | 'MAINTENANCE'
    | 'OUT_OF_SERVICE';
  assigned_worker_id?: number | null;
  assigned_worker_name?: string | null;
  employee_code?: string | null;
  purchase_date?: string | null;
  last_service_date?: string | null;
  next_service_date?: string | null;
  location?: string | null;
  created_at: string;
  updated_at: string;
};

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const response = await fetch(
    `${API_URL}/analytics/summary`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || 'Failed to fetch analytics'
    );
  }

  return data;
}
// --------------------------------------------------
// GET EQUIPMENT FOR CURRENT MINE
// --------------------------------------------------

export async function getMineEquipment(): Promise<EquipmentApi[]> {
  const response = await fetch(
    `${API_URL}/equipment/mine`,
    {
      method: 'GET',
      headers: authHeaders(),
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ??
        'Failed to fetch equipment',
    );
  }

  return data?.equipment ?? [];
}

export type SafetyMonitoringSummary = {
  total_equipment: number;
  unsafe: number;
  overdue: number;
  due_soon: number;
  not_scheduled: number;
  ok: number;
};

export type SafetyMonitoringResponse = {
  summary: SafetyMonitoringSummary;
  equipment?: any[];
};

export async function getSafetyMonitoring(): Promise<SafetyMonitoringResponse> {
  const response = await fetch(
   `${API_URL}/safety-monitoring/summary`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || 'Failed to load safety monitoring data',
    );
  }

  return data;
}
// --------------------------------------------------
// CREATE EQUIPMENT
// --------------------------------------------------

export async function createEquipment(
  payload: {
    equipmentCode: string;
    name: string;
    equipmentType: string;
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    purchaseDate?: string;
    lastServiceDate?: string;
    nextServiceDate?: string;
    location?: string;
  },
): Promise<EquipmentApi> {

  const response = await fetch(
    `${API_URL}/equipment`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ??
        'Failed to create equipment',
    );
  }

  return data.equipment;
}


// --------------------------------------------------
// UPDATE EQUIPMENT STATUS
// --------------------------------------------------

export async function updateEquipmentStatus(
  equipmentId: number,
  status: EquipmentApi['status'],
): Promise<EquipmentApi> {

  const response = await fetch(
    `${API_URL}/equipment/${equipmentId}/status`,
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({
        status,
      }),
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ??
        'Failed to update equipment status',
    );
  }

  return data.equipment;
}


// --------------------------------------------------
// GET SINGLE EQUIPMENT
// --------------------------------------------------

export async function getEquipment(
  equipmentId: number,
): Promise<EquipmentApi> {

  const response = await fetch(
    `${API_URL}/equipment/${equipmentId}`,
    {
      method: 'GET',
      headers: authHeaders(),
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ??
        'Failed to fetch equipment',
    );
  }

  return data;
}



// ======================================================
// SHIFT MANAGEMENT
// ======================================================

export type ShiftApi = {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  mine_id: number;
  is_active: boolean;
  created_at: string;
};

export type WorkerShiftAssignmentApi = {
  id: number;
  worker_id: number;
  worker_name: string;
  employee_code: string;
  shift_id: number;
  shift_name: string;
  start_time: string;
  end_time: string;
  effective_from: string;
  effective_to?: string | null;
  is_active: boolean;
  created_at: string;
};

export async function getMineShifts(): Promise<ShiftApi[]> {
  const response = await fetch(`${API_URL}/shifts/mine`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || 'Failed to fetch shifts.');
  }

  return data?.shifts ?? [];
}

export async function createShift(payload: {
  name: string;
  startTime: string;
  endTime: string;
}): Promise<ShiftApi> {
  const response = await fetch(`${API_URL}/shifts`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || 'Failed to create shift.');
  }

  return data.shift;
}

export async function assignWorkerShift(payload: {
  workerId: number;
  shiftId: number;
  effectiveFrom?: string;
}) {
  const response = await fetch(`${API_URL}/shifts/assign`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      workerId: payload.workerId,
      shiftId: payload.shiftId,
      effectiveFrom: payload.effectiveFrom || undefined,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message || 'Failed to assign worker shift.',
    );
  }

  return data;
}

export async function getWorkerShiftAssignments(
  workerId: number,
): Promise<WorkerShiftAssignmentApi[]> {
  const response = await fetch(
    `${API_URL}/shifts/worker/${workerId}`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to fetch worker shift assignments.',
    );
  }

  return data?.assignments ?? [];
}


export type IncidentApi = {
  id: number;
  mine_id: number;
  reported_by: number;
  worker_id?: number | null;
  incident_type:
    | 'ACCIDENT'
    | 'HAZARD'
    | 'NEAR_MISS'
    | 'UNSAFE_CONDITION'
    | 'SAFETY_VIOLATION';
  title: string;
  description: string;
  location?: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status:
    | 'OPEN'
    | 'UNDER_INVESTIGATION'
    | 'RESOLVED'
    | 'CLOSED';
  incident_date: string;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
};

export async function getMineIncidents(): Promise<IncidentApi[]> {
  const response = await fetch(
    `${API_URL}/incidents/mine`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || 'Failed to load incidents',
    );
  }

  return data.incidents ?? data;
}


export type CreateIncidentPayload = {
  incidentType:
    | 'ACCIDENT'
    | 'HAZARD'
    | 'NEAR_MISS'
    | 'UNSAFE_CONDITION'
    | 'SAFETY_VIOLATION';
  title: string;
  description: string;
  location?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  incidentDate?: string;
};

export async function createIncident(
  payload: CreateIncidentPayload,
): Promise<IncidentApi> {
  const response = await fetch(
    `${API_URL}/incidents`,
    {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        incidentType: payload.incidentType,
        title: payload.title,
        description: payload.description,
        location: payload.location || null,
        severity: payload.severity,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || 'Failed to create incident',
    );
  }

  return data.incident ?? data;
}

export type ManagerDashboardData = {
  status: 'success';

  mine: {
    id: number;
  };

  workers: {
    total_workers: number;
  };

  attendance: {
    checked_in: number;
    checked_out: number;
    late: number;
  };

  incidents: {
    total: number;
    open: number;
    critical: number;
  };

  health: {
    workers_with_health_records: number;
    unfit: number;
    restricted: number;
    pending: number;
    expired: number;
  };

  shifts: {
    active_shifts: number;
  };
};
// ======================================================
// WORKER DASHBOARD
// ======================================================

export type WorkerDashboardData = {
  status: 'success';

  worker: {
    id: number;
    name: string;
    employeeCode: string;
    mine: {
      id: number;
      name: string;
    };
  };

  attendance: {
    id: number;
    attendance_date: string;
    check_in?: string | null;
    check_out?: string | null;
    status?: string | null;
    shift_name?: string | null;
    start_time?: string | null;
    end_time?: string | null;
  } | null;

  shift: {
    id: number;
    name: string;
    start_time: string;
    end_time: string;
  } | null;

  health: {
    medical_status: string;
    fitness_expiry_date?: string | null;
  } | null;

  incidents: {
    total: number;
    active: number;
  };

  leave: {
    total: number;
    pending: number;
  };
};

export async function getWorkerDashboard(): Promise<WorkerDashboardData> {
  const response = await fetch(
    `${API_URL}/dashboard/worker`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to load worker dashboard',
    );
  }

  return data;
}
export async function getManagerDashboard(): Promise<ManagerDashboardData> {
  const response = await fetch(
    `${API_URL}/dashboard/manager`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to load manager dashboard',
    );
  }

  return data;
}

export type AdminDashboardData = {
  status: 'success';
  mines: {
    total: number;
    active: number;
  };
  workers: {
    total: number;
  };
  users: {
    total: number;
    active: number;
  };
  registrations: {
    pending: number;
    under_review: number;
    rejected: number;
  };
  incidents: {
    total: number;
    active: number;
    critical: number;
  };
};

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const response = await fetch(
    `${API_URL}/dashboard/admin`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to load admin dashboard',
    );
  }

  return data;
}

export type WorkerApi = {
  id: number;
  name: string;
  employee_code: string;
  phone?: string | null;
  mine_id: number;
  mine_name?: string | null;
  mine_code?: string | null;

  department?: string | null;
  designation?: string | null;

  role?: string | null;
  account_status?: string | null;
  is_verified?: boolean | null;
};
export async function getAllWorkers(): Promise<WorkerApi[]> {
  const response = await fetch(
    `${API_URL}/workers/all`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to fetch all workers'
    );
  }

  return data.workers ?? [];
}

export type ReportsSummary = {
  mine: {
    id: number;
  };

  summary: {
    totalIncidents: number;
    closedIncidents: number;
    highPriority: number;
    totalEquipment: number;
    operationalEquipment: number;
    outOfService: number;
    attendanceRecords: number;
    lateRecords: number;
  };

  recentIncidents: {
    id: number;
    title: string;
    incident_type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'OPEN' | 'UNDER_INVESTIGATION' | 'RESOLVED' | 'CLOSED';
    location?: string | null;
    incident_date: string;
  }[];
};


export async function getReportsSummary(): Promise<ReportsSummary> {
  const response = await fetch(
    `${API_URL}/reports/summary`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || 'Failed to fetch reports summary'
    );
  }

  return data;
}
// ==================================================
// ADMIN — REPORTS SUMMARY
// Platform-wide reports for Platform Admin
// ==================================================

export type AdminReportsSummary = {
  status: 'success';

  mines: {
    total: number;
    active: number;
  };

  workers: {
    total: number;
  };

  incidents: {
    total: number;
    active: number;
    highPriority: number;
    critical: number;
    closed: number;
  };

  equipment: {
    total: number;
    operational: number;
    maintenance: number;
    outOfService: number;
  };

  attendance: {
    records: number;
    todayRecords: number;
    todayLate: number;
  };

  recentIncidents: {
    id: number;
    title: string;
    incident_type: string;
    severity:
      | 'LOW'
      | 'MEDIUM'
      | 'HIGH'
      | 'CRITICAL';
    status:
      | 'OPEN'
      | 'UNDER_INVESTIGATION'
      | 'RESOLVED'
      | 'CLOSED';
    location?: string | null;
    incident_date: string;
    mine_name?: string | null;
    mine_code?: string | null;
  }[];
};

export async function getAdminReportsSummary(): Promise<AdminReportsSummary> {
  const response = await fetch(
    `${API_URL}/reports/admin-summary`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to load admin reports.'
    );
  }

  return data;
}
export type AttendanceApi = {
  id: number;
  attendance_date: string;
  check_in?: string | null;
  check_out?: string | null;
  status: string;
  worker_id: number;
  worker_name: string;
  employee_code: string;
  shift_id: number;
  shift_name: string;
  mine_name: string;
};

export async function getMineAttendance(): Promise<AttendanceApi[]> {
  const response = await fetch(
    `${API_URL}/attendance/mine`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || 'Failed to fetch mine attendance'
    );
  }

  return data.attendance ?? [];
}

export type SafetyDashboardData = {
  mine: {
    id: number;
  };

  incidents: {
    total: number;
    active: number;
    high_risk: number;
  };

  health: {
    unfit: number;
    restricted: number;
    pending: number;
    expired: number;
  };

  attendance: {
    checked_in: number;
    late: number;
  };

  workersNeedingAttention: {
    worker_id: number;
    name: string;
    employee_code: string;
    medical_status: string;
    fitness_expiry_date?: string | null;
  }[];
};
export async function getSafetyDashboard(): Promise<SafetyDashboardData> {
  const response = await fetch(
    `${API_URL}/dashboard/safety`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || 'Failed to fetch safety dashboard'
    );
  }

  return data;
}

export type IncidentStatus =
  | 'OPEN'
  | 'UNDER_INVESTIGATION'
  | 'RESOLVED'
  | 'CLOSED';

export async function updateIncidentStatus(
  id: number,
  status: IncidentStatus,
): Promise<IncidentApi> {
  const response = await fetch(
    `${API_URL}/incidents/${id}/status`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        status,
      }),
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to update incident status',
    );
  }

  return data.incident ?? data;
}

export async function resolveIncident(
  id: number,
  resolutionNotes: string,
): Promise<IncidentApi> {
  const response = await fetch(
    `${API_URL}/incidents/${id}/resolve`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        resolutionNotes,
      }),
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to resolve incident',
    );
  }

  return data.incident ?? data;
}

export async function closeIncident(
  id: number,
): Promise<IncidentApi> {
  const response = await fetch(
    `${API_URL}/incidents/${id}/close`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to close incident',
    );
  }

  return data.incident ?? data;
}

// ==================================================
// WORKER HEALTH
// ==================================================

export type WorkerHealthApi = {
  id: number;
  worker_id: number;
  blood_group: string | null;
  medical_status:
    | 'FIT'
    | 'UNFIT'
    | 'FIT_WITH_RESTRICTIONS'
    | 'PENDING';
  medical_check_date: string | null;
  fitness_expiry_date: string | null;
  restrictions: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function getMyHealth(): Promise<WorkerHealthApi> {
  const response = await fetch(
    `${API_URL}/health/me`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to load health profile.'
    );
  }

  return data.health;
}

export async function updateMyHealth(
  health: {
    bloodGroup?: string | null;
    medicalCheckDate?: string | null;
    fitnessExpiryDate?: string | null;
    restrictions?: string | null;
    notes?: string | null;
  }
): Promise<WorkerHealthApi> {
  const response = await fetch(
    `${API_URL}/health/me`,
    {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(health),
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to update health profile.'
    );
  }

  return data.health;
}

// ======================================================
// MANAGER — LEAVE APPROVAL
// ======================================================

export type ManagerLeaveRequest = {
  id: number;
  worker_id: number;
  worker_name: string;
  employee_code: string;

  leave_type:
    | 'annual'
    | 'sick'
    | 'personal'
    | 'emergency';

  start_date: string;
  end_date: string;
  days: number;
  reason: string;

  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'cancelled';

  submitted_at: string;

  reviewed_by?: number | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
};

export async function getManagerLeaveRequests(): Promise<
  ManagerLeaveRequest[]
> {
  const response = await fetch(
    `${API_URL}/manager/leave-requests`,
    {
      method: 'GET',
      headers: authHeaders(),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to fetch leave requests',
    );
  }

  return data.requests || [];
}

export async function approveManagerLeaveRequest(
  id: number,
): Promise<ManagerLeaveRequest> {
  const response = await fetch(
    `${API_URL}/manager/leave-requests/${id}/approve`,
    {
      method: 'PATCH',
      headers: authHeaders(),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to approve leave request',
    );
  }

  return data.request;
}

export async function rejectManagerLeaveRequest(
  id: number,
  reason: string,
): Promise<ManagerLeaveRequest> {
  const response = await fetch(
    `${API_URL}/manager/leave-requests/${id}/reject`,
    {
      method: 'PATCH',
      headers: authHeaders(),

      body: JSON.stringify({
        reason,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to reject leave request',
    );
  }

  return data.request;
}

// ======================================================
// WORKER — LEAVE BALANCE
// ======================================================

export type LeaveBalanceApi = {
  leaveType:
    | 'annual'
    | 'sick'
    | 'personal'
    | 'emergency';

  allocatedDays: number;
  approvedDays: number;
  pendingDays: number;
  remainingDays: number;
};

export type LeaveBalanceResponse = {
  status: 'success';
  year: number;
  balances: LeaveBalanceApi[];
};

export async function getLeaveBalance(): Promise<LeaveBalanceResponse> {
  const response = await fetch(
    `${API_URL}/leave-requests/balance`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to fetch leave balance',
    );
  }

  return data;
}

// ======================================================
// WORKER EMERGENCY / SOS
// ======================================================

export type EmergencyType =
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

export type EmergencyApi = {
  id: number;
  mine_id: number;
  worker_id: number;
  emergency_type: EmergencyType;
  severity: string;
  description?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status:
    | 'ACTIVE'
    | 'ACKNOWLEDGED'
    | 'RESPONDING'
    | 'RESOLVED'
    | 'CANCELLED';
  created_at: string;
  updated_at?: string;
};

export async function createEmergency(
  payload: {
    emergencyType: EmergencyType;
    description?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
  },
): Promise<EmergencyApi> {
  const response = await fetch(
    `${API_URL}/emergency`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to send emergency alert',
    );
  }

  return data.emergency ?? data;
}

// ======================================================
// WORKER ATTENDANCE
// ======================================================

export type WorkerAttendanceApi = {
  id: number;
  worker_id: number;
  shift_id: number;
  mine_id: number;
  attendance_date: string;
  check_in?: string | null;
  check_out?: string | null;
  status: 'PRESENT' | 'LATE';
};

export async function checkInWorker(): Promise<WorkerAttendanceApi> {
  const response = await fetch(
    `${API_URL}/attendance/check-in`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to check in',
    );
  }

  return data.attendance;
}

export async function checkOutWorker(): Promise<WorkerAttendanceApi> {
  const response = await fetch(
    `${API_URL}/attendance/check-out`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to check out',
    );
  }

  return data.attendance;
}

export async function getMyAttendance(): Promise<
  WorkerAttendanceApi[]
> {
  const response = await fetch(
    `${API_URL}/attendance/me`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Failed to fetch your attendance',
    );
  }

  return data.attendance ?? [];
}