const express = require("express");
const router = express.Router();

const pool = require("../db");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");


// ======================================================
// Helper: Get current user's mine
// ======================================================

async function getUserInfo(userId) {
    const result = await pool.query(
        `SELECT id, mine_id, worker_id, role
         FROM users
         WHERE id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}


// ======================================================
// Helper: Check equipment access
// ======================================================

async function getEquipment(equipmentId) {
    const result = await pool.query(
        `SELECT *
         FROM equipment
         WHERE id = $1`,
        [equipmentId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}


// ======================================================
// 1. CREATE MAINTENANCE RECORD
// ======================================================

router.post(
    "/",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const {
            equipmentId,
            maintenanceType,
            description,
            priority,
            scheduledDate,
            technicianName,
            cost,
            remarks
        } = req.body;

        if (!equipmentId || !maintenanceType || !description) {
            return res.status(400).json({
                message:
                    "equipmentId, maintenanceType and description are required"
            });
        }

        const allowedPriorities = [
            "LOW",
            "MEDIUM",
            "HIGH",
            "CRITICAL"
        ];

        const selectedPriority = priority || "MEDIUM";

        if (!allowedPriorities.includes(selectedPriority)) {
            return res.status(400).json({
                message: "Invalid maintenance priority"
            });
        }

        if (cost !== undefined && cost !== null) {

            if (isNaN(Number(cost)) || Number(cost) < 0) {
                return res.status(400).json({
                    message: "Cost must be a valid non-negative number"
                });
            }
        }

        try {

            const user = await getUserInfo(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const equipment = await getEquipment(equipmentId);

            if (!equipment) {
                return res.status(404).json({
                    message: "Equipment not found"
                });
            }

            // --------------------------------------------------
            // Mine isolation
            // --------------------------------------------------

            if (
                user.role !== "PLATFORM_ADMIN" &&
                equipment.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message:
                        "You cannot create maintenance for equipment from another mine"
                });
            }

            // --------------------------------------------------
            // Transaction
            // --------------------------------------------------

            const client = await pool.connect();

            try {

                await client.query("BEGIN");

                const maintenanceResult = await client.query(
                    `INSERT INTO equipment_maintenance
                    (
                        equipment_id,
                        reported_by,
                        maintenance_type,
                        description,
                        priority,
                        scheduled_date,
                        technician_name,
                        cost,
                        remarks
                    )
                    VALUES
                    (
                        $1,$2,$3,$4,$5,$6,$7,$8,$9
                    )
                    RETURNING *`,
                    [
                        equipmentId,
                        req.user.userId,
                        maintenanceType,
                        description,
                        selectedPriority,
                        scheduledDate || null,
                        technicianName || null,
                        cost !== undefined &&
                        cost !== null &&
                        cost !== ""
                            ? Number(cost)
                            : null,
                        remarks || null
                    ]
                );

                // --------------------------------------------------
                // Equipment becomes MAINTENANCE
                // --------------------------------------------------

                await client.query(
                    `UPDATE equipment
                     SET
                        status = 'MAINTENANCE',
                        assigned_worker_id = NULL,
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [equipmentId]
                );

                await client.query("COMMIT");

                res.status(201).json({
                    message:
                        "Maintenance record created successfully",
                    maintenance: maintenanceResult.rows[0]
                });

            } catch (error) {

                await client.query("ROLLBACK");
                throw error;

            } finally {

                client.release();
            }

        } catch (error) {

            console.error(
                "Create maintenance error:",
                error
            );

            res.status(500).json({
                message: "Failed to create maintenance record"
            });
        }
    }
);


// ======================================================
// 2. GET ALL MAINTENANCE FOR MINE
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

            const user = await getUserInfo(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            let result;

            if (user.role === "PLATFORM_ADMIN") {

                result = await pool.query(
                    `SELECT
                        em.*,

                        e.equipment_code,
                        e.name AS equipment_name,
                        e.equipment_type,
                        e.status AS equipment_status,
                        e.mine_id,

                        u.name AS reporter_name,
                        u.email AS reporter_email

                     FROM equipment_maintenance em

                     JOIN equipment e
                        ON em.equipment_id = e.id

                     JOIN users u
                        ON em.reported_by = u.id

                     ORDER BY em.created_at DESC`
                );

            } else {

                result = await pool.query(
                    `SELECT
                        em.*,

                        e.equipment_code,
                        e.name AS equipment_name,
                        e.equipment_type,
                        e.status AS equipment_status,
                        e.mine_id,

                        u.name AS reporter_name,
                        u.email AS reporter_email

                     FROM equipment_maintenance em

                     JOIN equipment e
                        ON em.equipment_id = e.id

                     JOIN users u
                        ON em.reported_by = u.id

                     WHERE e.mine_id = $1

                     ORDER BY em.created_at DESC`,
                    [user.mine_id]
                );
            }

            res.json({
                count: result.rows.length,
                maintenance: result.rows
            });

        } catch (error) {

            console.error(
                "Get mine maintenance error:",
                error
            );

            res.status(500).json({
                message: "Failed to fetch maintenance records"
            });
        }
    }
);


// ======================================================
// 3. GET MAINTENANCE HISTORY FOR EQUIPMENT
// ======================================================

router.get(
    "/equipment/:equipmentId",
    auth,
    async (req, res) => {

        const equipmentId = req.params.equipmentId;

        try {

            const user = await getUserInfo(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const equipment = await getEquipment(equipmentId);

            if (!equipment) {
                return res.status(404).json({
                    message: "Equipment not found"
                });
            }

            // --------------------------------------------------
            // Mine access
            // --------------------------------------------------

            if (
                user.role !== "PLATFORM_ADMIN" &&
                equipment.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            // --------------------------------------------------
            // Worker can only see assigned equipment
            // --------------------------------------------------

            if (user.role === "FIELD_WORKER") {

                if (
                    equipment.assigned_worker_id !== user.worker_id
                ) {
                    return res.status(403).json({
                        message:
                            "This equipment is not assigned to you"
                    });
                }
            }

            const result = await pool.query(
                `SELECT
                    em.*,
                    u.name AS reporter_name,
                    u.email AS reporter_email
                 FROM equipment_maintenance em
                 JOIN users u
                    ON em.reported_by = u.id
                 WHERE em.equipment_id = $1
                 ORDER BY em.created_at DESC`,
                [equipmentId]
            );

            res.json({
                equipment: {
                    id: equipment.id,
                    equipmentCode: equipment.equipment_code,
                    name: equipment.name,
                    status: equipment.status
                },

                count: result.rows.length,

                maintenance: result.rows
            });

        } catch (error) {

            console.error(
                "Get equipment maintenance error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch equipment maintenance"
            });
        }
    }
);


// ======================================================
// 4. GET SINGLE MAINTENANCE RECORD
// ======================================================

router.get(
    "/:id",
    auth,
    async (req, res) => {

        const maintenanceId = req.params.id;

        try {

            const user = await getUserInfo(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const result = await pool.query(
                `SELECT
                    em.*,

                    e.equipment_code,
                    e.name AS equipment_name,
                    e.equipment_type,
                    e.status AS equipment_status,
                    e.mine_id,

                    u.name AS reporter_name,
                    u.email AS reporter_email

                 FROM equipment_maintenance em

                 JOIN equipment e
                    ON em.equipment_id = e.id

                 JOIN users u
                    ON em.reported_by = u.id

                 WHERE em.id = $1`,
                [maintenanceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Maintenance record not found"
                });
            }

            const maintenance = result.rows[0];

            // --------------------------------------------------
            // Mine access
            // --------------------------------------------------

            if (
                user.role !== "PLATFORM_ADMIN" &&
                maintenance.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            // --------------------------------------------------
            // Worker access
            // --------------------------------------------------

            if (user.role === "FIELD_WORKER") {

                const equipment = await getEquipment(
                    maintenance.equipment_id
                );

                if (
                    !equipment ||
                    equipment.assigned_worker_id !==
                        user.worker_id
                ) {
                    return res.status(403).json({
                        message: "Access denied"
                    });
                }
            }

            res.json(maintenance);

        } catch (error) {

            console.error(
                "Get maintenance error:",
                error
            );

            res.status(500).json({
                message: "Failed to fetch maintenance record"
            });
        }
    }
);


// ======================================================
// 5. UPDATE MAINTENANCE DETAILS
// ======================================================

router.patch(
    "/:id",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const maintenanceId = req.params.id;

        const {
            maintenanceType,
            description,
            priority,
            scheduledDate,
            technicianName,
            cost,
            remarks
        } = req.body;

        const allowedPriorities = [
            "LOW",
            "MEDIUM",
            "HIGH",
            "CRITICAL"
        ];

        if (
            priority !== undefined &&
            !allowedPriorities.includes(priority)
        ) {
            return res.status(400).json({
                message: "Invalid maintenance priority"
            });
        }

        try {

            const user = await getUserInfo(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const existingResult = await pool.query(
                `SELECT
                    em.*,
                    e.mine_id
                 FROM equipment_maintenance em
                 JOIN equipment e
                    ON em.equipment_id = e.id
                 WHERE em.id = $1`,
                [maintenanceId]
            );

            if (existingResult.rows.length === 0) {
                return res.status(404).json({
                    message: "Maintenance record not found"
                });
            }

            const existing = existingResult.rows[0];

            if (
                user.role !== "PLATFORM_ADMIN" &&
                existing.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            const result = await pool.query(
                `UPDATE equipment_maintenance
                 SET
                    maintenance_type =
                        COALESCE($1, maintenance_type),

                    description =
                        COALESCE($2, description),

                    priority =
                        COALESCE($3, priority),

                    scheduled_date =
                        COALESCE($4, scheduled_date),

                    technician_name =
                        COALESCE($5, technician_name),

                    cost =
                        COALESCE($6, cost),

                    remarks =
                        COALESCE($7, remarks),

                    updated_at =
                        CURRENT_TIMESTAMP

                 WHERE id = $8

                 RETURNING *`,
                [
                    maintenanceType,
                    description,
                    priority,
                    scheduledDate,
                    technicianName,
                    cost !== undefined &&
                    cost !== null &&
                    cost !== ""
                        ? Number(cost)
                        : null,
                    remarks,
                    maintenanceId
                ]
            );

            res.json({
                message:
                    "Maintenance record updated successfully",
                maintenance: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Update maintenance error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to update maintenance record"
            });
        }
    }
);


// ======================================================
// 6. CHANGE MAINTENANCE STATUS
// ======================================================

router.patch(
    "/:id/status",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const maintenanceId = req.params.id;
        const { status } = req.body;

        const allowedStatuses = [
            "OPEN",
            "IN_PROGRESS",
            "COMPLETED",
            "CANCELLED"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Invalid maintenance status"
            });
        }

        try {

            const user = await getUserInfo(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const client = await pool.connect();

            try {

                await client.query("BEGIN");

                // --------------------------------------------------
                // Get maintenance + equipment
                // --------------------------------------------------

                const maintenanceResult = await client.query(
                    `SELECT
                        em.*,
                        e.mine_id,
                        e.status AS equipment_status
                     FROM equipment_maintenance em
                     JOIN equipment e
                        ON em.equipment_id = e.id
                     WHERE em.id = $1`,
                    [maintenanceId]
                );

                if (maintenanceResult.rows.length === 0) {

                    await client.query("ROLLBACK");

                    return res.status(404).json({
                        message:
                            "Maintenance record not found"
                    });
                }

                const maintenance =
                    maintenanceResult.rows[0];

                // --------------------------------------------------
                // Mine access
                // --------------------------------------------------

                if (
                    user.role !== "PLATFORM_ADMIN" &&
                    maintenance.mine_id !== user.mine_id
                ) {

                    await client.query("ROLLBACK");

                    return res.status(403).json({
                        message: "Access denied"
                    });
                }

                // --------------------------------------------------
                // Prevent changing completed/cancelled records
                // --------------------------------------------------

                if (
                    (
                        maintenance.status === "COMPLETED" ||
                        maintenance.status === "CANCELLED"
                    ) &&
                    maintenance.status !== status
                ) {

                    await client.query("ROLLBACK");

                    return res.status(400).json({
                        message:
                            "Completed or cancelled maintenance cannot be changed"
                    });
                }

                // --------------------------------------------------
                // COMPLETED
                // --------------------------------------------------

                if (status === "COMPLETED") {

                    /*
                        Before making equipment AVAILABLE,
                        check the latest inspection.

                        PASS        -> AVAILABLE
                        FAIL        -> OUT_OF_SERVICE
                        CONDITIONAL -> MAINTENANCE
                        No inspection -> MAINTENANCE
                    */

                    const inspectionResult =
                        await client.query(
                            `SELECT result
                             FROM equipment_inspections
                             WHERE equipment_id = $1
                             ORDER BY inspection_date DESC, id DESC
                             LIMIT 1`,
                            [maintenance.equipment_id]
                        );

                    let equipmentStatus = "MAINTENANCE";

                    if (
                        inspectionResult.rows.length > 0
                    ) {

                        const latestResult =
                            inspectionResult.rows[0].result;

                        if (latestResult === "PASS") {
                            equipmentStatus = "AVAILABLE";
                        }

                        if (latestResult === "FAIL") {
                            equipmentStatus = "OUT_OF_SERVICE";
                        }

                        if (
                            latestResult ===
                            "CONDITIONAL"
                        ) {
                            equipmentStatus = "MAINTENANCE";
                        }
                    }

                    const updatedMaintenance =
                        await client.query(
                            `UPDATE equipment_maintenance
                             SET
                                status = 'COMPLETED',
                                completed_at = CURRENT_TIMESTAMP,
                                updated_at = CURRENT_TIMESTAMP
                             WHERE id = $1
                             RETURNING *`,
                            [maintenanceId]
                        );

                    await client.query(
                        `UPDATE equipment
                         SET
                            status = $1,
                            last_service_date = CURRENT_DATE,
                            updated_at = CURRENT_TIMESTAMP
                         WHERE id = $2`,
                        [
                            equipmentStatus,
                            maintenance.equipment_id
                        ]
                    );

                    await client.query("COMMIT");

                    return res.json({
                        message:
                            "Maintenance completed successfully",
                        maintenance:
                            updatedMaintenance.rows[0],
                        equipmentStatus
                    });
                }

                // --------------------------------------------------
                // IN_PROGRESS
                // --------------------------------------------------

                if (status === "IN_PROGRESS") {

                    const result = await client.query(
                        `UPDATE equipment_maintenance
                         SET
                            status = 'IN_PROGRESS',
                            started_at =
                                COALESCE(
                                    started_at,
                                    CURRENT_TIMESTAMP
                                ),
                            updated_at =
                                CURRENT_TIMESTAMP
                         WHERE id = $1
                         RETURNING *`,
                        [maintenanceId]
                    );

                    await client.query(
                        `UPDATE equipment
                         SET
                            status = 'MAINTENANCE',
                            assigned_worker_id = NULL,
                            updated_at = CURRENT_TIMESTAMP
                         WHERE id = $1`,
                        [maintenance.equipment_id]
                    );

                    await client.query("COMMIT");

                    return res.json({
                        message:
                            "Maintenance started successfully",
                        maintenance: result.rows[0]
                    });
                }

                // --------------------------------------------------
                // OPEN
                // --------------------------------------------------

                if (status === "OPEN") {

                    const result = await client.query(
                        `UPDATE equipment_maintenance
                         SET
                            status = 'OPEN',
                            updated_at =
                                CURRENT_TIMESTAMP
                         WHERE id = $1
                         RETURNING *`,
                        [maintenanceId]
                    );

                    await client.query(
                        `UPDATE equipment
                         SET
                            status = 'MAINTENANCE',
                            assigned_worker_id = NULL,
                            updated_at =
                                CURRENT_TIMESTAMP
                         WHERE id = $1`,
                        [maintenance.equipment_id]
                    );

                    await client.query("COMMIT");

                    return res.json({
                        message:
                            "Maintenance reopened successfully",
                        maintenance: result.rows[0]
                    });
                }

                // --------------------------------------------------
                // CANCELLED
                // --------------------------------------------------

                if (status === "CANCELLED") {

                    const result = await client.query(
                        `UPDATE equipment_maintenance
                         SET
                            status = 'CANCELLED',
                            updated_at =
                                CURRENT_TIMESTAMP
                         WHERE id = $1
                         RETURNING *`,
                        [maintenanceId]
                    );

                    /*
                        Do NOT automatically make the equipment
                        AVAILABLE after cancellation.

                        It remains MAINTENANCE until a valid
                        safety inspection confirms that it is safe.
                    */

                    await client.query("COMMIT");

                    return res.json({
                        message:
                            "Maintenance cancelled successfully",
                        maintenance: result.rows[0],
                        equipmentStatus:
                            "MAINTENANCE"
                    });
                }

            } catch (error) {

                await client.query("ROLLBACK");
                throw error;

            } finally {

                client.release();
            }

        } catch (error) {

            console.error(
                "Maintenance status error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to update maintenance status"
            });
        }
    }
);


module.exports = router;