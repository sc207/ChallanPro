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

```bash
# Rebuild the generated frontend after editing the root index.html (see below)
node scripts/build-public.js
```

**Frontend build step**: `index.html` at the repo root is the *editing source of truth*. Running `node scripts/build-public.js` transforms it into three **generated, git-tracked** files: `public/index.html`, `public/css/app.css`, and `public/css/print.css`. The build extracts the inline `<style>` into `app.css`, appends responsive/print CSS, swaps the inline `SEED`/`loadStore` logic for `<script>` tags (`api.js`, `data.js`, `branding.js`, `admin.js`, `patches.js`), and applies a series of string-replacement patches (branding hooks, per-company PDF colors, async auth init). **Never edit `public/index.html` directly — it will be overwritten on the next build.** Make frontend markup/style changes in the root `index.html`, then rebuild. The hand-written `public/js/*.js` files are *not* generated and are edited directly.

There is no automated test runner or linter configured.

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `JWT_SECRET` — random 64-char string
- `ADMIN_EMAIL` — the first admin user's email
- `SMTP_USER` / `SMTP_APP_PASSWORD` — Gmail with App Password enabled
- Leave `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` empty for local SQLite (creates `data/challan.db`)

If SMTP creds are missing, OTPs are printed to the console (dev fallback). All env vars are centralized in `server/config.js`.

## Architecture

**Backend** — Express.js, split into routes → services → db layers:

- `server/index.js` — app entry: middleware stack (Helmet, CORS, rate limiter, JWT cookie parser), mounts all routes under `/api/`, health check at `/health`, admin-only `/api/backup/export` and `/api/backup/import` endpoints
- `server/config.js` — single source of truth for all env vars; import this instead of `process.env` directly
- `server/routes/` — one file per resource (auth, companies, clients, products, challans, payments, users, activity, settings, dcSeries)
- `server/middleware/auth.js` — `authenticateToken` (JWT from httpOnly cookie), `requireRole('admin')`, `signToken(user)`
- `server/utils/mappers.js` — converts SQLite snake_case rows to camelCase objects; also exports `requireCompanyId` middleware (extracts `companyId` from query or body)
- `server/services/` — `audit.js` (logAudit/formatActivity), `billNumber.js` (financial year + auto-increment), `mailer.js` (SMTP/fallback), `otp.js` (in-memory store, 10-min TTL)
- `server/db/connection.js` — abstracts better-sqlite3 (local) vs @libsql/client (Turso/production); **do not call SQLite APIs directly** — use the exported helpers: `queryAll(sql, params)`, `queryOne(sql, params)`, `run(sql, params)`
- `server/db/schema.sql` — single static DDL file; no migration versioning. Schema is applied automatically on server start if the `companies` table doesn't exist yet.

**Frontend** — Vanilla JS SPA served from `public/` (see the build step above; `public/index.html` is generated from the root `index.html`):

- `public/index.html` — single shell page with all section divs toggled by JS (**generated** — edit the root `index.html` instead)
- `public/js/api.js` — thin fetch wrapper with GET/POST/PUT/DELETE helpers (always sends JSON, returns parsed body; redirects to `/login.html` on 401)
- `public/js/data.js` — global `APP` state object; `loadCompanyData(id)` hydrates all resources for the active company; `persistClient/Product/Challan/Payment()` handles POST-vs-PUT routing
- `public/js/branding.js` — applies `primary_color`/`secondary_color` as CSS variables per company; `renderCompanyLogo()` renders image or initials placeholder
- `public/js/admin.js` — user management UI + activity feed (admin-only)
- `public/js/patches.js` — browser polyfills / minor UI patches

**Database** — SQLite with 9 tables: `companies`, `dc_series`, `clients`, `products`, `challans`, `payments`, `users`, `audit_logs`, `app_settings`. All tables use `is_deleted INTEGER DEFAULT 0` for soft deletes. Foreign keys are enabled.

Notable schema details:
- `challans.items_json` — LINE items stored as a serialized JSON array, parsed by `mapChallan()`
- `challans` also carries `series_id` (→ `dc_series`), `show_dc_no`, `challan_label`, `ref_bill_no`, `vehicle_no`, `receiver`, `notes`
- `clients.opening_balance` / `opening_balance_date` — starting balance folded into outstanding-balance math
- `challans.id` and `payments.id` are TEXT (UUIDs); `clients`, `products`, `users` use INTEGER AUTOINCREMENT
- `mappers.js` preserves legacy field aliases (e.g. `phone`/`gst`/`proprietor`/`billPrefix`/`logo`) for backward compatibility with older frontend code — keep them when updating mappers

## Key Domain Concepts

**Challans** are delivery notes. Lifecycle: `draft` → `confirmed` (assigns bill number) → `cancelled`. Two numbering paths, both in `services/billNumber.js`: the default `assignBillNumber()` uses `{financial_year}/{padded_seq}` (e.g. `2526/001` = FY 2025-26, first bill) and atomically increments `companies.next_bill_number`; if the challan has a `series_id`, `assignBillNumberFromSeries()` uses that series' `prefix` + `next_number` instead.

**DC Series** (`dc_series` table, `/api/dc-series`) are per-company alternative numbering sequences (each with a `name`, `prefix`, `next_number`, `series_type`), letting a company issue challans under multiple independent number runs. Editing a challan with a manually-entered number bumps the series counter if that number is at/above the series' current `next_number`.

**Payments** are recorded against a client, not a specific challan. Outstanding balance is computed frontend-side from challan totals minus payment sums per client.

**Multi-company**: every resource (clients, products, challans, payments) is scoped to a `company_id`. The active company is stored in `app_settings` and sent with every API request. Use `requireCompanyId` middleware (from `utils/mappers.js`) on any company-scoped route.

**Authentication**: passwordless TOTP-only. First login sends an email OTP; after verifying it the user scans a QR code to set up their authenticator app (speakeasy). Subsequent logins verify a 6-digit TOTP code. JWT stored in an httpOnly cookie (7-day expiry). The `/api/auth/request-otp` endpoint is rate-limited to 10 requests per 15 min.

**Audit log**: every CREATE/UPDATE/DELETE/CONFIRM/CANCEL mutation calls `logAudit()` which writes to `audit_logs` with `user_email`, `entity_type`, `entity_id`, `company_id`, and a `details_json` blob.

**Logo uploads**: handled by multer in `companies.js`, 500 KB limit, stored under `uploads/logos/`. Requires a persistent disk in production (see Render setup).

## Deployment

Targets Render.com (`render.yaml` blueprint). Production uses Turso (libsql) instead of local SQLite. Company logos are uploaded to `/uploads/logos/` and require a persistent disk on Render. See `DEPLOY.md` for full steps.
