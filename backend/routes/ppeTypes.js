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
        `SELECT id, mine_id, role
         FROM users
         WHERE id = $1`,
        [userId]
    );

    return result.rows[0] || null;
}


// ======================================================
// 1. CREATE PPE TYPE
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
            name,
            category,
            description,
            replacementPeriodDays,
            isMandatory
        } = req.body|| {};

        if (!name || !category) {
            return res.status(400).json({
                message: "name and category are required"
            });
        }

        if (
            replacementPeriodDays !== undefined &&
            replacementPeriodDays !== null &&
            (
                isNaN(Number(replacementPeriodDays)) ||
                Number(replacementPeriodDays) <= 0
            )
        ) {
            return res.status(400).json({
                message:
                    "replacementPeriodDays must be a positive number"
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

            const result = await pool.query(
                `INSERT INTO ppe_types
                (
                    mine_id,
                    name,
                    category,
                    description,
                    replacement_period_days,
                    is_mandatory
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *`,
                [
                    mineId,
                    name,
                    category,
                    description || null,
                    replacementPeriodDays
                        ? Number(replacementPeriodDays)
                        : null,
                    isMandatory !== false
                ]
            );

            res.status(201).json({
                message: "PPE type created successfully",
                ppeType: result.rows[0]
            });

        } catch (error) {

            console.error("Create PPE type error:", error);

            if (error.code === "23505") {
                return res.status(409).json({
                    message:
                        "This PPE type already exists in this mine"
                });
            }

            res.status(500).json({
                message: "Failed to create PPE type"
            });
        }
    }
);


// ======================================================
// 2. GET PPE TYPES FOR MINE
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
                    `SELECT *
                     FROM ppe_types
                     ORDER BY created_at DESC`
                );

            } else {

                if (!user.mine_id) {
                    return res.status(403).json({
                        message:
                            "User is not assigned to a mine"
                    });
                }

                result = await pool.query(
                    `SELECT *
                     FROM ppe_types
                     WHERE mine_id = $1
                     ORDER BY created_at DESC`,
                    [user.mine_id]
                );
            }

            res.json({
                count: result.rows.length,
                ppeTypes: result.rows
            });

        } catch (error) {

            console.error("Get PPE types error:", error);

            res.status(500).json({
                message: "Failed to fetch PPE types"
            });
        }
    }
);


// ======================================================
// 3. UPDATE PPE TYPE
// ======================================================

router.patch(
    "/:id",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER"
    ),
    async (req, res) => {

        const ppeTypeId = req.params.id;

        const {
            name,
            category,
            description,
            replacementPeriodDays,
            isMandatory,
            isActive
        } = req.body;

        try {

            const user = await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const existing = await pool.query(
                `SELECT *
                 FROM ppe_types
                 WHERE id = $1`,
                [ppeTypeId]
            );

            if (existing.rows.length === 0) {
                return res.status(404).json({
                    message: "PPE type not found"
                });
            }

            const ppeType = existing.rows[0];

            if (
                user.role !== "PLATFORM_ADMIN" &&
                ppeType.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            if (
                replacementPeriodDays !== undefined &&
                replacementPeriodDays !== null &&
                (
                    isNaN(Number(replacementPeriodDays)) ||
                    Number(replacementPeriodDays) <= 0
                )
            ) {
                return res.status(400).json({
                    message:
                        "replacementPeriodDays must be positive"
                });
            }

            const result = await pool.query(
                `UPDATE ppe_types
                 SET
                    name =
                        COALESCE($1, name),
                    category =
                        COALESCE($2, category),
                    description =
                        COALESCE($3, description),
                    replacement_period_days =
                        COALESCE($4, replacement_period_days),
                    is_mandatory =
                        COALESCE($5, is_mandatory),
                    is_active =
                        COALESCE($6, is_active)
                 WHERE id = $7
                 RETURNING *`,
                [
                    name,
                    category,
                    description,
                    replacementPeriodDays !== undefined
                        ? Number(replacementPeriodDays)
                        : null,
                    isMandatory,
                    isActive,
                    ppeTypeId
                ]
            );

            res.json({
                message: "PPE type updated successfully",
                ppeType: result.rows[0]
            });

        } catch (error) {

            console.error("Update PPE type error:", error);

            res.status(500).json({
                message: "Failed to update PPE type"
            });
        }
    }
);


module.exports = router;