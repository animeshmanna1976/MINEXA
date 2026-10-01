const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');

const router = express.Router();

const { sendSMS, sendWhatsApp } = require('../services/notificationService');

const { sendEmail } = require('../services/emailService');
/*
=================================================
HELPER: GET AUTHENTICATED USER
=================================================
*/

async function getUserContext(userId) {
    const result = await pool.query(
        `
        SELECT
            u.id,
            u.name,
            u.role,
            u.worker_id,
            u.mine_id,
            u.account_status,
            u.is_verified
        FROM users u
        WHERE u.id = $1
        `,
        [userId]
    );

    return result.rows[0] || null;
}


async function sendIncidentAlerts({
    incident,
    mineId
}) {
    /*
    Only HIGH and CRITICAL incidents
    trigger immediate alerts.
    */

    if (
        !['HIGH', 'CRITICAL'].includes(
            incident.severity
        )
    ) {
        return [];
    }

    const recipientResult = await pool.query(
        `
        SELECT
            id,
            name,
            email,
            phone,
            role
        FROM users
        WHERE mine_id = $1
          AND role IN (
              'MINE_MANAGER',
              'SAFETY_OFFICER'
          )
          AND account_status = 'ACTIVE'
          AND is_verified = TRUE
        `,
        [mineId]
    );

    const notifications = [];

    const alertMessage =
        `MINEMEXA SAFETY ALERT\n\n` +
        `Severity: ${incident.severity}\n` +
        `Type: ${incident.incident_type}\n` +
        `Title: ${incident.title}\n` +
        `Location: ${incident.location || 'Not specified'}\n\n` +
        `Immediate safety review is required.`;

    const emailMessage =
        `Hello,\n\n` +
        `A ${incident.severity} severity safety incident has been reported at your mine.\n\n` +
        `Incident Type: ${incident.incident_type}\n` +
        `Title: ${incident.title}\n` +
        `Description: ${incident.description}\n` +
        `Location: ${incident.location || 'Not specified'}\n\n` +
        `Please review this incident immediately.\n\n` +
        `MINEMEXA Safety System`;

    for (const recipient of recipientResult.rows) {

        /*
        EMAIL
        */
        if (recipient.email) {
            try {
                await sendEmail({
                    to: recipient.email,
                    subject:
                        `🚨 MINEMEXA ${incident.severity} Safety Alert`,
                    text: emailMessage
                });

                notifications.push({
                    recipientId: recipient.id,
                    role: recipient.role,
                    channel: 'EMAIL',
                    status: 'SENT'
                });
            } catch (error) {
                console.error(
                    `Incident alert email failed for user ${recipient.id}:`,
                    error.message
                );

                notifications.push({
                    recipientId: recipient.id,
                    role: recipient.role,
                    channel: 'EMAIL',
                    status: 'FAILED'
                });
            }
        }

        /*
        SMS + WHATSAPP
        */
        if (recipient.phone) {

            try {
                await sendSMS({
                    workerId: null,
                    phone: recipient.phone,
                    notificationType:
                        'INCIDENT_ALERT',
                    message: alertMessage
                });

                notifications.push({
                    recipientId: recipient.id,
                    role: recipient.role,
                    channel: 'SMS',
                    status: 'SENT'
                });
            } catch (error) {
                console.error(
                    `Incident SMS failed for user ${recipient.id}:`,
                    error.message
                );

                notifications.push({
                    recipientId: recipient.id,
                    role: recipient.role,
                    channel: 'SMS',
                    status: 'FAILED'
                });
            }

            try {
                await sendWhatsApp({
                    workerId: null,
                    phone: recipient.phone,
                    notificationType:
                        'INCIDENT_ALERT',
                    message: alertMessage
                });

                notifications.push({
                    recipientId: recipient.id,
                    role: recipient.role,
                    channel: 'WHATSAPP',
                    status: 'SENT'
                });
            } catch (error) {
                console.error(
                    `Incident WhatsApp failed for user ${recipient.id}:`,
                    error.message
                );

                notifications.push({
                    recipientId: recipient.id,
                    role: recipient.role,
                    channel: 'WHATSAPP',
                    status: 'FAILED'
                });
            }
        }
    }

    return notifications;
}
/*
=================================================
CREATE INCIDENT
=================================================
Field Worker, Mine Manager and Safety Officer
can report incidents.

mine_id and reported_by come from the JWT/user
account and are never trusted from the body.
*/

router.post(
    '/',
    authenticateToken,
    requireRoles(
        'FIELD_WORKER',
        'MINE_MANAGER',
        'SAFETY_OFFICER'
    ),
    async (req, res) => {
        try {
            const {
                incidentType,
                title,
                description,
                location,
                severity,
                workerId
            } = req.body;

            const type = String(
                incidentType || ''
            ).trim().toUpperCase();

            const incidentTitle = String(
                title || ''
            ).trim();

            const incidentDescription = String(
                description || ''
            ).trim();

            const incidentLocation = String(
                location || ''
            ).trim() || null;

            const incidentSeverity = String(
                severity || 'MEDIUM'
            ).trim().toUpperCase();

            const allowedTypes = [
                'ACCIDENT',
                'HAZARD',
                'NEAR_MISS',
                'UNSAFE_CONDITION',
                'SAFETY_VIOLATION'
            ];

            const allowedSeverities = [
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            ];

            if (!allowedTypes.includes(type)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid incident type.'
                });
            }

            if (!incidentTitle) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Incident title is required.'
                });
            }

            if (!incidentDescription) {
                return res.status(400).json({
                    status: 'error',
                    message:
                        'Incident description is required.'
                });
            }

            if (
                !allowedSeverities.includes(
                    incidentSeverity
                )
            ) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid incident severity.'
                });
            }

            const user = await getUserContext(
                req.user.userId
            );

            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User account not found.'
                });
            }

            if (
                user.account_status !== 'ACTIVE' ||
                !user.is_verified
            ) {
                return res.status(403).json({
                    status: 'error',
                    message:
                        'Your account is not active or verified.'
                });
            }

            if (!user.mine_id) {
                return res.status(403).json({
                    status: 'error',
                    message:
                        'You are not assigned to a mine.'
                });
            }

            /*
            Determine the worker involved in the incident.

            Field Worker:
            always use their own worker_id.

            Manager/Safety:
            may specify a worker from their own mine.
            */
            let involvedWorkerId = null;

            if (user.role === 'FIELD_WORKER') {
                involvedWorkerId = user.worker_id;

                if (!involvedWorkerId) {
                    return res.status(403).json({
                        status: 'error',
                        message:
                            'Field Worker account is not linked to a worker profile.'
                    });
                }
            } else if (workerId !== undefined && workerId !== null) {
                involvedWorkerId = Number(workerId);

                if (
                    !Number.isInteger(involvedWorkerId) ||
                    involvedWorkerId <= 0
                ) {
                    return res.status(400).json({
                        status: 'error',
                        message:
                            'Invalid worker ID.'
                    });
                }

                const workerResult =
                    await pool.query(
                        `
                        SELECT id
                        FROM workers
                        WHERE id = $1
                          AND mine_id = $2
                        `,
                        [
                            involvedWorkerId,
                            user.mine_id
                        ]
                    );

                if (
                    workerResult.rows.length === 0
                ) {
                    return res.status(404).json({
                        status: 'error',
                        message:
                            'Worker not found in your mine.'
                    });
                }
            }

            const result = await pool.query(
                `
                INSERT INTO incidents
                (
                    mine_id,
                    reported_by,
                    worker_id,
                    incident_type,
                    title,
                    description,
                    location,
                    severity
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8
                )
                RETURNING
                    id,
                    mine_id,
                    reported_by,
                    worker_id,
                    incident_type,
                    title,
                    description,
                    location,
                    severity,
                    status,
                    incident_date,
                    created_at,
                    updated_at
                `,
                [
                    user.mine_id,
                    user.id,
                    involvedWorkerId,
                    type,
                    incidentTitle,
                    incidentDescription,
                    incidentLocation,
                    incidentSeverity
                ]
            );

const incident = result.rows[0];

let notifications = [];

if (
    ['HIGH', 'CRITICAL'].includes(
        incident.severity
    )
) {
    notifications =
        await sendIncidentAlerts({
            incident,
            mineId: user.mine_id
        });
}

return res.status(201).json({
    status: 'success',
    message:
        'Incident reported successfully.',
    incident,
    notifications
});

        } catch (error) {
            console.error(
                'Create incident error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to report incident.'
            });
        }
    }
);


/*
=================================================
GET MY REPORTED INCIDENTS
=================================================
Field Worker can see incidents reported by them.
*/

router.get(
    '/me',
    authenticateToken,
    requireRoles('FIELD_WORKER'),
    async (req, res) => {
        try {
            const result = await pool.query(
                `
                SELECT
                    i.id,
                    i.incident_type,
                    i.title,
                    i.description,
                    i.location,
                    i.severity,
                    i.status,
                    i.incident_date,
                    i.reviewed_at,
                    i.resolution_notes,
                    i.resolved_at,
                    i.created_at,
                    i.updated_at
                FROM incidents i
                WHERE i.reported_by = $1
                ORDER BY
                    i.incident_date DESC,
                    i.id DESC
                `,
                [req.user.userId]
            );

            return res.status(200).json({
                status: 'success',
                incidents: result.rows
            });
        } catch (error) {
            console.error(
                'Get my incidents error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to fetch your incidents.'
            });
        }
    }
);


/*
=================================================
GET MINE INCIDENTS
=================================================
Mine Manager and Safety Officer can view incidents
from their assigned mine.
*/

router.get(
    '/mine',
    authenticateToken,
    requireRoles(
        'PLATFORM_ADMIN',
        'MINE_MANAGER',
        'SAFETY_OFFICER'
    ),
    async (req, res) => {
        try {
            const user = await getUserContext(
                req.user.userId
            );

            if (!user || !user.mine_id) {
                return res.status(403).json({
                    status: 'error',
                    message:
                        'You are not assigned to a mine.'
                });
            }

            const result = await pool.query(
                `
                SELECT
                    i.id,
                    i.incident_type,
                    i.title,
                    i.description,
                    i.location,
                    i.severity,
                    i.status,
                    i.incident_date,

                    w.id AS worker_id,
                    w.name AS worker_name,
                    w.employee_code,

                    reporter.id AS reported_by,
                    reporter.name AS reporter_name,
                    reporter.role AS reporter_role,

                    reviewer.id AS reviewed_by,
                    reviewer.name AS reviewer_name,

                    i.reviewed_at,
                    i.resolution_notes,
                    i.resolved_at,
                    i.created_at,
                    i.updated_at

                FROM incidents i

                LEFT JOIN workers w
                    ON w.id = i.worker_id

                JOIN users reporter
                    ON reporter.id = i.reported_by

                LEFT JOIN users reviewer
                    ON reviewer.id = i.reviewed_by

                WHERE i.mine_id = $1

                ORDER BY
                    i.incident_date DESC,
                    i.id DESC
                `,
                [user.mine_id]
            );

            return res.status(200).json({
                status: 'success',
                incidents: result.rows
            });
        } catch (error) {
            console.error(
                'Get mine incidents error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to fetch mine incidents.'
            });
        }
    }
);


/*
=================================================
GET INCIDENT BY ID
=================================================
Manager and Safety Officer can inspect an incident
in their mine.

Field Worker can only inspect an incident they
reported.
*/

router.get(
    '/:id',
    authenticateToken,
    requireRoles(
        'FIELD_WORKER',
        'MINE_MANAGER',
        'SAFETY_OFFICER'
    ),
    async (req, res) => {
        try {
            const incidentId =
                Number(req.params.id);

            if (
                !Number.isInteger(incidentId) ||
                incidentId <= 0
            ) {
                return res.status(400).json({
                    status: 'error',
                    message:
                        'Invalid incident ID.'
                });
            }

            const user = await getUserContext(
                req.user.userId
            );

            if (!user || !user.mine_id) {
                return res.status(403).json({
                    status: 'error',
                    message:
                        'You are not assigned to a mine.'
                });
            }

            const result = await pool.query(
                `
                SELECT
                    i.id,
                    i.mine_id,
                    i.reported_by,
                    i.worker_id,
                    i.incident_type,
                    i.title,
                    i.description,
                    i.location,
                    i.severity,
                    i.status,
                    i.incident_date,

                    w.name AS worker_name,
                    w.employee_code,

                    reporter.name AS reporter_name,

                    reviewer.id AS reviewed_by,
                    reviewer.name AS reviewer_name,

                    i.reviewed_at,
                    i.resolution_notes,
                    i.resolved_at,
                    i.created_at,
                    i.updated_at

                FROM incidents i

                LEFT JOIN workers w
                    ON w.id = i.worker_id

                JOIN users reporter
                    ON reporter.id = i.reported_by

                LEFT JOIN users reviewer
                    ON reviewer.id = i.reviewed_by

                WHERE i.id = $1
                  AND i.mine_id = $2
                `,
                [
                    incidentId,
                    user.mine_id
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message:
                        'Incident not found in your mine.'
                });
            }

            const incident = result.rows[0];

            if (
                user.role === 'FIELD_WORKER' &&
                incident.reported_by !== user.id
            ) {
                return res.status(403).json({
                    status: 'error',
                    message:
                        'You can only view incidents reported by you.'
                });
            }

            return res.status(200).json({
                status: 'success',
                incident
            });

        } catch (error) {
            console.error(
                'Get incident error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to fetch incident.'
            });
        }
    }
);


/*
=================================================
UPDATE INCIDENT STATUS
=================================================
Only Safety Officers can move an incident through
the investigation lifecycle.
*/

router.patch(
    '/:id/status',
    authenticateToken,
    requireRoles('MINE_MANAGER', 'SAFETY_OFFICER', 'PLATFORM_ADMIN'),
    async (req, res) => {
        try {
            const incidentId =
                Number(req.params.id);

            const newStatus = String(
                req.body.status || ''
            ).trim().toUpperCase();

            const allowedStatuses = [
                'OPEN',
                'UNDER_INVESTIGATION',
                'RESOLVED',
                'CLOSED'
            ];

            if (
                !Number.isInteger(incidentId) ||
                incidentId <= 0
            ) {
                return res.status(400).json({
                    status: 'error',
                    message:
                        'Invalid incident ID.'
                });
            }

            if (!allowedStatuses.includes(newStatus)) {
                return res.status(400).json({
                    status: 'error',
                    message:
                        'Invalid incident status.'
                });
            }

            const user = await getUserContext(
                req.user.userId
            );

            if (!user || !user.mine_id) {
                return res.status(403).json({
                    status: 'error',
                    message:
                        'You are not assigned to a mine.'
                });
            }

            const result = await pool.query(
                `
               UPDATE incidents
SET
    status = $1::VARCHAR(20),

    reviewed_by =
        CASE
            WHEN $1::VARCHAR(20) = 'UNDER_INVESTIGATION'
            THEN $2
            ELSE reviewed_by
        END,

    reviewed_at =
        CASE
            WHEN $1::VARCHAR(20) = 'UNDER_INVESTIGATION'
            THEN CURRENT_TIMESTAMP
            ELSE reviewed_at
        END,

    resolved_at =
        CASE
            WHEN $1::VARCHAR(20) IN ('RESOLVED', 'CLOSED')
            THEN COALESCE(
                resolved_at,
                CURRENT_TIMESTAMP
            )
            ELSE resolved_at
        END,

    updated_at = CURRENT_TIMESTAMP

WHERE id = $3
  AND mine_id = $4
                RETURNING
                    id,
                    status,
                    reviewed_by,
                    reviewed_at,
                    resolved_at,
                    updated_at
                `,
                [
                    newStatus,
                    user.id,
                    incidentId,
                    user.mine_id
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message:
                        'Incident not found in your mine.'
                });
            }

            return res.status(200).json({
                status: 'success',
                message:
                    'Incident status updated successfully.',
                incident: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Update incident status error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to update incident status.'
            });
        }
    }
);


/*
=================================================
RESOLVE INCIDENT
=================================================
Only Safety Officers can add resolution notes and
mark an incident RESOLVED.
*/

router.patch(
    '/:id/resolve',
    authenticateToken,
    requireRoles('MINE_MANAGER', 'SAFETY_OFFICER', 'PLATFORM_ADMIN'),
    async (req, res) => {
        try {
            const incidentId =
                Number(req.params.id);

            const resolutionNotes = String(
                req.body.resolutionNotes || ''
            ).trim();

            if (
                !Number.isInteger(incidentId) ||
                incidentId <= 0
            ) {
                return res.status(400).json({
                    status: 'error',
                    message:
                        'Invalid incident ID.'
                });
            }

            if (!resolutionNotes) {
                return res.status(400).json({
                    status: 'error',
                    message:
                        'Resolution notes are required.'
                });
            }

            const user = await getUserContext(
                req.user.userId
            );

            if (!user || !user.mine_id) {
                return res.status(403).json({
                    status: 'error',
                    message:
                        'You are not assigned to a mine.'
                });
            }

            const result = await pool.query(
                `
                UPDATE incidents
                SET
                    status = 'RESOLVED',
                    reviewed_by = $1,
                    reviewed_at =
                        COALESCE(
                            reviewed_at,
                            CURRENT_TIMESTAMP
                        ),
                    resolution_notes = $2,
                    resolved_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
                  AND mine_id = $4
                  AND status != 'CLOSED'
                RETURNING
                    id,
                    status,
                    resolution_notes,
                    resolved_at,
                    reviewed_by,
                    reviewed_at,
                    updated_at
                `,
                [
                    user.id,
                    resolutionNotes,
                    incidentId,
                    user.mine_id
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message:
                        'Incident not found or already closed.'
                });
            }

            return res.status(200).json({
                status: 'success',
                message:
                    'Incident resolved successfully.',
                incident: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Resolve incident error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to resolve incident.'
            });
        }
    }
);


/*
=================================================
CLOSE INCIDENT
=================================================
Only Safety Officers can close a resolved incident.
*/

router.patch(
    '/:id/close',
    authenticateToken,
    requireRoles('MINE_MANAGER', 'SAFETY_OFFICER', 'PLATFORM_ADMIN'),
    async (req, res) => {
        try {
            const incidentId =
                Number(req.params.id);

            if (
                !Number.isInteger(incidentId) ||
                incidentId <= 0
            ) {
                return res.status(400).json({
                    status: 'error',
                    message:
                        'Invalid incident ID.'
                });
            }

            const user = await getUserContext(
                req.user.userId
            );

            if (!user || !user.mine_id) {
                return res.status(403).json({
                    status: 'error',
                    message:
                        'You are not assigned to a mine.'
                });
            }

            const result = await pool.query(
                `
                UPDATE incidents
                SET
                    status = 'CLOSED',
                    updated_at = CURRENT_TIMESTAMP,
                    resolved_at =
                        COALESCE(
                            resolved_at,
                            CURRENT_TIMESTAMP
                        )
                WHERE id = $1
                  AND mine_id = $2
                  AND status = 'RESOLVED'
                RETURNING
                    id,
                    status,
                    resolved_at,
                    updated_at
                `,
                [
                    incidentId,
                    user.mine_id
                ]
            );

            if (result.rows.length === 0) {
                return res.status(409).json({
                    status: 'error',
                    message:
                        'Only resolved incidents can be closed.'
                });
            }

            return res.status(200).json({
                status: 'success',
                message:
                    'Incident closed successfully.',
                incident: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Close incident error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to close incident.'
            });
        }
    }
);

module.exports = router;