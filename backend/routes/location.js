const express = require("express");
const router = express.Router();

const pool = require("../db");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");


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
// Helper: Calculate distance between two coordinates
// Haversine Formula
// Returns meters
// ======================================================

function calculateDistanceMeters(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const earthRadius = 6371000;

    const toRadians = value =>
        value * Math.PI / 180;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const latitude1 = toRadians(lat1);
    const latitude2 = toRadians(lat2);

    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(latitude1) *
        Math.cos(latitude2) *

        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return earthRadius * c;
}


// ======================================================
// Helper: Check whether location violates geofence
// ======================================================

function isGeofenceViolation(
    geofence,
    distance
) {

    /*
        MINE_BOUNDARY:
        Worker must stay INSIDE the boundary.
        Outside = violation.

        Other zones:
        RESTRICTED
        BLASTING
        DANGER
        EQUIPMENT
        CUSTOM

        Worker must stay OUTSIDE.
        Inside = violation.
    */

    if (geofence.zone_type === "MINE_BOUNDARY") {

        return distance > geofence.radius_meters;
    }

    return distance <= geofence.radius_meters;
}


// ======================================================
// 1. WORKER SEND CURRENT LOCATION
// ======================================================

router.post(
    "/update",
    auth,
    authorize("FIELD_WORKER"),
    async (req, res) => {

        const {
            latitude,
            longitude,
            accuracyMeters
        } = req.body || {};

        // --------------------------------------------------
        // Validate coordinates
        // --------------------------------------------------

        if (
            latitude === undefined ||
            longitude === undefined
        ) {
            return res.status(400).json({
                message:
                    "latitude and longitude are required"
            });
        }

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
                message:
                    "Invalid latitude or longitude"
            });
        }

        if (
            accuracyMeters !== undefined &&
            accuracyMeters !== null &&
            (
                Number.isNaN(Number(accuracyMeters)) ||
                Number(accuracyMeters) < 0
            )
        ) {
            return res.status(400).json({
                message:
                    "accuracyMeters must be a non-negative number"
            });
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
            // Save location
            // --------------------------------------------------

            const locationResult = await pool.query(
                `INSERT INTO worker_locations
                (
                    worker_id,
                    mine_id,
                    latitude,
                    longitude,
                    accuracy_meters
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5
                )
                RETURNING *`,
                [
                    user.worker_id,
                    user.mine_id,
                    lat,
                    lon,
                    accuracyMeters !== undefined &&
                    accuracyMeters !== null
                        ? Number(accuracyMeters)
                        : null
                ]
            );

            // --------------------------------------------------
            // Get active geofences
            // --------------------------------------------------

            const geofenceResult = await pool.query(
                `SELECT *
                 FROM mine_geofences
                 WHERE mine_id = $1
                   AND is_active = TRUE`,
                [user.mine_id]
            );

            const violations = [];

            for (
                const geofence of geofenceResult.rows
            ) {

                const distance =
                    calculateDistanceMeters(
                        lat,
                        lon,
                        Number(geofence.latitude),
                        Number(geofence.longitude)
                    );

                const violation =
                    isGeofenceViolation(
                        geofence,
                        distance
                    );

                if (!violation) {
                    continue;
                }

                // --------------------------------------------------
                // Don't create duplicate OPEN alert
                // --------------------------------------------------

                const existingAlert =
                    await pool.query(
                        `SELECT id
                         FROM geofence_alerts
                         WHERE worker_id = $1
                           AND geofence_id = $2
                           AND status IN (
                               'OPEN',
                               'ACKNOWLEDGED'
                           )
                         LIMIT 1`,
                        [
                            user.worker_id,
                            geofence.id
                        ]
                    );

                let alertId = null;
                let created = false;

                if (
                    existingAlert.rows.length === 0
                ) {

                    const alertResult =
                        await pool.query(
                            `INSERT INTO geofence_alerts
                            (
                                mine_id,
                                worker_id,
                                geofence_id,
                                latitude,
                                longitude,
                                distance_meters,
                                status
                            )
                            VALUES
                            (
                                $1,
                                $2,
                                $3,
                                $4,
                                $5,
                                $6,
                                'OPEN'
                            )
                            RETURNING id`,
                            [
                                user.mine_id,
                                user.worker_id,
                                geofence.id,
                                lat,
                                lon,
                                distance
                            ]
                        );

                    alertId =
                        alertResult.rows[0].id;

                    created = true;

                } else {

                    alertId =
                        existingAlert.rows[0].id;

                    // Update latest location/distance
                    await pool.query(
                        `UPDATE geofence_alerts
                         SET
                            latitude = $1,
                            longitude = $2,
                            distance_meters = $3
                         WHERE id = $4`,
                        [
                            lat,
                            lon,
                            distance,
                            alertId
                        ]
                    );
                }

                violations.push({
                    geofenceId: geofence.id,
                    geofenceName: geofence.name,
                    zoneType: geofence.zone_type,
                    severity: geofence.severity,
                    distanceMeters:
                        Math.round(distance * 100) / 100,
                    radiusMeters:
                        geofence.radius_meters,
                    alertId,
                    alertCreated: created
                });
            }

            res.status(201).json({
                message:
                    "Worker location updated successfully",

                location: {
                    id: locationResult.rows[0].id,
                    workerId: user.worker_id,
                    mineId: user.mine_id,
                    latitude: lat,
                    longitude: lon,
                    accuracyMeters:
                        accuracyMeters !== undefined &&
                        accuracyMeters !== null
                            ? Number(accuracyMeters)
                            : null,
                    recordedAt:
                        locationResult.rows[0].recorded_at
                },

                geofences: {
                    checked:
                        geofenceResult.rows.length,
                    violations
                }
            });

        } catch (error) {

            console.error(
                "Worker location update error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to update worker location"
            });
        }
    }
);


// ======================================================
// 2. GET MY CURRENT LOCATION
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
                    worker_id,
                    mine_id,
                    latitude,
                    longitude,
                    accuracy_meters,
                    recorded_at

                 FROM worker_locations

                 WHERE worker_id = $1

                 ORDER BY recorded_at DESC, id DESC

                 LIMIT 1`,
                [user.worker_id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "No location has been recorded yet"
                });
            }

            res.json({
                location: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Get my location error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch current location"
            });
        }
    }
);


// ======================================================
// 3. GET WORKER LOCATION HISTORY
// MANAGER / SAFETY / ADMIN
// ======================================================

router.get(
    "/worker/:workerId",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const workerId =
            Number(req.params.workerId);

        if (!Number.isInteger(workerId)) {
            return res.status(400).json({
                message: "Invalid workerId"
            });
        }

        try {

            const user = await getUser(
                req.user.userId
            );

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const workerResult = await pool.query(
                `SELECT
                    id,
                    name,
                    employee_code,
                    mine_id
                 FROM workers
                 WHERE id = $1`,
                [workerId]
            );

            if (workerResult.rows.length === 0) {
                return res.status(404).json({
                    message: "Worker not found"
                });
            }

            const worker =
                workerResult.rows[0];

            if (
                user.role !== "PLATFORM_ADMIN" &&
                worker.mine_id !== user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            const result = await pool.query(
                `SELECT
                    id,
                    latitude,
                    longitude,
                    accuracy_meters,
                    recorded_at

                 FROM worker_locations

                 WHERE worker_id = $1

                 ORDER BY recorded_at DESC, id DESC

                 LIMIT 100`,
                [workerId]
            );

            res.json({
                worker: {
                    id: worker.id,
                    name: worker.name,
                    employeeCode:
                        worker.employee_code
                },

                count: result.rows.length,

                locations: result.rows
            });

        } catch (error) {

            console.error(
                "Worker location history error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch worker location history"
            });
        }
    }
);


// ======================================================
// 4. GET MINE WORKER LATEST LOCATIONS
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

            const user = await getUser(
                req.user.userId
            );

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            let result;

            if (
                user.role === "PLATFORM_ADMIN"
            ) {

                result = await pool.query(
                    `SELECT
                        DISTINCT ON (w.id)

                        w.id AS worker_id,
                        w.name AS worker_name,
                        w.employee_code,
                        w.mine_id,

                        wl.latitude,
                        wl.longitude,
                        wl.accuracy_meters,
                        wl.recorded_at

                     FROM workers w

                     JOIN worker_locations wl
                        ON wl.worker_id = w.id

                     ORDER BY
                        w.id,
                        wl.recorded_at DESC,
                        wl.id DESC`
                );

            } else {

                if (!user.mine_id) {
                    return res.status(403).json({
                        message:
                            "User is not assigned to a mine"
                    });
                }

                result = await pool.query(
                    `SELECT
                        DISTINCT ON (w.id)

                        w.id AS worker_id,
                        w.name AS worker_name,
                        w.employee_code,
                        w.mine_id,

                        wl.latitude,
                        wl.longitude,
                        wl.accuracy_meters,
                        wl.recorded_at

                     FROM workers w

                     JOIN worker_locations wl
                        ON wl.worker_id = w.id

                     WHERE w.mine_id = $1

                     ORDER BY
                        w.id,
                        wl.recorded_at DESC,
                        wl.id DESC`,
                    [user.mine_id]
                );
            }

            res.json({
                count: result.rows.length,
                workers: result.rows
            });

        } catch (error) {

            console.error(
                "Mine worker locations error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch worker locations"
            });
        }
    }
);


// ======================================================
// 5. GET MINE GEOFENCES
// ======================================================

router.get(
    "/geofences/mine",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        try {

            const user = await getUser(
                req.user.userId
            );

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            let result;

            if (
                user.role === "PLATFORM_ADMIN"
            ) {

                result = await pool.query(
                    `SELECT
                        mg.*,
                        u.name AS creator_name

                     FROM mine_geofences mg

                     LEFT JOIN users u
                        ON mg.created_by = u.id

                     ORDER BY
                        mg.created_at DESC`
                );

            } else {

                if (!user.mine_id) {
                    return res.status(403).json({
                        message:
                            "User is not assigned to a mine"
                    });
                }

                result = await pool.query(
                    `SELECT
                        mg.*,
                        u.name AS creator_name

                     FROM mine_geofences mg

                     LEFT JOIN users u
                        ON mg.created_by = u.id

                     WHERE mg.mine_id = $1

                     ORDER BY
                        mg.created_at DESC`,
                    [user.mine_id]
                );
            }

            res.json({
                count: result.rows.length,
                geofences: result.rows
            });

        } catch (error) {

            console.error(
                "Get geofences error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch geofences"
            });
        }
    }
);


// ======================================================
// 6. CREATE GEOFENCE
// MANAGER / SAFETY / ADMIN
// ======================================================

router.post(
    "/geofences",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const {
            name,
            zoneType,
            description,
            latitude,
            longitude,
            radiusMeters,
            severity
        } = req.body || {};

        if (
            !name ||
            !zoneType ||
            latitude === undefined ||
            longitude === undefined ||
            !radiusMeters
        ) {
            return res.status(400).json({
                message:
                    "name, zoneType, latitude, longitude and radiusMeters are required"
            });
        }

        const lat = Number(latitude);
        const lon = Number(longitude);
        const radius = Number(radiusMeters);

        if (
            Number.isNaN(lat) ||
            Number.isNaN(lon) ||
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180
        ) {
            return res.status(400).json({
                message:
                    "Invalid latitude or longitude"
            });
        }

        if (
            !Number.isInteger(radius) ||
            radius <= 0
        ) {
            return res.status(400).json({
                message:
                    "radiusMeters must be a positive integer"
            });
        }

        const allowedZoneTypes = [
            "MINE_BOUNDARY",
            "RESTRICTED",
            "BLASTING",
            "DANGER",
            "EQUIPMENT",
            "CUSTOM"
        ];

        if (!allowedZoneTypes.includes(zoneType)) {
            return res.status(400).json({
                message:
                    "Invalid zone type"
            });
        }

        const allowedSeverities = [
            "LOW",
            "MEDIUM",
            "HIGH",
            "CRITICAL"
        ];

        const selectedSeverity =
            severity || "HIGH";

        if (
            !allowedSeverities.includes(
                selectedSeverity
            )
        ) {
            return res.status(400).json({
                message:
                    "Invalid severity"
            });
        }

        try {

            const user =
                await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            let mineId = user.mine_id;

            if (
                user.role ===
                "PLATFORM_ADMIN"
            ) {

                mineId = req.body.mineId;

                if (!mineId) {
                    return res.status(400).json({
                        message:
                            "mineId is required for platform admin"
                    });
                }
            }

            const result = await pool.query(
                `INSERT INTO mine_geofences
                (
                    mine_id,
                    name,
                    zone_type,
                    description,
                    latitude,
                    longitude,
                    radius_meters,
                    severity,
                    created_by
                )
                VALUES
                (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9
                )
                RETURNING *`,
                [
                    mineId,
                    name,
                    zoneType,
                    description || null,
                    lat,
                    lon,
                    radius,
                    selectedSeverity,
                    user.id
                ]
            );

            res.status(201).json({
                message:
                    "Geofence created successfully",
                geofence:
                    result.rows[0]
            });

        } catch (error) {

            console.error(
                "Create geofence error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to create geofence"
            });
        }
    }
);


// ======================================================
// 7. UPDATE GEOFENCE
// ======================================================

router.patch(
    "/geofences/:id",
    auth,
    authorize(
        "PLATFORM_ADMIN",
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const geofenceId =
            Number(req.params.id);

        if (!Number.isInteger(geofenceId)) {
            return res.status(400).json({
                message:
                    "Invalid geofence id"
            });
        }

        const {
            name,
            zoneType,
            description,
            latitude,
            longitude,
            radiusMeters,
            severity,
            isActive
        } = req.body || {};

        try {

            const user =
                await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const existing =
                await pool.query(
                    `SELECT *
                     FROM mine_geofences
                     WHERE id = $1`,
                    [geofenceId]
                );

            if (existing.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Geofence not found"
                });
            }

            const geofence =
                existing.rows[0];

            if (
                user.role !==
                    "PLATFORM_ADMIN" &&
                geofence.mine_id !==
                    user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            const result =
                await pool.query(
                    `UPDATE mine_geofences
                     SET
                        name =
                            COALESCE($1, name),

                        zone_type =
                            COALESCE($2, zone_type),

                        description =
                            COALESCE($3, description),

                        latitude =
                            COALESCE($4, latitude),

                        longitude =
                            COALESCE($5, longitude),

                        radius_meters =
                            COALESCE($6, radius_meters),

                        severity =
                            COALESCE($7, severity),

                        is_active =
                            COALESCE($8, is_active),

                        updated_at =
                            CURRENT_TIMESTAMP

                     WHERE id = $9

                     RETURNING *`,
                    [
                        name,
                        zoneType,
                        description,
                        latitude !== undefined
                            ? Number(latitude)
                            : null,
                        longitude !== undefined
                            ? Number(longitude)
                            : null,
                        radiusMeters !== undefined
                            ? Number(radiusMeters)
                            : null,
                        severity,
                        isActive,
                        geofenceId
                    ]
                );

            res.json({
                message:
                    "Geofence updated successfully",
                geofence:
                    result.rows[0]
            });

        } catch (error) {

            console.error(
                "Update geofence error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to update geofence"
            });
        }
    }
);


// ======================================================
// 8. GET GEOFENCE ALERTS
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

            const user =
                await getUser(req.user.userId);

            if (!user) {
                return res.status(401).json({
                    message: "User not found"
                });
            }

            const baseQuery = `
                SELECT
                    ga.*,

                    w.name AS worker_name,
                    w.employee_code,

                    mg.name AS geofence_name,
                    mg.zone_type,
                    mg.severity AS geofence_severity

                FROM geofence_alerts ga

                JOIN workers w
                    ON ga.worker_id = w.id

                JOIN mine_geofences mg
                    ON ga.geofence_id = mg.id
            `;

            let result;

            if (
                user.role ===
                "PLATFORM_ADMIN"
            ) {

                result = await pool.query(
                    `${baseQuery}
                     ORDER BY
                        CASE
                            WHEN ga.status = 'OPEN'
                                THEN 1
                            WHEN ga.status = 'ACKNOWLEDGED'
                                THEN 2
                            ELSE 3
                        END,
                        ga.detected_at DESC`
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
                     WHERE ga.mine_id = $1

                     ORDER BY
                        CASE
                            WHEN ga.status = 'OPEN'
                                THEN 1
                            WHEN ga.status = 'ACKNOWLEDGED'
                                THEN 2
                            ELSE 3
                        END,
                        ga.detected_at DESC`,
                    [user.mine_id]
                );
            }

            res.json({
                count: result.rows.length,
                alerts: result.rows
            });

        } catch (error) {

            console.error(
                "Geofence alerts error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch geofence alerts"
            });
        }
    }
);


// ======================================================
// 9. ACKNOWLEDGE GEOFENCE ALERT
// ======================================================

router.patch(
    "/alerts/:id/acknowledge",
    auth,
    authorize(
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const alertId =
            Number(req.params.id);

        if (!Number.isInteger(alertId)) {
            return res.status(400).json({
                message:
                    "Invalid alert id"
            });
        }

        try {

            const user =
                await getUser(req.user.userId);

            if (!user || !user.mine_id) {
                return res.status(403).json({
                    message:
                        "User is not assigned to a mine"
                });
            }

            const existing =
                await pool.query(
                    `SELECT *
                     FROM geofence_alerts
                     WHERE id = $1`,
                    [alertId]
                );

            if (existing.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Geofence alert not found"
                });
            }

            const alert =
                existing.rows[0];

            if (
                alert.mine_id !==
                user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            if (alert.status !== "OPEN") {
                return res.status(400).json({
                    message:
                        `Alert cannot be acknowledged from status ${alert.status}`
                });
            }

            const result =
                await pool.query(
                    `UPDATE geofence_alerts
                     SET
                        status = 'ACKNOWLEDGED',
                        acknowledged_by = $1,
                        acknowledged_at =
                            CURRENT_TIMESTAMP
                     WHERE id = $2
                     RETURNING *`,
                    [
                        user.id,
                        alertId
                    ]
                );

            res.json({
                message:
                    "Geofence alert acknowledged",
                alert:
                    result.rows[0]
            });

        } catch (error) {

            console.error(
                "Acknowledge geofence alert error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to acknowledge geofence alert"
            });
        }
    }
);


// ======================================================
// 10. RESOLVE GEOFENCE ALERT
// ======================================================

router.patch(
    "/alerts/:id/resolve",
    auth,
    authorize(
        "MINE_MANAGER",
        "SAFETY_OFFICER"
    ),
    async (req, res) => {

        const alertId =
            Number(req.params.id);

        const {
            resolutionNotes
        } = req.body || {};

        if (!Number.isInteger(alertId)) {
            return res.status(400).json({
                message:
                    "Invalid alert id"
            });
        }

        if (!resolutionNotes) {
            return res.status(400).json({
                message:
                    "resolutionNotes are required"
            });
        }

        try {

            const user =
                await getUser(req.user.userId);

            if (!user || !user.mine_id) {
                return res.status(403).json({
                    message:
                        "User is not assigned to a mine"
                });
            }

            const existing =
                await pool.query(
                    `SELECT *
                     FROM geofence_alerts
                     WHERE id = $1`,
                    [alertId]
                );

            if (existing.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Geofence alert not found"
                });
            }

            const alert =
                existing.rows[0];

            if (
                alert.mine_id !==
                user.mine_id
            ) {
                return res.status(403).json({
                    message: "Access denied"
                });
            }

            if (
                ![
                    "OPEN",
                    "ACKNOWLEDGED"
                ].includes(alert.status)
            ) {
                return res.status(400).json({
                    message:
                        `Alert cannot be resolved from status ${alert.status}`
                });
            }

            const result =
                await pool.query(
                    `UPDATE geofence_alerts
                     SET
                        status = 'RESOLVED',
                        resolved_by = $1,
                        resolved_at =
                            CURRENT_TIMESTAMP,
                        resolution_notes = $2
                     WHERE id = $3
                     RETURNING *`,
                    [
                        user.id,
                        resolutionNotes,
                        alertId
                    ]
                );

            res.json({
                message:
                    "Geofence alert resolved",
                alert:
                    result.rows[0]
            });

        } catch (error) {

            console.error(
                "Resolve geofence alert error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to resolve geofence alert"
            });
        }
    }
);


module.exports = router;