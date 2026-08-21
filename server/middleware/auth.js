const jwt = require('jsonwebtoken');
const config = require('../config');

async function authRequired(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (_) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  // Session-aware: token must map to a live (non-revoked) session so devices can be listed & remotely logged out.
  if (!payload.jti) {
    return res.status(401).json({ error: 'Please sign in again' });
  }
  try {
    const { queryOne, run } = require('../db/connection');
    const s = await queryOne('SELECT revoked FROM sessions WHERE id = ?', [payload.jti]);
    if (!s || s.revoked) return res.status(401).json({ error: 'Session ended' });
    run("UPDATE sessions SET last_seen = datetime('now') WHERE id = ?", [payload.jti]).catch(() => {});
  } catch (e) {
    return res.status(500).json({ error: 'Auth check failed' });
  }
  req.user = payload;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

function signToken(user, jti) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, jti },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

module.exports = { authRequired, requireRole, signToken };
