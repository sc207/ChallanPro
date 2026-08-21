const express = require('express');
const router = express.Router();

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const { queryOne, run } = require('../db/connection');
const { signToken } = require('../middleware/auth');
const config = require('../config');
const { logAudit } = require('../services/audit');
const { generateOtp, verifyOtp, canRequestOtp } = require('../services/otp');
const { sendOtpEmail } = require('../services/mailer');

const loginAttempts = {};
// Drop stale rate-limit buckets so this map can't grow unbounded.
function pruneLoginAttempts(now) {
  for (const k of Object.keys(loginAttempts)) {
    loginAttempts[k] = loginAttempts[k].filter(t => now - t < 5 * 60 * 1000);
    if (!loginAttempts[k].length) delete loginAttempts[k];
  }
}

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

/* -------------------- REQUEST EMAIL OTP (to authorise authenticator setup) -------------------- */
// Proves the caller controls the email BEFORE any TOTP secret is issued.
// Always responds { ok:true } so it cannot be used to enumerate registered emails.
router.post('/request-setup-otp', async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Email required' });
    const user = await findUser(email);
    if (user && canRequestOtp(email)) {
      const otp = generateOtp(email);
      try { await sendOtpEmail(email, otp); } catch (_) { /* dev fallback logs the code */ }
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/* -------------------- SETUP AUTHENTICATOR (gated by verified email OTP) -------------------- */
router.post('/setup-authenticator', async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const otp = (req.body.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and email-OTP required' });
    }

    const user = await findUser(email);
    if (!user) {
      return res.status(403).json({ error: 'User is restricted' });
    }

    // Must prove email ownership first — no secret is ever handed out without this.
    const check = verifyOtp(email, otp);
    if (!check.ok) {
      return res.status(400).json({ error: check.error || 'Invalid or expired email code' });
    }

    // Issue a fresh secret for a new enrollment or a re-enrollment (lost device);
    // reuse a pending (not-yet-enabled) secret so a refresh doesn't rotate it mid-setup.
    let secret = user.totp_secret;
    if (!secret || user.totp_enabled) {
      secret = speakeasy.generateSecret({ name: `ChallanPro (${email})`, issuer: 'ChallanPro' }).base32;
      await run('UPDATE users SET totp_secret=?, totp_enabled=0 WHERE id=?', [secret, user.id]);
    }

    const qr = await QRCode.toDataURL(
      `otpauth://totp/ChallanPro:${email}?secret=${secret}&issuer=ChallanPro`
    );

    return res.json({ ok: true, qr, secret });
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

    pruneLoginAttempts(now);
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

    // Create a tracked session (device row) so it can be listed / remotely revoked
    const jti = crypto.randomUUID();
    await run(
      'INSERT INTO sessions (id, user_id, user_email, user_agent, ip) VALUES (?,?,?,?,?)',
      [jti, user.id, user.email, String(req.headers['user-agent'] || '').slice(0, 300), req.ip || '']
    );

    const token = signToken(user, jti);

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
    const user = jwt.verify(token, config.jwtSecret);
    // reflect remote logout: if the session was revoked, report signed-out
    if (user.jti) {
      const s = await queryOne('SELECT revoked FROM sessions WHERE id = ?', [user.jti]);
      if (!s || s.revoked) return res.json({ user: null });
    }
    res.json({ user });
  } catch {
    res.json({ user: null });
  }
});

/* -------------------- LOGOUT -------------------- */
router.post('/logout', async (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      const p = jwt.verify(token, config.jwtSecret);
      if (p.jti) await run('UPDATE sessions SET revoked = 1 WHERE id = ?', [p.jti]);
    } catch (_) {}
  }
  res.clearCookie('token');
  res.json({ ok: true });
});

module.exports = router;