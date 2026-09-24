# Fearless Footballer — Staging & CI/CD Deployment Guide

**Date:** September 2026  
**Audience:** Engineering, DevOps, and Operational Teams  
**Platforms:** Staging Server (Railway/Render/Docker/GHCR), Vercel (Web Frontend), PostgreSQL (Neon Cloud DB), Native Mobile Apps (Expo EAS Build)

---

## 1. Overview & Operational Architecture

The Fearless Footballer production deployment topology consists of:
1. **Web Client (Vercel)**: React 18 / Vite SPA frontend deployed to Vercel via `vercel.json` with dynamic API route proxying.
2. **Backend Server (Railway / Render)**: Containerized Node.js ESM Express API service deployed to Railway via `railway.json` (or Render via `render.yaml`) with automatic health probes (`GET /health/readiness`).
3. **Database Layer (Neon Cloud DB)**: Managed Neon Cloud PostgreSQL instance with automated daily point-in-time snapshots and SSL/TLS transport encryption.
4. **Container Registry**: GitHub Container Registry (`ghcr.io/ry4ever/fearless-footballer-backend`) storing multi-architecture Docker binaries (`linux/amd64`, `linux/arm64`).
5. **Mobile Native Release Pipeline**: Expo Application Services (EAS Build) compiling native iOS (`.ipa`) and Android (`.aab`) app bundles for Apple TestFlight and Google Play Internal Testing tracks.

---

## 2. Environment Variables & Secret Configuration

To ensure strict security and compliance with COPPA/GDPR-K, all production secrets must be set in your managed hosting provider environment or GitHub Repository Secrets (`Settings > Secrets & variables > Actions`):

| Secret Name | Description | Example / Required Format |
|---|---|---|
| `DATABASE_URL` | Live Neon PostgreSQL connection string with SSL | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_ACCESS_SECRET` | Secret key for signing 15-minute access tokens | Min 32 random characters |
| `JWT_REFRESH_SECRET` | Secret key for refresh token rotation | Min 32 random characters |
| `PII_ENCRYPTION_KEY` | AES-256-GCM symmetric key for athlete PII encryption | Exactly 32 characters |
| `SENTRY_DSN` | Sentry error tracking ingestion URL | `https://[key]@o[id].ingest.sentry.io/[project]` |
| `EXPO_TOKEN` / `EAS_TOKEN` | Expo Application Services authentication token | Generated via `eas build` dashboard |

---

## 3. Deployment Procedures

### 3.1 Deploy Web Client to Vercel
1. Import repository `ry4ever/Fearless-footballer` in Vercel Dashboard.
2. Vercel automatically detects `vercel.json` with build command `pnpm run build` and output directory `dist/public`.
3. Set Environment Variable `VITE_CDN_URL` (optional CDN URL).
4. Vercel will automatically build and deploy the React Vite web prototype on `https://[your-app].vercel.app`.

### 3.2 Deploy Backend Server & DB to Railway
1. Connect repository `ry4ever/Fearless-footballer` in Railway Console (`railway.app`).
2. Railway automatically reads `railway.json` and builds the Node.js Express service using `server/Dockerfile`.
3. Configure environment variables in Railway (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PII_ENCRYPTION_KEY`).
4. Railway will automatically bind the health check to `/health/readiness` and deploy the live API.

### 3.3 Automatic Staging Deployment (GitHub Actions)
Every merge to `main` triggers `.github/workflows/deploy.yml`:
1. **Container Build**: Compiles multi-platform Docker container (`server/Dockerfile`) and pushes tagged images to GHCR:
   - `ghcr.io/ry4ever/fearless-footballer-backend:${SHA}`
   - `ghcr.io/ry4ever/fearless-footballer-backend:latest`
2. **Health Check Validation**: Verifies `GET /health/readiness` probe returns `200 OK` with database latency stats.
3. **EAS Build Trigger**: If `EXPO_TOKEN` is configured, automatically runs `eas build --platform all --profile preview --non-interactive` in `mobile/`.

---

## 4. Database Snapshot & Integrity Audit

Run the automated snapshot verification script to audit database tables and confirm referential integrity:

```bash
# Run database snapshot audit
pnpm tsx scripts/backupDb.ts
```

Output confirms:
- User count & profile snapshots
- Published session package availability
- Zero orphaned athlete records
- Security audit log persistence

---

## 5. Mobile Native Release Workflow

### 5.1 Local EAS Build Trigger
```bash
cd mobile

# Trigger iOS preview build
eas build --platform ios --profile preview

# Trigger Android preview build
eas build --platform android --profile preview
```

### 5.2 Store Declarations Reference
Follow `docs/STORE_DECLARATIONS_AND_PRIVACY.md` for Apple Privacy Nutrition Labels and Google Play Data Safety form submissions before submitting binaries to App Store Connect or Google Play Console.
