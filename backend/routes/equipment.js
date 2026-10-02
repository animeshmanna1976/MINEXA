const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");

/*
    EQUIPMENT API

    Roles:
    PLATFORM_ADMIN  -> full access
    MINE_MANAGER    -> create/update/assign/delete
    SAFETY_OFFICER  -> view + status
    FIELD_WORKER    -> view assigned equipment
*/


// ======================================================
// 1. CREATE EQUIPMENT
// ======================================================

router.post(
    "/",
    auth,
    authorize("PLATFORM_ADMIN", "MINE_MANAGER"),
    async (req, res) => {

        const {
            equipmentCode,
            name,
            equipmentType,
            manufacturer,
            model,
            serialNumber,
            purchaseDate,
            lastServiceDate,
            nextServiceDate,
            location
        } = req.body;

        if (!equipmentCode || !name || !equipmentType) {
            return res.status(400).json({
                message: "Equipment code, name and type are required"
            });
        }

        try {

            let mineId;

            // Manager can only create equipment for their own mine
            if (req.user.role === "MINE_MANAGER") {

                const mineResult = await pool.query(
                    `SELECT mine_id
                     FROM users
                     WHERE id = $1
                       AND role = 'MINE_MANAGER'`,
                    [req.user.userId]
                );

                if (mineResult.rows.length === 0 || !mineResult.rows[0].mine_id) {
                    return res.status(403).json({
                        message: "Manager is not assigned to a mine"
                    });
                }

                mineId = mineResult.rows[0].mine_id;

            } else {

                // PLATFORM_ADMIN must provide mineId
                mineId = req.body.mineId;

                if (!mineId) {
                    return res.status(400).json({
                        message: "mineId is required for platform admin"
                    });
                }
            }

            const result = await pool.query(
                `INSERT INTO equipment
                (
                    mine_id,
                    equipment_code,
                    name,
                    equipment_type,
                    manufacturer,
                    model,
                    serial_number,
                    purchase_date,
                    last_service_date,
                    next_service_date,
                    location
                )
                VALUES
                (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
                )
                RETURNING *`,
                [
                    mineId,
                    equipmentCode,
                    name,
                    equipmentType,
                    manufacturer || null,
                    model || null,
                    serialNumber || null,
                    purchaseDate || null,
                    lastServiceDate || null,
                    nextServiceDate || null,
                    location || null
                ]
            );

            res.status(201).json({
                message: "Equipment created successfully",
                equipment: result.rows[0]
            });

        } catch (error) {

            console.error("Create equipment error:", error);

            if (error.code === "23505") {
                return res.status(409).json({
                    message: "Equipment code already exists in this mine"
                });
            }

            res.status(500).json({
                message: "Failed to create equipment"
            });
        }
    }
);


// ======================================================
// 2. GET EQUIPMENT FOR MINE
// ======================================================

router.get(
    "/mine",
    auth,
    authorize("PLATFORM_ADMIN", "MINE_MANAGER", "SAFETY_OFFICER"),
    async (req, res) => {

        try {

            let query;
            let params;

            if (req.user.role === "PLATFORM_ADMIN") {

                query = `
                    SELECT
                        e.*,
                        w.name AS assigned_worker_name,
                        w.employee_code
                    FROM equipment e
                    LEFT JOIN workers w
                        ON e.assigned_worker_id = w.id
                    ORDER BY e.created_at DESC
                `;

                params = [];

            } else {

                const mineResult = await pool.query(
                    `SELECT mine_id
                     FROM users
                     WHERE id = $1`,
                    [req.user.userId]
                );

                if (
                    mineResult.rows.length === 0 ||
                    !mineResult.rows[0].mine_id
                ) {
                    return res.status(403).json({
                        message: "User is not assigned to a mine"
                    });
                }

                const mineId = mineResult.rows[0].mine_id;

                query = `
                    SELECT
                        e.*,
                        w.name AS assigned_worker_name,
                        w.employee_code
                    FROM equipment e
                    LEFT JOIN workers w
                        ON e.assigned_worker_id = w.id
                    WHERE e.mine_id = $1
                    ORDER BY e.created_at DESC
                `;

                params = [mineId];
            }

            const result = await pool.query(query, params);

            res.json({
                count: result.rows.length,
                equipment: result.rows
            });

        } catch (error) {

            console.error("Get equipment error:", error);

            res.status(500).json({
                message: "Failed to fetch equipment"
            });
        }
    }
);


// ======================================================
// 3. GET SINGLE EQUIPMENT
// ======================================================

router.get(
    "/:id",
    auth,
    async (req, res) => {

        const equipmentId = req.params.id;

        try {

            const result = await pool.query(
                `SELECT
                    e.*,
                    w.name AS assigned_worker_name,
                    w.employee_code
                 FROM equipment e
                 LEFT JOIN workers w
                    ON e.assigned_worker_id = w.id
                 WHERE e.id = $1`,
                [equipmentId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Equipment not found"
                });
            }

            const equipment = result.rows[0];

            // Platform admin can access everything
            if (req.user.role === "PLATFORM_ADMIN") {
                return res.json(equipment);
            }

            const mineResult = await pool.query(
                `SELECT mine_id
                 FROM users
                 WHERE id = $1`,
                [req.user.userId]
            );

            if (
                mineResult.rows.length === 0 ||
                mineResult.rows[0].mine_id !== equipment.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            // Worker can only see equipment assigned to them
            if (req.user.role === "FIELD_WORKER") {

                if (equipment.assigned_worker_id !== req.user.workerId) {
                    return res.status(403).json({
                        message: "This equipment is not assigned to you"
                    });
                }
            }

            res.json(equipment);

        } catch (error) {

            console.error("Get equipment by id error:", error);

            res.status(500).json({
                message: "Failed to fetch equipment"
            });
        }
    }
);


// ======================================================
// 4. UPDATE EQUIPMENT DETAILS
// ======================================================

router.patch(
    "/:id",
    auth,
    authorize("PLATFORM_ADMIN", "MINE_MANAGER"),
    async (req, res) => {

        const equipmentId = req.params.id;

        const {
            name,
            equipmentType,
            manufacturer,
            model,
            serialNumber,
            purchaseDate,
            lastServiceDate,
            nextServiceDate,
            location
        } = req.body;

        try {

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

            if (req.user.role === "MINE_MANAGER") {

                const managerResult = await pool.query(
                    `SELECT mine_id
                     FROM users
                     WHERE id = $1`,
                    [req.user.userId]
                );

                if (
                    managerResult.rows.length === 0 ||
                    managerResult.rows[0].mine_id !== equipment.mine_id
                ) {
                    return res.status(403).json({
                        message: "Access denied"
                    });
                }
            }

            const result = await pool.query(
                `UPDATE equipment
                 SET
                    name = COALESCE($1, name),
                    equipment_type = COALESCE($2, equipment_type),
                    manufacturer = COALESCE($3, manufacturer),
                    model = COALESCE($4, model),
                    serial_number = COALESCE($5, serial_number),
                    purchase_date = COALESCE($6, purchase_date),
                    last_service_date = COALESCE($7, last_service_date),
                    next_service_date = COALESCE($8, next_service_date),
                    location = COALESCE($9, location),
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $10
                 RETURNING *`,
                [
                    name,
                    equipmentType,
                    manufacturer,
                    model,
                    serialNumber,
                    purchaseDate,
                    lastServiceDate,
                    nextServiceDate,
                    location,
                    equipmentId
                ]
            );

            res.json({
                message: "Equipment updated successfully",
                equipment: result.rows[0]
            });

        } catch (error) {

            console.error("Update equipment error:", error);

            res.status(500).json({
                message: "Failed to update equipment"
            });
        }
    }
);


// ======================================================
// 5. ASSIGN EQUIPMENT TO WORKER
// ======================================================

router.patch(
    "/:id/assign",
    auth,
    authorize("MINE_MANAGER"),
    async (req, res) => {

        const equipmentId = req.params.id;
        const { workerId } = req.body;

        if (!workerId) {
            return res.status(400).json({
                message: "workerId is required"
            });
        }

        try {

            const managerResult = await pool.query(
                `SELECT mine_id
                 FROM users
                 WHERE id = $1
                   AND role = 'MINE_MANAGER'`,
                [req.user.userId]
            );

            if (
                managerResult.rows.length === 0 ||
                !managerResult.rows[0].mine_id
            ) {
                return res.status(403).json({
                    message: "Manager is not assigned to a mine"
                });
            }

            const mineId = managerResult.rows[0].mine_id;

            const equipmentResult = await pool.query(
                `SELECT *
                 FROM equipment
                 WHERE id = $1
                   AND mine_id = $2`,
                [equipmentId, mineId]
            );

            if (equipmentResult.rows.length === 0) {
                return res.status(404).json({
                    message: "Equipment not found in manager's mine"
                });
            }

            const equipment = equipmentResult.rows[0];

            if (
                equipment.status === "MAINTENANCE" ||
                equipment.status === "OUT_OF_SERVICE"
            ) {
                return res.status(400).json({
                    message: `Equipment cannot be assigned while status is ${equipment.status}`
                });
            }

            const workerResult = await pool.query(
                `SELECT id, name, employee_code
                 FROM workers
                 WHERE id = $1
                   AND mine_id = $2`,
                [workerId, mineId]
            );

            if (workerResult.rows.length === 0) {
                return res.status(404).json({
                    message: "Worker not found in this mine"
                });
            }

            const result = await pool.query(
                `UPDATE equipment
                 SET
                    assigned_worker_id = $1,
                    status = 'IN_USE',
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING *`,
                [workerId, equipmentId]
            );

            res.json({
                message: "Equipment assigned successfully",
                equipment: result.rows[0]
            });

        } catch (error) {

            console.error("Assign equipment error:", error);

            res.status(500).json({
                message: "Failed to assign equipment"
            });
        }
    }
);


// ======================================================
// 6. CHANGE EQUIPMENT STATUS
// ======================================================

router.patch(
    "/:id/status",
    auth,
    authorize("PLATFORM_ADMIN", "MINE_MANAGER", "SAFETY_OFFICER"),
    async (req, res) => {

        const equipmentId = req.params.id;
        const { status } = req.body;

        const allowedStatuses = [
            "AVAILABLE",
            "IN_USE",
            "MAINTENANCE",
            "OUT_OF_SERVICE"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Invalid equipment status"
            });
        }

        try {

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

            if (req.user.role !== "PLATFORM_ADMIN") {

                const userResult = await pool.query(
                    `SELECT mine_id
                     FROM users
                     WHERE id = $1`,
                    [req.user.userId]
                );

                const userMineId = userResult.rows[0]?.mine_id;

                if (
                    !userMineId ||
                    (equipment.mine_id && userMineId !== equipment.mine_id)
                ) {
                    return res.status(403).json({
                        message: "Access denied to equipment outside your mine"
                    });
                }
            }

            let query;
            let params;

            if (
                status === "AVAILABLE" ||
                status === "MAINTENANCE" ||
                status === "OUT_OF_SERVICE"
            ) {
                query = `
                    UPDATE equipment
                    SET
                        status = $1,
                        assigned_worker_id = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING *
                `;

                params = [status, equipmentId];

            } else {

                query = `
                    UPDATE equipment
                    SET
                        status = $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING *
                `;

                params = [status, equipmentId];
            }

            const result = await pool.query(query, params);

            return res.json({
                message: "Equipment status updated successfully",
                equipment: result.rows[0]
            });

        } catch (error) {

            console.error("Equipment status error:", error);

            return res.status(500).json({
                message: error.message || "Failed to update equipment status"
            });
        }
    }
);


// ======================================================
// 7. DELETE EQUIPMENT
// ======================================================

router.delete(
    "/:id",
    auth,
    authorize("PLATFORM_ADMIN", "MINE_MANAGER"),
    async (req, res) => {

        const equipmentId = req.params.id;

        try {

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

            if (req.user.role === "MINE_MANAGER") {

                const managerResult = await pool.query(
                    `SELECT mine_id
                     FROM users
                     WHERE id = $1`,
                    [req.user.userId]
                );

                if (
                    managerResult.rows.length === 0 ||
                    managerResult.rows[0].mine_id !== equipment.mine_id
                ) {
                    return res.status(403).json({
                        message: "Access denied"
                    });
                }
            }

            await pool.query(
                `DELETE FROM equipment
                 WHERE id = $1`,
                [equipmentId]
            );

            res.json({
                message: "Equipment deleted successfully"
            });

        } catch (error) {

            console.error("Delete equipment error:", error);

            res.status(500).json({
                message: "Failed to delete equipment"
            });
        }
    }
);


module.exports = router;