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
        `SELECT id, mine_id, worker_id, role
         FROM users
         WHERE id = $1`,
        [userId]
    );

    return result.rows[0] || null;
}


// ======================================================
// 1. CREATE PPE INSPECTION
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
            ppeInventoryId,
            result,
            condition,
            remarks,
            nextInspectionDate
        } = req.body;

        if (
            !ppeInventoryId ||
            !result ||
            !condition
        ) {
            return res.status(400).json({
                message:
                    "ppeInventoryId, result and condition are required"
            });
        }

        const allowedResults = [
            "PASS",
            "FAIL",
            "CONDITIONAL"
        ];

        const allowedConditions = [
            "NEW",
            "GOOD",
            "WORN",
            "DAMAGED"
        ];

        if (!allowedResults.includes(result)) {
            return res.status(400).json({
                message:
                    "Invalid PPE inspection result"
            });
        }

        if (!allowedConditions.includes(condition)) {
            return res.status(400).json({
                message:
                    "Invalid PPE condition"
            });
        }

        try {

            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const ppeResult = await pool.query(
                `SELECT *
                 FROM ppe_inventory
                 WHERE id = $1`,
                [ppeInventoryId]
            );

            if (ppeResult.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "PPE item not found"
                });
            }

            const ppe = ppeResult.rows[0];

            if (
                user.role !== "PLATFORM_ADMIN" &&
                ppe.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message:
                        "You cannot inspect PPE from another mine"
                });
            }

            const client = await pool.connect();

            try {

                await client.query("BEGIN");

                const inspectionResult =
                    await client.query(
                        `INSERT INTO ppe_inspections
                        (
                            ppe_inventory_id,
                            inspected_by,
                            result,
                            condition,
                            remarks,
                            next_inspection_date
                        )
                        VALUES
                        (
                            $1,$2,$3,$4,$5,$6
                        )
                        RETURNING *`,
                        [
                            ppeInventoryId,
                            user.id,
                            result,
                            condition,
                            remarks || null,
                            nextInspectionDate || null
                        ]
                    );

                // --------------------------------------------------
                // Automatic PPE status
                // --------------------------------------------------
                
let ppeStatus = ppe.status;

if (result === "FAIL") {

    ppeStatus = "DAMAGED";

} else if (result === "CONDITIONAL") {

    ppeStatus = "UNDER_INSPECTION";

} else if (condition === "DAMAGED") {

    ppeStatus = "DAMAGED";

} else if (
    ppe.expiry_date &&
    new Date(ppe.expiry_date) < new Date()
) {

    ppeStatus = "EXPIRED";

} else if (ppe.status === "ASSIGNED") {

    ppeStatus = "ASSIGNED";

} else {

    ppeStatus = "AVAILABLE";
}

                await client.query(
                    `UPDATE ppe_inventory
                     SET
                        condition = $1,
                        status = $2,
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = $3`,
                    [
                        condition,
                        ppeStatus,
                        ppeInventoryId
                    ]
                );

                // --------------------------------------------------
                // If PPE failed, close active assignment
                // --------------------------------------------------

                if (
                    result === "FAIL" ||
                    condition === "DAMAGED" ||
                    ppeStatus === "EXPIRED"
                ) {

                    await client.query(
                        `UPDATE worker_ppe_assignments
                         SET
                            status = 'REPLACED',
                            updated_at = CURRENT_TIMESTAMP
                         WHERE ppe_inventory_id = $1
                           AND status = 'ACTIVE'`,
                        [ppeInventoryId]
                    );
                }

                await client.query("COMMIT");

                res.status(201).json({
                    message:
                        "PPE inspection recorded successfully",
                    inspection:
                        inspectionResult.rows[0],
                    ppeStatus
                });

            } catch (error) {

                await client.query("ROLLBACK");
                throw error;

            } finally {

                client.release();
            }

        } catch (error) {

            console.error(
                "Create PPE inspection error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to create PPE inspection"
            });
        }
    }
);


// ======================================================
// 2. GET PPE INSPECTION HISTORY
// ======================================================

router.get(
    "/ppe/:ppeId",
    auth,
    async (req, res) => {

        const ppeId = req.params.ppeId;

        try {

            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const ppeResult = await pool.query(
                `SELECT *
                 FROM ppe_inventory
                 WHERE id = $1`,
                [ppeId]
            );

            if (ppeResult.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "PPE item not found"
                });
            }

            const ppe = ppeResult.rows[0];

            if (
                user.role !== "PLATFORM_ADMIN" &&
                ppe.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            if (user.role === "FIELD_WORKER") {

                const assignment =
                    await pool.query(
                        `SELECT id
                         FROM worker_ppe_assignments
                         WHERE ppe_inventory_id = $1
                           AND worker_id = $2
                         LIMIT 1`,
                        [
                            ppeId,
                            user.worker_id
                        ]
                    );

                if (assignment.rows.length === 0) {
                    return res.status(403).json({
                        message:
                            "You do not have access to this PPE"
                    });
                }
            }

            const result = await pool.query(
                `SELECT
                    pi.*,

                    u.name AS inspector_name,

                    ppe.name AS ppe_type_name

                 FROM ppe_inspections pi

                 JOIN users u
                    ON pi.inspected_by = u.id

                 JOIN ppe_inventory inv
                    ON pi.ppe_inventory_id = inv.id

                 JOIN ppe_types ppe
                    ON inv.ppe_type_id = ppe.id

                 WHERE pi.ppe_inventory_id = $1

                 ORDER BY
                    pi.inspection_date DESC,
                    pi.id DESC`,
                [ppeId]
            );

            res.json({
                ppe: {
                    id: ppe.id,
                    itemCode: ppe.item_code,
                    status: ppe.status,
                    condition: ppe.condition
                },

                count: result.rows.length,

                inspections: result.rows
            });

        } catch (error) {

            console.error(
                "Get PPE inspections error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch PPE inspections"
            });
        }
    }
);


// ======================================================
// 3. GET ALL PPE INSPECTIONS FOR MINE
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

            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            let result;

            const baseQuery = `
                SELECT
                    pi.*,

                    inv.item_code,
                    inv.size,
                    inv.status AS ppe_status,
                    inv.mine_id,

                    pt.name AS ppe_type_name,
                    pt.category,

                    u.name AS inspector_name

                FROM ppe_inspections pi

                JOIN ppe_inventory inv
                    ON pi.ppe_inventory_id = inv.id

                JOIN ppe_types pt
                    ON inv.ppe_type_id = pt.id

                JOIN users u
                    ON pi.inspected_by = u.id
            `;

            if (user.role === "PLATFORM_ADMIN") {

                result = await pool.query(
                    `${baseQuery}
                     ORDER BY
                        pi.inspection_date DESC`
                );

            } else {

                result = await pool.query(
                    `${baseQuery}
                     WHERE inv.mine_id = $1
                     ORDER BY
                        pi.inspection_date DESC`,
                    [user.mine_id]
                );
            }

            res.json({
                count: result.rows.length,
                inspections: result.rows
            });

        } catch (error) {

            console.error(
                "Get mine PPE inspections error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch PPE inspections"
            });
        }
    }
);


// ======================================================
// 4. GET SINGLE PPE INSPECTION
// ======================================================

router.get(
    "/:id",
    auth,
    async (req, res) => {

        const inspectionId = req.params.id;

        try {

            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const result = await pool.query(
                `SELECT
                    pi.*,

                    inv.item_code,
                    inv.size,
                    inv.status AS ppe_status,
                    inv.condition AS ppe_condition,
                    inv.mine_id,

                    pt.name AS ppe_type_name,
                    pt.category,

                    u.name AS inspector_name,
                    u.email AS inspector_email

                 FROM ppe_inspections pi

                 JOIN ppe_inventory inv
                    ON pi.ppe_inventory_id = inv.id

                 JOIN ppe_types pt
                    ON inv.ppe_type_id = pt.id

                 JOIN users u
                    ON pi.inspected_by = u.id

                 WHERE pi.id = $1`,
                [inspectionId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "PPE inspection not found"
                });
            }

            const inspection = result.rows[0];

            if (
                user.role !== "PLATFORM_ADMIN" &&
                inspection.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            res.json(inspection);

        } catch (error) {

            console.error(
                "Get PPE inspection error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch PPE inspection"
            });
        }
    }
);


module.exports = router;