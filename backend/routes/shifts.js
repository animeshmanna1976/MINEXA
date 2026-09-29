const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');

const router = express.Router();

/*
=================================================
GET SHIFTS FOR MY MINE
=================================================
Manager and Safety Officer can view shifts
belonging to their assigned mine.
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
                    message: 'You are not assigned to a mine.'
                });
            }

            const mineId = mineResult.rows[0].mine_id;

            const result = await pool.query(
                `
                SELECT
                    id,
                    name,
                    start_time,
                    end_time,
                    mine_id,
                    is_active,
                    created_at
                FROM shifts
                WHERE mine_id = $1
                ORDER BY start_time
                `,
                [mineId]
            );

            return res.status(200).json({
                status: 'success',
                shifts: result.rows
            });
        } catch (error) {
            console.error('Fetch mine shifts error:', error);

            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch mine shifts.'
            });
        }
    }
);


/*
=================================================
CREATE SHIFT
=================================================
Only Mine Managers can create a shift.

The mine_id is taken from the authenticated
manager account, not from the request body.
*/

router.post(
    '/',
    authenticateToken,
    requireRoles('MINE_MANAGER'),
    async (req, res) => {
        try {
            const name = String(req.body.name || '').trim();
            const startTime = String(
                req.body.startTime || ''
            ).trim();
            const endTime = String(
                req.body.endTime || ''
            ).trim();

            if (!name) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Shift name is required.'
                });
            }

            if (!startTime || !endTime) {
                return res.status(400).json({
                    status: 'error',
                    message:
                        'Start time and end time are required.'
                });
            }

            const managerResult = await pool.query(
                `
                SELECT mine_id
                FROM users
                WHERE id = $1
                  AND role = 'MINE_MANAGER'
                  AND account_status = 'ACTIVE'
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

            const mineId = managerResult.rows[0].mine_id;

            const result = await pool.query(
                `
                INSERT INTO shifts
                (
                    name,
                    start_time,
                    end_time,
                    mine_id,
                    is_active
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    TRUE
                )
                RETURNING
                    id,
                    name,
                    start_time,
                    end_time,
                    mine_id,
                    is_active,
                    created_at
                `,
                [
                    name,
                    startTime,
                    endTime,
                    mineId
                ]
            );

            return res.status(201).json({
                status: 'success',
                message: 'Shift created successfully.',
                shift: result.rows[0]
            });
        } catch (error) {
            console.error('Create shift error:', error);

            return res.status(500).json({
                status: 'error',
                message: 'Failed to create shift.'
            });
        }
    }
);


/*
=================================================
ASSIGN SHIFT TO WORKER
=================================================
Only Mine Managers can assign shifts.

A worker can only have one active assignment.
Existing active assignment is closed first.
*/

router.post(
    '/assign',
    authenticateToken,
    requireRoles('MINE_MANAGER'),
    async (req, res) => {
        const client = await pool.connect();
        let transactionCommitted = false;

        try {
            const workerId = Number(req.body.workerId);
            const shiftId = Number(req.body.shiftId);
            const effectiveFrom =
                String(
                    req.body.effectiveFrom || ''
                ).trim() || null;

            if (
                !Number.isInteger(workerId) ||
                workerId <= 0
            ) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Valid worker ID is required.'
                });
            }

            if (
                !Number.isInteger(shiftId) ||
                shiftId <= 0
            ) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Valid shift ID is required.'
                });
            }

            await client.query('BEGIN');

            /*
            Get Manager mine
            */
            const managerResult = await client.query(
                `
                SELECT mine_id
                FROM users
                WHERE id = $1
                  AND role = 'MINE_MANAGER'
                  AND account_status = 'ACTIVE'
                `,
                [req.user.userId]
            );

            if (
                managerResult.rows.length === 0 ||
                !managerResult.rows[0].mine_id
            ) {
                await client.query('ROLLBACK');

                return res.status(403).json({
                    status: 'error',
                    message:
                        'Manager is not assigned to an active mine.'
                });
            }

            const mineId =
                managerResult.rows[0].mine_id;

            /*
            Verify worker belongs to manager's mine
            */
            const workerResult = await client.query(
                `
                SELECT
                    id,
                    name,
                    employee_code,
                    mine_id
                FROM workers
                WHERE id = $1
                  AND mine_id = $2
                `,
                [workerId, mineId]
            );

            if (workerResult.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    status: 'error',
                    message:
                        'Worker not found in your mine.'
                });
            }

            /*
            Verify shift belongs to manager's mine
            */
            const shiftResult = await client.query(
                `
                SELECT
                    id,
                    name,
                    start_time,
                    end_time,
                    mine_id
                FROM shifts
                WHERE id = $1
                  AND mine_id = $2
                  AND is_active = TRUE
                `,
                [shiftId, mineId]
            );

            if (shiftResult.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    status: 'error',
                    message:
                        'Shift not found or does not belong to your mine.'
                });
            }

            const assignmentDate =
                effectiveFrom || null;

            /*
            Close existing active assignment
            */
            if (assignmentDate) {
                await client.query(
                    `
                    UPDATE worker_shift_assignments
                    SET
                        is_active = FALSE,
                        effective_to =
                            ($1::date - INTERVAL '1 day')::date
                    WHERE worker_id = $2
                      AND is_active = TRUE
                    `,
                    [
                        assignmentDate,
                        workerId
                    ]
                );
            } else {
                await client.query(
                    `
                    UPDATE worker_shift_assignments
                    SET
                        is_active = FALSE,
                        effective_to = CURRENT_DATE-1
                    WHERE worker_id = $1
                      AND is_active = TRUE
                    `,
                    [workerId]
                );
            }

            /*
            Create new assignment
            */
            const assignmentResult =
                await client.query(
                    `
                    INSERT INTO worker_shift_assignments
                    (
                        worker_id,
                        shift_id,
                        effective_from,
                        is_active
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        COALESCE($3::date, CURRENT_DATE),
                        TRUE
                    )
                    RETURNING
                        id,
                        worker_id,
                        shift_id,
                        effective_from,
                        effective_to,
                        is_active,
                        created_at
                    `,
                    [
                        workerId,
                        shiftId,
                        assignmentDate
                    ]
                );

            await client.query('COMMIT');
            transactionCommitted = true;

            return res.status(201).json({
                status: 'success',
                message:
                    'Worker shift assigned successfully.',
                assignment:
                    assignmentResult.rows[0],
                worker: workerResult.rows[0],
                shift: shiftResult.rows[0]
            });
        } catch (error) {
            if (!transactionCommitted) {
                await client.query('ROLLBACK');
            }

            console.error(
                'Assign worker shift error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to assign worker shift.'
            });
        } finally {
            client.release();
        }
    }
);


/*
=================================================
GET WORKER SHIFT ASSIGNMENT
=================================================
Manager and Safety Officer can view a worker's
current assignment in their mine.
*/

router.get(
    '/worker/:workerId',
    authenticateToken,
    requireRoles('MINE_MANAGER', 'SAFETY_OFFICER'),
    async (req, res) => {
        try {
            const workerId =
                Number(req.params.workerId);

            if (
                !Number.isInteger(workerId) ||
                workerId <= 0
            ) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid worker ID.'
                });
            }

            const mineResult = await pool.query(
                `
                SELECT mine_id
                FROM users
                WHERE id = $1
                  AND role IN (
                      'MINE_MANAGER',
                      'SAFETY_OFFICER'
                  )
                  AND account_status = 'ACTIVE'
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
                        'You are not assigned to an active mine.'
                });
            }

            const mineId =
                mineResult.rows[0].mine_id;

            const result = await pool.query(
                `
                SELECT
                    a.id,
                    a.worker_id,
                    w.name AS worker_name,
                    w.employee_code,
                    a.shift_id,
                    s.name AS shift_name,
                    s.start_time,
                    s.end_time,
                    a.effective_from,
                    a.effective_to,
                    a.is_active,
                    a.created_at
                FROM worker_shift_assignments a

                JOIN workers w
                    ON w.id = a.worker_id

                JOIN shifts s
                    ON s.id = a.shift_id

                WHERE a.worker_id = $1
                  AND w.mine_id = $2

                ORDER BY
                    a.effective_from DESC,
                    a.id DESC
                `,
                [workerId, mineId]
            );

            return res.status(200).json({
                status: 'success',
                assignments: result.rows
            });
        } catch (error) {
            console.error(
                'Get worker shift assignment error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to fetch worker shift assignment.'
            });
        }
    }
);


/*
=================================================
DEACTIVATE SHIFT
=================================================
Only Mine Managers can deactivate a shift.

A shift with existing assignments should normally
be reassigned before deactivation.
*/

router.patch(
    '/:shiftId/deactivate',
    authenticateToken,
    requireRoles('MINE_MANAGER'),
    async (req, res) => {
        try {
            const shiftId =
                Number(req.params.shiftId);

            if (
                !Number.isInteger(shiftId) ||
                shiftId <= 0
            ) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid shift ID.'
                });
            }

            const result = await pool.query(
                `
                UPDATE shifts s
                SET is_active = FALSE
                FROM users u
                WHERE s.id = $1
                  AND u.id = $2
                  AND u.role = 'MINE_MANAGER'
                  AND u.mine_id = s.mine_id
                  AND s.is_active = TRUE
                RETURNING
                    s.id,
                    s.name,
                    s.start_time,
                    s.end_time,
                    s.mine_id,
                    s.is_active
                `,
                [
                    shiftId,
                    req.user.userId
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message:
                        'Shift not found or does not belong to your mine.'
                });
            }

            return res.status(200).json({
                status: 'success',
                message: 'Shift deactivated successfully.',
                shift: result.rows[0]
            });
        } catch (error) {
            console.error(
                'Deactivate shift error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to deactivate shift.'
            });
        }
    }
);

module.exports = router;