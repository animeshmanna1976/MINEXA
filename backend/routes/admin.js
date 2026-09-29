const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const { sendSMS, sendWhatsApp } = require('../services/notificationService'); // Added sendWhatsApp
const router = express.Router();
const { sendEmail } = require('../services/emailService');

function generateTemporaryPassword(length = 10) {
    const chars =
        'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

    let password = '';

    for (let i = 0; i < length; i++) {
        password += chars.charAt(
            Math.floor(Math.random() * chars.length)
        );
    }

    return password;
}

/*
=================================================
GET PENDING REGISTRATION REQUESTS
PLATFORM ADMIN ONLY
=================================================
*/

router.get(
    '/registrations',
    authenticateToken,
    requireRoles('PLATFORM_ADMIN'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    r.id,
                    r.name,
                    r.email,
                    r.phone,
                    r.requested_role,
                    r.mine_id,
                    m.name AS mine_name,
                    r.employee_id,
                    r.department,
                    r.designation,
                    r.certification_number,
                    r.safety_training_id,
                    r.status,
                    r.submitted_at,
                    r.reviewed_at,
                    r.reviewed_by
                FROM registration_requests r
                LEFT JOIN mines m
                    ON m.id = r.mine_id
                WHERE r.status IN ('PENDING', 'UNDER_REVIEW')
                ORDER BY r.submitted_at ASC
            `);

            return res.status(200).json({
                status: 'success',
                registrations: result.rows
            });
        } catch (error) {
            console.error(
                'Admin registrations error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch registration requests.'
            });
        }
    }
);

/*
=================================================
APPROVE REGISTRATION
PLATFORM ADMIN ONLY

Admin can approve:
- MINE_MANAGER
- SAFETY_OFFICER
- FIELD_WORKER

Worker still requires safety verification
before becoming active.
=================================================
*/

router.post(
    '/registrations/:id/approve',
    authenticateToken,
    requireRoles('PLATFORM_ADMIN'),
    async (req, res) => {
        const client = await pool.connect();
        let transactionCommitted = false;

        try {
            const registrationId = Number(req.params.id);

            if (
                !Number.isInteger(registrationId) ||
                registrationId <= 0
            ) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid registration ID.'
                });
            }

            await client.query('BEGIN');

            const registrationResult = await client.query(
                `
                SELECT *
                FROM registration_requests
                WHERE id = $1
                FOR UPDATE
                `,
                [registrationId]
            );

            if (registrationResult.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    status: 'error',
                    message: 'Registration request not found.'
                });
            }

            const registration = registrationResult.rows[0];

            if (
                !['PENDING', 'UNDER_REVIEW'].includes(
                    registration.status
                )
            ) {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    status: 'error',
                    message:
                        'This registration request has already been processed.'
                });
            }

            /*
            -----------------------------------------
            DUPLICATE EMAIL CHECK
            -----------------------------------------
            */

            let existingUser = { rows: [] };
            
            if (registration.email) {
                existingUser = await client.query(
                    `
                    SELECT id
                    FROM users
                    WHERE LOWER(email) = LOWER($1)
                    `,
                    [registration.email]
                );
            }

            if (existingUser.rows.length > 0) {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    status: 'error',
                    message:
                        'A user account with this email already exists.'
                });
            }

            /*
            -----------------------------------------
            WORKER APPROVAL
            -----------------------------------------

            Admin approval does NOT immediately activate
            a worker. Worker still needs safety verification.
            */

            if (registration.requested_role === 'FIELD_WORKER') {
                await client.query(
                    `
                    INSERT INTO approval_actions
                    (
                        registration_id,
                        reviewer_id,
                        action,
                        comments
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        'ADMIN_APPROVED',
                        $3
                    )
                    `,
                    [
                        registration.id,
                        req.user.userId,
                        'Approved by Platform Admin'
                    ]
                );

                await client.query(
                    `
                    UPDATE registration_requests
                    SET
                        status = 'UNDER_REVIEW',
                        reviewed_at = CURRENT_TIMESTAMP,
                        reviewed_by = $1
                    WHERE id = $2
                    `,
                    [
                        req.user.userId,
                        registration.id
                    ]
                );

                await client.query('COMMIT');
                transactionCommitted = true;

                return res.status(200).json({
                    status: 'success',
                    message:
                        'Worker registration approved by Platform Admin. Mine Manager and Safety verification are still required.'
                });
            }

            /*
            -----------------------------------------
            MANAGER / SAFETY OFFICER
            -----------------------------------------
            */

            let userId;

            if (
                registration.requested_role === 'MINE_MANAGER' ||
                registration.requested_role === 'SAFETY_OFFICER'
            ) {
                const temporaryPassword = generateTemporaryPassword(10);
                const temporaryPasswordHash = await bcrypt.hash(temporaryPassword, 12);
                
                const loginId =
                    registration.requested_role === 'MINE_MANAGER'
                        ? `MGR-${registration.id}`
                        : `SAFE-${registration.id}`;

                const userResult = await client.query(
                    `
                    INSERT INTO users
                    (
                        name,
                        email,
                        login_id,
                        password_hash,
                        role,
                        mine_id,
                        account_status,
                        is_verified,
                        verified_at,
                        mfa_enabled,
                        must_change_password
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        'ACTIVE',
                        TRUE,
                        CURRENT_TIMESTAMP,
                        FALSE,
                        TRUE
                    )
                    RETURNING
                        id,
                        name,
                        email,
                        login_id,
                        role,
                        mine_id,
                        account_status
                    `,
                    [
                        registration.name,
                        registration.email,
                        loginId,
                        temporaryPasswordHash,
                        registration.requested_role,
                        registration.mine_id
                    ]
                );

                userId = userResult.rows[0].id;

                /*
                -----------------------------------------
                RECORD ADMIN APPROVAL
                -----------------------------------------
                */

                await client.query(
                    `
                    INSERT INTO approval_actions
                    (
                        registration_id,
                        reviewer_id,
                        action,
                        comments
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        'APPROVED',
                        $3
                    )
                    `,
                    [
                        registration.id,
                        req.user.userId,
                        `Approved ${registration.requested_role} registration`
                    ]
                );

                /*
                -----------------------------------------
                UPDATE REGISTRATION
                -----------------------------------------
                */

                await client.query(
                    `
                    UPDATE registration_requests
                    SET
                        status = 'APPROVED',
                        reviewed_at = CURRENT_TIMESTAMP,
                        reviewed_by = $1
                    WHERE id = $2
                    `,
                    [
                        req.user.userId,
                        registration.id
                    ]
                );

                await client.query('COMMIT');
                transactionCommitted = true;
                let emailNotification = null;

                const roleName =
                    registration.requested_role === 'MINE_MANAGER'
                        ? 'Mine Manager'
                        : 'Safety Officer';

const welcomeMessage =
    `Hello ${registration.name},\n\n` +
    `Welcome to MINEMEXA!\n\n` +
    `Your ${roleName} account has been approved and activated successfully.\n\n` +
    `Login Credentials:\n` +
    `User ID: ${loginId}\n` +
    `Temporary Password: ${temporaryPassword}\n\n` +
    `Login to MINEMEXA using these credentials.\n\n` +
    `For security, you will be required to change your password after your first login.\n\n` +
    `Regards,\n` +
    `MINEMEXA Platform Team`;

                if (registration.email) {
                    try {
                        emailNotification = await sendEmail({
                            to: registration.email,
                           subject: `Welcome to MINEMEXA – Your Account is Active`,
                            text: welcomeMessage
                        });
                    } catch (emailError) {
                        console.error(
                            'Activation email failed:',
                            emailError.message
                        );
                    }
                }

                return res.status(200).json({
                    status: 'success',
                    message:
                        'Registration approved and account activated.',
                    userId: userId || null
                });
            }
        } catch (error) {
            if (!transactionCommitted) {
                await client.query('ROLLBACK');
            }

            console.error(
                'Admin approval error:',
                error
            );
            
            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to approve registration.'
            });
        } finally {
            client.release();
        }
    }
);

/*
=================================================
REJECT REGISTRATION
PLATFORM ADMIN ONLY
=================================================
*/

router.post(
    '/registrations/:id/reject',
    authenticateToken,
    requireRoles('PLATFORM_ADMIN'),
    async (req, res) => {
        const client = await pool.connect();
        let transactionCommitted = false;
        
        try {
            const registrationId = Number(req.params.id);

            const reason = String(
                req.body.reason || ''
            ).trim();

            if (
                !Number.isInteger(registrationId) ||
                registrationId <= 0
            ) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid registration ID.'
                });
            }

            if (!reason) {
                return res.status(400).json({
                    status: 'error',
                    message:
                        'A rejection reason is required.'
                });
            }

            await client.query('BEGIN');

            const result = await client.query(
                `
                SELECT
                    id,
                    name,
                    email,
                    status,
                    phone,
                    requested_role
                FROM registration_requests
                WHERE id = $1
                FOR UPDATE
                `,
                [registrationId]
            );

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    status: 'error',
                    message:
                        'Registration request not found.'
                });
            }

            const registration = result.rows[0];

            if (
                !['PENDING', 'UNDER_REVIEW'].includes(
                    registration.status
                )
            ) {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    status: 'error',
                    message:
                        'This registration has already been processed.'
                });
            }

            await client.query(
                `
                UPDATE registration_requests
                SET
                    status = 'REJECTED',
                    rejection_reason = $1,
                    reviewed_at = CURRENT_TIMESTAMP,
                    reviewed_by = $2
                WHERE id = $3
                `,
                [
                    reason,
                    req.user.userId,
                    registrationId
                ]
            );

            await client.query(
                `
                INSERT INTO approval_actions
                (
                    registration_id,
                    reviewer_id,
                    action,
                    comments
                )
                VALUES
                (
                    $1,
                    $2,
                    'REJECTED',
                    $3
                )
                `,
                [
                    registrationId,
                    req.user.userId,
                    reason
                ]
            );

            await client.query('COMMIT');
            transactionCommitted = true;

            const notificationsSent = [];

            // Email fallback logic
            if (registration.email) {
                try {
                    await sendEmail({
                        to: registration.email,
                        subject: 'MINEMEXA Registration Rejected',
                       text:
    `Hello ${registration.name},\n\n` +
    `Your MINEMEXA registration request has been rejected.\n\n` +
    `Reason:\n${reason}\n\n` +
    `Please contact the appropriate mine administrator if you believe this was incorrect.\n\n` +
    `Regards,\n` +
    `MINEMEXA Platform Team`
                    });
                    notificationsSent.push({ type: 'EMAIL', status: 'SENT' });
                } catch (emailError) {
                    console.error('Rejection email failed:', emailError.message);
                    notificationsSent.push({ type: 'EMAIL', status: 'FAILED' });
                }
            } else if (registration.requested_role === 'FIELD_WORKER' && registration.phone) {
               const rejectionMessage =
    `MINEMEXA: Your registration has been rejected.\n\n` +
    `Reason: ${reason}\n\n` +
    `Please contact the mine administrator for further information.`;
                
                // SMS Fallback
                try {
                    await sendSMS({
                        workerId: null,
                        phone: registration.phone,
                        notificationType: 'APPLICATION_REJECTED',
                        message: rejectionMessage
                    });
                    notificationsSent.push({ type: 'SMS', status: 'SENT' });
                } catch (smsError) {
                    console.error('Admin rejection SMS failed:', smsError.message);
                    notificationsSent.push({ type: 'SMS', status: 'FAILED' });
                }

                // WhatsApp Fallback
                if (typeof sendWhatsApp === 'function') {
                    try {
                        await sendWhatsApp({
                            workerId: null,
                            phone: registration.phone,
                            notificationType: 'APPLICATION_REJECTED',
                            message: rejectionMessage
                        });
                        notificationsSent.push({ type: 'WHATSAPP', status: 'SENT' });
                    } catch (waError) {
                        console.error('Admin rejection WhatsApp failed:', waError.message);
                        notificationsSent.push({ type: 'WHATSAPP', status: 'FAILED' });
                    }
                }
            }

            return res.status(200).json({
                status: 'success',
                message: 'Registration request rejected.',
                notifications: notificationsSent
            });

        } catch (error) {
            if (!transactionCommitted) {
                await client.query('ROLLBACK');
            }

            console.error(
                'Admin rejection error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to reject registration.'
            });
        } finally {
            client.release();
        }
    }
);

module.exports = router;