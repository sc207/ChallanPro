const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.smtp.user || !config.smtp.pass) return null;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  return transporter;
}

async function sendOtpEmail(email, otp) {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[DEV] OTP for ${email}: ${otp}`);
    return { dev: true };
  }
  await transport.sendMail({
    from: config.smtp.user,
    to: email,
    subject: 'ChallanPro — Login OTP',
    text: `Your login code is: ${otp}\n\nValid for 10 minutes. Do not share this code.`,
    html: `<div style="font-family:sans-serif;padding:20px"><h2>ChallanPro Login</h2><p>Your OTP code:</p><h1 style="letter-spacing:8px;color:#1d4ed8">${otp}</h1><p style="color:#64748b">Valid for 10 minutes.</p></div>`,
  });
  return { dev: false };
}

module.exports = { sendOtpEmail };
