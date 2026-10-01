const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');

const router = express.Router();

/*
=================================================
GET MY HEALTH PROFILE
=================================================
Field Worker can view only their own health profile.
*/

router.get(
    '/me',
    authenticateToken,
    requireRoles('FIELD_WORKER'),
    async (req, res) => {
        try {
            let result = await pool.query(
                `
                SELECT
                    h.id,
                    h.worker_id,
                    h.blood_group,
                    h.medical_status,
                    h.medical_check_date,
                    h.fitness_expiry_date,
                    h.restrictions,
                    h.notes,
                    h.created_at,
                    h.updated_at
                FROM worker_health h
                JOIN users u
                    ON u.worker_id = h.worker_id
                WHERE u.id = $1
                `,
                [req.user.userId]
            );

            if (result.rows.length === 0) {
                // Find worker_id from user account
                const userWorker = await pool.query(
                    `SELECT worker_id FROM users WHERE id = $1`,
                    [req.user.userId]
                );

                if (userWorker.rows.length > 0 && userWorker.rows[0].worker_id) {
                    const workerId = userWorker.rows[0].worker_id;

                    result = await pool.query(
                        `
                        INSERT INTO worker_health
                        (
                            worker_id,
                            medical_status,
                            medical_check_date,
                            fitness_expiry_date
                        )
                        VALUES
                        (
                            $1,
                            'FIT',
                            CURRENT_DATE,
                            CURRENT_DATE + INTERVAL '6 months'
                        )
                        ON CONFLICT (worker_id) DO UPDATE
                            SET updated_at = CURRENT_TIMESTAMP
                        RETURNING
                            id,
                            worker_id,
                            blood_group,
                            medical_status,
                            medical_check_date,
                            fitness_expiry_date,
                            restrictions,
                            notes,
                            created_at,
                            updated_at
                        `,
                        [workerId]
                    );
                } else {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Active worker account not found.'
                    });
                }
            }

            return res.status(200).json({
                status: 'success',
                health: result.rows[0]
            });
        } catch (error) {
            console.error('Get worker health error:', error);

            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch health profile.'
            });
        }
    }
);


/*
=================================================
CREATE MY HEALTH PROFILE
=================================================
Field Worker can create their initial health profile.
*/

router.post(
    '/',
    authenticateToken,
    requireRoles('FIELD_WORKER'),
    async (req, res) => {
        try {
            const {
                bloodGroup,
                medicalStatus,
                medicalCheckDate,
                fitnessExpiryDate,
                restrictions,
                notes
            } = req.body;

            const status =
                String(medicalStatus || 'FIT')
                    .trim()
                    .toUpperCase();

            const allowedStatuses = [
                'FIT',
                'UNFIT',
                'FIT_WITH_RESTRICTIONS',
                'PENDING'
            ];

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid medical status.'
                });
            }

            const workerResult = await pool.query(
                `
                SELECT
                    u.worker_id
                FROM users u
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

            const workerId = workerResult.rows[0].worker_id;

            const result = await pool.query(
                `
                INSERT INTO worker_health
                (
                    worker_id,
                    blood_group,
                    medical_status,
                    medical_check_date,
                    fitness_expiry_date,
                    restrictions,
                    notes
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7
                )
                RETURNING
                    id,
                    worker_id,
                    blood_group,
                    medical_status,
                    medical_check_date,
                    fitness_expiry_date,
                    restrictions,
                    notes,
                    created_at,
                    updated_at
                `,
                [
                    workerId,
                    bloodGroup || null,
                    status,
                    medicalCheckDate || null,
                    fitnessExpiryDate || null,
                    restrictions || null,
                    notes || null
                ]
            );

            return res.status(201).json({
                status: 'success',
                message: 'Health profile created successfully.',
                health: result.rows[0]
            });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({
                    status: 'error',
                    message:
                        'A health profile already exists for this worker.'
                });
            }

            console.error('Create worker health error:', error);

            return res.status(500).json({
                status: 'error',
                message: 'Failed to create health profile.'
            });
        }
    }
);


/*
=================================================
UPDATE MY HEALTH PROFILE
=================================================
Field Worker can update basic self-managed fields.

Medical status should normally be controlled by
authorized safety personnel, so this endpoint does
not accept medicalStatus.
*/

router.put(
    '/me',
    authenticateToken,
    requireRoles('FIELD_WORKER'),
    async (req, res) => {
        try {
            const {
                bloodGroup,
                medicalCheckDate,
                fitnessExpiryDate,
                restrictions,
                notes
            } = req.body;

            const userWorker = await pool.query(
                `SELECT worker_id FROM users WHERE id = $1`,
                [req.user.userId]
            );

            if (userWorker.rows.length === 0 || !userWorker.rows[0].worker_id) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Active worker account not found.'
                });
            }

            const workerId = userWorker.rows[0].worker_id;

            const result = await pool.query(
                `
                INSERT INTO worker_health
                (
                    worker_id,
                    blood_group,
                    medical_check_date,
                    fitness_expiry_date,
                    restrictions,
                    notes,
                    medical_status
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    'FIT'
                )
                ON CONFLICT (worker_id) DO UPDATE
                SET
                    blood_group = EXCLUDED.blood_group,
                    medical_check_date = EXCLUDED.medical_check_date,
                    fitness_expiry_date = EXCLUDED.fitness_expiry_date,
                    restrictions = EXCLUDED.restrictions,
                    notes = EXCLUDED.notes,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING
                    id,
                    worker_id,
                    blood_group,
                    medical_status,
                    medical_check_date,
                    fitness_expiry_date,
                    restrictions,
                    notes,
                    created_at,
                    updated_at
                `,
                [
                    workerId,
                    bloodGroup || null,
                    medicalCheckDate || null,
                    fitnessExpiryDate || null,
                    restrictions || null,
                    notes || null
                ]
            );

            return res.status(200).json({
                status: 'success',
                message: 'Health profile updated successfully.',
                health: result.rows[0]
            });
        } catch (error) {
            console.error('Update worker health error:', error);

            return res.status(500).json({
                status: 'error',
                message: 'Failed to update health profile.'
            });
        }
    }
);


/*
=================================================
GET MINE HEALTH RECORDS
=================================================
Safety Officer and Mine Manager can view health
records for their assigned mine.
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

            const mineId = mineResult.rows[0].mine_id;

            const result = await pool.query(
                `
                SELECT
                    h.id,
                    h.worker_id,
                    w.name AS worker_name,
                    w.employee_code,
                    h.blood_group,
                    h.medical_status,
                    h.medical_check_date,
                    h.fitness_expiry_date,
                    h.restrictions,
                    h.notes,
                    h.updated_at
                FROM worker_health h
                JOIN workers w
                    ON w.id = h.worker_id
                WHERE w.mine_id = $1
                ORDER BY
                    h.fitness_expiry_date ASC NULLS LAST,
                    w.name ASC
                `,
                [mineId]
            );

            return res.status(200).json({
                status: 'success',
                health: result.rows
            });
        } catch (error) {
            console.error('Get mine health error:', error);

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to fetch mine health records.'
            });
        }
    }
);

/*
=================================================
GET MINE HEALTH SUMMARY
=================================================
Mine Manager and Safety Officer can view a
health summary for their assigned mine.
*/

router.get(
    '/mine/summary',
    authenticateToken,
    requireRoles('MINE_MANAGER', 'SAFETY_OFFICER'),
    async (req, res) => {
        try {
            /*
            Get user's assigned mine
            */
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

            const mineId = mineResult.rows[0].mine_id;

            /*
            Count workers by effective health status
            */
            const summaryResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total_workers,

                    COUNT(*) FILTER (
                        WHERE
                            CASE
                                WHEN h.fitness_expiry_date < CURRENT_DATE
                                    THEN 'EXPIRED'
                                WHEN h.medical_status = 'UNFIT'
                                    THEN 'UNFIT'
                                WHEN h.medical_status = 'FIT_WITH_RESTRICTIONS'
                                    THEN 'FIT_WITH_RESTRICTIONS'
                                WHEN h.medical_status = 'PENDING'
                                    THEN 'PENDING'
                                ELSE 'FIT'
                            END = 'FIT'
                    )::INTEGER AS fit,

                    COUNT(*) FILTER (
                        WHERE
                            CASE
                                WHEN h.fitness_expiry_date < CURRENT_DATE
                                    THEN 'EXPIRED'
                                WHEN h.medical_status = 'UNFIT'
                                    THEN 'UNFIT'
                                WHEN h.medical_status = 'FIT_WITH_RESTRICTIONS'
                                    THEN 'FIT_WITH_RESTRICTIONS'
                                WHEN h.medical_status = 'PENDING'
                                    THEN 'PENDING'
                                ELSE 'FIT'
                            END = 'FIT_WITH_RESTRICTIONS'
                    )::INTEGER AS fit_with_restrictions,

                    COUNT(*) FILTER (
                        WHERE
                            CASE
                                WHEN h.fitness_expiry_date < CURRENT_DATE
                                    THEN 'EXPIRED'
                                WHEN h.medical_status = 'UNFIT'
                                    THEN 'UNFIT'
                                WHEN h.medical_status = 'FIT_WITH_RESTRICTIONS'
                                    THEN 'FIT_WITH_RESTRICTIONS'
                                WHEN h.medical_status = 'PENDING'
                                    THEN 'PENDING'
                                ELSE 'FIT'
                            END = 'UNFIT'
                    )::INTEGER AS unfit,

                    COUNT(*) FILTER (
                        WHERE
                            CASE
                                WHEN h.fitness_expiry_date < CURRENT_DATE
                                    THEN 'EXPIRED'
                                WHEN h.medical_status = 'UNFIT'
                                    THEN 'UNFIT'
                                WHEN h.medical_status = 'FIT_WITH_RESTRICTIONS'
                                    THEN 'FIT_WITH_RESTRICTIONS'
                                WHEN h.medical_status = 'PENDING'
                                    THEN 'PENDING'
                                ELSE 'FIT'
                            END = 'PENDING'
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

            /*
            Get workers needing attention
            */
            const alertsResult = await pool.query(
                `
                SELECT
                    h.worker_id,
                    w.name AS worker_name,
                    w.employee_code,
                    h.medical_status,
                    h.fitness_expiry_date,

                    CASE
                        WHEN h.fitness_expiry_date < CURRENT_DATE
                            THEN 'EXPIRED'
                        WHEN h.medical_status = 'UNFIT'
                            THEN 'UNFIT'
                        WHEN h.medical_status = 'FIT_WITH_RESTRICTIONS'
                            THEN 'FIT_WITH_RESTRICTIONS'
                        WHEN h.medical_status = 'PENDING'
                            THEN 'PENDING'
                        ELSE 'FIT'
                    END AS effective_status

                FROM worker_health h

                JOIN workers w
                    ON w.id = h.worker_id

                WHERE w.mine_id = $1
                  AND (
                      h.fitness_expiry_date < CURRENT_DATE
                      OR h.medical_status IN (
                          'UNFIT',
                          'FIT_WITH_RESTRICTIONS',
                          'PENDING'
                      )
                  )

                ORDER BY
                    h.fitness_expiry_date ASC NULLS LAST,
                    w.name ASC
                `,
                [mineId]
            );

            return res.status(200).json({
                status: 'success',

                summary: {
                    totalWorkers:
                        summaryResult.rows[0].total_workers,

                    fit:
                        summaryResult.rows[0].fit,

                    fitWithRestrictions:
                        summaryResult.rows[0].fit_with_restrictions,

                    unfit:
                        summaryResult.rows[0].unfit,

                    pending:
                        summaryResult.rows[0].pending,

                    expired:
                        summaryResult.rows[0].expired
                },

                alerts: alertsResult.rows
            });

        } catch (error) {
            console.error(
                'Health summary error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to fetch health summary.'
            });
        }
    }
);
/*
=================================================
UPDATE WORKER MEDICAL STATUS
=================================================
Only Safety Officers can update the medical status.

This keeps the worker from declaring themselves
FIT/UNFIT.
*/

router.patch(
    '/:workerId/status',
    authenticateToken,
    requireRoles('SAFETY_OFFICER'),
    async (req, res) => {
        try {
            const workerId = Number(req.params.workerId);

            if (
                !Number.isInteger(workerId) ||
                workerId <= 0
            ) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid worker ID.'
                });
            }

            const medicalStatus =
                String(req.body.medicalStatus || '')
                    .trim()
                    .toUpperCase();

            const allowedStatuses = [
                'FIT',
                'UNFIT',
                'FIT_WITH_RESTRICTIONS',
                'PENDING'
            ];

            if (!allowedStatuses.includes(medicalStatus)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid medical status.'
                });
            }

            const officerResult = await pool.query(
                `
                SELECT mine_id
                FROM users
                WHERE id = $1
                  AND role = 'SAFETY_OFFICER'
                  AND account_status = 'ACTIVE'
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

            const mineId = officerResult.rows[0].mine_id;

            const result = await pool.query(
                `
                UPDATE worker_health h
                SET
                    medical_status = $1,
                    updated_at = CURRENT_TIMESTAMP
                FROM workers w
                WHERE h.worker_id = w.id
                  AND h.worker_id = $2
                  AND w.mine_id = $3
                RETURNING
                    h.id,
                    h.worker_id,
                    h.medical_status,
                    h.medical_check_date,
                    h.fitness_expiry_date,
                    h.updated_at
                `,
                [
                    medicalStatus,
                    workerId,
                    mineId
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message:
                        'Worker health profile not found in your mine.'
                });
            }

            return res.status(200).json({
                status: 'success',
                message:
                    'Worker medical status updated successfully.',
                health: result.rows[0]
            });
        } catch (error) {
            console.error(
                'Update medical status error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to update medical status.'
            });
        }
    }
);

module.exports = router;