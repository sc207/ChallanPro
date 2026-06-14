const crypto = require('crypto');

const store = new Map();

function hashOtp(email, otp) {
  return crypto.createHash('sha256').update(`${email}:${otp}`).digest('hex');
}

function generateOtp(email) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const key = email.toLowerCase();
  store.set(key, {
    hash: hashOtp(key, otp),
    expires: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  });
  return otp;
}

function verifyOtp(email, otp) {
  const key = email.toLowerCase();
  const entry = store.get(key);
  if (!entry) return { ok: false, error: 'OTP expired or not found' };
  if (Date.now() > entry.expires) {
    store.delete(key);
    return { ok: false, error: 'OTP expired' };
  }
  if (entry.attempts >= 5) {
    store.delete(key);
    return { ok: false, error: 'Too many attempts' };
  }
  entry.attempts++;
  if (hashOtp(key, otp) !== entry.hash) {
    return { ok: false, error: 'Invalid OTP' };
  }
  store.delete(key);
  return { ok: true };
}

function canRequestOtp(email) {
  const key = email.toLowerCase();
  const entry = store.get(key);
  if (!entry) return true;
  return Date.now() > entry.expires;
}

module.exports = { generateOtp, verifyOtp, canRequestOtp };
