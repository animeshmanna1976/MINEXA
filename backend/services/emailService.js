const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

async function sendEmail({
    to,
    subject,
    text
}) {
    if (!to) {
        throw new Error('Recipient email is required.');
    }

    if (!subject) {
        throw new Error('Email subject is required.');
    }

    if (!text) {
        throw new Error('Email message is required.');
    }

    try {
        const info = await transporter.sendMail({
            from: `"NEONOVA" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text
        });

        console.log('📧 EMAIL SENT');
        console.log('To:', to);
        console.log('Message ID:', info.messageId);

        return {
            success: true,
            provider: 'GMAIL',
            messageId: info.messageId
        };
    } catch (error) {
        console.error('Email error:', error);
        throw error;
    }
}

module.exports = {
    sendEmail
};