const express = require("express");
const router = express.Router();

const pool = require("../db");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");


// ======================================================
// Helper: Get logged-in user
// ======================================================

async function getUser(userId) {

    const result = await pool.query(
        `SELECT
            id,
            name,
            mine_id,
            worker_id,
            role
         FROM users
         WHERE id = $1`,
        [userId]
    );

    return result.rows[0] || null;
}


// ======================================================
// 1. WORKER PPE COMPLIANCE
// ======================================================

router.get(
    "/compliance/:workerId",
    auth,
    async (req, res) => {

        const workerId = Number(req.params.workerId);

        if (!Number.isInteger(workerId)) {
            return res.status(400).json({
                message: "Invalid workerId"
            });
        }

        try {

            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            // --------------------------------------------------
            // Worker access
            // --------------------------------------------------

            if (
                user.role === "FIELD_WORKER" &&
                user.worker_id !== workerId
            ) {
                return res.status(403).json({
                    message:
                        "You can only view your own PPE compliance"
                });
            }

            // --------------------------------------------------
            // Get worker
            // --------------------------------------------------

            const workerResult = await pool.query(
                `SELECT
                    id,
                    name,
                    employee_code,
                    mine_id
                 FROM workers
                 WHERE id = $1`,
                [workerId]
            );

            if (workerResult.rows.length === 0) {
                return res.status(404).json({
                    message: "Worker not found"
                });
            }

            const worker = workerResult.rows[0];

            // --------------------------------------------------
            // Mine isolation
            // --------------------------------------------------

            if (
                user.role !== "PLATFORM_ADMIN" &&
                worker.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            // --------------------------------------------------
            // Mandatory PPE types
            // --------------------------------------------------

            const result = await pool.query(
                `
                SELECT
                    pt.id AS ppe_type_id,
                    pt.name AS ppe_type_name,
                    pt.category,
                    pt.is_mandatory,
                    pt.replacement_period_days,

                    a.assignment_id,
                    a.ppe_inventory_id,
                    a.item_code,
                    a.assignment_status,
                    a.ppe_status,
                    a.condition,
                    a.expiry_date,
                    a.expected_replacement_date,

                    CASE
                        WHEN a.assignment_id IS NULL
                            THEN 'MISSING'

                        WHEN a.ppe_status IN (
                            'EXPIRED',
                            'DAMAGED',
                            'DISPOSED'
                        )
                            THEN 'INVALID'

                        WHEN a.expiry_date IS NOT NULL
                             AND a.expiry_date < CURRENT_DATE
                            THEN 'EXPIRED'

                        WHEN a.expected_replacement_date IS NOT NULL
                             AND a.expected_replacement_date
                                 < CURRENT_DATE
                            THEN 'REPLACEMENT_DUE'

                        WHEN a.expected_replacement_date IS NOT NULL
                             AND a.expected_replacement_date
                                 <= CURRENT_DATE + 7
                            THEN 'REPLACEMENT_SOON'

                        ELSE 'COMPLIANT'
                    END AS compliance_status

                FROM ppe_types pt

                LEFT JOIN LATERAL (
                    SELECT
                        wpa.id AS assignment_id,
                        pi.id AS ppe_inventory_id,
                        pi.item_code,
                        wpa.status AS assignment_status,
                        pi.status AS ppe_status,
                        pi.condition,
                        pi.expiry_date,
                        wpa.expected_replacement_date

                    FROM worker_ppe_assignments wpa

                    JOIN ppe_inventory pi
                        ON wpa.ppe_inventory_id = pi.id

                    WHERE wpa.worker_id = $1
                      AND wpa.status = 'ACTIVE'
                      AND pi.ppe_type_id = pt.id

                    ORDER BY wpa.issue_date DESC, wpa.id DESC

                    LIMIT 1
                ) a ON TRUE

                WHERE pt.mine_id = $2
                  AND pt.is_active = TRUE
                  AND pt.is_mandatory = TRUE

                ORDER BY
                    pt.category,
                    pt.name
                `,
                [
                    workerId,
                    worker.mine_id
                ]
            );

            // --------------------------------------------------
            // Calculate compliance
            // --------------------------------------------------

            const totalRequired = result.rows.length;

            const compliant = result.rows.filter(
                item =>
                    item.compliance_status === "COMPLIANT"
            ).length;

            const missing = result.rows.filter(
                item =>
                    item.compliance_status === "MISSING"
            ).length;

            const invalid = result.rows.filter(
                item =>
                    item.compliance_status === "INVALID"
            ).length;

            const expired = result.rows.filter(
                item =>
                    item.compliance_status === "EXPIRED"
            ).length;

            const replacementDue = result.rows.filter(
                item =>
                    item.compliance_status ===
                    "REPLACEMENT_DUE"
            ).length;

            const replacementSoon = result.rows.filter(
                item =>
                    item.compliance_status ===
                    "REPLACEMENT_SOON"
            ).length;

            const compliancePercentage =
                totalRequired === 0
                    ? 100
                    : Math.round(
                        (compliant / totalRequired) * 100
                    );

            let overallStatus = "COMPLIANT";

            if (
                missing > 0 ||
                invalid > 0 ||
                expired > 0
            ) {
                overallStatus = "NON_COMPLIANT";

            } else if (
                replacementDue > 0 ||
                replacementSoon > 0
            ) {
                overallStatus = "ATTENTION_REQUIRED";
            }

            res.json({
                worker: {
                    id: worker.id,
                    name: worker.name,
                    employeeCode: worker.employee_code
                },

                summary: {
                    totalRequired,
                    compliant,
                    missing,
                    invalid,
                    expired,
                    replacementDue,
                    replacementSoon,
                    compliancePercentage,
                    overallStatus
                },

                requirements: result.rows
            });

        } catch (error) {

            console.error(
                "PPE compliance error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to calculate PPE compliance"
            });
        }
    }
);


// ======================================================
// 2. MINE-WIDE PPE ALERTS
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

            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            let mineId = null;

            if (user.role !== "PLATFORM_ADMIN") {

                if (!user.mine_id) {
                    return res.status(403).json({
                        message:
                            "User is not assigned to a mine"
                    });
                }

                mineId = user.mine_id;
            }

            const params = mineId
                ? [mineId]
                : [];

            const mineCondition = mineId
                ? "AND w.mine_id = $1"
                : "";

            const result = await pool.query(
                `
                SELECT
                    w.id AS worker_id,
                    w.name AS worker_name,
                    w.employee_code,

                    pt.id AS ppe_type_id,
                    pt.name AS ppe_type_name,
                    pt.category,

                    a.ppe_inventory_id,
                    a.item_code,
                    a.ppe_status,
                    a.condition,
                    a.expiry_date,
                    a.expected_replacement_date,

                    CASE
                        WHEN a.ppe_inventory_id IS NULL
                            THEN 'MISSING'

                        WHEN a.ppe_status = 'EXPIRED'
                            THEN 'EXPIRED'

                        WHEN a.ppe_status IN (
                            'DAMAGED',
                            'DISPOSED'
                        )
                            THEN 'INVALID'

                        WHEN a.expiry_date IS NOT NULL
                             AND a.expiry_date < CURRENT_DATE
                            THEN 'EXPIRED'

                        WHEN a.expected_replacement_date IS NOT NULL
                             AND a.expected_replacement_date
                                 < CURRENT_DATE
                            THEN 'REPLACEMENT_DUE'

                        WHEN a.expected_replacement_date IS NOT NULL
                             AND a.expected_replacement_date
                                 <= CURRENT_DATE + 7
                            THEN 'REPLACEMENT_SOON'

                        ELSE NULL
                    END AS alert_type

                FROM workers w

                JOIN ppe_types pt
                    ON pt.mine_id = w.mine_id
                   AND pt.is_active = TRUE
                   AND pt.is_mandatory = TRUE

                LEFT JOIN LATERAL (
                    SELECT
                        pi.id AS ppe_inventory_id,
                        pi.item_code,
                        pi.status AS ppe_status,
                        pi.condition,
                        pi.expiry_date,
                        wpa.expected_replacement_date

                    FROM worker_ppe_assignments wpa

                    JOIN ppe_inventory pi
                        ON wpa.ppe_inventory_id = pi.id

                    WHERE wpa.worker_id = w.id
                      AND wpa.status = 'ACTIVE'
                      AND pi.ppe_type_id = pt.id

                    ORDER BY
                        wpa.issue_date DESC,
                        wpa.id DESC

                    LIMIT 1
                ) a ON TRUE

                WHERE 1 = 1
                    ${mineCondition}

                AND (
                    a.ppe_inventory_id IS NULL

                    OR a.ppe_status IN (
                        'EXPIRED',
                        'DAMAGED',
                        'DISPOSED'
                    )

                    OR (
                        a.expiry_date IS NOT NULL
                        AND a.expiry_date < CURRENT_DATE
                    )

                    OR (
                        a.expected_replacement_date IS NOT NULL
                        AND a.expected_replacement_date
                            <= CURRENT_DATE + 7
                    )
                )

                ORDER BY
                    CASE
                        WHEN a.ppe_inventory_id IS NULL
                            THEN 1

                        WHEN a.ppe_status = 'EXPIRED'
                            THEN 2

                        WHEN a.ppe_status = 'DAMAGED'
                            THEN 3

                        WHEN a.expected_replacement_date
                             < CURRENT_DATE
                            THEN 4

                        ELSE 5
                    END,

                    w.name,
                    pt.category
                `,
                params
            );

            const summary = {
                totalAlerts: result.rows.length,
                missing: 0,
                expired: 0,
                invalid: 0,
                replacementDue: 0,
                replacementSoon: 0
            };

            for (const alert of result.rows) {

                switch (alert.alert_type) {

                    case "MISSING":
                        summary.missing++;
                        break;

                    case "EXPIRED":
                        summary.expired++;
                        break;

                    case "INVALID":
                        summary.invalid++;
                        break;

                    case "REPLACEMENT_DUE":
                        summary.replacementDue++;
                        break;

                    case "REPLACEMENT_SOON":
                        summary.replacementSoon++;
                        break;
                }
            }

            res.json({
                summary,
                alerts: result.rows
            });

        } catch (error) {

            console.error(
                "PPE alerts error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch PPE alerts"
            });
        }
    }
);


// ======================================================
// 3. PPE COMPLIANCE SUMMARY FOR MINE
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

            let mineId = null;

            if (user.role !== "PLATFORM_ADMIN") {

                if (!user.mine_id) {
                    return res.status(403).json({
                        message:
                            "User is not assigned to a mine"
                    });
                }

                mineId = user.mine_id;
            }

            const params = mineId
                ? [mineId]
                : [];

            const mineCondition = mineId
                ? "WHERE w.mine_id = $1"
                : "";

            const result = await pool.query(
                `
                SELECT
                    COUNT(DISTINCT w.id)::INTEGER
                        AS total_workers,

                    COUNT(DISTINCT w.id) FILTER (
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM ppe_types pt
                            WHERE pt.mine_id = w.mine_id
                              AND pt.is_active = TRUE
                              AND pt.is_mandatory = TRUE
                              AND NOT EXISTS (
                                  SELECT 1
                                  FROM worker_ppe_assignments wpa
                                  JOIN ppe_inventory pi
                                      ON wpa.ppe_inventory_id = pi.id
                                  WHERE wpa.worker_id = w.id
                                    AND wpa.status = 'ACTIVE'
                                    AND pi.ppe_type_id = pt.id
                                    AND pi.status NOT IN (
                                        'EXPIRED',
                                        'DAMAGED',
                                        'DISPOSED'
                                    )
                                    AND (
                                        pi.expiry_date IS NULL
                                        OR pi.expiry_date >= CURRENT_DATE
                                    )
                              )
                        )
                    )::INTEGER
                        AS fully_compliant_workers,

                    COUNT(DISTINCT w.id) FILTER (
                        WHERE EXISTS (
                            SELECT 1
                            FROM ppe_types pt
                            WHERE pt.mine_id = w.mine_id
                              AND pt.is_active = TRUE
                              AND pt.is_mandatory = TRUE
                              AND NOT EXISTS (
                                  SELECT 1
                                  FROM worker_ppe_assignments wpa
                                  JOIN ppe_inventory pi
                                      ON wpa.ppe_inventory_id = pi.id
                                  WHERE wpa.worker_id = w.id
                                    AND wpa.status = 'ACTIVE'
                                    AND pi.ppe_type_id = pt.id
                                    AND pi.status NOT IN (
                                        'EXPIRED',
                                        'DAMAGED',
                                        'DISPOSED'
                                    )
                                    AND (
                                        pi.expiry_date IS NULL
                                        OR pi.expiry_date >= CURRENT_DATE
                                    )
                              )
                        )
                    )::INTEGER
                        AS workers_needing_attention

                FROM workers w
                ${mineCondition}
                `,
                params
            );

            const summary = result.rows[0];

            const compliancePercentage =
                Number(summary.total_workers) === 0
                    ? 100
                    : Math.round(
                        (
                            Number(
                                summary.fully_compliant_workers
                            ) /
                            Number(
                                summary.total_workers
                            )
                        ) * 100
                    );

            res.json({
                summary: {
                    ...summary,
                    compliance_percentage:
                        compliancePercentage
                }
            });

        } catch (error) {

            console.error(
                "PPE summary error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to calculate PPE summary"
            });
        }
    }
);


module.exports = router;