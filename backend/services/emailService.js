const nodemailer = require('nodemailer');
const dns = require('dns');

// Ensure Node.js prioritizes and forces IPv4 on IPv4-only cloud hosts like Render
try {
    if (typeof dns.setDefaultResultOrder === 'function') {
        dns.setDefaultResultOrder('ipv4first');
    }
} catch (_) {}

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // false for port 587 (STARTTLS)
    auth: {
        user: process.env.EMAIL_USER,
        pass: (process.env.EMAIL_APP_PASSWORD || '').replace(/\s+/g, '')
    },
    tls: {
        rejectUnauthorized: false
    },
    // Force IPv4 lookup directly on socket creation
    lookup: (hostname, options, callback) => {
        return dns.lookup(hostname, { family: 4 }, callback);
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