const nodemailer = require('nodemailer');
const dns = require('dns');

// Ensure Node.js prioritizes and forces IPv4 on IPv4-only cloud hosts like Render
try {
    if (typeof dns.setDefaultResultOrder === 'function') {
        dns.setDefaultResultOrder('ipv4first');
    }
} catch (_) {}

async function sendEmail({
    to,
    subject,
    text,
    html
}) {
    if (!to) {
        throw new Error('Recipient email is required.');
    }

    if (!subject) {
        throw new Error('Email subject is required.');
    }

    if (!text && !html) {
        throw new Error('Email message text is required.');
    }

    // 1. IF RESEND_API_KEY is provided, use Resend's HTTPS REST API (Zero firewall/port issues!)
    if (process.env.RESEND_API_KEY) {
        const fromEmail = process.env.EMAIL_FROM || 'MINEXA <onboarding@resend.dev>';

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: fromEmail,
                to: [to],
                subject,
                text,
                ...(html ? { html } : {})
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Resend API Error:', data);
            throw new Error(data.message || 'Failed to send email via Resend API');
        }

        console.log('📧 EMAIL SENT via RESEND');
        console.log('To:', to);
        console.log('Message ID:', data.id);

        return {
            success: true,
            provider: 'RESEND',
            messageId: data.id
        };
    }

    // 2. FALLBACK to SMTP / Gmail
    try {
        let hostAddress = 'smtp.gmail.com';
        try {
            const resolved = await dns.promises.lookup('smtp.gmail.com', { family: 4 });
            if (resolved && resolved.address) {
                hostAddress = resolved.address;
            }
        } catch (_) {}

        const transporter = nodemailer.createTransport({
            host: hostAddress,
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: (process.env.EMAIL_APP_PASSWORD || '').replace(/\s+/g, '')
            },
            tls: {
                servername: 'smtp.gmail.com',
                rejectUnauthorized: false
            }
        });

        const info = await transporter.sendMail({
            from: `"NEONOVA" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            ...(html ? { html } : {})
        });

        console.log('📧 EMAIL SENT via SMTP');
        console.log('To:', to);
        console.log('Message ID:', info.messageId);

        return {
            success: true,
            provider: 'GMAIL',
            messageId: info.messageId
        };
    } catch (error) {
        console.error('SMTP Email error:', error);
        throw error;
    }
}

module.exports = {
    sendEmail
};