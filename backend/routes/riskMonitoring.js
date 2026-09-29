const express = require("express");
const router = express.Router();

const pool = require("../db");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");


// ======================================================
// Helper
// ======================================================

async function getUser(userId) {

    const result = await pool.query(
        `SELECT
            id,
            name,
            role,
            mine_id,
            worker_id
         FROM users
         WHERE id = $1`,
        [userId]
    );

    return result.rows[0] || null;
}


// ======================================================
// Helper: Get latest risk assessment per worker
// ======================================================

async function getLatestRisk(workerId) {

    const result = await pool.query(
        `SELECT *
         FROM worker_risk_assessments
         WHERE worker_id = $1
         ORDER BY calculated_at DESC, id DESC
         LIMIT 1`,
        [workerId]
    );

    return result.rows[0] || null;
}


// ======================================================
// 1. GENERATE RISK ALERT
// ======================================================

router.post(
    "/generate-alert/:workerId",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const workerId =
            Number(req.params.workerId);

        if (!Number.isInteger(workerId)) {
            return res.status(400).json({
                message: "Invalid workerId"
            });
        }

        try {

            const user =
                await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const workerResult =
                await pool.query(
                    `SELECT
                        id,
                        name,
                        employee_code,
                        mine_id
                     FROM workers
                     WHERE id = $1`,
                    [workerId]
                );

            if (
                workerResult.rows.length === 0
            ) {
                return res.status(404).json({
                    message:
                        "Worker not found"
                });
            }

            const worker =
                workerResult.rows[0];

            if (
                user.role !== "PLATFORM_ADMIN" &&
                worker.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message:
                        "Access denied"
                });
            }

            const assessment =
                await getLatestRisk(workerId);

            if (!assessment) {
                return res.status(404).json({
                    message:
                        "No risk assessment exists for this worker"
                });
            }

            if (
                ![
                    "HIGH",
                    "CRITICAL"
                ].includes(
                    assessment.risk_level
                )
            ) {
                return res.json({
                    message:
                        "No risk alert required",
                    riskLevel:
                        assessment.risk_level,
                    riskScore:
                        assessment.risk_score,
                    alertCreated: false
                });
            }

            const factors =
                Array.isArray(
                    assessment.contributing_factors
                )
                    ? assessment.contributing_factors
                    : [];

            const importantFactors =
                factors
                    .slice(0, 3)
                    .map(
                        factor =>
                            factor.message
                    )
                    .join("; ");

            const title =
                assessment.risk_level === "CRITICAL"
                    ? "Critical worker safety risk"
                    : "High worker safety risk";

            const message =
                importantFactors ||
                `Worker risk score is ${assessment.risk_score}`;

            // --------------------------------------------------
            // Avoid duplicate open alert for same assessment
            // --------------------------------------------------

            const existing =
                await pool.query(
                    `SELECT id
                     FROM risk_alerts
                     WHERE worker_id = $1
                       AND risk_assessment_id = $2
                       AND status IN (
                           'OPEN',
                           'ACKNOWLEDGED'
                       )
                     LIMIT 1`,
                    [
                        workerId,
                        assessment.id
                    ]
                );

            if (existing.rows.length > 0) {

                return res.status(200).json({
                    message:
                        "Risk alert already exists",
                    alertCreated: false,
                    alertId:
                        existing.rows[0].id
                });
            }

            const result =
                await pool.query(
                    `INSERT INTO risk_alerts
                    (
                        worker_id,
                        mine_id,
                        risk_assessment_id,
                        risk_score,
                        risk_level,
                        title,
                        message
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
                    RETURNING *`,
                    [
                        workerId,
                        worker.mine_id,
                        assessment.id,
                        assessment.risk_score,
                        assessment.risk_level,
                        title,
                        message
                    ]
                );

            res.status(201).json({
                message:
                    "Risk alert created successfully",
                alert:
                    result.rows[0]
            });

        } catch (error) {

            console.error(
                "Generate risk alert error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to generate risk alert"
            });
        }
    }
);


// ======================================================
// 2. GET ACTIVE RISK ALERTS
// ======================================================

router.get(
    "/alerts",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        try {

            const user =
                await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message:
                        "User not found"
                });
            }

            let result;

            const baseQuery = `
                SELECT
                    ra.*,

                    w.name AS worker_name,
                    w.employee_code

                FROM risk_alerts ra

                JOIN workers w
                    ON ra.worker_id = w.id

                WHERE ra.status IN (
                    'OPEN',
                    'ACKNOWLEDGED'
                )
            `;

            if (
                user.role ===
                "PLATFORM_ADMIN"
            ) {

                result =
                    await pool.query(
                        `${baseQuery}
                         ORDER BY
                            CASE
                                WHEN ra.risk_level = 'CRITICAL'
                                    THEN 1
                                ELSE 2
                            END,
                            ra.created_at DESC`
                    );

            } else {

                if (!user.mine_id) {
                    return res.status(403).json({
                        message:
                            "User is not assigned to a mine"
                    });
                }

                result =
                    await pool.query(
                        `${baseQuery}
                         AND ra.mine_id = $1

                         ORDER BY
                            CASE
                                WHEN ra.risk_level = 'CRITICAL'
                                    THEN 1
                                ELSE 2
                            END,
                            ra.created_at DESC`,
                        [user.mine_id]
                    );
            }

            const summary = {
                total: result.rows.length,
                critical: 0,
                high: 0
            };

            for (
                const alert of result.rows
            ) {

                if (
                    alert.risk_level ===
                    "CRITICAL"
                ) {
                    summary.critical++;
                }

                if (
                    alert.risk_level ===
                    "HIGH"
                ) {
                    summary.high++;
                }
            }

            res.json({
                summary,
                alerts: result.rows
            });

        } catch (error) {

            console.error(
                "Get risk alerts error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch risk alerts"
            });
        }
    }
);


// ======================================================
// 3. GET MINE RISK SUMMARY
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

            const user =
                await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message:
                        "User not found"
                });
            }

            let result;

            const baseQuery = `
                SELECT
                    COUNT(*)::INTEGER
                        AS total_workers,

                    COUNT(*) FILTER (
                        WHERE latest.risk_level = 'LOW'
                    )::INTEGER AS low,

                    COUNT(*) FILTER (
                        WHERE latest.risk_level = 'MEDIUM'
                    )::INTEGER AS medium,

                    COUNT(*) FILTER (
                        WHERE latest.risk_level = 'HIGH'
                    )::INTEGER AS high,

                    COUNT(*) FILTER (
                        WHERE latest.risk_level = 'CRITICAL'
                    )::INTEGER AS critical,

                    ROUND(
                        AVG(
                            latest.risk_score
                        )
                    )::INTEGER
                        AS average_risk_score

                FROM workers w

                LEFT JOIN LATERAL (
                    SELECT
                        risk_score,
                        risk_level

                    FROM worker_risk_assessments wra

                    WHERE wra.worker_id = w.id

                    ORDER BY
                        calculated_at DESC,
                        id DESC

                    LIMIT 1
                ) latest
                    ON TRUE
            `;

            if (
                user.role ===
                "PLATFORM_ADMIN"
            ) {

                result =
                    await pool.query(
                        baseQuery
                    );

            } else {

                if (!user.mine_id) {
                    return res.status(403).json({
                        message:
                            "User is not assigned to a mine"
                    });
                }

                result =
                    await pool.query(
                        `${baseQuery}
                         WHERE w.mine_id = $1`,
                        [user.mine_id]
                    );
            }

            res.json({
                summary:
                    result.rows[0]
            });

        } catch (error) {

            console.error(
                "Risk summary error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch risk summary"
            });
        }
    }
);


// ======================================================
// 4. ACKNOWLEDGE RISK ALERT
// ======================================================

router.patch(
    "/alerts/:id/acknowledge",
    auth,
    authorize(
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const alertId =
            Number(req.params.id);

        if (!Number.isInteger(alertId)) {
            return res.status(400).json({
                message:
                    "Invalid alert id"
            });
        }

        try {

            const user =
                await getUser(req.user.userId);

            if (
                !user ||
                !user.mine_id
            ) {
                return res.status(403).json({
                    message:
                        "User is not assigned to a mine"
                });
            }

            const alertResult =
                await pool.query(
                    `SELECT *
                     FROM risk_alerts
                     WHERE id = $1`,
                    [alertId]
                );

            if (
                alertResult.rows.length === 0
            ) {
                return res.status(404).json({
                    message:
                        "Risk alert not found"
                });
            }

            const alert =
                alertResult.rows[0];

            if (
                alert.mine_id !==
                user.mine_id
            ) {
                return res.status(403).json({
                    message:
                        "Access denied"
                });
            }

            if (
                alert.status !== "OPEN"
            ) {
                return res.status(400).json({
                    message:
                        `Alert cannot be acknowledged from status ${alert.status}`
                });
            }

            const result =
                await pool.query(
                    `UPDATE risk_alerts
                     SET
                        status = 'ACKNOWLEDGED',
                        acknowledged_by = $1,
                        acknowledged_at =
                            CURRENT_TIMESTAMP,
                        updated_at =
                            CURRENT_TIMESTAMP
                     WHERE id = $2
                     RETURNING *`,
                    [
                        user.id,
                        alertId
                    ]
                );

            res.json({
                message:
                    "Risk alert acknowledged",
                alert:
                    result.rows[0]
            });

        } catch (error) {

            console.error(
                "Acknowledge risk alert error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to acknowledge risk alert"
            });
        }
    }
);


// ======================================================
// 5. RESOLVE RISK ALERT
// ======================================================

router.patch(
    "/alerts/:id/resolve",
    auth,
    authorize(
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const alertId =
            Number(req.params.id);

        if (!Number.isInteger(alertId)) {
            return res.status(400).json({
                message:
                    "Invalid alert id"
            });
        }

        try {

            const user =
                await getUser(req.user.userId);

            if (
                !user ||
                !user.mine_id
            ) {
                return res.status(403).json({
                    message:
                        "User is not assigned to a mine"
                });
            }

            const alertResult =
                await pool.query(
                    `SELECT *
                     FROM risk_alerts
                     WHERE id = $1`,
                    [alertId]
                );

            if (
                alertResult.rows.length === 0
            ) {
                return res.status(404).json({
                    message:
                        "Risk alert not found"
                });
            }

            const alert =
                alertResult.rows[0];

            if (
                alert.mine_id !==
                user.mine_id
            ) {
                return res.status(403).json({
                    message:
                        "Access denied"
                });
            }

            if (
                ![
                    "OPEN",
                    "ACKNOWLEDGED"
                ].includes(
                    alert.status
                )
            ) {
                return res.status(400).json({
                    message:
                        `Alert cannot be resolved from status ${alert.status}`
                });
            }

            const result =
                await pool.query(
                    `UPDATE risk_alerts
                     SET
                        status = 'RESOLVED',
                        resolved_by = $1,
                        resolved_at =
                            CURRENT_TIMESTAMP,
                        updated_at =
                            CURRENT_TIMESTAMP
                     WHERE id = $2
                     RETURNING *`,
                    [
                        user.id,
                        alertId
                    ]
                );

            res.json({
                message:
                    "Risk alert resolved",
                alert:
                    result.rows[0]
            });

        } catch (error) {

            console.error(
                "Resolve risk alert error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to resolve risk alert"
            });
        }
    }
);


module.exports = router;