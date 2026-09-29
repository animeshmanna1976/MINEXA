const express = require("express");
const router = express.Router();

const pool = require("../db");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");


// ======================================================
// Helper: Get user's mine
// ======================================================

async function getUserMine(userId) {
    const result = await pool.query(
        `SELECT mine_id, worker_id, role
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
// 1. CREATE EQUIPMENT INSPECTION
// ======================================================

router.post(
    "/",
    auth,
    authorize("PLATFORM_ADMIN", "MINE_MANAGER", "SAFETY_OFFICER"),
    async (req, res) => {

        const {
            equipmentId,
            inspectionType,
            result,
            remarks,
            nextInspectionDate
        } = req.body;

        if (!equipmentId || !inspectionType || !result) {
            return res.status(400).json({
                message:
                    "equipmentId, inspectionType and result are required"
            });
        }

        const allowedResults = [
            "PASS",
            "FAIL",
            "CONDITIONAL"
        ];

        if (!allowedResults.includes(result)) {
            return res.status(400).json({
                message: "Invalid inspection result"
            });
        }

        try {

            const user = await getUserMine(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            // --------------------------------------------------
            // Get equipment
            // --------------------------------------------------

            const equipmentResult = await pool.query(
                `SELECT *
                 FROM equipment
                 WHERE id = $1`,
                [equipmentId]
            );

            if (equipmentResult.rows.length === 0) {
                return res.status(404).json({
                    message: "Equipment not found"
                });
            }

            const equipment = equipmentResult.rows[0];

            // --------------------------------------------------
            // Platform admin can inspect any mine
            // --------------------------------------------------

            if (
                user.role !== "PLATFORM_ADMIN" &&
                equipment.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message:
                        "You cannot inspect equipment from another mine"
                });
            }

            // --------------------------------------------------
            // Insert inspection
            // --------------------------------------------------

            const inspection = await pool.query(
                `INSERT INTO equipment_inspections
                (
                    equipment_id,
                    inspected_by,
                    inspection_type,
                    result,
                    remarks,
                    next_inspection_date
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6
                )
                RETURNING *`,
                [
                    equipmentId,
                    req.user.userId,
                    inspectionType,
                    result,
                    remarks || null,
                    nextInspectionDate || null
                ]
            );

            // --------------------------------------------------
            // Update equipment status automatically
            // --------------------------------------------------

            if (result === "FAIL") {

                await pool.query(
                    `UPDATE equipment
                     SET
                        status = 'OUT_OF_SERVICE',
                        assigned_worker_id = NULL,
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [equipmentId]
                );

            } else if (result === "PASS") {

                await pool.query(
                    `UPDATE equipment
                     SET
                        status = 'AVAILABLE',
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1
                       AND status != 'OUT_OF_SERVICE'`,
                    [equipmentId]
                );

            } else if (result === "CONDITIONAL") {

                await pool.query(
                    `UPDATE equipment
                     SET
                        status = 'MAINTENANCE',
                        assigned_worker_id = NULL,
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [equipmentId]
                );
            }

            res.status(201).json({
                message: "Equipment inspection recorded successfully",
                inspection: inspection.rows[0]
            });

        } catch (error) {

            console.error(
                "Create equipment inspection error:",
                error
            );

            res.status(500).json({
                message: "Failed to create equipment inspection"
            });
        }
    }
);


// ======================================================
// 2. GET INSPECTIONS FOR ONE EQUIPMENT
// ======================================================

router.get(
    "/equipment/:equipmentId",
    auth,
    async (req, res) => {

        const equipmentId = req.params.equipmentId;

        try {

            const user = await getUserMine(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const equipmentResult = await pool.query(
                `SELECT *
                 FROM equipment
                 WHERE id = $1`,
                [equipmentId]
            );

            if (equipmentResult.rows.length === 0) {
                return res.status(404).json({
                    message: "Equipment not found"
                });
            }

            const equipment = equipmentResult.rows[0];

            // --------------------------------------------------
            // Check mine access
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
            // Worker can only view assigned equipment
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
                    ei.*,
                    u.name AS inspector_name,
                    u.email AS inspector_email
                 FROM equipment_inspections ei
                 JOIN users u
                    ON ei.inspected_by = u.id
                 WHERE ei.equipment_id = $1
                 ORDER BY ei.inspection_date DESC`,
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
                inspections: result.rows
            });

        } catch (error) {

            console.error(
                "Get equipment inspections error:",
                error
            );

            res.status(500).json({
                message: "Failed to fetch inspections"
            });
        }
    }
);


// ======================================================
// 3. GET ALL INSPECTIONS FOR MINE
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

            const user = await getUserMine(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            let result;

            if (user.role === "PLATFORM_ADMIN") {

                result = await pool.query(
                    `SELECT
                        ei.*,

                        e.equipment_code,
                        e.name AS equipment_name,
                        e.equipment_type,
                        e.status AS equipment_status,
                        e.mine_id,

                        u.name AS inspector_name

                     FROM equipment_inspections ei

                     JOIN equipment e
                        ON ei.equipment_id = e.id

                     JOIN users u
                        ON ei.inspected_by = u.id

                     ORDER BY ei.inspection_date DESC`
                );

            } else {

                result = await pool.query(
                    `SELECT
                        ei.*,

                        e.equipment_code,
                        e.name AS equipment_name,
                        e.equipment_type,
                        e.status AS equipment_status,
                        e.mine_id,

                        u.name AS inspector_name

                     FROM equipment_inspections ei

                     JOIN equipment e
                        ON ei.equipment_id = e.id

                     JOIN users u
                        ON ei.inspected_by = u.id

                     WHERE e.mine_id = $1

                     ORDER BY ei.inspection_date DESC`,
                    [user.mine_id]
                );
            }

            res.json({
                count: result.rows.length,
                inspections: result.rows
            });

        } catch (error) {

            console.error(
                "Get mine inspections error:",
                error
            );

            res.status(500).json({
                message: "Failed to fetch mine inspections"
            });
        }
    }
);


// ======================================================
// 4. GET SINGLE INSPECTION
// ======================================================

router.get(
    "/:id",
    auth,
    async (req, res) => {

        const inspectionId = req.params.id;

        try {

            const user = await getUserMine(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const result = await pool.query(
                `SELECT
                    ei.*,

                    e.equipment_code,
                    e.name AS equipment_name,
                    e.equipment_type,
                    e.status AS equipment_status,
                    e.mine_id,

                    u.name AS inspector_name,
                    u.email AS inspector_email

                 FROM equipment_inspections ei

                 JOIN equipment e
                    ON ei.equipment_id = e.id

                 JOIN users u
                    ON ei.inspected_by = u.id

                 WHERE ei.id = $1`,
                [inspectionId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Inspection not found"
                });
            }

            const inspection = result.rows[0];

            // --------------------------------------------------
            // Mine access
            // --------------------------------------------------

            if (
                user.role !== "PLATFORM_ADMIN" &&
                inspection.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            // --------------------------------------------------
            // Worker restriction
            // --------------------------------------------------

            if (user.role === "FIELD_WORKER") {

                const equipmentResult = await pool.query(
                    `SELECT assigned_worker_id
                     FROM equipment
                     WHERE id = $1`,
                    [inspection.equipment_id]
                );

                if (
                    equipmentResult.rows.length === 0 ||
                    equipmentResult.rows[0].assigned_worker_id !==
                        user.worker_id
                ) {
                    return res.status(403).json({
                        message: "Access denied"
                    });
                }
            }

            res.json(inspection);

        } catch (error) {

            console.error(
                "Get inspection error:",
                error
            );

            res.status(500).json({
                message: "Failed to fetch inspection"
            });
        }
    }
);


module.exports = router;