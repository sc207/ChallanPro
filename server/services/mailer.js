const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  // Already created
  if (transporter) return transporter;

  // Missing config → fallback to dev mode
  if (!config?.smtp?.user || !config?.smtp?.pass) {
    console.warn('[MAILER] SMTP not configured. Running in DEV mode.');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // TLS via STARTTLS
      requireTLS: true,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
    });

    return transporter;
  } catch (err) {
    console.error('[MAILER] Failed to create transporter:', err.message);
    return null;
  }
}

async function sendOtpEmail(email, otp) {
  if (!email) throw new Error('Email is required');
  if (!otp) throw new Error('OTP is required');

  console.log('========== MAILER DEBUG ==========');
  console.log('SMTP_USER:', config?.smtp?.user || 'NOT SET');
  console.log('SMTP_PASS:', config?.smtp?.pass ? 'SET' : 'NOT SET');
  console.log('NODE_ENV:', config?.nodeEnv);
  console.log('==================================');

  const transport = getTransporter();

  // DEV fallback mode
  if (!transport) {
    console.log(`[DEV MODE] OTP for ${email}: ${otp}`);
    return { success: true, dev: true };
  }

  try {
    const info = await transport.sendMail({
      from: `"ChallanPro" <${config.smtp.user}>`,
      to: email,
      subject: 'ChallanPro — Login OTP',
      text: `Your login code is: ${otp}\n\nValid for 10 minutes. Do not share this code.`,
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px">
          <h2>ChallanPro Login</h2>
          <p>Your OTP code is:</p>
          <h1 style="letter-spacing:6px;color:#1d4ed8">${otp}</h1>
          <p style="color:#64748b">Valid for 10 minutes. Do not share this code.</p>
        </div>
      `,
    });

    console.log('[MAILER] Email sent:', info.messageId);

    return {
      success: true,
      dev: false,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error('[MAILER] Send failed:', err.message);

    // IMPORTANT: fallback so login doesn't break
    console.log(`[FALLBACK OTP] ${email}: ${otp}`);

    return {
      success: false,
      error: err.message,
      dev: true,
    };
  }
}

module.exports = { sendOtpEmail };