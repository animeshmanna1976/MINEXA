const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');

const router = express.Router();

/*
=================================================
ANALYTICS SUMMARY
=================================================
Manager and Safety Officer only.

Returns live analytics for the user's mine.
=================================================
*/

router.get(
    '/summary',
    authenticateToken,
    requireRoles('MINE_MANAGER', 'SAFETY_OFFICER'),
    async (req, res) => {
        try {
            /*
            -----------------------------------------
            GET USER MINE
            -----------------------------------------
            */

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

            /*
            -----------------------------------------
            INCIDENT ANALYTICS
            LAST 7 DAYS
            -----------------------------------------
            */

            const incidentResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total_incidents,

                    COUNT(*) FILTER (
                        WHERE severity = 'CRITICAL'
                    )::INTEGER AS critical_incidents,

                    COUNT(*) FILTER (
                        WHERE status IN (
                            'OPEN',
                            'UNDER_INVESTIGATION'
                        )
                    )::INTEGER AS open_incidents

                FROM incidents

                WHERE mine_id = $1
                  AND incident_date >= CURRENT_DATE - INTERVAL '6 days'
                `,
                [mineId]
            );

            /*
            -----------------------------------------
            EQUIPMENT ANALYTICS
            -----------------------------------------
            */

            const equipmentResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total_equipment,

                    COUNT(*) FILTER (
                        WHERE status IN ('AVAILABLE', 'IN_USE')
                    )::INTEGER AS operational_equipment,

                    COUNT(*) FILTER (
                        WHERE status = 'MAINTENANCE'
                    )::INTEGER AS maintenance_equipment,

                    COUNT(*) FILTER (
                        WHERE status = 'OUT_OF_SERVICE'
                    )::INTEGER AS out_of_service

                FROM equipment

                WHERE mine_id = $1
                `,
                [mineId]
            );

            /*
            -----------------------------------------
            TODAY'S ATTENDANCE
            -----------------------------------------
            */

            const attendanceResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS attendance_records,

                    COUNT(*) FILTER (
                        WHERE check_out IS NULL
                    )::INTEGER AS currently_checked_in,

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
            -----------------------------------------
            7-DAY INCIDENT TREND
            -----------------------------------------
            */

            const trendResult = await pool.query(
                `
                SELECT
                    TO_CHAR(
                        CURRENT_DATE - day_offset,
                        'DD Mon'
                    ) AS day,

                    (
                        SELECT COUNT(*)
                        FROM incidents i
                        WHERE i.mine_id = $1
                          AND i.incident_date::DATE =
                              CURRENT_DATE - day_offset
                    )::INTEGER AS incidents,

                    (
                        SELECT COUNT(*)
                        FROM incidents i
                        WHERE i.mine_id = $1
                          AND i.incident_date::DATE =
                              CURRENT_DATE - day_offset
                          AND i.severity IN (
                              'HIGH',
                              'CRITICAL'
                          )
                    )::INTEGER AS high_risk_incidents

                FROM generate_series(6, 0, -1)
                AS day_offset

                ORDER BY day_offset DESC
                `,
                [mineId]
            );

            /*
            -----------------------------------------
            EQUIPMENT UPTIME
            -----------------------------------------
            */

            const equipment = equipmentResult.rows[0];

            const totalEquipment =
                Number(equipment.total_equipment) || 0;

            const operationalEquipment =
                Number(equipment.operational_equipment) || 0;

            const equipmentUptime =
                totalEquipment > 0
                    ? Number(
                          (
                              (operationalEquipment /
                                  totalEquipment) *
                              100
                          ).toFixed(1)
                      )
                    : 0;

            /*
            -----------------------------------------
            RESPONSE
            -----------------------------------------
            */

            return res.status(200).json({
                status: 'success',

                mine: {
                    id: mineId
                },

                incidents: {
                    total:
                        Number(
                            incidentResult.rows[0]
                                .total_incidents
                        ) || 0,

                    critical:
                        Number(
                            incidentResult.rows[0]
                                .critical_incidents
                        ) || 0,

                    open:
                        Number(
                            incidentResult.rows[0]
                                .open_incidents
                        ) || 0
                },

                equipment: {
                    total: totalEquipment,
                    operational:
                        operationalEquipment,
                    maintenance:
                        Number(
                            equipment.maintenance_equipment
                        ) || 0,
                    outOfService:
                        Number(
                            equipment.out_of_service
                        ) || 0,
                    uptime: equipmentUptime
                },

                attendance: {
                    records:
                        Number(
                            attendanceResult.rows[0]
                                .attendance_records
                        ) || 0,

                    checkedIn:
                        Number(
                            attendanceResult.rows[0]
                                .currently_checked_in
                        ) || 0,

                    checkedOut:
                        Number(
                            attendanceResult.rows[0]
                                .checked_out
                        ) || 0,

                    late:
                        Number(
                            attendanceResult.rows[0].late
                        ) || 0
                },

                trend: trendResult.rows.map((row) => ({
                    day: row.day,
                    incidents:
                        Number(row.incidents) || 0,
                    highRiskIncidents:
                        Number(
                            row.high_risk_incidents
                        ) || 0
                }))
            });

        } catch (error) {
            console.error(
                'Analytics summary error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to load analytics.'
            });
        }
    }
);


// =================================================
// ADMIN ANALYTICS SUMMARY
// Platform-wide analytics for Platform Admin
// =================================================

router.get(
    '/admin-summary',
    authenticateToken,
    requireRoles('PLATFORM_ADMIN'),
    async (req, res) => {
        try {
            const minesResult = await pool.query(`
                SELECT
                    COUNT(*)::INTEGER AS total,
                    COUNT(*) FILTER (
                        WHERE status = 'ACTIVE'
                    )::INTEGER AS active
                FROM mines
            `);

            const workersResult = await pool.query(`
                SELECT COUNT(*)::INTEGER AS total
                FROM workers
            `);

            const incidentsResult = await pool.query(`
                SELECT
                    COUNT(*)::INTEGER AS total,
                    COUNT(*) FILTER (
                        WHERE status IN (
                            'OPEN',
                            'UNDER_INVESTIGATION'
                        )
                    )::INTEGER AS active,
                    COUNT(*) FILTER (
                        WHERE severity = 'HIGH'
                    )::INTEGER AS high_risk,
                    COUNT(*) FILTER (
                        WHERE severity = 'CRITICAL'
                    )::INTEGER AS critical
                FROM incidents
            `);

            const equipmentResult = await pool.query(`
                SELECT
                    COUNT(*)::INTEGER AS total,
                    COUNT(*) FILTER (
                        WHERE status IN (
                            'AVAILABLE',
                            'IN_USE'
                        )
                    )::INTEGER AS operational,
                    COUNT(*) FILTER (
                        WHERE status = 'MAINTENANCE'
                    )::INTEGER AS maintenance,
                    COUNT(*) FILTER (
                        WHERE status = 'OUT_OF_SERVICE'
                    )::INTEGER AS out_of_service
                FROM equipment
            `);

            const attendanceResult = await pool.query(`
                SELECT
                    COUNT(*)::INTEGER AS records,
                    COUNT(*) FILTER (
                        WHERE attendance_date = CURRENT_DATE
                    )::INTEGER AS today_records,
                    COUNT(*) FILTER (
                        WHERE attendance_date = CURRENT_DATE
                        AND status = 'LATE'
                    )::INTEGER AS today_late
                FROM attendance
            `);

            return res.status(200).json({
                status: 'success',

                mines: {
                    total: minesResult.rows[0].total,
                    active: minesResult.rows[0].active
                },

                workers: {
                    total: workersResult.rows[0].total
                },

                incidents: {
                    total: incidentsResult.rows[0].total,
                    active: incidentsResult.rows[0].active,
                    highRisk: incidentsResult.rows[0].high_risk,
                    critical: incidentsResult.rows[0].critical
                },

                equipment: {
                    total: equipmentResult.rows[0].total,
                    operational: equipmentResult.rows[0].operational,
                    maintenance: equipmentResult.rows[0].maintenance,
                    outOfService: equipmentResult.rows[0].out_of_service
                },

                attendance: {
                    records: attendanceResult.rows[0].records,
                    todayRecords:
                        attendanceResult.rows[0].today_records,
                    todayLate:
                        attendanceResult.rows[0].today_late
                }
            });

        } catch (error) {
            console.error(
                'Admin analytics summary error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message: 'Failed to load admin analytics.'
            });
        }
    }
);
module.exports = router;