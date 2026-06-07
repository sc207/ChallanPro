const express = require('express');
const { queryOne, queryAll, run } = require('../db/connection');
const { generateOtp, verifyOtp } = require('../services/otp');
const { sendOtpEmail } = require('../services/mailer');
const { signToken } = require('../middleware/auth');
const { logAudit } = require('../services/audit');
const config = require('../config');

const router = express.Router();

router.get('/me', async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.json({ user: null });
  try {
    const jwt = require('jsonwebtoken');
    const user = jwt.verify(token, config.jwtSecret);
    res.json({ user });
  } catch (_) {
    res.json({ user: null });
  }
});

router.post('/request-otp', async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Email required' });

    let user = await queryOne('SELECT * FROM users WHERE email = ? AND active = 1', [email]);

    if (!user && config.adminEmail && email === config.adminEmail) {
      const existing = await queryAll('SELECT id FROM users LIMIT 1');
      if (!existing.length) {
        await run('INSERT INTO users (email, role) VALUES (?, ?)', [email, 'admin']);
        user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
      }
    }

    if (!user) return res.status(403).json({ error: 'Email not authorized. Contact admin.' });

    const otp = generateOtp(email);
    await sendOtpEmail(email, otp);
    await logAudit({ userEmail: email, action: 'OTP_SENT', entityType: 'auth' });

    res.json({ ok: true, message: 'OTP sent to your email' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const otp = (req.body.otp || '').trim();
    const result = verifyOtp(email, otp);
    if (!result.ok) return res.status(400).json({ error: result.error });

    const user = await queryOne('SELECT * FROM users WHERE email = ? AND active = 1', [email]);
    if (!user) return res.status(403).json({ error: 'User not found' });

    const token = signToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    await logAudit({ userId: user.id, userEmail: email, action: 'LOGIN', entityType: 'auth' });
    res.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/logout', async (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

module.exports = router;
