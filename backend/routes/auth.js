const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET =
    process.env.JWT_SECRET || 'development-secret-change-me';

const ALLOWED_LOGIN_ROLES = [
    'PLATFORM_ADMIN',
    'MINE_MANAGER',
    'SAFETY_OFFICER',
    'FIELD_WORKER'
];

const ALLOWED_REGISTRATION_ROLES = [
    'MINE_MANAGER',
    'SAFETY_OFFICER',
    'FIELD_WORKER'
];

/*
-------------------------------------------------
REGISTER
-------------------------------------------------

Public registration does NOT create an active user.

It creates a registration request with:
status = PENDING

Platform Admin / authorized Manager will
approve it later.
*/
router.post('/register', async (req, res) => {
    try {
        const {
    name,
    email,
    phone,
    requestedRole,
    mineId,
    employeeId,
    department,
    designation,
    certificationNumber,
    safetyTrainingId
} = req.body;

        const cleanName = String(name || '').trim();
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanPhone = String(phone || '').trim();
        const cleanRole = String(requestedRole || '').trim().toUpperCase();

        /*
        -----------------------------------------
        BASIC VALIDATION
        -----------------------------------------
        */

        if (!cleanName || !cleanPhone || !cleanRole) {
    return res.status(400).json({
        status: 'error',
        message: 'Name, phone and requested role are required.'
    });
}

        if (cleanName.length < 2) {
            return res.status(400).json({
                status: 'error',
                message: 'Name must contain at least 2 characters.'
            });
        }

        

        /*
        -----------------------------------------
        ROLE VALIDATION
        -----------------------------------------

        PLATFORM_ADMIN is intentionally NOT allowed.
        */

        if (!ALLOWED_REGISTRATION_ROLES.includes(cleanRole)) {
            return res.status(400).json({
                status: 'error',
                message:
                    'Invalid registration role. Platform Admin accounts cannot be created through public signup.'
            });
        }
        // Email is optional for Field Workers,
// but required for Managers and Safety Officers.
if (
    cleanRole !== 'FIELD_WORKER' &&
    !cleanEmail
) {
    return res.status(400).json({
        status: 'error',
        message:
            'Email is required for Mine Managers and Safety Officers.'
    });
}

        /*
        -----------------------------------------
        MINE VALIDATION
        -----------------------------------------
        */

        const parsedMineId =
            mineId === undefined ||
            mineId === null ||
            mineId === ''
                ? null
                : Number(mineId);

        if (
            cleanRole !== 'PLATFORM_ADMIN' &&
            (!Number.isInteger(parsedMineId) || parsedMineId <= 0)
        ) {
            return res.status(400).json({
                status: 'error',
                message: 'A valid mine is required for this registration.'
            });
        }

        /*
        -----------------------------------------
        CHECK MINE EXISTS
        -----------------------------------------
        */

        if (parsedMineId !== null) {
            const mineResult = await pool.query(
                `
                SELECT id, name, status
                FROM mines
                WHERE id = $1
                `,
                [parsedMineId]
            );

            if (mineResult.rows.length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Selected mine does not exist.'
                });
            }

            if (mineResult.rows[0].status !== 'ACTIVE') {
                return res.status(400).json({
                    status: 'error',
                    message: 'Selected mine is not currently active.'
                });
            }
        }

        /*
        -----------------------------------------
        CHECK EXISTING USERS
        -----------------------------------------
        */

        let existingUser = { rows: [] };

if (cleanEmail) {
    existingUser = await pool.query(
        `
        SELECT id
        FROM users
        WHERE LOWER(email) = $1
        `,
        [cleanEmail]
    );
}

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                status: 'error',
                message:
                    'An account with this email already exists.'
            });
        }

        /*
        -----------------------------------------
        CHECK PENDING REGISTRATION
        -----------------------------------------
        */

let existingRequest = { rows: [] };

if (cleanEmail) {
    existingRequest = await pool.query(
        `
        SELECT id
        FROM registration_requests
        WHERE LOWER(email) = $1
          AND status IN ('PENDING', 'UNDER_REVIEW')
        `,
        [cleanEmail]
    );
}
        if (existingRequest.rows.length > 0) {
            return res.status(409).json({
                status: 'error',
                message:
                    'A registration request for this email is already under review.'
            });
        }
const existingPhoneUser = await pool.query(
    `
    SELECT id
    FROM workers
    WHERE phone = $1
    `,
    [cleanPhone]
);

if (existingPhoneUser.rows.length > 0) {
    return res.status(409).json({
        status: 'error',
        message:
            'An account with this phone number already exists.'
    });
}

const existingPhoneRequest = await pool.query(
    `
    SELECT id
    FROM registration_requests
    WHERE phone = $1
      AND status IN ('PENDING', 'UNDER_REVIEW')
    `,
    [cleanPhone]
);

if (existingPhoneRequest.rows.length > 0) {
    return res.status(409).json({
        status: 'error',
        message:
            'A registration request with this phone number is already under review.'
    });
}
        /*
        -----------------------------------------
        WORKER-SPECIFIC VALIDATION
        -----------------------------------------
        */

        if (cleanRole === 'FIELD_WORKER') {
            if (!employeeId || !String(employeeId).trim()) {
                return res.status(400).json({
                    status: 'error',
                    message:
                        'Employee ID is required for Field Worker registration.'
                });
            }
        }

        /*
        -----------------------------------------
        HASH PASSWORD
        -----------------------------------------
        */

        

        /*
        -----------------------------------------
        INSERT REGISTRATION REQUEST
        -----------------------------------------
        */

        const result = await pool.query(
            `
            INSERT INTO registration_requests
            (
                name,
                email,
                phone,
                password_hash,
                requested_role,
                mine_id,
                employee_id,
                department,
                designation,
                certification_number,
                safety_training_id,
                status
            )
           VALUES
(
    $1,
    $2,
    $3,
    NULL,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    'PENDING'
)
            RETURNING
                id,
                name,
                email,
                requested_role,
                mine_id,
                employee_id,
                status,
                submitted_at
            `,
            [
                cleanName,
                cleanEmail || null,
                cleanPhone ,
                
                cleanRole,
                parsedMineId,
                employeeId ? String(employeeId).trim() : null,
                department ? String(department).trim() : null,
                designation ? String(designation).trim() : null,
                certificationNumber
                    ? String(certificationNumber).trim()
                    : null,
                safetyTrainingId
                    ? String(safetyTrainingId).trim()
                    : null
            ]
        );

        const registration = result.rows[0];

        /*
        -----------------------------------------
        SUCCESS
        -----------------------------------------
        */

        return res.status(201).json({
            status: 'success',
            message:
                'Registration submitted successfully. Your account is pending approval.',
            registration: {
                id: registration.id,
                name: registration.name,
                email: registration.email,
                requestedRole: registration.requested_role,
                mineId: registration.mine_id,
                employeeId: registration.employee_id,
                status: registration.status,
                submittedAt: registration.submitted_at
            }
        });
    } catch (error) {
        console.error('Registration error:', error);

        return res.status(500).json({
            status: 'error',
            message: 'Registration failed.'
        });
    }
});

/*
-------------------------------------------------
LOGIN
-------------------------------------------------
*/

router.post('/login', async (req, res) => {
    try {
        const identifier = String(req.body.identifier || '')
            .trim()
            .toLowerCase();

        const password = String(req.body.password || '');

        if (!identifier || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'User ID/email and password are required'
            });
        }

        const result = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                login_id,
                password_hash,
                role,
                worker_id,
                account_status,
                is_verified,
                verified_at,
                mfa_enabled,
                must_change_password
            FROM users
            WHERE LOWER(email) = $1
               OR LOWER(login_id) = $1
            LIMIT 1
            `,
            [identifier]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid User ID/email or password'
            });
        }

        const user = result.rows[0];

        if (!ALLOWED_LOGIN_ROLES.includes(user.role)) {
            return res.status(403).json({
                status: 'error',
                message:
                    'Your account has an invalid role configuration.'
            });
        }

        if (user.account_status !== 'ACTIVE') {
            return res.status(403).json({
                status: 'error',
                message:
                    `Your account is ${String(
                        user.account_status
                    ).toLowerCase()}. Please contact your administrator.`
            });
        }

        if (!user.is_verified) {
            return res.status(403).json({
                status: 'error',
                message:
                    'Your account has not been verified yet. Please contact your administrator.'
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid User ID/email or password'
            });
        }

        if (user.mfa_enabled) {
            return res.status(403).json({
                status: 'error',
                message:
                    'MFA is enabled for this account, but the MFA verification flow is not implemented yet.',
                code: 'MFA_REQUIRED'
            });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                workerId: user.worker_id,
                role: user.role
            },
            JWT_SECRET,
            {
                expiresIn: '1h'
            }
        );

        return res.status(200).json({
            status: 'success',
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                loginId: user.login_id,
                role: user.role,
                workerId: user.worker_id,
                mustChangePassword: user.must_change_password
            }
        });

    } catch (error) {
        console.error('Login error:', error);

        return res.status(500).json({
            status: 'error',
            message: 'Login failed'
        });
    }
});

/*
-------------------------------------------------
CURRENT USER
-------------------------------------------------
*/
/*
-------------------------------------------------
CHANGE PASSWORD
-------------------------------------------------
*/

router.post(
    '/change-password',
    authenticateToken,
    async (req, res) => {
        try {
            const currentPassword = String(
                req.body.currentPassword || ''
            );

            const newPassword = String(
                req.body.newPassword || ''
            );

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    status: 'error',
                    message:
                        'Current password and new password are required.'
                });
            }

            if (newPassword.length < 8) {
                return res.status(400).json({
                    status: 'error',
                    message:
                        'New password must contain at least 8 characters.'
                });
            }

            if (currentPassword === newPassword) {
                return res.status(400).json({
                    status: 'error',
                    message:
                        'New password must be different from current password.'
                });
            }

            const result = await pool.query(
                `
                SELECT
                    id,
                    password_hash,
                    must_change_password
                FROM users
                WHERE id = $1
                `,
                [req.user.userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User account not found.'
                });
            }

            const user = result.rows[0];

            const passwordMatches = await bcrypt.compare(
                currentPassword,
                user.password_hash
            );

            if (!passwordMatches) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Current password is incorrect.'
                });
            }

            const newPasswordHash = await bcrypt.hash(
                newPassword,
                12
            );

            await pool.query(
                `
                UPDATE users
                SET
                    password_hash = $1,
                    must_change_password = FALSE
                WHERE id = $2
                `,
                [
                    newPasswordHash,
                    user.id
                ]
            );

            return res.status(200).json({
                status: 'success',
                message:
                    'Password changed successfully.'
            });

        } catch (error) {
            console.error(
                'Change password error:',
                error
            );

            return res.status(500).json({
                status: 'error',
                message:
                    'Failed to change password.'
            });
        }
    }
);
router.get('/me', authenticateToken, async (req, res) => {
    try {
       const result = await pool.query(
    `
    SELECT
        u.id,
        u.name,
        u.email,
        u.login_id,
        u.role,
        u.worker_id,
        u.mine_id,
        u.account_status,
        u.is_verified,
        u.verified_at,
        u.mfa_enabled,
        u.must_change_password,
        w.employee_code
    FROM users u
    LEFT JOIN workers w
        ON w.id = u.worker_id
    WHERE u.id = $1
    `,
    [req.user.userId]
);

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        const user = result.rows[0];

        if (user.account_status !== 'ACTIVE') {
            return res.status(403).json({
                status: 'error',
                message: 'Your account is no longer active.'
            });
        }

        if (!user.is_verified) {
            return res.status(403).json({
                status: 'error',
                message: 'Your account is no longer verified.'
            });
        }

return res.status(200).json({
    status: 'success',
    user: {
        id: user.id,
        name: user.name,
        email: user.email,
        loginId: user.login_id,
        role: user.role,
        workerId: user.worker_id,
        mineId: user.mine_id,
        employeeCode: user.employee_code,
        accountStatus: user.account_status,
        isVerified: user.is_verified,
        verifiedAt: user.verified_at,
        mfaEnabled: user.mfa_enabled,
        mustChangePassword: user.must_change_password
    }
});
    } catch (error) {
        console.error('Auth /me error:', error);

        return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch current user'
        });
    }
});

module.exports = router;