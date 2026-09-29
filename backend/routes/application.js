const express = require('express');
const router = express.Router();

const pool = require('../db');
const authenticateToken = require('../middleware/auth');

router.get('/status', authenticateToken, async (req, res) => {
    try {
        // Only Field Workers
        if (req.user.role !== 'FIELD_WORKER') {
            return res.status(403).json({
                success: false,
                message: 'Only field workers can view application status.'
            });
        }

        // Worker must have a linked worker record
        if (!req.user.workerId) {
            return res.status(404).json({
                success: false,
                message: 'Worker profile not linked to this account.'
            });
        }

        const result = await pool.query(
            `
            SELECT
                rr.id,
                rr.name,
                rr.email,
                rr.phone,
                rr.employee_id,
                rr.department,
                rr.designation,
                rr.status,
                rr.rejection_reason,
                rr.submitted_at,
                rr.reviewed_at,
                rr.mine_id,
                m.name AS mine_name
            FROM registration_requests rr
            INNER JOIN workers w
                ON w.employee_code = rr.employee_id
            LEFT JOIN mines m
                ON m.id = rr.mine_id
            WHERE w.id = $1
            ORDER BY rr.submitted_at DESC
            LIMIT 1
            `,
            [req.user.workerId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No registration application found for this worker.'
            });
        }

        return res.status(200).json({
            success: true,
            application: result.rows[0]
        });

    } catch (error) {
        console.error('Application status error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch application status.'
        });
    }
});

module.exports = router;