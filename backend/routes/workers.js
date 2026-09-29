const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');

const router = express.Router();


router.get(
    '/mine',
    authenticateToken,
    requireRoles('MINE_MANAGER', 'SAFETY_OFFICER'),
    async (req, res) => {
        try {
            const userResult = await pool.query(
                `
                SELECT mine_id
                FROM users
                WHERE id = $1
                  AND role IN ('MINE_MANAGER', 'SAFETY_OFFICER')
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

            const result = await pool.query(
    `
    SELECT
        w.id,
        w.name,
        w.employee_code,
        w.phone,
        w.mine_id,
        m.name AS mine_name,

        r.department,
        r.designation

    FROM workers w

    LEFT JOIN mines m
        ON m.id = w.mine_id

    LEFT JOIN registration_requests r
        ON r.employee_id = w.employee_code
       AND r.mine_id = w.mine_id
       AND r.requested_role = 'FIELD_WORKER'
       AND r.status = 'APPROVED'

    WHERE w.mine_id = $1

    ORDER BY w.id ASC
    `,
    [mineId]
);

            return res.status(200).json({
                status: 'success',
                workers: result.rows
            });

        } catch (error) {
            console.error('Mine workers fetch error:', error);

            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch mine workers.'
            });
        }
    }
);
router.get(
    '/all',
    authenticateToken,
    requireRoles('PLATFORM_ADMIN'),
    async (req, res) => {
        try {
            const result = await pool.query(
                `
                SELECT
                    w.id,
                    w.name,
                    w.employee_code,
                    w.phone,
                    w.mine_id,

                    m.name AS mine_name,
                    m.mine_code,

                    u.role,
                    u.account_status,
                    u.is_verified,

                    r.department,
                    r.designation

                FROM workers w

                LEFT JOIN mines m
                    ON m.id = w.mine_id

                LEFT JOIN users u
                    ON u.worker_id = w.id

                LEFT JOIN LATERAL (
                    SELECT
                        rr.department,
                        rr.designation
                    FROM registration_requests rr
                    WHERE rr.employee_id = w.employee_code
                      AND rr.mine_id = w.mine_id
                      AND rr.requested_role = 'FIELD_WORKER'
                      AND rr.status = 'APPROVED'
                    ORDER BY rr.id DESC
                    LIMIT 1
                ) r ON TRUE

                ORDER BY w.id ASC
                `
            );

            return res.status(200).json({
                status: 'success',
                workers: result.rows
            });

        } catch (error) {
            console.error(
                'Admin workers fetch error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch all workers.'
            });
        }
    }
);
router.get(
    '/me',
    authenticateToken,
    requireRoles('FIELD_WORKER'),
    async (req, res) => {
        try {
            const result = await pool.query(
                `
                SELECT
    u.id,
    u.name,
    u.email,
    u.login_id,
    u.role,
    u.worker_id,
    u.mine_id,
    u.account_status,
    u.is_verified,
    w.employee_code,
    w.phone AS worker_phone,
    m.name AS mine_name,
    m.mine_code,
    m.location
FROM users u
LEFT JOIN workers w
    ON w.id = u.worker_id
LEFT JOIN mines m
    ON m.id = u.mine_id
WHERE u.id = $1
                `,
                [req.user.userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Worker profile not found.'
                });
            }

            const worker = result.rows[0];

            return res.status(200).json({
                status: 'success',
                worker: {
                    id: worker.id,
                    name: worker.name,
                    loginId: worker.login_id,
                    email: worker.email,
                    phone: worker.worker_phone,
                    employeeCode: worker.employee_code,
                    role: worker.role,
                    accountStatus: worker.account_status,
                    isVerified: worker.is_verified,
                    mine: {
                        id: worker.mine_id,
                        name: worker.mine_name,
                        code: worker.mine_code,
                        location: worker.location
                    }
                }
            });
        } catch (error) {
            console.error('Worker profile error:', error);

            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch worker profile.'
            });
        }
    }
);
router.put(
    '/me',
    authenticateToken,
    requireRoles('FIELD_WORKER'),
    async (req, res) => {
        try {
            const name = String(req.body.name || '').trim();
            const phone = String(req.body.phone || '').trim();

            if (!name) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Name is required.'
                });
            }

            if (!phone) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Phone number is required.'
                });
            }

            const result = await pool.query(
                `
                UPDATE workers w
                SET
                    name = $1,
                    phone = $2
                FROM users u
                WHERE u.id = $3
                  AND u.worker_id = w.id
                RETURNING
                    w.id,
                    w.name,
                    w.employee_code,
                    w.phone,
                    w.mine_id
                `,
                [name, phone, req.user.userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Worker profile not found.'
                });
            }

            return res.status(200).json({
                status: 'success',
                message: 'Worker profile updated successfully.',
                worker: result.rows[0]
            });
        } catch (error) {
            console.error('Worker profile update error:', error);

            return res.status(500).json({
                status: 'error',
                message: 'Failed to update worker profile.'
            });
        }
    }
);

module.exports = router;

