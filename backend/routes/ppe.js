const express = require("express");
const router = express.Router();

const pool = require("../db");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");


// ======================================================
// Helpers
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
// 1. ADD PPE INVENTORY ITEM
// ======================================================

router.post(
    "/",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER"
    ),
    async (req, res) => {

        const {
            ppeTypeId,
            itemCode,
            size,
            condition,
            purchaseDate,
            expiryDate
        } = req.body;

        if (!ppeTypeId || !itemCode) {
            return res.status(400).json({
                message:
                    "ppeTypeId and itemCode are required"
            });
        }

        const allowedConditions = [
            "NEW",
            "GOOD",
            "WORN",
            "DAMAGED"
        ];

        const selectedCondition =
            condition || "NEW";

        if (!allowedConditions.includes(selectedCondition)) {
            return res.status(400).json({
                message: "Invalid PPE condition"
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
                        message:
                            "mineId is required for platform admin"
                    });
                }
            }

            const typeResult = await pool.query(
                `SELECT *
                 FROM ppe_types
                 WHERE id = $1
                   AND mine_id = $2`,
                [ppeTypeId, mineId]
            );

            if (typeResult.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "PPE type not found in this mine"
                });
            }

            let status = "AVAILABLE";

            if (selectedCondition === "DAMAGED") {
                status = "DAMAGED";
            }

            const result = await pool.query(
                `INSERT INTO ppe_inventory
                (
                    ppe_type_id,
                    mine_id,
                    item_code,
                    size,
                    condition,
                    status,
                    purchase_date,
                    expiry_date
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                RETURNING *`,
                [
                    ppeTypeId,
                    mineId,
                    itemCode,
                    size || null,
                    selectedCondition,
                    status,
                    purchaseDate || null,
                    expiryDate || null
                ]
            );

            res.status(201).json({
                message:
                    "PPE inventory item created successfully",
                ppe: result.rows[0]
            });

        } catch (error) {

            console.error("Create PPE error:", error);

            if (error.code === "23505") {
                return res.status(409).json({
                    message:
                        "PPE item code already exists in this mine"
                });
            }

            res.status(500).json({
                message:
                    "Failed to create PPE inventory item"
            });
        }
    }
);


// ======================================================
// 2. GET PPE INVENTORY
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

                    pt.name AS ppe_type_name,
                    pt.category,
                    pt.is_mandatory,

                    w.name AS assigned_worker_name,
                    w.employee_code

                FROM ppe_inventory pi

                JOIN ppe_types pt
                    ON pi.ppe_type_id = pt.id

                LEFT JOIN worker_ppe_assignments wpa
                    ON pi.id = wpa.ppe_inventory_id
                   AND wpa.status = 'ACTIVE'

                LEFT JOIN workers w
                    ON wpa.worker_id = w.id
            `;

            if (user.role === "PLATFORM_ADMIN") {

                result = await pool.query(
                    `${baseQuery}
                     ORDER BY pi.created_at DESC`
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
                     WHERE pi.mine_id = $1
                     ORDER BY pi.created_at DESC`,
                    [user.mine_id]
                );
            }

            res.json({
                count: result.rows.length,
                ppe: result.rows
            });

        } catch (error) {

            console.error("Get PPE inventory error:", error);

            res.status(500).json({
                message:
                    "Failed to fetch PPE inventory"
            });
        }
    }
);

// ======================================================
// 8. GET CURRENT WORKER'S PPE
// ======================================================

router.get(
    "/me",
    auth,
    authorize("FIELD_WORKER"),
    async (req, res) => {

        try {

            if (!req.user.workerId) {
                return res.status(400).json({
                    message:
                        "Worker profile is not linked to this account"
                });
            }

            const result = await pool.query(
                `SELECT
                    wpa.*,

                    pi.item_code,
                    pi.size,
                    pi.condition,
                    pi.status AS ppe_status,
                    pi.expiry_date,

                    pt.name AS ppe_type_name,
                    pt.category,
                    pt.is_mandatory

                 FROM worker_ppe_assignments wpa

                 JOIN ppe_inventory pi
                    ON wpa.ppe_inventory_id = pi.id

                 JOIN ppe_types pt
                    ON pi.ppe_type_id = pt.id

                 WHERE wpa.worker_id = $1
                   AND wpa.status = 'ACTIVE'

                 ORDER BY pt.category, pt.name`,
                [req.user.workerId]
            );

            res.json({
                count: result.rows.length,
                ppe: result.rows
            });

        } catch (error) {

            console.error(
                "Get my PPE error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch your PPE"
            });
        }
    }
);

// ======================================================
// 3. GET PPE ITEM
// ======================================================

router.get(
    "/:id",
    auth,
    async (req, res) => {

        const ppeId = req.params.id;

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

                    pt.name AS ppe_type_name,
                    pt.category,
                    pt.replacement_period_days,
                    pt.is_mandatory,

                    w.name AS assigned_worker_name,
                    w.employee_code

                 FROM ppe_inventory pi

                 JOIN ppe_types pt
                    ON pi.ppe_type_id = pt.id

                 LEFT JOIN worker_ppe_assignments wpa
                    ON pi.id = wpa.ppe_inventory_id
                   AND wpa.status = 'ACTIVE'

                 LEFT JOIN workers w
                    ON wpa.worker_id = w.id

                 WHERE pi.id = $1`,
                [ppeId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "PPE item not found"
                });
            }

            const ppe = result.rows[0];

            if (
                user.role !== "PLATFORM_ADMIN" &&
                ppe.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            if (user.role === "FIELD_WORKER") {

                if (
                    ppe.assigned_worker_id !==
                    user.worker_id
                ) {
                    return res.status(403).json({
                        message:
                            "This PPE is not assigned to you"
                    });
                }
            }

            res.json(ppe);

        } catch (error) {

            console.error("Get PPE error:", error);

            res.status(500).json({
                message:
                    "Failed to fetch PPE item"
            });
        }
    }
);


// ======================================================
// 4. UPDATE PPE STATUS / CONDITION
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

        const ppeId = req.params.id;

        const {
            status,
            condition
        } = req.body;

        const allowedStatuses = [
            "AVAILABLE",
            "ASSIGNED",
            "UNDER_INSPECTION",
            "DAMAGED",
            "EXPIRED",
            "DISPOSED"
        ];

        const allowedConditions = [
            "NEW",
            "GOOD",
            "WORN",
            "DAMAGED"
        ];

        if (
            status !== undefined &&
            !allowedStatuses.includes(status)
        ) {
            return res.status(400).json({
                message:
                    "Invalid PPE status"
            });
        }

        if (
            condition !== undefined &&
            !allowedConditions.includes(condition)
        ) {
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

            const existing = await pool.query(
                `SELECT *
                 FROM ppe_inventory
                 WHERE id = $1`,
                [ppeId]
            );

            if (existing.rows.length === 0) {
                return res.status(404).json({
                    message: "PPE item not found"
                });
            }

            const ppe = existing.rows[0];

            if (
                user.role !== "PLATFORM_ADMIN" &&
                ppe.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            const result = await pool.query(
                `UPDATE ppe_inventory
                 SET
                    status =
                        COALESCE($1, status),

                    condition =
                        COALESCE($2, condition),

                    updated_at =
                        CURRENT_TIMESTAMP

                 WHERE id = $3
                 RETURNING *`,
                [
                    status,
                    condition,
                    ppeId
                ]
            );

            res.json({
                message:
                    "PPE status updated successfully",
                ppe: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Update PPE status error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to update PPE status"
            });
        }
    }
);


// ======================================================
// 5. ASSIGN PPE TO WORKER
// ======================================================

router.post(
    "/assign",
    auth,
    authorize("MINE_MANAGER"),
    async (req, res) => {

        const {
            workerId,
            ppeInventoryId,
            expectedReplacementDate,
            remarks
        } = req.body;

        if (!workerId || !ppeInventoryId) {
            return res.status(400).json({
                message:
                    "workerId and ppeInventoryId are required"
            });
        }

        try {

            const user = await getUser(req.user.userId);

            if (!user || !user.mine_id) {
                return res.status(403).json({
                    message:
                        "Manager is not assigned to a mine"
                });
            }

            const client = await pool.connect();

            try {

                await client.query("BEGIN");

                // --------------------------------------------------
                // Worker
                // --------------------------------------------------

                const workerResult = await client.query(
                    `SELECT id, name, employee_code, mine_id
                     FROM workers
                     WHERE id = $1
                       AND mine_id = $2`,
                    [workerId, user.mine_id]
                );

                if (workerResult.rows.length === 0) {

                    await client.query("ROLLBACK");

                    return res.status(404).json({
                        message:
                            "Worker not found in manager's mine"
                    });
                }

                // --------------------------------------------------
                // PPE
                // --------------------------------------------------

                const ppeResult = await client.query(
                    `SELECT
                        pi.*,
                        pt.name AS ppe_type_name,
                        pt.replacement_period_days
                     FROM ppe_inventory pi
                     JOIN ppe_types pt
                        ON pi.ppe_type_id = pt.id
                     WHERE pi.id = $1
                       AND pi.mine_id = $2
                     FOR UPDATE`,
                    [ppeInventoryId, user.mine_id]
                );

                if (ppeResult.rows.length === 0) {

                    await client.query("ROLLBACK");

                    return res.status(404).json({
                        message:
                            "PPE item not found in manager's mine"
                    });
                }

                const ppe = ppeResult.rows[0];

                // --------------------------------------------------
                // PPE must be available
                // --------------------------------------------------

                if (ppe.status !== "AVAILABLE") {

                    await client.query("ROLLBACK");

                    return res.status(400).json({
                        message:
                            `PPE cannot be assigned while status is ${ppe.status}`
                    });
                }

                if (ppe.condition === "DAMAGED") {

                    await client.query("ROLLBACK");

                    return res.status(400).json({
                        message:
                            "Damaged PPE cannot be assigned"
                    });
                }

                // --------------------------------------------------
                // Check expiry
                // --------------------------------------------------

                if (
                    ppe.expiry_date &&
                    new Date(ppe.expiry_date) < new Date()
                ) {

                    await client.query(
                        `UPDATE ppe_inventory
                         SET
                            status = 'EXPIRED',
                            updated_at = CURRENT_TIMESTAMP
                         WHERE id = $1`,
                        [ppeInventoryId]
                    );

                    await client.query("COMMIT");

                    return res.status(400).json({
                        message:
                            "This PPE has expired and cannot be assigned"
                    });
                }

                // --------------------------------------------------
                // Check existing active assignment
                // --------------------------------------------------

                const assignmentResult =
                    await client.query(
                        `SELECT id
                         FROM worker_ppe_assignments
                         WHERE ppe_inventory_id = $1
                           AND status = 'ACTIVE'
                         FOR UPDATE`,
                        [ppeInventoryId]
                    );

                if (assignmentResult.rows.length > 0) {

                    await client.query("ROLLBACK");

                    return res.status(409).json({
                        message:
                            "PPE is already assigned to a worker"
                    });
                }

                // --------------------------------------------------
                // Automatic replacement date
                // --------------------------------------------------

                // --------------------------------------------------
// Automatic replacement date
// --------------------------------------------------

let insertResult;

if (
    !expectedReplacementDate &&
    ppe.replacement_period_days
) {

    insertResult = await client.query(
        `INSERT INTO worker_ppe_assignments
        (
            worker_id,
            ppe_inventory_id,
            issued_by,
            issue_date,
            expected_replacement_date,
            status,
            remarks
        )
        VALUES
        (
            $1,
            $2,
            $3,
            CURRENT_DATE,
            CURRENT_DATE + $4::INTEGER,
            'ACTIVE',
            $5
        )
        RETURNING *`,
        [
            workerId,
            ppeInventoryId,
            user.id,
            Number(ppe.replacement_period_days),
            remarks || null
        ]
    );

} else {

    insertResult = await client.query(
        `INSERT INTO worker_ppe_assignments
        (
            worker_id,
            ppe_inventory_id,
            issued_by,
            issue_date,
            expected_replacement_date,
            status,
            remarks
        )
        VALUES
        (
            $1,
            $2,
            $3,
            CURRENT_DATE,
            $4,
            'ACTIVE',
            $5
        )
        RETURNING *`,
        [
            workerId,
            ppeInventoryId,
            user.id,
            expectedReplacementDate || null,
            remarks || null
        ]
    );
}

                await client.query(
                    `UPDATE ppe_inventory
                     SET
                        status = 'ASSIGNED',
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [ppeInventoryId]
                );

                await client.query("COMMIT");

                res.status(201).json({
                    message:
                        "PPE assigned successfully",
                    assignment:
                        insertResult.rows[0]
                });

            } catch (error) {

                await client.query("ROLLBACK");
                throw error;

            } finally {

                client.release();
            }

        } catch (error) {

            console.error("Assign PPE error:", error);

            res.status(500).json({
                message:
                    "Failed to assign PPE"
            });
        }
    }
);


// ======================================================
// 6. RETURN / REPLACE PPE
// ======================================================

router.patch(
    "/assignment/:id/return",
    auth,
    authorize("MINE_MANAGER"),
    async (req, res) => {

        const assignmentId = req.params.id;

        try {

            const user = await getUser(req.user.userId);

            if (!user || !user.mine_id) {
                return res.status(403).json({
                    message:
                        "Manager is not assigned to a mine"
                });
            }

            const client = await pool.connect();

            try {

                await client.query("BEGIN");

                const assignmentResult =
                    await client.query(
                        `SELECT
                            wpa.*,
                            pi.mine_id,
                            pi.id AS ppe_id

                         FROM worker_ppe_assignments wpa

                         JOIN ppe_inventory pi
                            ON wpa.ppe_inventory_id = pi.id

                         WHERE wpa.id = $1
                           AND pi.mine_id = $2

                         FOR UPDATE`,
                        [
                            assignmentId,
                            user.mine_id
                        ]
                    );

                if (assignmentResult.rows.length === 0) {

                    await client.query("ROLLBACK");

                    return res.status(404).json({
                        message:
                            "Active PPE assignment not found"
                    });
                }

                const assignment =
                    assignmentResult.rows[0];

                if (
                    assignment.status !== "ACTIVE"
                ) {

                    await client.query("ROLLBACK");

                    return res.status(400).json({
                        message:
                            "This PPE assignment is not active"
                    });
                }

                await client.query(
                    `UPDATE worker_ppe_assignments
                     SET
                        status = 'RETURNED',
                        returned_date = CURRENT_DATE,
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [assignmentId]
                );

                await client.query(
                    `UPDATE ppe_inventory
                     SET
                        status = 'AVAILABLE',
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [assignment.ppe_id]
                );

                await client.query("COMMIT");

                res.json({
                    message:
                        "PPE returned successfully"
                });

            } catch (error) {

                await client.query("ROLLBACK");
                throw error;

            } finally {

                client.release();
            }

        } catch (error) {

            console.error(
                "Return PPE error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to return PPE"
            });
        }
    }
);


// ======================================================
// 7. GET WORKER PPE
// ======================================================

router.get(
    "/worker/:workerId",
    auth,
    async (req, res) => {

        const workerId = req.params.workerId;

        try {

            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            if (
                user.role === "FIELD_WORKER" &&
                user.worker_id !== Number(workerId)
            ) {
                return res.status(403).json({
                    message:
                        "You can only view your own PPE"
                });
            }

            if (
                user.role !== "PLATFORM_ADMIN" &&
                user.role !== "FIELD_WORKER" &&
                user.mine_id
            ) {

                const workerCheck = await pool.query(
                    `SELECT id
                     FROM workers
                     WHERE id = $1
                       AND mine_id = $2`,
                    [workerId, user.mine_id]
                );

                if (workerCheck.rows.length === 0) {
                    return res.status(403).json({
                        message:
                            "Worker does not belong to your mine"
                    });
                }
            }

            const result = await pool.query(
                `SELECT
                    wpa.*,

                    pi.item_code,
                    pi.size,
                    pi.condition,
                    pi.status AS ppe_status,
                    pi.expiry_date,

                    pt.name AS ppe_type_name,
                    pt.category,
                    pt.is_mandatory

                 FROM worker_ppe_assignments wpa

                 JOIN ppe_inventory pi
                    ON wpa.ppe_inventory_id = pi.id

                 JOIN ppe_types pt
                    ON pi.ppe_type_id = pt.id

                 WHERE wpa.worker_id = $1

                 ORDER BY
                    wpa.issue_date DESC,
                    wpa.id DESC`,
                [workerId]
            );

            res.json({
                workerId: Number(workerId),
                count: result.rows.length,
                ppe: result.rows
            });

        } catch (error) {

            console.error(
                "Get worker PPE error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch worker PPE"
            });
        }
    }
);







module.exports = router;