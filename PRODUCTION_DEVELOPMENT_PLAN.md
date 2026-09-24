# Fearless Footballer — Production-Ready Development Plan

**Date:** 2026-09-21  
**Status:** Beta v1.0 → Production  
**Platforms:** iOS (Expo) and Android (Expo)  
**Audience:** Young athletes (COPPA/GDPR-K regulated), caregivers

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Phase 1 — Infrastructure Foundation](#2-phase-1--infrastructure-foundation)
3. [Phase 2 — Security & Privacy Hardening](#3-phase-2--security--privacy-hardening)
4. [Phase 3 — API Client Migration](#4-phase-3--api-client-migration)
5. [Phase 4 — Testing Infrastructure](#5-phase-4--testing-infrastructure)
6. [Phase 5 — Performance & Audio Hardening](#6-phase-5--performance--audio-hardening)
7. [Phase 6 — App Store & Play Store Readiness](#7-phase-6--app-store--play-store-readiness)
8. [Phase 7 — Monitoring & Observability](#8-phase-7--monitoring--observability)
9. [Phase 8 — Content & Media Pipeline](#9-phase-8--content--media-pipeline)
10. [Phase 9 — Beta Rollout & Iteration](#10-phase-9--beta-rollout--iteration)
11. [Dependency Map](#11-dependency-map)
12. [Risk Register](#12-risk-register)
13. [Definition of Done](#13-definition-of-done)

---

## 1. Current State Assessment

### What Exists Today

| Layer | Status | Notes |
|-------|--------|-------|
| **Mobile app (Expo SDK 57)** | ✅ Functional beta | React Native with file-based routing, all P0 screens implemented |
| **Local beta API stub** | ⚠️ Stub only | `mobile/src/lib/localBetaApi.ts` (982 lines) — in-memory persistence, no real backend |
| **Backend server** | ❌ Empty | `server/index.ts` is a static file server with no API logic |
| **Database** | ❌ Not provisioned | Prisma schema documented in `docs/DATA_MODELS_AND_SCHEMA.md` only |
| **Shared types** | ✅ Complete | `shared/types.ts` defines all interfaces |
| **UI components** | ✅ Implemented | `mobile/src/ui/index.tsx` has custom RN components |
| **Tests** | ⚠️ Partial | Unit tests for store, guard, and local API exist via vitest |
| **CI/CD** | ❌ None | No GitHub Actions, no build pipelines |
| **Crash reporting** | ❌ None | No error tracking integrated |
| **Analytics** | ❌ None | No analytics SDK |
| **Media/CDN** | ❌ Placeholders | All media URLs reference `cdn.fearlessfootballer.com` (non-existent) |
| **Documentation** | ✅ Excellent | API spec, data models, beta scope, QA plan all documented |

### Critical Gaps for Production

1. **No real backend** — The entire API layer is a local stub with in-memory data; every install starts from scratch.
2. **No database** — Prisma schema is documented but not implemented.
3. **No CI/CD** — No automated build, test, or deployment pipeline.
4. **No production auth** — JWT tokens are generated locally; no real identity provider.
5. **No privacy compliance mechanism** — COPPA/GDPR-K is documented but not enforced in code.
6. **No crash monitoring** — Production apps need real-time error tracking.
7. **No e2e tests** — Only unit tests exist; no test flight / internal testing automation.

---

## 2. Phase 1 — Infrastructure Foundation

**Goal:** Stand up the backend, database, and deployment pipeline that the mobile app depends on.

**Status:** Partially complete. The backend, Prisma schema/migration artifacts, Docker configuration, CI workflow, and dedicated Neon staging/integration database are implemented and migration-tested. Production backups, staging API deployment, deployment promotion, and mobile EAS deployment remain open.

### 2.1 Backend API Server

**What to build:** Replace `server/index.ts` with a real Express (or Fastify) API server implementing the contracts in `docs/API_SPECIFICATION.md`.

| Item | Detail |
|------|--------|
| **Framework** | Node.js + Express or Fastify |
| **Auth** | JWT-based (access token 15-min TTL + refresh token rotation) |
| **Endpoints** | All 7 contract groups from API spec (auth, pairing, sessions, playback events, completion, caregiver dashboard, calculations) |
| **Runtime** | Docker container, deployed to a managed service |
| **Environment** | Staging + Production environments minimum |

**Action items:**
- [x] Implement `POST /auth/register`, `POST /auth/age-gate`
- [x] Implement pairing endpoints (`code`, `claim`, `approve`, `revoke`)
- [x] Implement `GET /sessions/today` with media allow-list filtering
- [x] Implement `POST /sessions/{id}/events` (playback telemetry)
- [x] Implement `POST /sessions/{id}/complete` with idempotency keys
- [x] Implement `GET /caregiver/athletes/{athleteId}/dashboard` with server-side authorization
- [x] Implement error conventions (401, 403, 404, 409, 422) per spec
- [x] Enforce privacy: never log reflection notes, tokens, pairing codes, or raw audio

### 2.2 Database

**What to build:** Provision and migrate the Prisma schema from `docs/DATA_MODELS_AND_SCHEMA.md`.

| Item | Detail |
|------|--------|
| **Primary database** | PostgreSQL (production) |
| **Local/dev database** | SQLite via `expo-sqlite` on device; PostgreSQL locally |
| **Migrations** | Prisma Migrate, version-controlled |
| **Backups** | Automated daily backups with point-in-time recovery |
| **Connection** | SSL/TLS enforced, connection pooling configured |

**Action items:**
- [x] Set up a dedicated PostgreSQL staging/integration instance using Neon; production database provisioning remains open
- [x] Create and version Prisma schema and migration artifacts; apply them to the Neon staging database
- [x] Add seed data for QA
- [ ] Configure read replicas if needed for dashboard reads
- [ ] Set up automated backup schedule
- [ ] Document rollback procedure

### 2.3 CI/CD Pipeline

**What to build:** Automated build, test, and deploy for mobile and backend.

**Action items:**
- [x] Create `.github/workflows/ci.yml` — runs on every PR:
  - TypeScript type check (`tsc --noEmit` in mobile and root)
  - Unit tests (`vitest run` in mobile)
  - Backend lint + type check
- [ ] Create and enable `.github/workflows/deploy-mobile.yml` — on merge to `main`:
  - Build iOS and Android artifacts via Expo Application Services (EAS)
  - Upload to TestFlight / Google Play Internal Testing
- [ ] Create and enable `.github/workflows/deploy-backend.yml` — on merge to `main`:
  - Build and push Docker image to container registry
  - Deploy to staging, then promote to production via approval gate
- [ ] Add branch protection rules (required reviews, passing checks)
- [ ] Set up environment variable management (e.g., `.env` files, secrets in GitHub)

---

## 3. Phase 2 — Security & Privacy Hardening

**Goal:** Achieve COPPA/GDPR-K compliance and protect minor users' data end-to-end.

**Status:** Security and privacy controls are substantially implemented in code. PostgreSQL-backed verification now passes against Neon; TLS/deployment verification, privacy impact assessment, retention policy, and privacy-counsel approval remain open.

### 3.1 Authentication & Authorization

**Action items:**
- [x] Implement custom JWT authentication with access and refresh tokens
- [x] Implement password hashing (bcrypt/argon2) on server — never store plaintext
- [x] Enforce JWT refresh token rotation on the server
- [x] Implement rate limiting on auth endpoints (prevent brute force)
- [ ] Add CSRF protection for web-facing endpoints
- [x] Implement token invalidation during account deletion; password-change revocation remains open

### 3.2 Data Protection

**Action items:**
- [x] Encrypt PII at rest (AES-256) — email, name, birth date
- [ ] Enforce TLS 1.2+ on all connections (server, database, CDN)
- [x] Use `expo-secure-store` for all tokens and credentials on device (already configured in app.json)
- [x] Sanitize all API responses — strip internal fields (password hash, _id, internal IDs)
- [x] Implement server-side authorization for every caregiver data access (not just UI hiding)
- [x] Add audit logging for all data access events (who accessed what, when)

### 3.3 Child Safety (COPPA / GDPR-K)

**Action items:**
- [x] Implement age verification flow that prevents under-age users from registering without guardian consent
- [x] Add parental consent collection and storage (documented consent artifact)
- [x] Provide data deletion mechanism (right to erasure for minors)
- [ ] Ensure reflection data is never stored server-side in an identifiable form (or provide deletion)
- [ ] Document data retention policy (minimum necessary period)
- [ ] Conduct a third-party privacy impact assessment (PIA) before public release
- [x] Add privacy policy and terms of service screens to the mobile app
- [x] Implement consent revocation flow (user can withdraw consent and trigger data deletion)

---

## 4. Phase 3 — API Client Migration

**Goal:** Replace the local beta stub (`localBetaApi.ts`) with a production API client that connects to the real backend.

**Status:** Core migration and offline-sync implementation are complete. Real-backend device validation and a remote feature-flag service remain open.

### 4.1 API Client Rewrite

**Action items:**
- [x] Create `mobile/src/lib/apiClient.ts` — a typed HTTP client (using `fetch`) that:
  - Stores JWT in `expo-secure-store`
  - Attaches `Authorization: Bearer <token>` header automatically
  - Handles 401 responses by redirecting to login
  - Implements idempotency key header support for completion endpoint
  - Uses `Idempotency-Key` header on `POST /sessions/{id}/complete`
- [x] Implement request retry with exponential backoff (network failures)
- [x] Add request timeout (15 seconds default, 60 seconds for upload/completion)
- [x] Write mobile API-client integration tests with mocked HTTP transport; real deployed-backend integration remains open

### 4.2 Offline Sync Hardening

**Action items:**
- [x] Audit and implement `mobile/src/lib/offlineCompletionQueue.ts` — ensure:
  - Idempotency keys are preserved across retries (already in spec)
  - Queue state transitions are: `queued → syncing → synced` or `failed`
  - Failed items have a retry counter and exponential backoff
  - Queue survives app restart and device reboot (AsyncStorage persistence is OK, but verify)
- [x] Add connectivity change listener (use `expo-network`) to trigger sync automatically
- [x] Handle conflict resolution: server timestamp wins, client never overwrites

### 4.3 Feature Flag Readiness

**Action items:**
- [x] Add a minimal environment-based feature flag mechanism (`EXPO_PUBLIC_API_MODE`)
- [ ] Gate guidance/relaxation modes on feature flags (they are P1 and not yet ready)
- [ ] Gate any P1 features that ship after beta launch

---

## 5. Phase 4 — Testing Infrastructure

**Goal:** Build a testing pyramid that gives confidence before every release.

**Status:** Unit and mocked API integration coverage are substantially expanded. Database-backed integration tests, executable native E2E tests, automated accessibility checks, and enforced coverage thresholds remain open.

### 5.1 Unit Tests

**Current:** Vitest is configured; unit tests exist for `sessionStore`, `sessionGuard`, `localBetaApi`.  
**Gap:** Need tests for all business logic, especially metrics and offline queue.

**Action items:**
- [x] Expand `metrics.ts` unit tests — verify composure score calculation deterministically
- [x] Expand `offlineCompletionQueue.ts` tests — verify idempotency, retry, state transitions
- [x] Add tests for API client error handling (403, 404, 409, 422, 5xx, and network failures; 401 refresh is covered by integration tests)
- [x] Add tests for age-gate logic and timezone-aware streak calculations
- [ ] Maintain and enforce ≥80% code coverage on business logic (metrics, queue, guard)

### 5.2 Integration Tests

**Action items:**
- [ ] Set up a local API server (in-memory or Docker) for integration test runs
- [ ] Write database-backed integration tests for the full athlete lifecycle (register → age-gate → pairing → complete)
- [ ] Write database-backed integration tests for the caregiver dashboard authorization rules
- [x] Write mobile offline queue → sync flow tests
- [ ] Write server integration tests verifying caregiver payload excludes private fields

### 5.3 End-to-End (E2E) Tests

**Action items:**
- [ ] Set up Detox or Expo's E2E framework for the mobile app; acceptance scenarios are documented in `mobile/e2e/`
- [ ] Execute E2E tests for critical user journeys:
  - Athlete: welcome → register → age-gate → pairing → session play → completion → reflection
  - Caregiver: register → claim code → approval → dashboard view
  - Offline: play session offline → reconnect → verify sync

### 5.4 Accessibility Testing

**Action items:**
- [ ] Use `axe-core` or `react-native-axe` for automated accessibility checks
- [ ] Manual VoiceOver (iOS) and TalkBack (Android) testing on real devices
- [ ] Verify color contrast ratios programmatically (≥4.5:1 normal text, ≥3:1 large text)
- [ ] Test Dynamic Type / font scaling to 200%
- [ ] Verify all touch targets ≥44×44 pt (iOS) / 48×48 dp (Android)

---

## 6. Phase 5 — Performance & Audio Hardening

**Goal:** Ensure the session player works reliably in real-world conditions.

**Status:** In progress. Phase 4 device validation cleared the transition gate. Expo Audio background playback is configured, and the session player now guards audio-session setup, lock-screen registration, native cleanup, and media-service reset recovery. Physical interruption, Bluetooth, background, startup, and low-memory validation remain open.

### 6.1 Audio Playback

**Action items:**
- [x] Configure and safely register lockscreen playback controls using `expo-audio` built-in media session support
- [x] Guard native audio cleanup when the player is released before React cleanup runs
- [x] Detect media-service resets and preserve progress while prompting for safe resume
- [ ] Test lockscreen playback controls on Android and iOS physical devices
- [ ] Handle incoming phone call interruptions (audio duck/pause → resume)
- [ ] Handle Bluetooth headset disconnect (auto-pause, not speaker broadcast)
- [ ] Handle audio focus conflicts (Spotify, YouTube, etc.)
- [ ] Handle app backgrounding (audio continues if background mode is configured; pause otherwise)
- [ ] Handle headphone/Bluetooth reconnection during playback
- [ ] Verify audio resume after interruption returns to correct position (not start over)

### 6.2 Background Mode Configuration

**Action items:**
- [x] Confirm `expo-audio` background playback is configured correctly in `app.json`
- [ ] Test background audio on both iOS and Android physical devices
- [ ] Implement proper background task handling (expiration handler on iOS)

### 6.3 Performance Optimization

**Action items:**
- [ ] Profile app startup time (target: <3 seconds cold start on mid-tier devices)
- [ ] Lazy-load session player components (don't load all sessions upfront)
- [ ] Implement image caching for thumbnails/avatars (use FastImage or similar)
- [ ] Optimize list rendering (FlashList with proper key extraction)
- [ ] Test on low-RAM devices (Android budget tier: Galaxy A14/A34)
- [ ] Monitor bundle size (target: <150MB for initial download)

---

## 7. Phase 6 — App Store & Play Store Readiness

**Goal:** Meet all platform requirements for public distribution.

### 7.1 App Configuration

**Action items:**
- [ ] Update `app.json`:
  - Bump version to production version (e.g., `1.0.0`)
  - Increment `versionCode` to `1` (Android)
  - Add `privacyCustomizations` if needed for ATT
  - Verify bundle ID is correct (`com.fearlessfootballer.app`)
  - Configure app transport security (ATS) for iOS
  - Configure Android `network_security_config`
- [ ] Generate production app icons (all required sizes for iOS and Android)
- [ ] Generate production splash screens and storyboards
- [ ] Generate iOS App Icons asset catalog
- [ ] Generate Android adaptive icon foreground/background (already in app.json, verify assets exist)
- [ ] Create App Store and Google Play developer accounts ($99/$25)

### 7.2 Privacy & Compliance Submission

**Action items:**
- [ ] Complete Apple Privacy Nutrition Labels:
  - Data used to track: None
  - Data linked to you: User ID, Contact Info (Email), Diagnostics
  - Data not linked: Product Interaction, Crash Data
- [ ] Complete Google Play Data Safety Section:
  - Declare encrypted transit
  - Declare user deletion rights
  - Declare child safety compliance
- [ ] Apple App Tracking Transparency (ATT): Not required (zero third-party tracking)
- [ ] Age rating: Apple 4+ or 9+, Google Play ESRB Everyone / PEGI 3
- [ ] Write privacy policy URL (required by both stores)
- [ ] Write terms of service URL

### 7.3 Build & Submission

**Action items:**
- [ ] Configure EAS Build secrets and credentials in Expo
- [ ] Run `eas build --platform ios --profile production`
- [ ] Run `eas build --platform android --profile production`
- [ ] Upload iOS build to App Store Connect → submit for TestFlight review
- [ ] Upload Android build to Google Play Console → submit to Internal Testing track
- [ ] Set up staged rollout (1% → 5% → 25% → 100%)

---

## 8. Phase 7 — Monitoring & Observability

**Goal:** See what's happening in production, fast.

### 8.1 Crash & Error Reporting

**Action items:**
- [ ] Integrate Sentry (or similar) into the mobile app:
  - Capture all uncaught exceptions and native crashes
  - Tag events with app version, OS version, device model
  - Set up alerts for crash rate increases (>1% of sessions)
- [ ] Add Sentry to the backend server
- [ ] Set up alert routing (Slack, PagerDuty, or email)

### 8.2 Analytics (Privacy-Minimized)

**Action items:**
- [ ] Implement privacy-minimized analytics (no third-party cross-app tracking):
  - Track: session starts, completions, errors, feature usage (anonymized)
  - Do NOT track: user identity, reflection content, audio, or personal data
- [ ] Use a self-hosted or privacy-compliant analytics tool (PostHog, Plausible, or custom)
- [ ] Ensure analytics data cannot be used for re-identification

### 8.3 Backend Monitoring

**Action items:**
- [ ] Set up uptime monitoring for the API (e.g., UptimeRobot, Pingdom)
- [ ] Monitor API latency (p50, p95, p99)
- [ ] Monitor database connection pool usage
- [ ] Monitor error rates and failed request counts
- [ ] Set up log aggregation (e.g., Datadog, Grafana Loki, or CloudWatch)
- [ ] Logs must NOT contain: reflection notes, access tokens, pairing codes, raw audio

### 8.4 User Feedback Loop

**Action items:**
- [ ] Add in-app feedback mechanism (simple form: rating + message)
- [ ] Create a feedback triage process (daily review during beta)
- [ ] Set up a beta tester community channel (Discord, Slack, or email)

---

## 9. Phase 8 — Content & Media Pipeline

**Goal:** Serve real media files from a reliable CDN instead of placeholder URLs.

### 9.1 Media Hosting

**Action items:**
- [ ] Upload audio files (voice stems, music beds) to a CDN (AWS S3 + CloudFront, BunnyCDN, or similar)
- [ ] Upload caption files (.vtt) to CDN
- [ ] Upload transcript files (.txt) to CDN
- [ ] Upload mentor avatars, session thumbnails to CDN
- [ ] Configure CDN with proper cache headers (immutable for hashed assets, short TTL for HTML)
- [ ] Configure CDN with proper access control (signed URLs for athlete-session media)

### 9.2 Media Optimization

**Action items:**
- [ ] Audio: Use AAC-LC format at 128kbps minimum for voice, 192kbps for music beds
- [ ] Audio: Implement adaptive bitrate streaming if session duration increases (HLS)
- [ ] Captions: Validate .vtt files for timing accuracy and accessibility
- [ ] Thumbnails: WebP format, multiple sizes (thumbnail, medium, large)
- [ ] Implement offline download caching (download session media for offline playback)

### 9.3 Content Management

**Action items:**
- [ ] Build a simple content management interface (web dashboard) for:
  - Adding/managing session packages
  - Uploading media files
  - Managing mentor profiles
- [ ] Version session content (already in schema — version field)
- [ ] Implement content approval workflow before new sessions go live

---

## 10. Phase 9 — Beta Rollout & Iteration

**Goal:** Controlled release to beta testers with fast feedback and iteration.

### 10.1 Beta Distribution Setup

**Action items:**
- [ ] Configure Apple TestFlight:
  - Internal testers (up to 100 Apple IDs)
  - External testers (up to 10,000, requires app review)
  - Crash reports accessible via App Store Connect
- [ ] Configure Google Play Internal Testing:
  - Up to 100 testers per track
  - Manage tester groups
- [ ] Create tester onboarding document (how to install, provide feedback)
- [ ] Send invites to initial beta group (10-25 testers)

### 10.2 Beta Monitoring Dashboard

**Action items:**
- [ ] Build a simple dashboard showing:
  - Active users / daily active users
  - Session completion rate
  - Crash rate and top crashes
  - Feedback submissions
  - Offline sync success rate
- [ ] Review dashboard daily during beta

### 10.3 Iteration Cadence

**Action items:**
- [ ] Weekly bug triage (every Monday)
- [ ] Bi-weekly beta update release (every other Tuesday)
- [ ] Monthly privacy and compliance audit
- [ ] After 4 weeks of beta with stable metrics, prepare for public release

---

## 11. Dependency Map

```
Phase 1 (Infrastructure)
├── Backend API Server ──── required by Phase 3 (API Migration)
├── Database ─────────────── required by Backend API Server
└── CI/CD Pipeline ───────── required by all phases

Phase 2 (Security) ──────── required before public beta distribution
    └── Auth integration ── required by Phase 3

Phase 3 (API Migration) ─── depends on Phase 1 + Phase 2
    └── Offline Sync ──────── depends on Backend API

Phase 4 (Testing) ───────── runs in parallel with Phase 3
    ├── Unit tests ────────── independent
    ├── Integration tests ─── depends on Backend API
    └── E2E tests ─────────── depends on Phase 3 (working app)

Phase 5 (Performance) ───── depends on Phase 3 (real media, real API)

Phase 6 (Store Ready) ───── depends on Phase 2, 3, 5

Phase 7 (Monitoring) ────── depends on Phase 6 (production deployment target)

Phase 8 (Media CDN) ─────── depends on Phase 1 (server infra), Phase 6 (store)

Phase 9 (Beta Rollout) ──── depends on Phase 6 + 7
```

---

## 12. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Backend development takes longer than mobile | High | High | Use localBetaApi as parallel development path; mock API contract first |
| COPPA compliance issues found late | Medium | Critical | Engage privacy counsel in Phase 2; PIA before beta |
| Audio playback fails on specific devices | Medium | High | Extensive physical device testing matrix (see QA plan) |
| App Store rejection for child safety | Medium | High | Review Apple/Google guidelines carefully; pre-submission review |
| Offline sync bugs corrupt data | Low | High | Idempotency keys; extensive unit + integration tests |
| CDN media delivery slow globally | Medium | Medium | Use multi-region CDN; monitor with synthetic checks |
| Beta tester engagement too low | Medium | Medium | Personal outreach; easy feedback mechanism; incentivize with early access |
| Scope creep (P1 features pulled into P0) | High | Medium | Strict BETA_SCOPE.md adherence; explicit defer list |

---

## 13. Definition of Done

A release is **production-ready** (beta distribution eligible) when ALL of the following are true:

### Technical
- [ ] Mobile app launches on iOS and Android from native entrypoint
- [ ] All P0 features from BETA_SCOPE.md are implemented and working
- [ ] Athlete and caregiver can complete the full age/consent/pairing lifecycle
- [ ] Session package plays interactively and completes reliably
- [ ] Completion, reflection, streak, and composure updates are persisted and idempotent
- [ ] Offline completion survives reconnect without duplication
- [ ] Caregiver dashboard authorization passes API-level tests (no private data leaked)
- [ ] All API contracts from `docs/API_SPECIFICATION.md` are implemented on the backend
- [ ] TypeScript compiles without errors across mobile and shared packages
- [ ] Unit tests pass with ≥80% coverage on business logic
- [ ] Integration tests pass (full user lifecycle)
- [ ] E2E tests pass (critical user journeys)

### Compliance & Privacy
- [ ] COPPA/GDPR-K compliance verified by privacy counsel
- [ ] Privacy policy and terms of service published
- [ ] Apple Privacy Nutrition Labels completed
- [ ] Google Play Data Safety Section completed
- [ ] Age rating declared correctly (4+ / 9+)
- [ ] Reflection data confirmed private (athlete-only, excluded from all caregiver/analytics payloads)
- [ ] Data deletion mechanism functional

### Quality
- [ ] Crash rate < 0.5% of sessions (Sentry)
- [ ] App startup time < 3 seconds (cold, mid-tier device)
- [ ] Accessibility: VoiceOver/TalkBack tested on real devices
- [ ] Color contrast meets WCAG 2.1 AA
- [ ] Dynamic Type tested to 200% scaling
- [ ] Audio tested on all physical devices in the testing matrix

### Operational
- [ ] CI/CD pipeline running (build, test, deploy)
- [ ] Crash reporting active (Sentry)
- [ ] Backend monitoring active (uptime, latency, errors)
- [ ] Beta distribution configured (TestFlight + Google Play)
- [ ] Rollback plan documented and tested

---

## Estimated Timeline

| Phase | Duration | Depends On |
|-------|----------|------------|
| Phase 1: Infrastructure | 3-4 weeks | — |
| Phase 2: Security & Privacy | 2-3 weeks | Phase 1 (DB) |
| Phase 3: API Migration | 2-3 weeks | Phase 1 + 2 |
| Phase 4: Testing | 3-4 weeks | Parallel with Phase 3 |
| Phase 5: Audio & Performance | 2 weeks | Phase 3 |
| Phase 6: Store Readiness | 1-2 weeks | Phase 2 + 3 + 5 |
| Phase 7: Monitoring | 1 week | Phase 6 |
| Phase 8: Media CDN | 1-2 weeks | Phase 1 |
| Phase 9: Beta Rollout | Ongoing | Phase 6 + 7 |
| **Total estimated time** | **~14-20 weeks** | |

---

*This plan is based on the existing beta codebase at `/mobile/`, the documented API contracts in `/docs/`, and the beta scope lock in `/docs/BETA_SCOPE.md*. All phases are subject to revision based on engineering capacity and beta feedback.*
