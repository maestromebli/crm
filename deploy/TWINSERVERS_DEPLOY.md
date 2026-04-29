# ENVER CRM deployment on TwinServers (`enver.com.ua`)

This guide is prepared for account `hq237786` and Passenger-based Node.js hosting.

## 1) Prepare hosting

1. In panel, point domain `enver.com.ua` to this hosting account.
2. Enable SSL for `enver.com.ua` (Let's Encrypt in panel).
3. Create PostgreSQL database/user and save credentials.
4. Set Node.js version to 20+ in hosting panel.

## 2) Upload app files

1. Upload `deploy/crm-standalone.zip` into `/home/hq237786/public_html/`.
2. Extract archive so app files appear directly in `public_html`:
   - `.next/`
   - `node_modules/`
   - `prisma/`
   - `public/`
   - `server.js`
   - `package.json`
3. Upload these files from `deploy/` into the same `public_html`:
   - `app.js`
   - `.htaccess` (use `root-passenger.htaccess` content)
   - `.env.production` (create from `.env.production.example`)

## 3) Configure Passenger startup

Put this content into `/home/hq237786/public_html/.htaccess`:

```apache
PassengerEnabled on
PassengerAppType node
PassengerAppRoot /home/hq237786/public_html
PassengerStartupFile app.js
PassengerBaseURI /
```

## 4) Configure env

Create `/home/hq237786/public_html/.env.production` from `deploy/.env.production.example`.

Mandatory values:
- `DATABASE_URL`
- `NEXTAUTH_URL=https://enver.com.ua`
- `NEXTAUTH_SECRET`
- `DIIA_WEBHOOK_SECRET`
- `CLIENT_PORTAL_TOKEN_SECRET`

## 5) First run / migrations

Run in terminal from `public_html`:

```bash
npm run db:migrate
npm run db:seed
npm run db:ensure-admin
```

If seed is not needed on production with existing data, skip `db:seed`.

## 6) Restart app

Any of:
- in panel: Restart Node app
- or touch Passenger restart file:

```bash
mkdir -p tmp
touch tmp/restart.txt
```

## 7) Smoke check

1. Open `https://enver.com.ua/login`
2. Verify login works.
3. Verify dashboard opens.
4. Verify static assets load (`/_next/*` and images).

## Notes

- If login fails, check `NEXTAUTH_URL` exactly matches browser URL with `https://enver.com.ua`.
- If database errors occur, verify PostgreSQL host/port/user and DB grants.
- Uploads path is under app `public/uploads`; ensure write permissions if needed by hosting policy.
