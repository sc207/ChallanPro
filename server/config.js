require('dotenv').config();
const path = require('path');

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  adminEmail: (process.env.ADMIN_EMAIL || '').toLowerCase().trim(),
  smtp: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_APP_PASSWORD || '',
  },
  turso: {
    url: process.env.TURSO_DATABASE_URL || '',
    token: process.env.TURSO_AUTH_TOKEN || '',
  },
  uploadsDir: path.resolve(process.cwd(), process.env.UPLOADS_DIR || 'uploads'),
  isProd: process.env.NODE_ENV === 'production',
};

module.exports = config;
