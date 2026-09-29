const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');

const router = express.Router();


/*
=================================================
FIELD WORKER DASHBOARD
=================================================
*/

router.get(
    '/worker',
    authenticateToken,
    requireRoles('FIELD_WORKER'),
    async (req, res) => {
        try {
            const userResult = await pool.query(
                `
                SELECT
                    u.id,
                    u.name,
                    u.worker_id,
                    u.mine_id,
                    w.employee_code,
                    w.name AS worker_name,
                    m.name AS mine_name
                FROM users u
                JOIN workers w
                    ON w.id = u.worker_id
                LEFT JOIN mines m
                    ON m.id = u.mine_id
                WHERE u.id = $1
                  AND u.account_status = 'ACTIVE'
                  AND u.is_verified = TRUE
                `,
                [req.user.userId]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Worker account not found.'
                });
            }

            const user = userResult.rows[0];

            /*
            Today's attendance
            */
            const attendanceResult = await pool.query(
                `
                SELECT
                    a.id,
                    a.attendance_date,
                    a.check_in,
                    a.check_out,
                    a.status,
                    s.name AS shift_name,
                    s.start_time,
                    s.end_time
                FROM attendance a
                JOIN shifts s
                    ON s.id = a.shift_id
                WHERE a.worker_id = $1
                  AND a.attendance_date = CURRENT_DATE
                LIMIT 1
                `,
                [user.worker_id]
            );

            /*
            Current shift
            */
            const shiftResult = await pool.query(
                `
                SELECT
                    s.id,
                    s.name,
                    s.start_time,
                    s.end_time
                FROM worker_shift_assignments a
                JOIN shifts s
                    ON s.id = a.shift_id
                WHERE a.worker_id = $1
                  AND a.is_active = TRUE
                  AND s.is_active = TRUE
                  AND a.effective_from <= CURRENT_DATE
                  AND (
                      a.effective_to IS NULL
                      OR a.effective_to >= CURRENT_DATE
                  )
                ORDER BY a.effective_from DESC
                LIMIT 1
                `,
                [user.worker_id]
            );

            /*
            Health
            */
            const healthResult = await pool.query(
                `
                SELECT
                    medical_status,
                    fitness_expiry_date
                FROM worker_health
                WHERE worker_id = $1
                `,
                [user.worker_id]
            );

            /*
            Incident count
            */
            const incidentResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total,
                    COUNT(*) FILTER (
                        WHERE status IN (
                            'OPEN',
                            'UNDER_INVESTIGATION'
                        )
                    )::INTEGER AS active
                FROM incidents
                WHERE reported_by = $1
                `,
                [user.id]
            );

            /*
            Leave count
            */
            const leaveResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total,
                    COUNT(*) FILTER (
                        WHERE status = 'pending'
                    )::INTEGER AS pending
                FROM leave_requests
                WHERE worker_id = $1
                `,
                [user.worker_id]
            );

            return res.status(200).json({
                status: 'success',

                worker: {
                    id: user.id,
                    name: user.worker_name,
                    employeeCode: user.employee_code,
                    mine: {
                        id: user.mine_id,
                        name: user.mine_name
                    }
                },

                attendance:
                    attendanceResult.rows[0] || null,

                shift:
                    shiftResult.rows[0] || null,

                health:
                    healthResult.rows[0] || null,

                incidents:
                    incidentResult.rows[0],

                leave:
                    leaveResult.rows[0]
            });

        } catch (error) {
            console.error(
                'Worker dashboard error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to load worker dashboard.'
            });
        }
    }
);


/*
=================================================
MANAGER DASHBOARD
=================================================
*/

router.get(
    '/manager',
    authenticateToken,
    requireRoles('MINE_MANAGER'),
    async (req, res) => {
        try {
            const managerResult = await pool.query(
                `
                SELECT
                    id,
                    mine_id
                FROM users
                WHERE id = $1
                  AND role = 'MINE_MANAGER'
                  AND account_status = 'ACTIVE'
                  AND is_verified = TRUE
                `,
                [req.user.userId]
            );

            if (
                managerResult.rows.length === 0 ||
                !managerResult.rows[0].mine_id
            ) {
                return res.status(403).json({
                    status: 'error',
                    message:
                        'Manager is not assigned to an active mine.'
                });
            }

            const mineId =
                managerResult.rows[0].mine_id;

            /*
            Worker count
            */
            const workerCountResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS total_workers
                    FROM workers
                    WHERE mine_id = $1
                    `,
                    [mineId]
                );

            /*
            Today's attendance
            */
            const attendanceResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS checked_in,
                        COUNT(*) FILTER (
                            WHERE check_out IS NOT NULL
                        )::INTEGER AS checked_out,
                        COUNT(*) FILTER (
                            WHERE status = 'LATE'
                        )::INTEGER AS late
                    FROM attendance
                    WHERE mine_id = $1
                      AND attendance_date = CURRENT_DATE
                    `,
                    [mineId]
                );

            /*
            Incident summary
            */
            const incidentResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS total,
                        COUNT(*) FILTER (
                            WHERE status IN (
                                'OPEN',
                                'UNDER_INVESTIGATION'
                            )
                        )::INTEGER AS open,
                        COUNT(*) FILTER (
                            WHERE severity = 'CRITICAL'
                              AND status != 'CLOSED'
                        )::INTEGER AS critical
                    FROM incidents
                    WHERE mine_id = $1
                    `,
                    [mineId]
                );

            /*
            Health summary
            */
            const healthResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS workers_with_health_records,

                        COUNT(*) FILTER (
                            WHERE medical_status = 'UNFIT'
                        )::INTEGER AS unfit,

                        COUNT(*) FILTER (
                            WHERE medical_status = 'FIT_WITH_RESTRICTIONS'
                        )::INTEGER AS restricted,

                        COUNT(*) FILTER (
                            WHERE medical_status = 'PENDING'
                        )::INTEGER AS pending,

                        COUNT(*) FILTER (
                            WHERE fitness_expiry_date < CURRENT_DATE
                        )::INTEGER AS expired

                    FROM worker_health h
                    JOIN workers w
                        ON w.id = h.worker_id

                    WHERE w.mine_id = $1
                    `,
                    [mineId]
                );

            /*
            Shift count
            */
            const shiftResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS active_shifts
                    FROM shifts
                    WHERE mine_id = $1
                      AND is_active = TRUE
                    `,
                    [mineId]
                );

            return res.status(200).json({
                status: 'success',

                mine: {
                    id: mineId
                },

                workers:
                    workerCountResult.rows[0],

                attendance:
                    attendanceResult.rows[0],

                incidents:
                    incidentResult.rows[0],

                health:
                    healthResult.rows[0],

                shifts:
                    shiftResult.rows[0]
            });

        } catch (error) {
            console.error(
                'Manager dashboard error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to load manager dashboard.'
            });
        }
    }
);


/*
=================================================
SAFETY OFFICER DASHBOARD
=================================================
*/

router.get(
    '/safety',
    authenticateToken,
    requireRoles('SAFETY_OFFICER'),
    async (req, res) => {
        try {
            const officerResult = await pool.query(
                `
                SELECT
                    id,
                    mine_id
                FROM users
                WHERE id = $1
                  AND role = 'SAFETY_OFFICER'
                  AND account_status = 'ACTIVE'
                  AND is_verified = TRUE
                `,
                [req.user.userId]
            );

            if (
                officerResult.rows.length === 0 ||
                !officerResult.rows[0].mine_id
            ) {
                return res.status(403).json({
                    status: 'error',
                    message:
                        'Safety Officer is not assigned to an active mine.'
                });
            }

            const mineId =
                officerResult.rows[0].mine_id;

            const incidentResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS total,
                        COUNT(*) FILTER (
                            WHERE status IN (
                                'OPEN',
                                'UNDER_INVESTIGATION'
                            )
                        )::INTEGER AS active,
                        COUNT(*) FILTER (
                            WHERE severity IN (
                                'HIGH',
                                'CRITICAL'
                            )
                              AND status != 'CLOSED'
                        )::INTEGER AS high_risk
                    FROM incidents
                    WHERE mine_id = $1
                    `,
                    [mineId]
                );

            const healthResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*) FILTER (
                            WHERE h.medical_status = 'UNFIT'
                        )::INTEGER AS unfit,

                        COUNT(*) FILTER (
                            WHERE h.medical_status =
                                'FIT_WITH_RESTRICTIONS'
                        )::INTEGER AS restricted,

                        COUNT(*) FILTER (
                            WHERE h.medical_status = 'PENDING'
                        )::INTEGER AS pending,

                        COUNT(*) FILTER (
                            WHERE h.fitness_expiry_date < CURRENT_DATE
                        )::INTEGER AS expired

                    FROM worker_health h
                    JOIN workers w
                        ON w.id = h.worker_id
                    WHERE w.mine_id = $1
                    `,
                    [mineId]
                );

            const attendanceResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS checked_in,
                        COUNT(*) FILTER (
                            WHERE status = 'LATE'
                        )::INTEGER AS late
                    FROM attendance
                    WHERE mine_id = $1
                      AND attendance_date = CURRENT_DATE
                    `,
                    [mineId]
                );

            const workersNeedingAttention =
                await pool.query(
                    `
                    SELECT
                        w.id AS worker_id,
                        w.name,
                        w.employee_code,
                        h.medical_status,
                        h.fitness_expiry_date

                    FROM workers w

                    JOIN worker_health h
                        ON h.worker_id = w.id

                    WHERE w.mine_id = $1

                      AND (
                          h.medical_status IN (
                              'UNFIT',
                              'FIT_WITH_RESTRICTIONS',
                              'PENDING'
                          )

                          OR h.fitness_expiry_date
                              < CURRENT_DATE
                      )

                    ORDER BY
                        h.fitness_expiry_date ASC NULLS LAST
                    LIMIT 20
                    `,
                    [mineId]
                );

            return res.status(200).json({
                status: 'success',

                mine: {
                    id: mineId
                },

                incidents:
                    incidentResult.rows[0],

                health:
                    healthResult.rows[0],

                attendance:
                    attendanceResult.rows[0],

                workersNeedingAttention:
                    workersNeedingAttention.rows
            });

        } catch (error) {
            console.error(
                'Safety dashboard error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to load safety dashboard.'
            });
        }
    }
);


/*
=================================================
PLATFORM ADMIN DASHBOARD
=================================================
*/

router.get(
    '/admin',
    authenticateToken,
    requireRoles('PLATFORM_ADMIN'),
    async (req, res) => {
        try {
            const [
                mines,
                workers,
                users,
                registrations,
                incidents
            ] = await Promise.all([
                pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS total,
                        COUNT(*) FILTER (
                            WHERE status = 'ACTIVE'
                        )::INTEGER AS active
                    FROM mines
                    `
                ),

                pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS total
                    FROM workers
                    `
                ),

                pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS total,
                        COUNT(*) FILTER (
                            WHERE account_status = 'ACTIVE'
                        )::INTEGER AS active
                    FROM users
                    `
                ),

                pool.query(
                    `
                    SELECT
                        COUNT(*) FILTER (
                            WHERE status = 'PENDING'
                        )::INTEGER AS pending,
                        COUNT(*) FILTER (
                            WHERE status = 'UNDER_REVIEW'
                        )::INTEGER AS under_review,
                        COUNT(*) FILTER (
                            WHERE status = 'REJECTED'
                        )::INTEGER AS rejected
                    FROM registration_requests
                    `
                ),

                pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS total,
                        COUNT(*) FILTER (
                            WHERE status IN (
                                'OPEN',
                                'UNDER_INVESTIGATION'
                            )
                        )::INTEGER AS active,
                        COUNT(*) FILTER (
                            WHERE severity = 'CRITICAL'
                              AND status != 'CLOSED'
                        )::INTEGER AS critical
                    FROM incidents
                    `
                )
            ]);

            return res.status(200).json({
                status: 'success',

                mines: mines.rows[0],
                workers: workers.rows[0],
                users: users.rows[0],
                registrations: registrations.rows[0],
                incidents: incidents.rows[0]
            });

        } catch (error) {
            console.error(
                'Admin dashboard error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to load admin dashboard.'
            });
        }
    }
);

module.exports = router;