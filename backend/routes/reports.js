const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');

const router = express.Router();

router.get(
    '/summary',
    authenticateToken,
    requireRoles(
        'MINE_MANAGER',
        'SAFETY_OFFICER'
    ),
    async (req, res) => {
        try {
            const userResult = await pool.query(
                `
                SELECT mine_id
                FROM users
                WHERE id = $1
                  AND role IN (
                      'MINE_MANAGER',
                      'SAFETY_OFFICER'
                  )
                `,
                [req.user.userId]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User account not found.'
                });
            }

            const mineId = userResult.rows[0].mine_id;

            if (!mineId) {
                return res.status(403).json({
                    status: 'error',
                    message: 'User is not assigned to a mine.'
                });
            }

            const incidentResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total_incidents,
                    COUNT(*) FILTER (
                        WHERE status = 'CLOSED'
                    )::INTEGER AS closed_incidents,
                    COUNT(*) FILTER (
                        WHERE severity IN (
                            'HIGH',
                            'CRITICAL'
                        )
                    )::INTEGER AS high_priority
                FROM incidents
                WHERE mine_id = $1
                `,
                [mineId]
            );

            const equipmentResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total_equipment,
                    COUNT(*) FILTER (
                        WHERE status IN (
                            'AVAILABLE',
                            'IN_USE'
                        )
                    )::INTEGER AS operational_equipment,
                    COUNT(*) FILTER (
                        WHERE status = 'OUT_OF_SERVICE'
                    )::INTEGER AS out_of_service
                FROM equipment
                WHERE mine_id = $1
                `,
                [mineId]
            );

            const attendanceResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS attendance_records,
                    COUNT(*) FILTER (
                        WHERE status = 'LATE'
                    )::INTEGER AS late_records
                FROM attendance
                WHERE mine_id = $1
                  AND attendance_date >=
                      CURRENT_DATE - INTERVAL '6 days'
                `,
                [mineId]
            );

            const recentIncidents = await pool.query(
                `
                SELECT
                    id,
                    title,
                    incident_type,
                    severity,
                    status,
                    location,
                    incident_date
                FROM incidents
                WHERE mine_id = $1
                ORDER BY incident_date DESC
                LIMIT 10
                `,
                [mineId]
            );

            return res.status(200).json({
                status: 'success',

                mine: {
                    id: mineId
                },

                summary: {
                    totalIncidents:
                        Number(
                            incidentResult.rows[0]
                                .total_incidents
                        ) || 0,

                    closedIncidents:
                        Number(
                            incidentResult.rows[0]
                                .closed_incidents
                        ) || 0,

                    highPriority:
                        Number(
                            incidentResult.rows[0]
                                .high_priority
                        ) || 0,

                    totalEquipment:
                        Number(
                            equipmentResult.rows[0]
                                .total_equipment
                        ) || 0,

                    operationalEquipment:
                        Number(
                            equipmentResult.rows[0]
                                .operational_equipment
                        ) || 0,

                    outOfService:
                        Number(
                            equipmentResult.rows[0]
                                .out_of_service
                        ) || 0,

                    attendanceRecords:
                        Number(
                            attendanceResult.rows[0]
                                .attendance_records
                        ) || 0,

                    lateRecords:
                        Number(
                            attendanceResult.rows[0]
                                .late_records
                        ) || 0
                },

                recentIncidents:
                    recentIncidents.rows
            });

        } catch (error) {
            console.error(
                'Reports summary error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to load reports summary.'
            });
        }
    }
);
// ======================================================
// ADMIN REPORTS SUMMARY
// Platform-wide report data for Platform Admin
// ======================================================

router.get(
    '/admin-summary',
    authenticateToken,
    requireRoles('PLATFORM_ADMIN'),
    async (req, res) => {
        try {
            // ------------------------------------------
            // MINES
            // ------------------------------------------

            const minesResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total_mines,
                    COUNT(*) FILTER (
                        WHERE status = 'ACTIVE'
                    )::INTEGER AS active_mines
                FROM mines
                `
            );

            // ------------------------------------------
            // WORKERS
            // ------------------------------------------

            const workersResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total_workers
                FROM workers
                `
            );

            // ------------------------------------------
            // INCIDENTS
            // ------------------------------------------

            const incidentResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total_incidents,

                    COUNT(*) FILTER (
                        WHERE status IN (
                            'OPEN',
                            'UNDER_INVESTIGATION'
                        )
                    )::INTEGER AS active_incidents,

                    COUNT(*) FILTER (
                        WHERE severity IN (
                            'HIGH',
                            'CRITICAL'
                        )
                    )::INTEGER AS high_priority,

                    COUNT(*) FILTER (
                        WHERE severity = 'CRITICAL'
                    )::INTEGER AS critical_incidents,

                    COUNT(*) FILTER (
                        WHERE status = 'CLOSED'
                    )::INTEGER AS closed_incidents
                FROM incidents
                `
            );

            // ------------------------------------------
            // EQUIPMENT
            // ------------------------------------------

            const equipmentResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total_equipment,

                    COUNT(*) FILTER (
                        WHERE status IN (
                            'AVAILABLE',
                            'IN_USE'
                        )
                    )::INTEGER AS operational_equipment,

                    COUNT(*) FILTER (
                        WHERE status = 'MAINTENANCE'
                    )::INTEGER AS maintenance_equipment,

                    COUNT(*) FILTER (
                        WHERE status = 'OUT_OF_SERVICE'
                    )::INTEGER AS out_of_service
                FROM equipment
                `
            );

            // ------------------------------------------
            // ATTENDANCE
            // ------------------------------------------

            const attendanceResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS attendance_records,

                    COUNT(*) FILTER (
                        WHERE attendance_date = CURRENT_DATE
                    )::INTEGER AS today_records,

                    COUNT(*) FILTER (
                        WHERE attendance_date = CURRENT_DATE
                        AND status = 'LATE'
                    )::INTEGER AS today_late
                FROM attendance
                `
            );

            // ------------------------------------------
            // RECENT INCIDENTS
            // ------------------------------------------

            const recentIncidents = await pool.query(
                `
                SELECT
                    i.id,
                    i.title,
                    i.incident_type,
                    i.severity,
                    i.status,
                    i.location,
                    i.incident_date,
                    m.name AS mine_name,
                    m.mine_code
                FROM incidents i
                LEFT JOIN mines m
                    ON m.id = i.mine_id
                ORDER BY i.incident_date DESC
                LIMIT 10
                `
            );

            // ------------------------------------------
            // RESPONSE
            // ------------------------------------------

            return res.status(200).json({
                status: 'success',

                mines: {
                    total:
                        Number(
                            minesResult.rows[0]
                                .total_mines
                        ) || 0,

                    active:
                        Number(
                            minesResult.rows[0]
                                .active_mines
                        ) || 0
                },

                workers: {
                    total:
                        Number(
                            workersResult.rows[0]
                                .total_workers
                        ) || 0
                },

                incidents: {
                    total:
                        Number(
                            incidentResult.rows[0]
                                .total_incidents
                        ) || 0,

                    active:
                        Number(
                            incidentResult.rows[0]
                                .active_incidents
                        ) || 0,

                    highPriority:
                        Number(
                            incidentResult.rows[0]
                                .high_priority
                        ) || 0,

                    critical:
                        Number(
                            incidentResult.rows[0]
                                .critical_incidents
                        ) || 0,

                    closed:
                        Number(
                            incidentResult.rows[0]
                                .closed_incidents
                        ) || 0
                },

                equipment: {
                    total:
                        Number(
                            equipmentResult.rows[0]
                                .total_equipment
                        ) || 0,

                    operational:
                        Number(
                            equipmentResult.rows[0]
                                .operational_equipment
                        ) || 0,

                    maintenance:
                        Number(
                            equipmentResult.rows[0]
                                .maintenance_equipment
                        ) || 0,

                    outOfService:
                        Number(
                            equipmentResult.rows[0]
                                .out_of_service
                        ) || 0
                },

                attendance: {
                    records:
                        Number(
                            attendanceResult.rows[0]
                                .attendance_records
                        ) || 0,

                    todayRecords:
                        Number(
                            attendanceResult.rows[0]
                                .today_records
                        ) || 0,

                    todayLate:
                        Number(
                            attendanceResult.rows[0]
                                .today_late
                        ) || 0
                },

                recentIncidents:
                    recentIncidents.rows
            });

        } catch (error) {
            console.error(
                'Admin reports summary error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to load admin reports summary.'
            });
        }
    }
);
module.exports = router;