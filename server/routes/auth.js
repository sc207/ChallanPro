const express = require('express');
const router = express.Router();

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const { queryOne, run } = require('../db/connection');
const { signToken } = require('../middleware/auth');
const config = require('../config');
const { logAudit } = require('../services/audit');

const loginAttempts = {};

/* -------------------- FIND USER -------------------- */
async function findUser(email) {
  const user = await queryOne(
    'SELECT * FROM users WHERE email = ? AND active = 1',
    [email]
  );

  return user || null;
}

/* -------------------- START LOGIN -------------------- */
router.post('/start-login', async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = await findUser(email);

    if (!user) {
      return res.status(403).json({ error: 'User is restricted' });
    }

    return res.json({
      ok: true,
      totpEnabled: !!user.totp_enabled,
      step: user.totp_enabled ? 'verify' : 'setup'
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/* -------------------- SETUP AUTHENTICATOR -------------------- */
router.post('/setup-authenticator', async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = await findUser(email);

    if (!user) {
      return res.status(403).json({ error: 'User is restricted' });
    }

    // If already fully enabled, DON'T break flow
    if (user.totp_enabled && user.totp_secret) {
      const qr = await QRCode.toDataURL(
        `otpauth://totp/ChallanPro:${email}?secret=${user.totp_secret}&issuer=ChallanPro`
      );

      return res.json({
        ok: true,
        alreadySetup: true,
        qr,
        secret: user.totp_secret
      });
    }

    // If secret exists but not enabled yet
    let secret = user.totp_secret;

    if (!secret) {
      const generated = speakeasy.generateSecret({
        name: `ChallanPro (${email})`,
        issuer: 'ChallanPro'
      });

      secret = generated.base32;

      await run(
        'UPDATE users SET totp_secret=? WHERE id=?',
        [secret, user.id]
      );
    }

    const qr = await QRCode.toDataURL(
      `otpauth://totp/ChallanPro:${email}?secret=${secret}&issuer=ChallanPro`
    );

    return res.json({
      ok: true,
      qr,
      secret
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/* -------------------- VERIFY AUTHENTICATOR -------------------- */
router.post('/verify-authenticator', async (req, res) => {
  try {

    const now = Date.now();
    const email = (req.body.email || '').toLowerCase().trim();
    const code = (req.body.code || '').trim();

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code required' });
    }

    const key = `${email}:${req.ip}`;

    if (!loginAttempts[key]) {
      loginAttempts[key] = [];
    }

    loginAttempts[key] = loginAttempts[key].filter(
      t => now - t < 5 * 60 * 1000
    );

    if (loginAttempts[key].length >= 5) {
      return res.status(429).json({
        error: 'Too many attempts. Try again after 5 minutes.'
      });
    }

    loginAttempts[key].push(now);

    const user = await findUser(email);

    if (!user) {
      return res.status(403).json({ error: 'User is restricted' });
    }

    if (!user.totp_secret) {
      return res.status(400).json({ error: 'Authenticator not set up' });
    }

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: code,
      window: 1
    });

    if (!valid) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    // enable after successful login
    await run(
      'UPDATE users SET totp_enabled=1 WHERE id=?',
      [user.id]
    );

    const token = signToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN',
      entityType: 'auth'
    });

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/* -------------------- ME -------------------- */
router.get('/me', async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.json({ user: null });

  try {
    const jwt = require('jsonwebtoken');
    const user = jwt.verify(token, config.jwtSecret);
    res.json({ user });
  } catch {
    res.json({ user: null });
  }
});

/* -------------------- LOGOUT -------------------- */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

module.exports = router;