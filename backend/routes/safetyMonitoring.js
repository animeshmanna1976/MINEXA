const express = require("express");
const router = express.Router();

const pool = require("../db");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");


// ======================================================
// GET EQUIPMENT SAFETY STATUS
// ======================================================

router.get(
    "/equipment-status",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        try {

            let result;

            if (req.user.role === "PLATFORM_ADMIN") {

                result = await pool.query(`
                    SELECT
                        e.id,
                        e.mine_id,
                        e.equipment_code,
                        e.name,
                        e.equipment_type,
                        e.status,
                        e.next_inspection_date,

                        CASE
                            WHEN e.status = 'OUT_OF_SERVICE'
                                THEN 'UNSAFE'

                            WHEN e.next_inspection_date IS NULL
                                THEN 'NOT_SCHEDULED'

                            WHEN e.next_inspection_date < CURRENT_DATE
                                THEN 'OVERDUE'

                            WHEN e.next_inspection_date <= CURRENT_DATE + 2
                                THEN 'DUE_SOON'

                            ELSE 'OK'
                        END AS safety_status

                    FROM equipment e
                    ORDER BY
                        CASE
                            WHEN e.status = 'OUT_OF_SERVICE'
                                THEN 1
                            WHEN e.next_inspection_date < CURRENT_DATE
                                THEN 2
                            WHEN e.next_inspection_date <= CURRENT_DATE + 2
                                THEN 3
                            ELSE 4
                        END,
                        e.equipment_code
                `);

            } else {

                const userResult = await pool.query(
                    `SELECT mine_id
                     FROM users
                     WHERE id = $1`,
                    [req.user.userId]
                );

                if (
                    userResult.rows.length === 0 ||
                    !userResult.rows[0].mine_id
                ) {
                    return res.status(403).json({
                        message: "User is not assigned to a mine"
                    });
                }

                const mineId = userResult.rows[0].mine_id;

                result = await pool.query(`
                    SELECT
                        e.id,
                        e.mine_id,
                        e.equipment_code,
                        e.name,
                        e.equipment_type,
                        e.status,
                        e.next_inspection_date,

                        CASE
                            WHEN e.status = 'OUT_OF_SERVICE'
                                THEN 'UNSAFE'

                            WHEN e.next_inspection_date IS NULL
                                THEN 'NOT_SCHEDULED'

                            WHEN e.next_inspection_date < CURRENT_DATE
                                THEN 'OVERDUE'

                            WHEN e.next_inspection_date <= CURRENT_DATE + 2
                                THEN 'DUE_SOON'

                            ELSE 'OK'
                        END AS safety_status

                    FROM equipment e

                    WHERE e.mine_id = $1

                    ORDER BY
                        CASE
                            WHEN e.status = 'OUT_OF_SERVICE'
                                THEN 1
                            WHEN e.next_inspection_date < CURRENT_DATE
                                THEN 2
                            WHEN e.next_inspection_date <= CURRENT_DATE + 2
                                THEN 3
                            ELSE 4
                        END,
                        e.equipment_code
                `, [mineId]);
            }

            const summary = {
                unsafe: 0,
                overdue: 0,
                dueSoon: 0,
                notScheduled: 0,
                ok: 0
            };

            for (const equipment of result.rows) {

                switch (equipment.safety_status) {

                    case "UNSAFE":
                        summary.unsafe++;
                        break;

                    case "OVERDUE":
                        summary.overdue++;
                        break;

                    case "DUE_SOON":
                        summary.dueSoon++;
                        break;

                    case "NOT_SCHEDULED":
                        summary.notScheduled++;
                        break;

                    case "OK":
                        summary.ok++;
                        break;
                }
            }

            res.json({
                count: result.rows.length,
                summary,
                equipment: result.rows
            });

        } catch (error) {

            console.error(
                "Equipment safety monitoring error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch equipment safety status"
            });
        }
    }
);


// ======================================================
// GET SAFETY ALERTS
// ======================================================

router.get(
    "/alerts",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        try {

            let result;

            if (req.user.role === "PLATFORM_ADMIN") {

                result = await pool.query(`
                    SELECT
                        e.id,
                        e.mine_id,
                        e.equipment_code,
                        e.name,
                        e.status,
                        e.next_inspection_date,

                        CASE
                            WHEN e.status = 'OUT_OF_SERVICE'
                                THEN 'UNSAFE'

                            WHEN e.next_inspection_date < CURRENT_DATE
                                THEN 'INSPECTION_OVERDUE'

                            WHEN e.next_inspection_date <= CURRENT_DATE + 2
                                THEN 'INSPECTION_DUE_SOON'

                            ELSE 'NONE'
                        END AS alert_type

                    FROM equipment e

                    WHERE
                        e.status = 'OUT_OF_SERVICE'
                        OR (
                            e.next_inspection_date IS NOT NULL
                            AND e.next_inspection_date <= CURRENT_DATE + 2
                        )

                    ORDER BY
                        CASE
                            WHEN e.status = 'OUT_OF_SERVICE'
                                THEN 1
                            WHEN e.next_inspection_date < CURRENT_DATE
                                THEN 2
                            ELSE 3
                        END,
                        e.next_inspection_date
                `);

            } else {

                const userResult = await pool.query(
                    `SELECT mine_id
                     FROM users
                     WHERE id = $1`,
                    [req.user.userId]
                );

                if (
                    userResult.rows.length === 0 ||
                    !userResult.rows[0].mine_id
                ) {
                    return res.status(403).json({
                        message: "User is not assigned to a mine"
                    });
                }

                const mineId = userResult.rows[0].mine_id;

                result = await pool.query(`
                    SELECT
                        e.id,
                        e.mine_id,
                        e.equipment_code,
                        e.name,
                        e.status,
                        e.next_inspection_date,

                        CASE
                            WHEN e.status = 'OUT_OF_SERVICE'
                                THEN 'UNSAFE'

                            WHEN e.next_inspection_date < CURRENT_DATE
                                THEN 'INSPECTION_OVERDUE'

                            WHEN e.next_inspection_date <= CURRENT_DATE + 2
                                THEN 'INSPECTION_DUE_SOON'

                            ELSE 'NONE'
                        END AS alert_type

                    FROM equipment e

                    WHERE e.mine_id = $1
                      AND (
                            e.status = 'OUT_OF_SERVICE'
                            OR (
                                e.next_inspection_date IS NOT NULL
                                AND e.next_inspection_date <= CURRENT_DATE + 2
                            )
                      )

                    ORDER BY
                        CASE
                            WHEN e.status = 'OUT_OF_SERVICE'
                                THEN 1
                            WHEN e.next_inspection_date < CURRENT_DATE
                                THEN 2
                            ELSE 3
                        END,
                        e.next_inspection_date
                `, [mineId]);
            }

            res.json({
                count: result.rows.length,
                alerts: result.rows
            });

        } catch (error) {

            console.error(
                "Safety alerts error:",
                error
            );

            res.status(500).json({
                message: "Failed to fetch safety alerts"
            });
        }
    }
);


// ======================================================
// GET SAFETY SUMMARY
// ======================================================

router.get(
    "/summary",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        try {

            let mineId = null;

            if (req.user.role !== "PLATFORM_ADMIN") {

                const userResult = await pool.query(
                    `SELECT mine_id
                     FROM users
                     WHERE id = $1`,
                    [req.user.userId]
                );

                if (
                    userResult.rows.length === 0 ||
                    !userResult.rows[0].mine_id
                ) {
                    return res.status(403).json({
                        message:
                            "User is not assigned to a mine"
                    });
                }

                mineId = userResult.rows[0].mine_id;
            }

            const params = mineId ? [mineId] : [];

            const whereClause =
                mineId ? "WHERE e.mine_id = $1" : "";

            const result = await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total_equipment,

                    COUNT(*) FILTER (
                        WHERE e.status = 'OUT_OF_SERVICE'
                    )::INTEGER AS unsafe,

                    COUNT(*) FILTER (
                        WHERE e.next_inspection_date < CURRENT_DATE
                    )::INTEGER AS overdue,

                    COUNT(*) FILTER (
                        WHERE
                            e.next_inspection_date >= CURRENT_DATE
                            AND e.next_inspection_date <= CURRENT_DATE + 2
                    )::INTEGER AS due_soon,

                    COUNT(*) FILTER (
                        WHERE e.next_inspection_date IS NULL
                    )::INTEGER AS not_scheduled,

                    COUNT(*) FILTER (
                        WHERE
                            e.status != 'OUT_OF_SERVICE'
                            AND (
                                e.next_inspection_date IS NULL
                                OR e.next_inspection_date > CURRENT_DATE + 2
                            )
                    )::INTEGER AS ok

                FROM equipment e

                ${whereClause}
                `,
                params
            );

            res.json({
                summary: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Safety summary error:",
                error
            );

            res.status(500).json({
                message: "Failed to fetch safety summary"
            });
        }
    }
);


module.exports = router;