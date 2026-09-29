const express = require('express');
const cors = require('cors');
const pool = require('./db');
const app = express();
const authenticateToken = require('./middleware/auth');
const PORT = process.env.PORT || 3000;
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const managerRoutes = require('./routes/manager');
const { requireRoles } = require('./middleware/roles');
const applicationRoutes = require('./routes/application');
const workerRoutes = require('./routes/workers');
const attendanceRoutes = require('./routes/attendance');
const shiftRoutes = require('./routes/shifts');

const safetyRoutes = require('./routes/safety');
const healthRoutes = require('./routes/health');
const incidentRoutes = require('./routes/incidents');
const dashboardRoutes = require('./routes/dashboard');
const equipmentRoutes = require("./routes/equipment");
const equipmentInspectionRoutes = require("./routes/equipmentInspections");
const equipmentMaintenanceRoutes = require("./routes/equipmentMaintenance");
const safetyChecklistRoutes = require("./routes/safetyChecklists");
const safetyMonitoringRoutes = require("./routes/safetyMonitoring");
const ppeTypeRoutes = require("./routes/ppeTypes");
const ppeRoutes = require("./routes/ppe");
const ppeInspectionRoutes = require("./routes/ppeInspections");
const ppeMonitoringRoutes = require("./routes/ppeMonitoring");
const emergencyRoutes = require("./routes/emergency");
const emergencyDashboardRoutes = require("./routes/emergencyDashboard");
const locationRoutes = require("./routes/location");
const riskRoutes = require("./routes/risk");
const riskMonitoringRoutes = require("./routes/riskMonitoring");
const auditRoutes = require("./routes/audit");
const analyticsRoutes = require('./routes/analytics');
const reportsRoutes = require('./routes/reports');

app.use(cors());

app.use(express.json());
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/manager', managerRoutes);
app.use('/api/v1/safety', safetyRoutes);
app.use('/api/v1/application', applicationRoutes);
app.use('/api/v1/workers', workerRoutes);
app.use('/api/v1/attendance',attendanceRoutes);
app.use('/api/v1/shifts',shiftRoutes);
app.use('/api/v1/health',healthRoutes);
app.use('/api/v1/incidents',incidentRoutes);
app.use('/api/v1/dashboard',dashboardRoutes);
app.use("/api/v1/equipment", equipmentRoutes);
app.use("/api/v1/equipment-inspections",equipmentInspectionRoutes);
app.use("/api/v1/equipment-maintenance",equipmentMaintenanceRoutes);
app.use("/api/v1/safety-checklists", safetyChecklistRoutes);
app.use("/api/v1/safety-monitoring",safetyMonitoringRoutes);
app.use("/api/v1/ppe-types", ppeTypeRoutes);
app.use("/api/v1/ppe",ppeRoutes);
app.use("/api/v1/ppe-inspections",ppeInspectionRoutes);
app.use("/api/v1/ppe-monitoring",ppeMonitoringRoutes);
app.use("/api/v1/emergency",emergencyRoutes);
app.use("/api/v1/emergency-dashboard",emergencyDashboardRoutes);
app.use("/api/v1/location",locationRoutes);
app.use("/api/v1/risk",riskRoutes);
app.use("/api/v1/risk-monitoring",riskMonitoringRoutes);
app.use("/api/v1/audit", auditRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/reports',reportsRoutes);


app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MINEXA API',
    message: 'Backend is running successfully',
    timestamp: new Date().toISOString(),
  });
});
app.get('/api/v1/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');

    res.json({
      status: 'ok',
      message: 'PostgreSQL connected successfully',
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    console.error('Database connection error:', error);

    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
    });
  }
});

app.get('/api/v1/test-email', async (req, res) => {
  const { sendEmail } = require('./services/emailService');
  const targetEmail = req.query.to || process.env.EMAIL_USER;

  if (!targetEmail) {
    return res.status(400).json({
      status: 'error',
      message: 'Please provide ?to=your_email@gmail.com or set EMAIL_USER in environment variables.',
    });
  }

  try {
    const result = await sendEmail({
      to: targetEmail,
      subject: 'MINEXA Test Email',
      text: 'Hello from MINEXA! Your email service is working properly on Render.',
    });

    res.json({
      status: 'success',
      message: `Test email sent successfully to ${targetEmail}`,
      result,
    });
  } catch (error) {
    console.error('Test email failed:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to send test email',
      hint: 'Ensure EMAIL_USER and EMAIL_APP_PASSWORD are correctly set in Render environment variables without spaces.',
    });
  }
});

app.post(
  '/api/v1/leave-requests',
  authenticateToken,
  async (req, res) => {
    try {
      const {
        leaveType,
        startDate,
        endDate,
        days,
        reason,
      } = req.body;

      const workerId = req.user.workerId;

      if (!workerId) {
        return res.status(403).json({
          status: 'error',
          message: 'This account is not linked to a worker',
        });
      }

      if (
        !leaveType ||
        !startDate ||
        !endDate ||
        !days ||
        !reason
      ) {
        return res.status(400).json({
          status: 'error',
          message: 'All fields are required',
        });
      }

      const result = await pool.query(
        `
        INSERT INTO leave_requests
        (
          worker_id,
          leave_type,
          start_date,
          end_date,
          days,
          reason,
          status
        )
        VALUES
        ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          worker_id,
          leave_type,
          start_date,
          end_date,
          days,
          reason,
          status,
          submitted_at
        `,
        [
          workerId,
          leaveType,
          startDate,
          endDate,
          days,
          reason,
          'pending',
        ]
      );

      return res.status(201).json({
        status: 'success',
        message: 'Leave request created successfully',
        request: result.rows[0],
      });
    } catch (error) {
      console.error(
        'Leave request creation error:',
        error
      );

      return res.status(500).json({
        status: 'error',
        message: 'Failed to create leave request',
      });
    }
  }
);
app.get(
  '/api/v1/leave-requests',
  authenticateToken,
  async (req, res) => {
    try {
      const workerId = req.user.workerId;

      if (!workerId) {
        return res.status(403).json({
          status: 'error',
          message: 'This account is not linked to a worker',
        });
      }

      const result = await pool.query(
        `
        SELECT
    id,
    worker_id,
    leave_type,
    start_date,
    end_date,
    days,
    reason,
    status,
    submitted_at,
    rejection_reason,
    reviewed_by,
    reviewed_at
FROM leave_requests
WHERE worker_id = $1
ORDER BY submitted_at DESC
        `,
        [workerId]
      );

      return res.status(200).json({
        status: 'success',
        requests: result.rows,
      });
    } catch (error) {
      console.error(
        'Error fetching leave requests:',
        error
      );

      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch leave requests',
      });
    }
  }
);
app.patch(
  '/api/v1/leave-requests/:id/cancel',
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const workerId = req.user.workerId;

      if (!workerId) {
        return res.status(403).json({
          status: 'error',
          message: 'This account is not linked to a worker',
        });
      }

      const result = await pool.query(
        `
        UPDATE leave_requests
        SET status = 'cancelled'
        WHERE id = $1
          AND worker_id = $2
          AND status = 'pending'
        RETURNING
          id,
          worker_id,
          leave_type,
          start_date,
          end_date,
          days,
          reason,
          status,
          submitted_at
        `,
        [id, workerId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message:
            'Leave request not found, not yours, or cannot be cancelled.',
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Leave request cancelled successfully',
        request: result.rows[0],
      });
    } catch (error) {
      console.error(
        'Cancel leave request error:',
        error
      );

      return res.status(500).json({
        status: 'error',
        message: 'Failed to cancel leave request',
      });
    }
  }
);

app.use('/api/v1/auth', authRoutes);
app.get(
  '/api/v1/admin/test',
  authenticateToken,
  requireRoles('PLATFORM_ADMIN'),
  (req, res) => {
    res.json({
      status: 'success',
      message:
        'Platform Admin access confirmed',
      user: req.user,
    });
  },
);

app.get(
  '/api/v1/mines',
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          name,
          mine_code,
          location,
          status
        FROM mines
        WHERE status = 'ACTIVE'
        ORDER BY name
      `);

      return res.status(200).json({
        status: 'success',
        mines: result.rows,
      });
    } catch (error) {
      console.error(
        'Mine fetch error:',
        error
      );

      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch mines',
      });
    }
  }
);
// ======================================================
// GET WORKER LEAVE BALANCE
// FIELD WORKER ONLY
// ======================================================

app.get(
    '/api/v1/leave-requests/balance',
    authenticateToken,
    requireRoles('FIELD_WORKER'),
    async (req, res) => {
        try {
            const userResult = await pool.query(
                `
                SELECT
                    worker_id
                FROM users
                WHERE id = $1
                  AND role = 'FIELD_WORKER'
                  AND account_status = 'ACTIVE'
                `,
                [req.user.userId]
            );

            if (
                userResult.rows.length === 0 ||
                !userResult.rows[0].worker_id
            ) {
                return res.status(404).json({
                    status: 'error',
                    message:
                        'Worker account not found.'
                });
            }

            const workerId =
                userResult.rows[0].worker_id;

            const result = await pool.query(
                `
                SELECT
                    b.leave_type,
                    b.allocated_days,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN lr.status = 'approved'
                                 AND EXTRACT(
                                     YEAR FROM lr.start_date
                                 ) = $2
                                THEN lr.days
                                ELSE 0
                            END
                        ),
                        0
                    )::INTEGER AS approved_days,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN lr.status = 'pending'
                                 AND EXTRACT(
                                     YEAR FROM lr.start_date
                                 ) = $2
                                THEN lr.days
                                ELSE 0
                            END
                        ),
                        0
                    )::INTEGER AS pending_days

                FROM worker_leave_balances b

                LEFT JOIN leave_requests lr
                    ON lr.worker_id = b.worker_id
                   AND lr.leave_type = b.leave_type

                WHERE b.worker_id = $1
                  AND b.year = $2

                GROUP BY
                    b.leave_type,
                    b.allocated_days

                ORDER BY
                    b.leave_type;
                `,
                [
                    workerId,
                    new Date().getFullYear()
                ]
            );

            const balances = result.rows.map(
                (row) => ({
                    leaveType: row.leave_type,

                    allocatedDays:
                        Number(
                            row.allocated_days
                        ) || 0,

                    approvedDays:
                        Number(
                            row.approved_days
                        ) || 0,

                    pendingDays:
                        Number(
                            row.pending_days
                        ) || 0,

                    remainingDays: Math.max(
                        (
                            Number(
                                row.allocated_days
                            ) || 0
                        ) -
                        (
                            Number(
                                row.approved_days
                            ) || 0
                        ),
                        0
                    )
                })
            );

            return res.status(200).json({
                status: 'success',
                year: new Date().getFullYear(),
                balances
            });

        } catch (error) {
            console.error(
                'Leave balance error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to load leave balance.'
            });
        }
    }
);
app.listen(PORT, () => {
  console.log(`MINEXA API running on http://localhost:${PORT}`);
});
