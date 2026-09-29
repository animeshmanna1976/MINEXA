const express = require("express");
const router = express.Router();

const pool = require("../db");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const {
    createAuditLog
} = require("../utils/auditLogger");

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
// Helper: Get emergency
// ======================================================

async function getEmergency(emergencyId) {

    const result = await pool.query(
        `SELECT
            ea.*,

            w.name AS worker_name,
            w.employee_code,

            m.name AS mine_name,

            ack.name AS acknowledged_by_name,
            resp.name AS responding_by_name,
            resv.name AS resolved_by_name

         FROM emergency_alerts ea

         JOIN workers w
            ON ea.worker_id = w.id

         JOIN mines m
            ON ea.mine_id = m.id

         LEFT JOIN users ack
            ON ea.acknowledged_by = ack.id

         LEFT JOIN users resp
            ON ea.responding_by = resp.id

         LEFT JOIN users resv
            ON ea.resolved_by = resv.id

         WHERE ea.id = $1`,
        [emergencyId]
    );

    return result.rows[0] || null;
}


// ======================================================
// 1. CREATE EMERGENCY / SOS
// FIELD WORKER ONLY
// ======================================================

router.post(
    "/",
    auth,
    authorize("FIELD_WORKER"),
    async (req, res) => {

        const {
            emergencyType,
            description,
            location,
            latitude,
            longitude
        } = req.body || {};

        if (!emergencyType) {
            return res.status(400).json({
                message: "emergencyType is required"
            });
        }

        const allowedTypes = [
            "MEDICAL",
            "ACCIDENT",
            "FIRE",
            "GAS_LEAK",
            "GROUND_COLLAPSE",
            "EQUIPMENT_FAILURE",
            "TRAPPED_WORKER",
            "UNSAFE_AREA",
            "SECURITY",
            "OTHER"
        ];

        if (!allowedTypes.includes(emergencyType)) {
            return res.status(400).json({
                message: "Invalid emergency type"
            });
        }

        // --------------------------------------------------
        // Validate coordinates
        // --------------------------------------------------

        if (
            (latitude !== undefined && longitude === undefined) ||
            (longitude !== undefined && latitude === undefined)
        ) {
            return res.status(400).json({
                message:
                    "latitude and longitude must be provided together"
            });
        }

        if (latitude !== undefined && longitude !== undefined) {

            const lat = Number(latitude);
            const lon = Number(longitude);

            if (
                Number.isNaN(lat) ||
                Number.isNaN(lon) ||
                lat < -90 ||
                lat > 90 ||
                lon < -180 ||
                lon > 180
            ) {
                return res.status(400).json({
                    message: "Invalid latitude or longitude"
                });
            }
        }

        try {

            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            if (!user.worker_id) {
                return res.status(400).json({
                    message:
                        "Worker profile is not linked to this account"
                });
            }

            if (!user.mine_id) {
                return res.status(400).json({
                    message:
                        "Worker is not assigned to a mine"
                });
            }

            // --------------------------------------------------
            // Prevent duplicate active SOS
            // --------------------------------------------------

            const activeResult = await pool.query(
                `SELECT id
                 FROM emergency_alerts
                 WHERE worker_id = $1
                   AND status IN (
                        'ACTIVE',
                        'ACKNOWLEDGED',
                        'RESPONDING'
                   )
                 LIMIT 1`,
                [user.worker_id]
            );

            if (activeResult.rows.length > 0) {
                return res.status(409).json({
                    message:
                        "You already have an active emergency alert",
                    emergencyId:
                        activeResult.rows[0].id
                });
            }

            const result = await pool.query(
                `INSERT INTO emergency_alerts
                (
                    mine_id,
                    worker_id,
                    emergency_type,
                    severity,
                    description,
                    location,
                    latitude,
                    longitude,
                    status
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    'CRITICAL',
                    $4,
                    $5,
                    $6,
                    $7,
                    'ACTIVE'
                )
                RETURNING *`,
                [
                    user.mine_id,
                    user.worker_id,
                    emergencyType,
                    description || null,
                    location || null,
                    latitude !== undefined
                        ? Number(latitude)
                        : null,
                    longitude !== undefined
                        ? Number(longitude)
                        : null
                ]
            );

            await createAuditLog({
    userId: user.id,
    mineId: user.mine_id,
    action: "EMERGENCY_CREATED",
    entityType: "EMERGENCY",
    entityId: result.rows[0].id,
    description:
        `Emergency alert created: ${emergencyType}`,
    newValues: result.rows[0],
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
});

            res.status(201).json({
                message:
                    "Emergency alert created successfully",

                emergency: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Create emergency error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to create emergency alert"
            });
        }
    }
);


// ======================================================
// 2. GET MY EMERGENCY ALERTS
// FIELD WORKER
// ======================================================

router.get(
    "/me",
    auth,
    authorize("FIELD_WORKER"),
    async (req, res) => {

        try {

            const user = await getUser(req.user.userId);

            if (!user || !user.worker_id) {
                return res.status(400).json({
                    message:
                        "Worker profile is not linked to this account"
                });
            }

            const result = await pool.query(
                `SELECT
                    id,
                    emergency_type,
                    severity,
                    description,
                    location,
                    latitude,
                    longitude,
                    status,
                    acknowledged_at,
                    responding_at,
                    resolved_at,
                    resolution_notes,
                    created_at,
                    updated_at
                 FROM emergency_alerts
                 WHERE worker_id = $1
                 ORDER BY created_at DESC`,
                [user.worker_id]
            );

            res.json({
                count: result.rows.length,
                emergencies: result.rows
            });

        } catch (error) {

            console.error(
                "Get my emergencies error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch your emergency alerts"
            });
        }
    }
);


// ======================================================
// 3. GET MINE EMERGENCIES
// MANAGER / SAFETY
// ======================================================

router.get(
    "/mine",
    auth,
    authorize(
        "MINE_MANAGER",
        "SAFETY_OFFICER",
        "PLATFORM_ADMIN"
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

            const selectQuery = `
                SELECT
                    ea.*,

                    w.name AS worker_name,
                    w.employee_code,

                    m.name AS mine_name,

                    ack.name AS acknowledged_by_name,
                    resp.name AS responding_by_name,
                    resv.name AS resolved_by_name

                FROM emergency_alerts ea

                JOIN workers w
                    ON ea.worker_id = w.id

                JOIN mines m
                    ON ea.mine_id = m.id

                LEFT JOIN users ack
                    ON ea.acknowledged_by = ack.id

                LEFT JOIN users resp
                    ON ea.responding_by = resp.id

                LEFT JOIN users resv
                    ON ea.resolved_by = resv.id
            `;

            if (user.role === "PLATFORM_ADMIN") {

                result = await pool.query(
                    `${selectQuery}
                     ORDER BY
                        CASE
                            WHEN ea.status = 'ACTIVE'
                                THEN 1
                            WHEN ea.status = 'ACKNOWLEDGED'
                                THEN 2
                            WHEN ea.status = 'RESPONDING'
                                THEN 3
                            ELSE 4
                        END,
                        ea.created_at DESC`
                );

            } else {

                if (!user.mine_id) {
                    return res.status(403).json({
                        message:
                            "User is not assigned to a mine"
                    });
                }

                result = await pool.query(
                    `${selectQuery}
                     WHERE ea.mine_id = $1
                     ORDER BY
                        CASE
                            WHEN ea.status = 'ACTIVE'
                                THEN 1
                            WHEN ea.status = 'ACKNOWLEDGED'
                                THEN 2
                            WHEN ea.status = 'RESPONDING'
                                THEN 3
                            ELSE 4
                        END,
                        ea.created_at DESC`,
                    [user.mine_id]
                );
            }

            res.json({
                count: result.rows.length,
                emergencies: result.rows
            });

        } catch (error) {

            console.error(
                "Get mine emergencies error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch mine emergencies"
            });
        }
    }
);


// ======================================================
// 4. GET SINGLE EMERGENCY
// ======================================================

router.get(
    "/:id",
    auth,
    async (req, res) => {

        const emergencyId = Number(req.params.id);

        if (!Number.isInteger(emergencyId)) {
            return res.status(400).json({
                message: "Invalid emergency id"
            });
        }

        try {

            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const emergency =
                await getEmergency(emergencyId);

            if (!emergency) {
                return res.status(404).json({
                    message:
                        "Emergency alert not found"
                });
            }

            // --------------------------------------------------
            // Platform admin
            // --------------------------------------------------

            if (user.role === "PLATFORM_ADMIN") {
                return res.json(emergency);
            }

            // --------------------------------------------------
            // Worker can see only own emergency
            // --------------------------------------------------

            if (user.role === "FIELD_WORKER") {

                if (
                    emergency.worker_id !==
                    user.worker_id
                ) {
                    return res.status(403).json({
                        message: "Access denied"
                    });
                }

                return res.json(emergency);
            }

            // --------------------------------------------------
            // Manager / Safety mine access
            // --------------------------------------------------

            if (
                emergency.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            res.json(emergency);

        } catch (error) {

            console.error(
                "Get emergency error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch emergency alert"
            });
        }
    }
);


// ======================================================
// 5. ACKNOWLEDGE EMERGENCY
// MANAGER / SAFETY
// ======================================================

router.patch(
    "/:id/acknowledge",
    auth,
    authorize(
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const emergencyId = Number(req.params.id);

        if (!Number.isInteger(emergencyId)) {
            return res.status(400).json({
                message: "Invalid emergency id"
            });
        }

        try {

            const user = await getUser(req.user.userId);

            if (!user || !user.mine_id) {
                return res.status(403).json({
                    message:
                        "User is not assigned to a mine"
                });
            }

            const emergency =
                await getEmergency(emergencyId);

            if (!emergency) {
                return res.status(404).json({
                    message:
                        "Emergency alert not found"
                });
            }

            if (
                emergency.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            if (emergency.status !== "ACTIVE") {
                return res.status(400).json({
                    message:
                        `Emergency cannot be acknowledged from status ${emergency.status}`
                });
            }

            const result = await pool.query(
    `UPDATE emergency_alerts
     SET
        status = 'ACKNOWLEDGED',
        acknowledged_by = $1,
        acknowledged_at = CURRENT_TIMESTAMP,
        response_time_seconds =
            EXTRACT(
                EPOCH FROM (
                    CURRENT_TIMESTAMP - created_at
                )
            )::INTEGER,
        updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [
        user.id,
        emergencyId
    ]
);
await createAuditLog({
    userId: user.id,
    mineId: user.mine_id,
    action: "EMERGENCY_ACKNOWLEDGED",
    entityType: "EMERGENCY",
    entityId: emergencyId,
    description:
        "Emergency alert acknowledged",
    oldValues: {
        status: emergency.status
    },
    newValues: {
        status: "ACKNOWLEDGED",
        acknowledgedBy: user.id
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
});

            res.json({
                message:
                    "Emergency acknowledged successfully",
                emergency: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Acknowledge emergency error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to acknowledge emergency"
            });
        }
    }
);


// ======================================================
// 6. START RESPONSE
// MANAGER / SAFETY
// ======================================================

router.patch(
    "/:id/respond",
    auth,
    authorize(
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const emergencyId = Number(req.params.id);

        if (!Number.isInteger(emergencyId)) {
            return res.status(400).json({
                message: "Invalid emergency id"
            });
        }

        try {

            const user = await getUser(req.user.userId);

            if (!user || !user.mine_id) {
                return res.status(403).json({
                    message:
                        "User is not assigned to a mine"
                });
            }

            const emergency =
                await getEmergency(emergencyId);

            if (!emergency) {
                return res.status(404).json({
                    message:
                        "Emergency alert not found"
                });
            }

            if (
                emergency.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            if (
                emergency.status !==
                "ACKNOWLEDGED"
            ) {
                return res.status(400).json({
                    message:
                        "Emergency must be acknowledged before response starts"
                });
            }

            const result = await pool.query(
                `UPDATE emergency_alerts
                 SET
                    status = 'RESPONDING',
                    responding_by = $1,
                    responding_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING *`,
                [
                    user.id,
                    emergencyId
                ]
            );

            await createAuditLog({
    userId: user.id,
    mineId: user.mine_id,
    action: "EMERGENCY_RESPONSE_STARTED",
    entityType: "EMERGENCY",
    entityId: emergencyId,
    description:
        "Emergency response started",
    oldValues: {
        status: emergency.status
    },
    newValues: {
        status: "RESPONDING",
        respondingBy: user.id
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
});

            res.json({
                message:
                    "Emergency response started",
                emergency: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Respond emergency error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to start emergency response"
            });
        }
    }
);


// ======================================================
// 7. RESOLVE EMERGENCY
// MANAGER / SAFETY
// ======================================================

router.patch(
    "/:id/resolve",
    auth,
    authorize(
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const emergencyId = Number(req.params.id);

        const {
            resolutionNotes
        } = req.body || {};

        if (!Number.isInteger(emergencyId)) {
            return res.status(400).json({
                message: "Invalid emergency id"
            });
        }

        if (!resolutionNotes) {
            return res.status(400).json({
                message:
                    "resolutionNotes are required"
            });
        }

        try {

            const user = await getUser(req.user.userId);

            if (!user || !user.mine_id) {
                return res.status(403).json({
                    message:
                        "User is not assigned to a mine"
                });
            }

            const emergency =
                await getEmergency(emergencyId);

            if (!emergency) {
                return res.status(404).json({
                    message:
                        "Emergency alert not found"
                });
            }

            if (
                emergency.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            if (
                emergency.status !== "RESPONDING"
            ) {
                return res.status(400).json({
                    message:
                        "Emergency must be in RESPONDING status before resolution"
                });
            }

            const result = await pool.query(
    `UPDATE emergency_alerts
     SET
        status = 'RESOLVED',
        resolved_by = $1,
        resolved_at = CURRENT_TIMESTAMP,
        resolution_notes = $2,
        resolution_time_seconds =
            EXTRACT(
                EPOCH FROM (
                    CURRENT_TIMESTAMP - created_at
                )
            )::INTEGER,
        updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [
        user.id,
        resolutionNotes,
        emergencyId
    ]
);

await createAuditLog({
    userId: user.id,
    mineId: user.mine_id,
    action: "EMERGENCY_RESOLVED",
    entityType: "EMERGENCY",
    entityId: emergencyId,
    description:
        "Emergency alert resolved",
    oldValues: {
        status: emergency.status
    },
    newValues: {
        status: "RESOLVED",
        resolutionNotes
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
});

            res.json({
                message:
                    "Emergency resolved successfully",
                emergency: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Resolve emergency error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to resolve emergency"
            });
        }
    }
);


// ======================================================
// 8. CANCEL EMERGENCY
// FIELD WORKER
// ======================================================

router.patch(
    "/:id/cancel",
    auth,
    authorize("FIELD_WORKER"),
    async (req, res) => {

        const emergencyId = Number(req.params.id);

        if (!Number.isInteger(emergencyId)) {
            return res.status(400).json({
                message: "Invalid emergency id"
            });
        }

        try {

            const user = await getUser(req.user.userId);

            if (!user || !user.worker_id) {
                return res.status(400).json({
                    message:
                        "Worker profile is not linked to this account"
                });
            }

            const emergency =
                await getEmergency(emergencyId);

            if (!emergency) {
                return res.status(404).json({
                    message:
                        "Emergency alert not found"
                });
            }

            if (
                emergency.worker_id !==
                user.worker_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            if (
                emergency.status !== "ACTIVE"
            ) {
                return res.status(400).json({
                    message:
                        "Only an ACTIVE emergency can be cancelled"
                });
            }

            const result = await pool.query(
                `UPDATE emergency_alerts
                 SET
                    status = 'CANCELLED',
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                 RETURNING *`,
                [emergencyId]
            );

            res.json({
                message:
                    "Emergency cancelled successfully",
                emergency: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Cancel emergency error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to cancel emergency"
            });
        }
    }
);


module.exports = router;