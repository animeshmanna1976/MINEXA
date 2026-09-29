const express = require("express");
const router = express.Router();

const pool = require("../db");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");


// ======================================================
// GET MINE AUDIT LOGS
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

        const {
            action,
            entityType,
            limit = 100,
            offset = 0
        } = req.query;

        const parsedLimit =
            Math.min(
                Math.max(
                    Number(limit) || 100,
                    1
                ),
                500
            );

        const parsedOffset =
            Math.max(
                Number(offset) || 0,
                0
            );

        try {

            const userResult =
                await pool.query(
                    `SELECT
                        id,
                        role,
                        mine_id
                     FROM users
                     WHERE id = $1`,
                    [req.user.userId]
                );

            if (
                userResult.rows.length === 0
            ) {
                return res.status(401).json({
                    message:
                        "User not found"
                });
            }

            const user =
                userResult.rows[0];

            const conditions = [];
            const params = [];

            let paramIndex = 1;

            // --------------------------------------------------
            // Mine isolation
            // --------------------------------------------------

            if (
                user.role !==
                "PLATFORM_ADMIN"
            ) {

                if (!user.mine_id) {
                    return res.status(403).json({
                        message:
                            "User is not assigned to a mine"
                    });
                }

                conditions.push(
                    `al.mine_id = $${paramIndex}`
                );

                params.push(
                    user.mine_id
                );

                paramIndex++;
            }

            // --------------------------------------------------
            // Optional action filter
            // --------------------------------------------------

            if (action) {

                conditions.push(
                    `al.action = $${paramIndex}`
                );

                params.push(action);

                paramIndex++;
            }

            // --------------------------------------------------
            // Optional entity filter
            // --------------------------------------------------

            if (entityType) {

                conditions.push(
                    `al.entity_type = $${paramIndex}`
                );

                params.push(entityType);

                paramIndex++;
            }

            const whereClause =
                conditions.length > 0
                    ? `WHERE ${conditions.join(" AND ")}`
                    : "";

            params.push(parsedLimit);
            const limitIndex =
                paramIndex++;

            params.push(parsedOffset);
            const offsetIndex =
                paramIndex++;

            const result =
                await pool.query(
                    `
                    SELECT
                        al.*,

                        u.name AS user_name,
                        u.email AS user_email,
                        u.role AS user_role,

                        m.name AS mine_name

                    FROM audit_logs al

                    LEFT JOIN users u
                        ON al.user_id = u.id

                    LEFT JOIN mines m
                        ON al.mine_id = m.id

                    ${whereClause}

                    ORDER BY
                        al.created_at DESC,
                        al.id DESC

                    LIMIT $${limitIndex}
                    OFFSET $${offsetIndex}
                    `,
                    params
                );

            res.json({
                count: result.rows.length,
                limit: parsedLimit,
                offset: parsedOffset,
                logs: result.rows
            });

        } catch (error) {

            console.error(
                "Get audit logs error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch audit logs"
            });
        }
    }
);


// ======================================================
// GET AUDIT HISTORY FOR ENTITY
// ======================================================

router.get(
    "/entity/:entityType/:entityId",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const {
            entityType,
            entityId
        } = req.params;

        try {

            const userResult =
                await pool.query(
                    `SELECT
                        id,
                        role,
                        mine_id
                     FROM users
                     WHERE id = $1`,
                    [req.user.userId]
                );

            if (
                userResult.rows.length === 0
            ) {
                return res.status(401).json({
                    message:
                        "User not found"
                });
            }

            const user =
                userResult.rows[0];

            let query;
            let params;

            if (
                user.role ===
                "PLATFORM_ADMIN"
            ) {

                query = `
                    SELECT
                        al.*,

                        u.name AS user_name,
                        u.email AS user_email,
                        u.role AS user_role

                    FROM audit_logs al

                    LEFT JOIN users u
                        ON al.user_id = u.id

                    WHERE al.entity_type = $1
                      AND al.entity_id = $2

                    ORDER BY
                        al.created_at DESC,
                        al.id DESC
                `;

                params = [
                    entityType,
                    String(entityId)
                ];

            } else {

                if (!user.mine_id) {
                    return res.status(403).json({
                        message:
                            "User is not assigned to a mine"
                    });
                }

                query = `
                    SELECT
                        al.*,

                        u.name AS user_name,
                        u.email AS user_email,
                        u.role AS user_role

                    FROM audit_logs al

                    LEFT JOIN users u
                        ON al.user_id = u.id

                    WHERE al.entity_type = $1
                      AND al.entity_id = $2
                      AND al.mine_id = $3

                    ORDER BY
                        al.created_at DESC,
                        al.id DESC
                `;

                params = [
                    entityType,
                    String(entityId),
                    user.mine_id
                ];
            }

            const result =
                await pool.query(
                    query,
                    params
                );

            res.json({
                count: result.rows.length,
                logs: result.rows
            });

        } catch (error) {

            console.error(
                "Get entity audit error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch entity audit history"
            });
        }
    }
);


module.exports = router;