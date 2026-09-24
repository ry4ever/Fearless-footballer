# Fearless Footballer — Beta Deployment & TestFlight Rollout Guide

**Target Environments:** Staging (Render / Railway / Docker) & Production  
**Distribution Platforms:** Apple TestFlight (iOS) & Google Play Internal Testing (Android)  
**Primary Users:** Athletes (Ages 10–17) and Caregivers / Parents

---

## 1. Backend Staging Deployment (Node.js / Express + Neon PostgreSQL)

### Step 1.1: Environment Variables Setup
Set the following environment variables in your staging host dashboard (Render, Railway, Fly.io, or AWS ECS):

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://neondb_owner:npg_FXe21mtZVrOb@ep-silent-pond-b4ggho8d-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=<strong-random-32-char-key>
JWT_REFRESH_SECRET=<strong-random-32-char-key>
PII_ENCRYPTION_KEY=<64-char-hex-key>
ALLOWED_ORIGINS=https://fearlessfootballer.com,https://staging.fearlessfootballer.com
```

### Step 1.2: Database Migration & Deployment
Run the following build command on deployment:

```bash
pnpm db:setup
# Runs prisma:generate -> prisma:migrate:deploy -> prisma:seed
```

### Step 1.3: Verify Health Probes
Confirm server readiness and Neon DB pool connectivity:

```bash
curl https://api-staging.fearlessfootballer.com/health/readiness
# Expected Output: {"status":"ok","database":{"connected":true,"latencyMs":42}}
```

---

## 2. EAS Mobile App Build & TestFlight Upload

### Step 2.1: Login to EAS CLI
```bash
npx eas login
```

### Step 2.2: Execute iOS TestFlight Build
```bash
cd mobile
npx eas build --platform ios --profile preview
```

EAS will generate a signed `.ipa` binary and automatically upload it to **Apple App Store Connect TestFlight**.

### Step 2.3: Execute Android Play Store Internal Build
```bash
cd mobile
npx eas build --platform android --profile preview
```

EAS will generate a signed `.aab` Android App Bundle and upload it to **Google Play Console Internal Testing**.

---

## 3. Tester Onboarding & Feedback Process

### Step 3.1: Invite Athlete & Caregiver Testers
1. **Apple TestFlight:** Add caregiver and athlete Apple IDs to the **Internal Testers** group in App Store Connect.
2. **Google Play:** Share the Google Play Internal Testing link with beta participants.

### Step 3.2: Verify Beta Scenarios
- [ ] Athlete registration with age-gating check (Under 13 vs Teen vs Adult)
- [ ] Caregiver account creation & 6-character code pairing (`hashPairingCode`)
- [ ] Today's Fearless Rep rehearsal playback & reflection notes
- [ ] Offline session completion queueing and automatic sync upon network reconnect
- [ ] Caregiver aggregate dashboard metrics review
- [ ] In-app account deletion (`DELETE /auth/account`)
