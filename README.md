# ChallanPro — Billing & Credit Manager

Full-stack billing app with multi-company support, OTP login, SQLite storage, and delivery challan printing.

## Quick Start (Local)

```bash
npm install
cp .env.example .env
# Edit .env — set JWT_SECRET and ADMIN_EMAIL
npm run migrate -- --seed
npm start
```

Open http://localhost:3000/login.html

**Dev login:** Without SMTP configured, OTP is printed in the server console.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Random secret for session tokens |
| `ADMIN_EMAIL` | Yes | Bootstrap admin email |
| `SMTP_USER` | Prod | Gmail address |
| `SMTP_APP_PASSWORD` | Prod | Gmail app password |
| `TURSO_DATABASE_URL` | Prod | Turso SQLite URL |
| `TURSO_AUTH_TOKEN` | Prod | Turso auth token |
| `UPLOADS_DIR` | No | Logo upload directory (default: `uploads`) |

## Deploy to Render

See **[DEPLOY.md](DEPLOY.md)** for the full step-by-step guide (Turso, Gmail OTP, Persistent Disk, env vars).

Quick summary:

1. Push to GitHub
2. Create Turso DB → `npm run turso:migrate -- --seed`
3. Create Render Web Service (Node 20) + Persistent Disk for `uploads/`
4. Set env vars (`JWT_SECRET`, `ADMIN_EMAIL`, SMTP, Turso)
5. Login at `/login.html` with admin email

## Features

- Multi-company with dynamic branding (logo, colors, tagline)
- Gmail OTP authentication (admin + staff roles)
- Resource APIs with company isolation
- FIFO payment allocation & aging reports
- Soft delete, challan status workflow, auto bill numbering
- A5 print at 80% scale (118×168mm)
- Mobile card layouts
- Audit log & activity feed
