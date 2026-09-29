const pool = require('../db');

/**
 * Mock SMS service for development.
 *
 * Later this function can be replaced with MSG91,
 * Twilio, or another SMS provider without changing
 * the approval routes.
 */
async function sendSMS({
    workerId = null,
    phone,
    message,
    notificationType
}) {
    if (!phone) {
        throw new Error('Phone number is required.');
    }

    if (!message) {
        throw new Error('SMS message is required.');
    }

    if (!notificationType) {
        throw new Error('Notification type is required.');
    }

    try {
        // Save notification in PostgreSQL
        const result = await pool.query(
            `
            INSERT INTO notification_logs
            (
                worker_id,
                phone,
                notification_type,
                message,
                channel,
                status
            )
            VALUES ($1, $2, $3, $4, 'SMS', 'SENT')
            RETURNING *
            `,
            [
                workerId,
                phone,
                notificationType,
                message
            ]
        );

        // Development-only simulation
        console.log('');
        console.log('========================================');
        console.log('📱 MOCK SMS');
        console.log('========================================');
        console.log(`To: ${phone}`);
        console.log(`Type: ${notificationType}`);
        console.log('');
        console.log(message);
        console.log('');
        console.log('Status: SENT');
        console.log('========================================');
        console.log('');

        return {
            success: true,
            provider: 'MOCK',
            notification: result.rows[0]
        };

    } catch (error) {
        console.error('Notification error:', error);

        // Try to save failed notification
        try {
            await pool.query(
                `
                INSERT INTO notification_logs
                (
                    worker_id,
                    phone,
                    notification_type,
                    message,
                    channel,
                    status
                )
                VALUES ($1, $2, $3, $4, 'SMS', 'FAILED')
                `,
                [
                    workerId,
                    phone,
                    notificationType,
                    message
                ]
            );
        } catch (logError) {
            console.error(
                'Failed to save notification log:',
                logError
            );
        }

        throw error;
    }
}

module.exports = {
    sendSMS
};

async function sendWhatsApp({
    workerId = null,
    phone,
    message,
    notificationType
}) {
    if (!phone) {
        throw new Error('Phone number is required.');
    }

    if (!message) {
        throw new Error('WhatsApp message is required.');
    }

    if (!notificationType) {
        throw new Error('Notification type is required.');
    }

    try {
        const result = await pool.query(
            `
            INSERT INTO notification_logs
            (
                worker_id,
                phone,
                notification_type,
                message,
                channel,
                status
            )
            VALUES
            ($1, $2, $3, $4, 'WHATSAPP', 'SENT')
            RETURNING *
            `,
            [
                workerId,
                phone,
                notificationType,
                message
            ]
        );

        console.log('');
        console.log('========================================');
        console.log('💬 MOCK WHATSAPP');
        console.log('========================================');
        console.log(`To: ${phone}`);
        console.log(`Type: ${notificationType}`);
        console.log('');
        console.log(message);
        console.log('');
        console.log('Status: SENT');
        console.log('========================================');
        console.log('');

        return {
            success: true,
            provider: 'MOCK',
            notification: result.rows[0]
        };

    } catch (error) {
        console.error('WhatsApp notification error:', error);

        throw error;
    }
}

module.exports = {
    sendSMS,
    sendWhatsApp
};