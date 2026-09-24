# Phase 2 Completion Plan: Security & Privacy Hardening

## Current State Assessment

Phase 2 is **almost complete**. The server-side security foundation is fully implemented, all mobile screens have been migrated to the feature-flagged API facade, and the only remaining gap is running end-to-end integration tests with a real database.

## What's Already Done ✅

### Server-side (Phase 2 foundation)
- **Real authentication**: JWT access tokens + refresh tokens with rotation via `refreshVersion` (POST `/auth/refresh`)
- **Password security**: bcrypt hashing (cost 12), failed-attempt tracking, 15-minute account lockout
- **PII encryption at rest**: AES-256-GCM via `server/lib/pii.ts` for email, fullName, birthDate
- **Privacy-sensitive hashing**: HMAC-SHA256 for email lookup, pairing codes, password-reset tokens
- **COPPA/GDPR-K consent**: `coppaConsent` + consent policy version/source/actor/timestamps on caregiver links
- **Consent revocation**: `DELETE /auth/consent/:linkId` — both athlete and caregiver can revoke, pairing is revoked and access is cut
- **Account deletion**: `DELETE /auth/account` with full transactional cleanup + anonymized audit log
- **Audit logging**: structured `AuditLog` records with sanitized detail fields
- **Rate limiting**: per-auth-endpoint limiter (5/15min) + global limiter (100/15min)
- **Transport hardening**: Helmet headers, strict CORS allowlist, 1MB body limit, request-id logging
- **Schema + migration**: `prisma/schema.prisma` + migration for Phase 2 models
- **Unit tests**: `server/tests/security.test.ts` — 20/20 passing (password rules, age gate, PII crypto, token rotation, audit sanitization, rate limiting)
- **All 18 server endpoints implemented**: register, sign-in, refresh, password reset, age-gate, pairing code/claim/approve/revoke, consent revoke, account delete, sessions (today, events, complete), athlete progress, athlete queue-status, athlete profile patch, health

### Mobile-side (Phase 2 complete)
- **Production API client** (`mobile/src/lib/apiClient.ts`):
  - `expo-secure-store` token storage
  - automatic access-token refresh on 401 with silent retry
  - retry + exponential backoff with decorrelated jitter
  - request timeouts (15s default, 60s for completions)
  - idempotency key support for completions
  - `syncOfflineCompletions()` for offline queue sync
- **Feature flag** (`mobile/src/lib/apiMode.ts`): `EXPO_PUBLIC_API_MODE` env var (`local` | `production`), defaults to `local`
- **API facade** (`mobile/src/lib/apiFacade.ts`): unified `getApiFacade({ role })` that delegates to either `localBetaApi` or `apiClient` based on `isProductionApi()`, normalizing `{ status, data }` results into throw-on-error behavior via `LocalApiError`
- **Session store** (`mobile/src/lib/sessionStore.ts`): AsyncStorage + expo-secure-store with auth persistence via `persistAuthAccount`
- **Offline queue** (`mobile/src/lib/offlineCompletionQueue.ts`): state machine (queued → syncing → synced/failed), exponential backoff retry, connectivity listener
- **All screens migrated to `getApiFacade`**: zero direct `localBetaApi` imports in `mobile/app/`; all API calls go through the unified facade
- **`LocalBetaApi` interface** now includes `revokeConsent` and `deleteAccount` alongside all other methods, ensuring the local stub has parity with production
- **Settings screens** (`mobile/app/athlete/settings.tsx`, `mobile/app/caregiver/settings.tsx`): now use `getApiFacade` for `revokeConsent` and `deleteAccount` instead of direct `apiClient` imports
- `.env.example` includes `EXPO_PUBLIC_API_MODE=local`

## What's Still Needed for Phase 2 ❌

### 1. Run integration tests with a real database
- `server/tests/phase2-security.integration.test.ts` exists but is gated on `DATABASE_URL` env var (10 skipped tests)
- Needs a running PostgreSQL instance to verify: full auth flow, refresh rotation, consent grant→revoke→denied, account deletion, rate limiting, PII round-trip
- Command: `DATABASE_URL="..." npx vitest run server/tests/phase2-security.integration.test.ts`

### 2. TypeScript type checking
- Run `npx tsc --noEmit` in both `mobile/` and server root to verify no type errors after the apiFacade/settings changes

## Already Completed (per previous plan items)

| Previous Plan Item | Status |
|---|---|
| Step 1: Server endpoints (`/athlete/progress`, `/athlete/queue-status`, `PATCH /athlete/profile`) | ✅ Done |
| Step 2: Offline sync via `apiClient.syncOfflineCompletions()` | ✅ Done |
| Step 3: Feature flag (`EXPO_PUBLIC_API_MODE`) | ✅ Done |
| Step 4: Migrate screens to `getApiFacade` | ✅ Done (all screens + settings) |
| Step 5: Integration tests | ⏳ Ready, awaiting DB |
| Step 6: Verification | ⏳ Pending |

## Implementation Plan (remaining work)

### Step 1: Run integration tests
1. Start PostgreSQL (e.g., `docker compose up -d`)
2. Run `DATABASE_URL="postgresql://..." npx vitest run server/tests/phase2-security.integration.test.ts`
3. All 10 tests should pass

### Step 2: Type checking
1. Run `npx tsc --noEmit` in project root
2. Run `npx tsc --noEmit` in `mobile/` directory (if separate tsconfig)
3. Fix any errors

### Step 3: Verification
1. Run `npx vitest run` (server) to confirm all tests pass
2. Verify `EXPO_PUBLIC_API_MODE=production` + `EXPO_PUBLIC_API_BASE_URL` switches the app to production API
3. Test the full flow on a device with the production API

## Priority Order
1. **Integration tests** — proves Phase 2 is complete
2. **Type checking** — catches migration issues
3. **Device verification** — validates production path end-to-end

## Notes
- `localBetaApi` remains available during migration — the app works without a backend when `EXPO_PUBLIC_API_MODE=local` (default)
- `apiClient.revokeConsent` and `apiClient.deleteAccount` are now also accessible via `getApiFacade` for consistent error handling
- PII encryption key rotation: the current key is a single environment variable; plan for key versioning before launch
