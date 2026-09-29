const express = require("express");
const router = express.Router();

const pool = require("../db");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");


async function getUser(userId) {

    const result = await pool.query(
        `SELECT
            id,
            name,
            role,
            mine_id
         FROM users
         WHERE id = $1`,
        [userId]
    );

    return result.rows[0] || null;
}


// ======================================================
// GET EMERGENCY SUMMARY
// ======================================================

router.get(
    "/summary",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        try {

            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            let query;
            let params = [];

            if (user.role === "PLATFORM_ADMIN") {

                query = `
                    SELECT
                        COUNT(*)::INTEGER
                            AS total_emergencies,

                        COUNT(*) FILTER (
                            WHERE status = 'ACTIVE'
                        )::INTEGER
                            AS active,

                        COUNT(*) FILTER (
                            WHERE status = 'ACKNOWLEDGED'
                        )::INTEGER
                            AS acknowledged,

                        COUNT(*) FILTER (
                            WHERE status = 'RESPONDING'
                        )::INTEGER
                            AS responding,

                        COUNT(*) FILTER (
                            WHERE status = 'RESOLVED'
                        )::INTEGER
                            AS resolved,

                        COUNT(*) FILTER (
                            WHERE status = 'CANCELLED'
                        )::INTEGER
                            AS cancelled,

                        ROUND(
                            AVG(response_time_seconds)
                            FILTER (
                                WHERE response_time_seconds IS NOT NULL
                            )
                        )::INTEGER
                            AS avg_response_time_seconds,

                        ROUND(
                            AVG(resolution_time_seconds)
                            FILTER (
                                WHERE resolution_time_seconds IS NOT NULL
                            )
                        )::INTEGER
                            AS avg_resolution_time_seconds

                    FROM emergency_alerts
                `;

            } else {

                if (!user.mine_id) {
                    return res.status(403).json({
                        message:
                            "User is not assigned to a mine"
                    });
                }

                query = `
                    SELECT
                        COUNT(*)::INTEGER
                            AS total_emergencies,

                        COUNT(*) FILTER (
                            WHERE status = 'ACTIVE'
                        )::INTEGER
                            AS active,

                        COUNT(*) FILTER (
                            WHERE status = 'ACKNOWLEDGED'
                        )::INTEGER
                            AS acknowledged,

                        COUNT(*) FILTER (
                            WHERE status = 'RESPONDING'
                        )::INTEGER
                            AS responding,

                        COUNT(*) FILTER (
                            WHERE status = 'RESOLVED'
                        )::INTEGER
                            AS resolved,

                        COUNT(*) FILTER (
                            WHERE status = 'CANCELLED'
                        )::INTEGER
                            AS cancelled,

                        ROUND(
                            AVG(response_time_seconds)
                            FILTER (
                                WHERE response_time_seconds IS NOT NULL
                            )
                        )::INTEGER
                            AS avg_response_time_seconds,

                        ROUND(
                            AVG(resolution_time_seconds)
                            FILTER (
                                WHERE resolution_time_seconds IS NOT NULL
                            )
                        )::INTEGER
                            AS avg_resolution_time_seconds

                    FROM emergency_alerts

                    WHERE mine_id = $1
                `;

                params = [user.mine_id];
            }

            const result = await pool.query(
                query,
                params
            );

            res.json({
                summary: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Emergency summary error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch emergency summary"
            });
        }
    }
);


// ======================================================
// GET ACTIVE EMERGENCIES
// ======================================================

router.get(
    "/active",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        try {

            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            let result;

            const baseQuery = `
                SELECT
                    ea.id,

                    ea.mine_id,

                    ea.worker_id,

                    ea.emergency_type,

                    ea.severity,

                    ea.description,

                    ea.location,

                    ea.latitude,

                    ea.longitude,

                    ea.status,

                    ea.created_at,

                    ea.acknowledged_at,

                    ea.responding_at,

                    w.name AS worker_name,

                    w.employee_code,

                    m.name AS mine_name

                FROM emergency_alerts ea

                JOIN workers w
                    ON ea.worker_id = w.id

                JOIN mines m
                    ON ea.mine_id = m.id

                WHERE ea.status IN (
                    'ACTIVE',
                    'ACKNOWLEDGED',
                    'RESPONDING'
                )
            `;

            if (
                user.role === "PLATFORM_ADMIN"
            ) {

                result = await pool.query(
                    `${baseQuery}
                     ORDER BY
                        CASE
                            WHEN ea.status = 'ACTIVE'
                                THEN 1
                            WHEN ea.status = 'ACKNOWLEDGED'
                                THEN 2
                            ELSE 3
                        END,
                        ea.created_at ASC`
                );

            } else {

                if (!user.mine_id) {
                    return res.status(403).json({
                        message:
                            "User is not assigned to a mine"
                    });
                }

                result = await pool.query(
                    `${baseQuery}
                     AND ea.mine_id = $1

                     ORDER BY
                        CASE
                            WHEN ea.status = 'ACTIVE'
                                THEN 1
                            WHEN ea.status = 'ACKNOWLEDGED'
                                THEN 2
                            ELSE 3
                        END,
                        ea.created_at ASC`,
                    [user.mine_id]
                );
            }

            res.json({
                count: result.rows.length,
                emergencies: result.rows
            });

        } catch (error) {

            console.error(
                "Active emergency error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch active emergencies"
            });
        }
    }
);


module.exports = router;