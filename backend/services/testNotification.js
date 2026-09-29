require('dotenv').config();

const { sendSMS } = require('./notificationService');

async function testNotification() {
    try {
        const result = await sendSMS({
            workerId: 1,
            phone: '+919999999999',
            notificationType: 'ACCOUNT_ACTIVE',
            message:
                'NEONOVA: Your worker account has been activated successfully.'
        });

        console.log('Notification result:');
        console.log(result);

    } catch (error) {
        console.error(
            'Notification test failed:',
            error.message
        );
    } finally {
        process.exit();
    }
}

testNotification();