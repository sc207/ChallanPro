# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start the server (http://localhost:3000/login.html)
npm start

# Initialize DB with schema + demo data (first-time setup)
npm run migrate -- --seed

# Apply schema only (no demo data)
npm run migrate
```

No build step — frontend assets are plain HTML/CSS/JS served statically by Express.

No test runner or linter is configured.

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `JWT_SECRET` — random 64-char string
- `ADMIN_EMAIL` — the first admin user's email
- `SMTP_USER` / `SMTP_APP_PASSWORD` — Gmail with App Password enabled
- Leave `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` empty for local SQLite (creates `data/challan.db`)

If SMTP creds are missing, OTPs are printed to the console (dev fallback).

## Architecture

**Backend** — Express.js, split into routes → services → db layers:

- `server/index.js` — app entry: middleware stack (Helmet, CORS, rate limiter, JWT cookie parser), mounts all routes under `/api/`
- `server/routes/` — one file per resource (auth, companies, clients, products, challans, payments, users, activity, settings)
- `server/middleware/auth.js` — `authenticateToken` (JWT from httpOnly cookie), `requireRole('admin')`, `requireCompanyId`
- `server/services/` — `audit.js` (logAudit/formatActivity), `billNumber.js` (financial year + auto-increment), `mailer.js` (SMTP/fallback), `otp.js` (in-memory store, 10-min TTL)
- `server/db/connection.js` — abstracts better-sqlite3 (local) vs @libsql/client (Turso/production); exposes `db.prepare()` compatible API
- `server/db/schema.sql` — single static DDL file; no migration versioning
- `server/utils/mappers.js` — converts SQLite snake_case rows to camelCase objects

**Frontend** — Vanilla JS SPA in `public/`:

- `public/index.html` — single shell page with all section divs toggled by JS
- `public/js/api.js` — thin fetch wrapper with GET/POST/PUT/DELETE helpers (always sends JSON, returns parsed body)
- `public/js/data.js` — global `APP` state object; `loadCompanyData(id)` hydrates all resources for the active company
- `public/js/branding.js` — applies `primary_color`/`secondary_color` as CSS variables per company
- `public/js/admin.js` — user management UI + activity feed (admin-only)

**Database** — SQLite with 8 tables: `companies`, `clients`, `products`, `challans`, `payments`, `users`, `audit_logs`, `app_settings`. All tables use `is_deleted INTEGER DEFAULT 0` for soft deletes. Foreign keys are enabled.

## Key Domain Concepts

**Challans** are delivery notes. Lifecycle: `draft` → `confirmed` (assigns bill number) → `cancelled`. Bill numbers use the format `{financial_year}/{padded_seq}` (e.g. `2526/001`) and auto-increment per company.

**Payments** are recorded against a client, not a specific challan. Outstanding balance is computed frontend-side from challan totals minus payment sums per client.

**Multi-company**: every resource (clients, products, challans, payments) is scoped to a `company_id`. The active company is stored in `app_settings` and sent with every API request.

**Authentication**: passwordless TOTP-only. First login triggers authenticator app setup (speakeasy + QR code). Subsequent logins verify a 6-digit code. JWT stored in an httpOnly cookie (7-day expiry).

**Audit log**: every CREATE/UPDATE/DELETE/CONFIRM/CANCEL mutation calls `logAudit()` which writes to `audit_logs` with `user_email`, `entity_type`, `entity_id`, `company_id`, and a `details_json` blob.

## Deployment

Targets Render.com (`render.yaml` blueprint). Production uses Turso (libsql) instead of local SQLite. Company logos are uploaded to `/uploads/logos/` and require a persistent disk on Render. See `DEPLOY.md` for full steps.
