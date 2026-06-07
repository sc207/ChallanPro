# ChallanPro — Production Deployment Guide

Deploy ChallanPro on **Render** (free tier) with **Turso** (SQLite) and **Gmail OTP** login.

## Architecture

| Component | Service | Purpose |
|-----------|---------|---------|
| Web app | Render Web Service | Express + static frontend |
| Database | Turso | Managed SQLite (replaces local `data/challan.db`) |
| File storage | Render Persistent Disk | Company logos at `/uploads` |
| Email | Gmail SMTP | OTP login codes |

## Prerequisites

- GitHub account
- [Render](https://render.com) account
- [Turso](https://turso.tech) account
- Gmail with [App Password](https://myaccount.google.com/apppasswords) enabled (2FA required)

---

## Step 1 — Push to GitHub

```bash
cd "Challan Pro"
git add .
git commit -m "ChallanPro full-stack app"
git remote add origin https://github.com/YOUR_USER/challan-pro.git
git push -u origin main
```

---

## Step 2 — Create Turso Database

```bash
# Install Turso CLI: https://docs.turso.tech/cli
turso auth login
turso db create challan-pro
turso db show challan-pro --url
turso db tokens create challan-pro
```

Save the **Database URL** and **Auth Token**.

### Run migrations against Turso

Set env vars locally (or in Render shell), then migrate:

```bash
export TURSO_DATABASE_URL="libsql://your-db.turso.io"
export TURSO_AUTH_TOKEN="your-token"
npm run migrate -- --seed
```

`--seed` loads demo data only if the database is empty. Skip `--seed` for a clean production start.

---

## Step 3 — Gmail App Password

1. Enable 2-Step Verification on your Google account
2. Go to **Google Account → Security → App passwords**
3. Create an app password for "Mail"
4. Use your Gmail address as `SMTP_USER` and the 16-char password as `SMTP_APP_PASSWORD`

---

## Step 4 — Create Render Web Service

### Option A — Blueprint (`render.yaml`)

1. Render Dashboard → **New** → **Blueprint**
2. Connect your GitHub repo
3. Render reads `render.yaml` and creates the web service

### Option B — Manual

1. **New** → **Web Service** → connect repo
2. **Runtime:** Node 20
3. **Build command:** `npm install`
4. **Start command:** `node server/index.js`
5. **Plan:** Free (or paid for always-on)

### Add Persistent Disk (logos)

1. Open your service → **Disks** → **Add Disk**
2. **Name:** `uploads`
3. **Mount path:** `/opt/render/project/src/uploads` (or set `UPLOADS_DIR` to match)
4. **Size:** 1 GB

> Logo files are stored on disk, not in the database. Without a persistent disk, logos are lost on redeploy.

---

## Step 5 — Environment Variables

Set these in Render → **Environment**:

| Variable | Example | Required |
|----------|---------|----------|
| `NODE_ENV` | `production` | Yes |
| `PORT` | `3000` | Auto-set by Render |
| `JWT_SECRET` | 64-char random string | Yes |
| `ADMIN_EMAIL` | `you@gmail.com` | Yes — first login creates admin |
| `SMTP_USER` | `you@gmail.com` | Yes (prod) |
| `SMTP_APP_PASSWORD` | `abcd efgh ijkl mnop` | Yes (prod) |
| `TURSO_DATABASE_URL` | `libsql://...` | Yes (prod) |
| `TURSO_AUTH_TOKEN` | `eyJ...` | Yes (prod) |
| `UPLOADS_DIR` | `uploads` | No |

Generate JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 6 — First Login

1. Open `https://your-app.onrender.com/login.html`
2. Enter `ADMIN_EMAIL` — OTP is sent via Gmail
3. Verify OTP — account is created as **admin**
4. Go to **Manage Users** → add staff emails
5. Staff log in the same way (OTP only, no passwords)

---

## Step 7 — Post-Deploy Checklist

- [ ] Login works with Gmail OTP
- [ ] Dashboard loads challans and activity feed
- [ ] Add a staff user and confirm they cannot see Companies / Users
- [ ] Upload a company logo (admin) and confirm it persists after redeploy
- [ ] Export backup (admin) and verify JSON download
- [ ] Print a challan — A5, 80% scale (118×168 mm)

---

## Local vs Production

| | Local | Production |
|---|-------|------------|
| Database | `data/challan.db` (better-sqlite3) | Turso (`@libsql/client`) |
| OTP email | Printed to server console | Gmail SMTP |
| Logos | `./uploads/logos/` | Persistent disk |
| HTTPS | No | Render provides SSL |

---

## Troubleshooting

**OTP not received**
- Check `SMTP_USER` / `SMTP_APP_PASSWORD` in Render env
- Review Render logs for mailer errors
- Confirm Gmail app password (not regular password)

**Database errors on startup**
- Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- Run `npm run migrate` from Render Shell with Turso env set

**Logos disappear after deploy**
- Add Persistent Disk mounted at `UPLOADS_DIR`

**Free tier sleeps**
- Render free services spin down after ~15 min idle; first request may take 30–60s

**Import backup fails**
- Admin role required
- Backup must include `challans` and `clients` arrays

---

## Useful Commands

```bash
npm start                    # Local server
npm run migrate              # Schema only
npm run migrate -- --seed    # Schema + demo data (empty DB only)
npm run seed                 # Alias for migrate --seed
```

Render Shell (after deploy):

```bash
npm run migrate
```
