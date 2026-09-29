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
// Helper: Risk level
// ======================================================

function getRiskLevel(score) {

    if (score >= 75) {
        return "CRITICAL";
    }

    if (score >= 50) {
        return "HIGH";
    }

    if (score >= 25) {
        return "MEDIUM";
    }

    return "LOW";
}


// ======================================================
// Helper: Clamp score 0 - 100
// ======================================================

function clampScore(value) {

    return Math.max(
        0,
        Math.min(
            100,
            Math.round(Number(value) || 0)
        )
    );
}


// ======================================================
// 1. CALCULATE RISK FOR WORKER
// ======================================================

router.post(
    "/calculate/:workerId",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const workerId = Number(
            req.params.workerId
        );

        if (!Number.isInteger(workerId)) {
            return res.status(400).json({
                message: "Invalid workerId"
            });
        }

        try {

            const user = await getUser(
                req.user.userId
            );

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
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

            const worker =
                workerResult.rows[0];

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

            const contributingFactors = [];

            // ==================================================
            // PPE RISK
            // ==================================================

            const ppeResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total_required,

                    COUNT(*) FILTER (
                        WHERE EXISTS (
                            SELECT 1
                            FROM worker_ppe_assignments wpa
                            JOIN ppe_inventory pi
                                ON wpa.ppe_inventory_id = pi.id
                            WHERE wpa.worker_id = $1
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
                    )::INTEGER AS compliant

                FROM ppe_types pt

                WHERE pt.mine_id = $2
                  AND pt.is_active = TRUE
                  AND pt.is_mandatory = TRUE
                `,
                [
                    workerId,
                    worker.mine_id
                ]
            );

            const ppeData =
                ppeResult.rows[0];

            const totalPpe =
                Number(
                    ppeData.total_required
                );

            const compliantPpe =
                Number(
                    ppeData.compliant
                );

            const ppeCompliance =
                totalPpe === 0
                    ? 100
                    : (
                        compliantPpe /
                        totalPpe
                    ) * 100;

            const ppeScore = clampScore(
                100 - ppeCompliance
            );

            if (ppeScore >= 50) {

                contributingFactors.push({
                    category: "PPE",
                    severity: "HIGH",
                    message:
                        "Worker has missing, expired or invalid mandatory PPE"
                });

            } else if (ppeScore > 0) {

                contributingFactors.push({
                    category: "PPE",
                    severity: "MEDIUM",
                    message:
                        "Worker PPE compliance is incomplete"
                });
            }


            // ==================================================
            // HEALTH RISK
            // ==================================================

            const healthResult = await pool.query(
                `
                SELECT
                    medical_status,
                    fitness_expiry_date
                FROM worker_health
                WHERE worker_id = $1
                `,
                [workerId]
            );

            let healthScore = 60;

            if (healthResult.rows.length === 0) {

                healthScore = 60;

                contributingFactors.push({
                    category: "HEALTH",
                    severity: "MEDIUM",
                    message:
                        "Worker does not have a health record"
                });

            } else {

                const health =
                    healthResult.rows[0];

                const status =
                    health.medical_status;

                if (status === "FIT") {
                    healthScore = 0;
                }

                else if (
                    status ===
                    "FIT_WITH_RESTRICTIONS"
                ) {
                    healthScore = 40;

                    contributingFactors.push({
                        category: "HEALTH",
                        severity: "MEDIUM",
                        message:
                            "Worker has medical restrictions"
                    });
                }

                else if (
                    status === "UNFIT"
                ) {
                    healthScore = 100;

                    contributingFactors.push({
                        category: "HEALTH",
                        severity: "CRITICAL",
                        message:
                            "Worker is medically unfit"
                    });
                }

                else if (
                    status === "PENDING"
                ) {
                    healthScore = 60;

                    contributingFactors.push({
                        category: "HEALTH",
                        severity: "MEDIUM",
                        message:
                            "Worker medical fitness is pending"
                    });
                }

                if (
                    health.fitness_expiry_date &&
                    new Date(
                        health.fitness_expiry_date
                    ) < new Date()
                ) {

                    healthScore = Math.max(
                        healthScore,
                        80
                    );

                    contributingFactors.push({
                        category: "HEALTH",
                        severity: "HIGH",
                        message:
                            "Worker medical fitness has expired"
                    });
                }
            }


            // ==================================================
            // INCIDENT RISK
            // Last 30 days
            // ==================================================

            const incidentResult = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total,

                    COUNT(*) FILTER (
                        WHERE severity = 'CRITICAL'
                    )::INTEGER AS critical,

                    COUNT(*) FILTER (
                        WHERE severity = 'HIGH'
                    )::INTEGER AS high

                FROM incidents

                WHERE worker_id = $1
                  AND incident_date >=
                      CURRENT_DATE - INTERVAL '30 days'
                `,
                [workerId]
            );

            const incidentData =
                incidentResult.rows[0];

            const totalIncidents =
                Number(
                    incidentData.total
                );

            const criticalIncidents =
                Number(
                    incidentData.critical
                );

            const highIncidents =
                Number(
                    incidentData.high
                );

            let incidentScore = 0;

            if (criticalIncidents > 0) {

                incidentScore = 100;

                contributingFactors.push({
                    category: "INCIDENT",
                    severity: "CRITICAL",
                    message:
                        "Worker has a recent critical incident"
                });

            } else if (highIncidents > 0) {

                incidentScore = 75;

                contributingFactors.push({
                    category: "INCIDENT",
                    severity: "HIGH",
                    message:
                        "Worker has a recent high-severity incident"
                });

            } else if (totalIncidents >= 3) {

                incidentScore = 60;

                contributingFactors.push({
                    category: "INCIDENT",
                    severity: "HIGH",
                    message:
                        "Worker has multiple recent incidents"
                });

            } else if (totalIncidents === 2) {

                incidentScore = 40;

            } else if (totalIncidents === 1) {

                incidentScore = 20;
            }


            // ==================================================
            // ATTENDANCE RISK
            // Last 30 days
            // ==================================================

            const attendanceResult =
                await pool.query(
                    `
                    SELECT

                        COUNT(*)::INTEGER AS total_days,

                        COUNT(*) FILTER (
                            WHERE status = 'PRESENT'
                        )::INTEGER AS present_days,

                        COUNT(*) FILTER (
                            WHERE status = 'LATE'
                        )::INTEGER AS late_days,

                        COUNT(*) FILTER (
                            WHERE status = 'ABSENT'
                        )::INTEGER AS absent_days,

                        COUNT(*) FILTER (
                            WHERE status = 'HALF_DAY'
                        )::INTEGER AS half_days

                    FROM attendance

                    WHERE worker_id = $1
                      AND attendance_date >=
                          CURRENT_DATE - INTERVAL '30 days'
                    `,
                    [workerId]
                );

            const attendance =
                attendanceResult.rows[0];

            const totalAttendance =
                Number(
                    attendance.total_days
                );

            const absentDays =
                Number(
                    attendance.absent_days
                );

            const lateDays =
                Number(
                    attendance.late_days
                );

            let attendanceScore = 0;

            if (totalAttendance > 0) {

                const absenceRate =
                    absentDays /
                    totalAttendance;

                const lateRate =
                    lateDays /
                    totalAttendance;

                attendanceScore = clampScore(
                    (
                        absenceRate * 100
                    ) * 0.7 +
                    (
                        lateRate * 100
                    ) * 0.3
                );

            } else {

                attendanceScore = 10;
            }

            if (attendanceScore >= 50) {

                contributingFactors.push({
                    category: "ATTENDANCE",
                    severity: "HIGH",
                    message:
                        "Worker has frequent attendance issues"
                });

            } else if (attendanceScore >= 25) {

                contributingFactors.push({
                    category: "ATTENDANCE",
                    severity: "MEDIUM",
                    message:
                        "Worker has some attendance irregularities"
                });
            }


            // ==================================================
            // GEOFENCE RISK
            // Last 30 days
            // ==================================================

            const geofenceResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS total_alerts,

                        COUNT(*) FILTER (
                            WHERE status IN (
                                'OPEN',
                                'ACKNOWLEDGED'
                            )
                        )::INTEGER AS active_alerts

                    FROM geofence_alerts

                    WHERE worker_id = $1
                      AND detected_at >=
                          CURRENT_TIMESTAMP -
                          INTERVAL '30 days'
                    `,
                    [workerId]
                );

            const geofenceData =
                geofenceResult.rows[0];

            const totalGeofenceAlerts =
                Number(
                    geofenceData.total_alerts
                );

            const activeGeofenceAlerts =
                Number(
                    geofenceData.active_alerts
                );

            let geofenceScore = 0;

            if (activeGeofenceAlerts > 0) {

                geofenceScore = Math.min(
                    100,
                    70 +
                    (
                        activeGeofenceAlerts * 10
                    )
                );

                contributingFactors.push({
                    category: "GEOFENCE",
                    severity: "HIGH",
                    message:
                        "Worker has an active geofence violation"
                });

            } else if (
                totalGeofenceAlerts >= 3
            ) {

                geofenceScore = 60;

                contributingFactors.push({
                    category: "GEOFENCE",
                    severity: "HIGH",
                    message:
                        "Worker has repeated zone violations"
                });

            } else if (
                totalGeofenceAlerts === 2
            ) {

                geofenceScore = 40;

            } else if (
                totalGeofenceAlerts === 1
            ) {

                geofenceScore = 20;
            }


            // ==================================================
            // EQUIPMENT RISK
            // Based on equipment currently assigned
            // ==================================================

            const equipmentResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS assigned_count,

                        COUNT(*) FILTER (
                            WHERE e.status =
                                'OUT_OF_SERVICE'
                        )::INTEGER AS unsafe_count,

                        COUNT(*) FILTER (
                            WHERE e.status =
                                'MAINTENANCE'
                        )::INTEGER AS maintenance_count

                    FROM equipment e

                    WHERE e.assigned_worker_id = $1
                    `,
                    [workerId]
                );

            const equipmentData =
                equipmentResult.rows[0];

            const unsafeEquipment =
                Number(
                    equipmentData.unsafe_count
                );

            const maintenanceEquipment =
                Number(
                    equipmentData.maintenance_count
                );

            let equipmentScore = 0;

            if (unsafeEquipment > 0) {

                equipmentScore = 100;

                contributingFactors.push({
                    category: "EQUIPMENT",
                    severity: "CRITICAL",
                    message:
                        "Worker is assigned equipment marked out of service"
                });

            } else if (
                maintenanceEquipment > 0
            ) {

                equipmentScore = 50;

                contributingFactors.push({
                    category: "EQUIPMENT",
                    severity: "HIGH",
                    message:
                        "Worker has equipment requiring maintenance"
                });
            }


            // ==================================================
            // FINAL WEIGHTED SCORE
            // ==================================================

            const riskScore = clampScore(

                (
                    ppeScore * 0.25
                ) +

                (
                    healthScore * 0.20
                ) +

                (
                    incidentScore * 0.20
                ) +

                (
                    attendanceScore * 0.10
                ) +

                (
                    geofenceScore * 0.15
                ) +

                (
                    equipmentScore * 0.10
                )
            );

            const riskLevel =
                getRiskLevel(riskScore);


            // ==================================================
            // STORE ASSESSMENT
            // ==================================================

            const insertResult =
                await pool.query(
                    `
                    INSERT INTO worker_risk_assessments
                    (
                        worker_id,
                        mine_id,
                        risk_score,
                        risk_level,
                        ppe_score,
                        health_score,
                        incident_score,
                        attendance_score,
                        geofence_score,
                        equipment_score,
                        contributing_factors
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        $10,
                        $11::JSONB
                    )
                    RETURNING *
                    `,
                    [
                        workerId,
                        worker.mine_id,
                        riskScore,
                        riskLevel,
                        ppeScore,
                        healthScore,
                        incidentScore,
                        attendanceScore,
                        geofenceScore,
                        equipmentScore,
                        JSON.stringify(
                            contributingFactors
                        )
                    ]
                );

            res.status(201).json({
                message:
                    "Worker risk assessment calculated successfully",

                assessment:
                    insertResult.rows[0],

                breakdown: {
                    ppe: ppeScore,
                    health: healthScore,
                    incidents: incidentScore,
                    attendance: attendanceScore,
                    geofence: geofenceScore,
                    equipment: equipmentScore
                }
            });

        } catch (error) {

            console.error(
                "Risk calculation error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to calculate worker risk"
            });
        }
    }
);


// ======================================================
// 2. GET LATEST RISK FOR WORKER
// ======================================================

router.get(
    "/worker/:workerId",
    auth,
    async (req, res) => {

        const workerId = Number(
            req.params.workerId
        );

        if (!Number.isInteger(workerId)) {
            return res.status(400).json({
                message:
                    "Invalid workerId"
            });
        }

        try {

            const user =
                await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message:
                        "User not found"
                });
            }

            if (
                user.role === "FIELD_WORKER" &&
                user.worker_id !== workerId
            ) {
                return res.status(403).json({
                    message:
                        "You can only view your own risk"
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

            const result =
                await pool.query(
                    `SELECT *
                     FROM worker_risk_assessments
                     WHERE worker_id = $1
                     ORDER BY calculated_at DESC, id DESC
                     LIMIT 1`,
                    [workerId]
                );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "No risk assessment exists for this worker"
                });
            }

            res.json({
                worker: {
                    id: worker.id,
                    name: worker.name,
                    employeeCode:
                        worker.employee_code
                },

                assessment:
                    result.rows[0]
            });

        } catch (error) {

            console.error(
                "Get worker risk error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch worker risk"
            });
        }
    }
);


// ======================================================
// 3. GET RISK FOR MINE
// ======================================================

router.get(
    "/mine",
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

            if (
                user.role === "PLATFORM_ADMIN"
            ) {

                result =
                    await pool.query(
                        `
                        SELECT DISTINCT ON (wra.worker_id)

                            wra.*,

                            w.name AS worker_name,
                            w.employee_code

                        FROM worker_risk_assessments wra

                        JOIN workers w
                            ON wra.worker_id = w.id

                        ORDER BY
                            wra.worker_id,
                            wra.calculated_at DESC,
                            wra.id DESC
                        `
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
                        `
                        SELECT DISTINCT ON (wra.worker_id)

                            wra.*,

                            w.name AS worker_name,
                            w.employee_code

                        FROM worker_risk_assessments wra

                        JOIN workers w
                            ON wra.worker_id = w.id

                        WHERE wra.mine_id = $1

                        ORDER BY
                            wra.worker_id,
                            wra.calculated_at DESC,
                            wra.id DESC
                        `,
                        [user.mine_id]
                    );
            }

            res.json({
                count: result.rows.length,
                workers: result.rows
            });

        } catch (error) {

            console.error(
                "Mine risk error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch mine risk"
            });
        }
    }
);


// ======================================================
// 4. GET HIGH / CRITICAL RISK WORKERS
// ======================================================

router.get(
    "/high-risk",
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

            const query = `
                SELECT DISTINCT ON (wra.worker_id)

                    wra.*,

                    w.name AS worker_name,
                    w.employee_code

                FROM worker_risk_assessments wra

                JOIN workers w
                    ON wra.worker_id = w.id

                WHERE wra.risk_level IN (
                    'HIGH',
                    'CRITICAL'
                )

                ${user.role !== "PLATFORM_ADMIN"
                    ? "AND wra.mine_id = $1"
                    : ""
                }

                ORDER BY
                    wra.worker_id,
                    wra.calculated_at DESC,
                    wra.id DESC
            `;

            result =
                user.role === "PLATFORM_ADMIN"
                    ? await pool.query(query)
                    : await pool.query(
                        query,
                        [user.mine_id]
                    );

            res.json({
                count: result.rows.length,
                highRiskWorkers:
                    result.rows
            });

        } catch (error) {

            console.error(
                "High risk workers error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch high-risk workers"
            });
        }
    }
);


// ======================================================
// 5. GET RISK TREND
// ======================================================

router.get(
    "/trend/:workerId",
    auth,
    async (req, res) => {

        const workerId =
            Number(req.params.workerId);

        if (!Number.isInteger(workerId)) {
            return res.status(400).json({
                message:
                    "Invalid workerId"
            });
        }

        try {

            const user =
                await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message:
                        "User not found"
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
                user.role === "FIELD_WORKER" &&
                user.worker_id !== workerId
            ) {
                return res.status(403).json({
                    message:
                        "Access denied"
                });
            }

            if (
                user.role !== "PLATFORM_ADMIN" &&
                worker.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message:
                        "Access denied"
                });
            }

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        risk_score,
                        risk_level,
                        ppe_score,
                        health_score,
                        incident_score,
                        attendance_score,
                        geofence_score,
                        equipment_score,
                        calculated_at

                    FROM worker_risk_assessments

                    WHERE worker_id = $1

                    ORDER BY
                        calculated_at ASC,
                        id ASC

                    LIMIT 100
                    `,
                    [workerId]
                );

            res.json({
                worker: {
                    id: worker.id,
                    name: worker.name,
                    employeeCode:
                        worker.employee_code
                },

                count: result.rows.length,

                trend: result.rows
            });

        } catch (error) {

            console.error(
                "Risk trend error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch risk trend"
            });
        }
    }
);


module.exports = router;