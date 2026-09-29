const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');

const router = express.Router();

/*
=================================================
WORKER CHECK-IN
=================================================
*/

router.post(
    '/check-in',
    authenticateToken,
    requireRoles('FIELD_WORKER'),
    async (req, res) => {
        try {

            /*
            Get logged-in worker
            */
            const workerResult = await pool.query(
                `
                SELECT
                    u.worker_id,
                    u.mine_id,
                    w.employee_code,
                    w.name
                FROM users u
                JOIN workers w
                    ON w.id = u.worker_id
                WHERE u.id = $1
                  AND u.role = 'FIELD_WORKER'
                  AND u.account_status = 'ACTIVE'
                  AND u.is_verified = TRUE
                `,
                [req.user.userId]
            );

            if (workerResult.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Active worker account not found.'
                });
            }

            const worker = workerResult.rows[0];

            /*
            Verify shift belongs to worker's mine
            */
            const shiftResult = await pool.query(
                `
                SELECT
                    s.id,
                    s.name,
                    s.start_time,
                    s.end_time,
                    s.mine_id
                FROM worker_shift_assignments a
                JOIN shifts s
                    ON s.id = a.shift_id
                WHERE a.worker_id = $1
                  AND a.is_active = TRUE
                  AND s.is_active = TRUE
                  AND s.mine_id = $2
                  AND a.effective_from <= CURRENT_DATE
                  AND (
                      a.effective_to IS NULL
                      OR a.effective_to >= CURRENT_DATE
                  )
                ORDER BY a.effective_from DESC
                LIMIT 1
                `,
                [worker.worker_id, worker.mine_id]
            );

            if (shiftResult.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message:
                        'No active shift is assigned to you. Please contact your Mine Manager.'
                });
            }

            const shift = shiftResult.rows[0];

            /*
            Check today's attendance
            */
            const existingAttendance = await pool.query(
                `
                SELECT
                    id,
                    check_in,
                    check_out,
                    status
                FROM attendance
                WHERE worker_id = $1
                  AND attendance_date = CURRENT_DATE
                `,
                [worker.worker_id]
            );

            if (existingAttendance.rows.length > 0) {
                return res.status(409).json({
                    status: 'error',
                    message:
                        'Attendance has already been marked for today.',
                    attendance: existingAttendance.rows[0]
                });
            }

            /*
            Determine status
            */
            const now = new Date();

            const [hours, minutes] =
                shift.start_time
                    .split(':')
                    .map(Number);

            const shiftStart = new Date(now);
            shiftStart.setHours(hours, minutes, 0, 0);

            const status =
                now > shiftStart
                    ? 'LATE'
                    : 'PRESENT';

            /*
            Create attendance
            */
            const attendanceResult = await pool.query(
                `
                INSERT INTO attendance
                (
                    worker_id,
                    shift_id,
                    mine_id,
                    attendance_date,
                    check_in,
                    status
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    CURRENT_DATE,
                    CURRENT_TIMESTAMP,
                    $4
                )
                RETURNING
                    id,
                    worker_id,
                    shift_id,
                    mine_id,
                    attendance_date,
                    check_in,
                    check_out,
                    status
                `,
                [
                    worker.worker_id,
                    shift.id,
                    worker.mine_id,
                    status
                ]
            );

            return res.status(201).json({
                status: 'success',
                message: 'Check-in successful.',
                attendance: attendanceResult.rows[0]
            });

        } catch (error) {
            console.error(
                'Worker check-in error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message: 'Failed to check in.'
            });
        }
    }
);


/*
=================================================
WORKER CHECK-OUT
=================================================
*/

router.post(
    '/check-out',
    authenticateToken,
    requireRoles('FIELD_WORKER'),
    async (req, res) => {
        try {

            const workerResult = await pool.query(
                `
                SELECT worker_id
                FROM users
                WHERE id = $1
                  AND role = 'FIELD_WORKER'
                  AND account_status = 'ACTIVE'
                  AND is_verified = TRUE
                `,
                [req.user.userId]
            );

            if (workerResult.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Active worker account not found.'
                });
            }

            const workerId =
                workerResult.rows[0].worker_id;

            /*
            Find today's attendance
            */
            const attendanceResult = await pool.query(
                `
                SELECT
                    id,
                    check_in,
                    check_out,
                    status
                FROM attendance
                WHERE worker_id = $1
                  AND attendance_date = CURRENT_DATE
                `,
                [workerId]
            );

            if (attendanceResult.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message:
                        'You have not checked in today.'
                });
            }

            const attendance =
                attendanceResult.rows[0];

            if (attendance.check_out) {
                return res.status(409).json({
                    status: 'error',
                    message:
                        'You have already checked out today.'
                });
            }

            /*
            Update checkout
            */
            const result = await pool.query(
                `
                UPDATE attendance
                SET check_out = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING
                    id,
                    worker_id,
                    shift_id,
                    mine_id,
                    attendance_date,
                    check_in,
                    check_out,
                    status
                `,
                [attendance.id]
            );

            return res.status(200).json({
                status: 'success',
                message: 'Check-out successful.',
                attendance: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Worker check-out error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message: 'Failed to check out.'
            });
        }
    }
);


/*
=================================================
GET MY ATTENDANCE
=================================================
*/

router.get(
    '/me',
    authenticateToken,
    requireRoles('FIELD_WORKER'),
    async (req, res) => {
        try {

            const result = await pool.query(
                `
                SELECT
                    a.id,
                    a.attendance_date,
                    a.check_in,
                    a.check_out,
                    a.status,
                    s.id AS shift_id,
                    s.name AS shift_name,
                    s.start_time,
                    s.end_time,
                    m.id AS mine_id,
                    m.name AS mine_name
                FROM attendance a
                JOIN users u
                    ON u.worker_id = a.worker_id
                JOIN shifts s
                    ON s.id = a.shift_id
                JOIN mines m
                    ON m.id = a.mine_id
                WHERE u.id = $1
                ORDER BY a.attendance_date DESC, a.id DESC
                `,
                [req.user.userId]
            );

            return res.status(200).json({
                status: 'success',
                attendance: result.rows
            });

        } catch (error) {
            console.error(
                'Worker attendance fetch error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to fetch attendance.'
            });
        }
    }
);


/*
=================================================
GET MINE ATTENDANCE
=================================================
*/

router.get(
    '/mine',
    authenticateToken,
    requireRoles('MINE_MANAGER', 'SAFETY_OFFICER'),
    async (req, res) => {
        try {

const mineResult = await pool.query(
    `
    SELECT mine_id
    FROM users
    WHERE id = $1
      AND role IN ('MINE_MANAGER', 'SAFETY_OFFICER')
    `,
    [req.user.userId]
);

            if (
                mineResult.rows.length === 0 ||
                !mineResult.rows[0].mine_id
            ) {
                return res.status(403).json({
                    status: 'error',
                    message:
                        'You are not assigned to a mine.'
                });
            }

            const mineId =
                mineResult.rows[0].mine_id;

            const result = await pool.query(
                `
                SELECT
                    a.id,
                    a.attendance_date,
                    a.check_in,
                    a.check_out,
                    a.status,

                    w.id AS worker_id,
                    w.name AS worker_name,
                    w.employee_code,

                    s.id AS shift_id,
                    s.name AS shift_name,

                    m.name AS mine_name

                FROM attendance a

                JOIN workers w
                    ON w.id = a.worker_id

                JOIN shifts s
                    ON s.id = a.shift_id

                JOIN mines m
                    ON m.id = a.mine_id

                WHERE a.mine_id = $1

                ORDER BY
                    a.attendance_date DESC,
                    a.id DESC
                `,
                [mineId]
            );

            return res.status(200).json({
                status: 'success',
                attendance: result.rows
            });

        } catch (error) {
            console.error(
                'Mine attendance fetch error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to fetch mine attendance.'
            });
        }
    }
);


module.exports = router;