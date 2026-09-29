const express = require("express");
const router = express.Router();

const pool = require("../db");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");


// ======================================================
// Helper: current user
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
// Helper: get checklist and verify mine access
// ======================================================

async function getChecklist(checklistId) {
    const result = await pool.query(
        `SELECT *
         FROM safety_checklists
         WHERE id = $1`,
        [checklistId]
    );

    return result.rows[0] || null;
}


// ======================================================
// 1. CREATE CHECKLIST
// ======================================================

router.post(
    "/",
    auth,
    authorize("PLATFORM_ADMIN", "MINE_MANAGER", "SAFETY_OFFICER"),
    async (req, res) => {

        const {
            name,
            description,
            equipmentType
        } = req.body;

        if (!name) {
            return res.status(400).json({
                message: "Checklist name is required"
            });
        }

        try {
            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            let mineId = user.mine_id;

            if (user.role === "PLATFORM_ADMIN") {
                mineId = req.body.mineId;

                if (!mineId) {
                    return res.status(400).json({
                        message: "mineId is required for platform admin"
                    });
                }
            }

            const result = await pool.query(
                `INSERT INTO safety_checklists
                (
                    mine_id,
                    name,
                    description,
                    equipment_type,
                    created_by
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *`,
                [
                    mineId,
                    name,
                    description || null,
                    equipmentType || null,
                    user.id
                ]
            );

            res.status(201).json({
                message: "Safety checklist created successfully",
                checklist: result.rows[0]
            });

        } catch (error) {
            console.error("Create checklist error:", error);

            res.status(500).json({
                message: "Failed to create checklist"
            });
        }
    }
);


// ======================================================
// 2. GET CHECKLISTS FOR MINE
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

            if (user.role === "PLATFORM_ADMIN") {

                result = await pool.query(
                    `SELECT
                        sc.*,
                        u.name AS creator_name,
                        COUNT(sci.id)::INTEGER AS item_count
                     FROM safety_checklists sc
                     LEFT JOIN users u
                        ON sc.created_by = u.id
                     LEFT JOIN safety_checklist_items sci
                        ON sc.id = sci.checklist_id
                     GROUP BY sc.id, u.name
                     ORDER BY sc.created_at DESC`
                );

            } else {

                result = await pool.query(
                    `SELECT
                        sc.*,
                        u.name AS creator_name,
                        COUNT(sci.id)::INTEGER AS item_count
                     FROM safety_checklists sc
                     LEFT JOIN users u
                        ON sc.created_by = u.id
                     LEFT JOIN safety_checklist_items sci
                        ON sc.id = sci.checklist_id
                     WHERE sc.mine_id = $1
                     GROUP BY sc.id, u.name
                     ORDER BY sc.created_at DESC`,
                    [user.mine_id]
                );
            }

            res.json({
                count: result.rows.length,
                checklists: result.rows
            });

        } catch (error) {
            console.error("Get checklists error:", error);

            res.status(500).json({
                message: "Failed to fetch checklists"
            });
        }
    }
);


// ======================================================
// 3. ADD CHECKLIST ITEM
// ======================================================

router.post(
    "/:id/items",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const checklistId = req.params.id;

        const {
            itemName,
            description,
            itemOrder,
            isCritical
        } = req.body;

        if (!itemName) {
            return res.status(400).json({
                message: "itemName is required"
            });
        }

        try {
            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const checklist = await getChecklist(checklistId);

            if (!checklist) {
                return res.status(404).json({
                    message: "Checklist not found"
                });
            }

            if (
                user.role !== "PLATFORM_ADMIN" &&
                checklist.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            const result = await pool.query(
                `INSERT INTO safety_checklist_items
                (
                    checklist_id,
                    item_name,
                    description,
                    item_order,
                    is_critical
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *`,
                [
                    checklistId,
                    itemName,
                    description || null,
                    itemOrder || 1,
                    isCritical === true
                ]
            );

            res.status(201).json({
                message: "Checklist item added successfully",
                item: result.rows[0]
            });

        } catch (error) {
            console.error("Add checklist item error:", error);

            res.status(500).json({
                message: "Failed to add checklist item"
            });
        }
    }
);


// ======================================================
// 4. GET SINGLE CHECKLIST WITH ITEMS
// ======================================================

router.get(
    "/:id",
    auth,
    async (req, res) => {

        const checklistId = req.params.id;

        try {
            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const checklist = await getChecklist(checklistId);

            if (!checklist) {
                return res.status(404).json({
                    message: "Checklist not found"
                });
            }

            if (
                user.role !== "PLATFORM_ADMIN" &&
                checklist.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            const items = await pool.query(
                `SELECT *
                 FROM safety_checklist_items
                 WHERE checklist_id = $1
                 ORDER BY item_order ASC, id ASC`,
                [checklistId]
            );

            res.json({
                checklist,
                items: items.rows
            });

        } catch (error) {
            console.error("Get checklist error:", error);

            res.status(500).json({
                message: "Failed to fetch checklist"
            });
        }
    }
);


// ======================================================
// 5. CREATE SAFETY INSPECTION
// ======================================================

router.post(
    "/inspections",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const {
            equipmentId,
            checklistId,
            overallResult,
            remarks,
            results
        } = req.body;

        if (!equipmentId || !checklistId || !results) {
            return res.status(400).json({
                message:
                    "equipmentId, checklistId and results are required"
            });
        }

        if (!Array.isArray(results) || results.length === 0) {
            return res.status(400).json({
                message:
                    "results must be a non-empty array"
            });
        }

        const allowedItemResults = [
            "PASS",
            "FAIL",
            "NA"
        ];

        try {
            const user = await getUser(req.user.userId);

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
            // Get checklist
            // --------------------------------------------------

            const checklist = await getChecklist(checklistId);

            if (!checklist) {
                return res.status(404).json({
                    message: "Checklist not found"
                });
            }

            // --------------------------------------------------
            // Mine isolation
            // --------------------------------------------------

            if (user.role !== "PLATFORM_ADMIN") {

                if (
                    equipment.mine_id !== user.mine_id ||
                    checklist.mine_id !== user.mine_id
                ) {
                    return res.status(403).json({
                        message:
                            "Equipment and checklist must belong to your mine"
                    });
                }
            }

            // --------------------------------------------------
            // Checklist must match equipment type when defined
            // --------------------------------------------------

            if (
                checklist.equipment_type &&
                checklist.equipment_type !==
                    equipment.equipment_type
            ) {
                return res.status(400).json({
                    message:
                        "This checklist is not applicable to this equipment type"
                });
            }

            // --------------------------------------------------
            // Get checklist items
            // --------------------------------------------------

            const itemResult = await pool.query(
                `SELECT id, is_critical
                 FROM safety_checklist_items
                 WHERE checklist_id = $1`,
                [checklistId]
            );

            if (itemResult.rows.length === 0) {
                return res.status(400).json({
                    message:
                        "Checklist has no items"
                });
            }

            const itemsMap = new Map();

            for (const item of itemResult.rows) {
                itemsMap.set(item.id, item);
            }

            // --------------------------------------------------
            // Validate submitted items
            // --------------------------------------------------

            const submittedIds = new Set();

            for (const item of results) {

                if (!item.checklistItemId || !item.result) {
                    return res.status(400).json({
                        message:
                            "Each result requires checklistItemId and result"
                    });
                }

                if (
                    !allowedItemResults.includes(item.result)
                ) {
                    return res.status(400).json({
                        message:
                            `Invalid result for item ${item.checklistItemId}`
                    });
                }

                if (!itemsMap.has(item.checklistItemId)) {
                    return res.status(400).json({
                        message:
                            `Checklist item ${item.checklistItemId} does not belong to this checklist`
                    });
                }

                if (
                    submittedIds.has(item.checklistItemId)
                ) {
                    return res.status(400).json({
                        message:
                            `Duplicate checklist item ${item.checklistItemId}`
                    });
                }

                submittedIds.add(item.checklistItemId);
            }

            // --------------------------------------------------
            // Require every checklist item
            // --------------------------------------------------

            if (
                submittedIds.size !==
                itemResult.rows.length
            ) {
                return res.status(400).json({
                    message:
                        "All checklist items must have a result"
                });
            }

            // --------------------------------------------------
            // Calculate overall result server-side
            // --------------------------------------------------

            let calculatedResult = "PASS";

            let hasFail = false;
            let hasConditional = false;

            for (const item of results) {

                const definition =
                    itemsMap.get(item.checklistItemId);

                if (
                    definition.is_critical &&
                    item.result === "FAIL"
                ) {
                    hasFail = true;
                    break;
                }

                if (item.result === "FAIL") {
                    hasFail = true;
                }

                if (item.result === "NA") {
                    hasConditional = true;
                }
            }

            if (hasFail) {
                calculatedResult = "FAIL";
            } else if (hasConditional) {
                calculatedResult = "CONDITIONAL";
            }

            // Do not trust client overallResult
            if (
                overallResult &&
                overallResult !== calculatedResult
            ) {
                return res.status(400).json({
                    message:
                        `Overall result must be ${calculatedResult} based on checklist results`
                });
            }

            // --------------------------------------------------
            // Transaction
            // --------------------------------------------------

            const client = await pool.connect();

            try {

                await client.query("BEGIN");

                const inspectionResult =
                    await client.query(
                        `INSERT INTO safety_inspections
                        (
                            equipment_id,
                            checklist_id,
                            inspected_by,
                            overall_result,
                            remarks
                        )
                        VALUES ($1, $2, $3, $4, $5)
                        RETURNING *`,
                        [
                            equipmentId,
                            checklistId,
                            user.id,
                            calculatedResult,
                            remarks || null
                        ]
                    );

                const inspection =
                    inspectionResult.rows[0];

                for (const item of results) {

                    await client.query(
                        `INSERT INTO safety_inspection_results
                        (
                            inspection_id,
                            checklist_item_id,
                            result,
                            remarks
                        )
                        VALUES ($1, $2, $3, $4)`,
                        [
                            inspection.id,
                            item.checklistItemId,
                            item.result,
                            item.remarks || null
                        ]
                    );
                }

                // --------------------------------------------------
                // Update equipment based on result
                // --------------------------------------------------

if (calculatedResult === "FAIL") {

    await client.query(
        `UPDATE equipment
         SET
            status = 'OUT_OF_SERVICE',
            assigned_worker_id = NULL,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [equipmentId]
    );

} else if (calculatedResult === "CONDITIONAL") {

    await client.query(
        `UPDATE equipment
         SET
            status = 'MAINTENANCE',
            assigned_worker_id = NULL,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [equipmentId]
    );

} else {

    /*
        PASS:
        Schedule the next inspection automatically.
    */

    await client.query(
        `UPDATE equipment
         SET
            status = 'AVAILABLE',
            next_inspection_date =
                CURRENT_DATE +
                COALESCE(inspection_frequency_days, 7),
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [equipmentId]
    );
}

                await client.query("COMMIT");

                res.status(201).json({
                    message:
                        "Safety inspection completed successfully",

                    inspection: {
                        ...inspection,
                        equipmentStatus:
                            calculatedResult === "FAIL"
                                ? "OUT_OF_SERVICE"
                                : calculatedResult ===
                                  "CONDITIONAL"
                                    ? "MAINTENANCE"
                                    : "AVAILABLE"
                    }
                });

            } catch (error) {

                await client.query("ROLLBACK");
                throw error;

            } finally {
                client.release();
            }

        } catch (error) {

            console.error(
                "Create safety inspection error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to create safety inspection"
            });
        }
    }
);


// ======================================================
// 6. GET SAFETY INSPECTIONS FOR MINE
// ======================================================

router.get(
    "/inspections/mine",
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

            if (user.role === "PLATFORM_ADMIN") {

                result = await pool.query(
                    `SELECT
                        si.*,

                        e.equipment_code,
                        e.name AS equipment_name,
                        e.equipment_type,
                        e.mine_id,

                        sc.name AS checklist_name,

                        u.name AS inspector_name

                     FROM safety_inspections si

                     JOIN equipment e
                        ON si.equipment_id = e.id

                     JOIN safety_checklists sc
                        ON si.checklist_id = sc.id

                     JOIN users u
                        ON si.inspected_by = u.id

                     ORDER BY si.inspection_date DESC`
                );

            } else {

                result = await pool.query(
                    `SELECT
                        si.*,

                        e.equipment_code,
                        e.name AS equipment_name,
                        e.equipment_type,
                        e.mine_id,

                        sc.name AS checklist_name,

                        u.name AS inspector_name

                     FROM safety_inspections si

                     JOIN equipment e
                        ON si.equipment_id = e.id

                     JOIN safety_checklists sc
                        ON si.checklist_id = sc.id

                     JOIN users u
                        ON si.inspected_by = u.id

                     WHERE e.mine_id = $1

                     ORDER BY si.inspection_date DESC`,
                    [user.mine_id]
                );
            }

            res.json({
                count: result.rows.length,
                inspections: result.rows
            });

        } catch (error) {

            console.error(
                "Get safety inspections error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch safety inspections"
            });
        }
    }
);


// ======================================================
// 7. GET INSPECTIONS FOR EQUIPMENT
// ======================================================

router.get(
    "/inspections/equipment/:equipmentId",
    auth,
    async (req, res) => {

        const equipmentId = req.params.equipmentId;

        try {

            const user = await getUser(req.user.userId);

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

            if (
                user.role !== "PLATFORM_ADMIN" &&
                equipment.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            if (user.role === "FIELD_WORKER") {

                if (
                    equipment.assigned_worker_id !==
                    user.worker_id
                ) {
                    return res.status(403).json({
                        message:
                            "This equipment is not assigned to you"
                    });
                }
            }

            const inspectionResult = await pool.query(
                `SELECT
                    si.*,
                    sc.name AS checklist_name,
                    u.name AS inspector_name
                 FROM safety_inspections si
                 JOIN safety_checklists sc
                    ON si.checklist_id = sc.id
                 JOIN users u
                    ON si.inspected_by = u.id
                 WHERE si.equipment_id = $1
                 ORDER BY si.inspection_date DESC`,
                [equipmentId]
            );

            res.json({
                equipment: {
                    id: equipment.id,
                    equipmentCode:
                        equipment.equipment_code,
                    name: equipment.name,
                    status: equipment.status
                },

                count: inspectionResult.rows.length,

                inspections:
                    inspectionResult.rows
            });

        } catch (error) {

            console.error(
                "Get equipment safety inspections error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch safety inspections"
            });
        }
    }
);


// ======================================================
// 8. GET SINGLE SAFETY INSPECTION
// ======================================================

router.get(
    "/inspections/:id",
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

            const inspectionResult = await pool.query(
                `SELECT
                    si.*,

                    e.equipment_code,
                    e.name AS equipment_name,
                    e.equipment_type,
                    e.mine_id,

                    sc.name AS checklist_name,

                    u.name AS inspector_name,
                    u.email AS inspector_email

                 FROM safety_inspections si

                 JOIN equipment e
                    ON si.equipment_id = e.id

                 JOIN safety_checklists sc
                    ON si.checklist_id = sc.id

                 JOIN users u
                    ON si.inspected_by = u.id

                 WHERE si.id = $1`,
                [inspectionId]
            );

            if (inspectionResult.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Safety inspection not found"
                });
            }

            const inspection =
                inspectionResult.rows[0];

            if (
                user.role !== "PLATFORM_ADMIN" &&
                inspection.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            if (user.role === "FIELD_WORKER") {

                const equipmentResult =
                    await pool.query(
                        `SELECT assigned_worker_id
                         FROM equipment
                         WHERE id = $1`,
                        [inspection.equipment_id]
                    );

                if (
                    equipmentResult.rows.length === 0 ||
                    equipmentResult.rows[0]
                        .assigned_worker_id !==
                        user.worker_id
                ) {
                    return res.status(403).json({
                        message: "Access denied"
                    });
                }
            }

            const resultItems =
                await pool.query(
                    `SELECT
                        sir.*,

                        sci.item_name,
                        sci.description,
                        sci.is_critical,
                        sci.item_order

                     FROM safety_inspection_results sir

                     JOIN safety_checklist_items sci
                        ON sir.checklist_item_id =
                           sci.id

                     WHERE sir.inspection_id = $1

                     ORDER BY
                        sci.item_order ASC,
                        sci.id ASC`,
                    [inspectionId]
                );

            res.json({
                inspection,
                results: resultItems.rows
            });

        } catch (error) {

            console.error(
                "Get safety inspection error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch safety inspection"
            });
        }
    }
);


module.exports = router;