# Phases 1–4 Completion Plan

**Project:** Fearless Footballer  
**Objective:** Move Phases 1–4 from partially verified implementation to a reproducible, staging-ready foundation that can support real-device validation and controlled beta distribution.

## Completion target

Phases 1–4 should be considered complete only when the project can be installed from a clean checkout, provision a disposable PostgreSQL environment, run all server and mobile checks, deploy a staging backend, connect a development build to that backend, and complete the athlete, caregiver, consent, deletion, and offline-sync journeys on physical iOS and Android devices.

The existing code already provides much of the implementation. The remaining work is primarily operational verification, test infrastructure, deployment configuration, and evidence collection. The plan below deliberately separates **implemented in source code** from **verified in a production-like environment**.

## Recommended execution order

The work should proceed in six gates. Each gate produces an artifact or test result that the next gate depends on.

| Gate | Outcome | Depends on |
|---|---|---|
| 1 | Reproducible local infrastructure and database test environment | Existing repository |
| 2 | Verified backend security and privacy behavior | Gate 1 |
| 3 | Staging backend with safe configuration and health checks | Gates 1–2 |
| 4 | Complete mobile API and offline integration verification | Gate 3 |
| 5 | Native E2E, accessibility, and physical-device evidence | Gate 4 |
| 6 | Phase 1–4 release decision and operational handoff | Gates 1–5 |

Do not begin broad device testing before Gate 3. Without a reachable staging backend, device testing will only validate the local beta path and will not prove production API readiness.

## Gate 1 — Make infrastructure reproducible

### 1.1 Establish environment ownership and secrets

Create separate development and staging environment records. Store database credentials, JWT secrets, refresh secrets, PII encryption keys, CORS origins, and API base URLs in the chosen secret manager rather than committing them to repository files. Use distinct keys for development, CI, and staging.

Document which environment is safe for disposable test data. State explicitly that production data must never be used by integration tests.

### 1.2 Make PostgreSQL setup deterministic

Keep the existing Docker Compose PostgreSQL service as the default local database. Add a documented one-command setup that starts PostgreSQL, waits for readiness, generates Prisma Client, applies migrations, and seeds QA data. Prefer `prisma migrate deploy` for migration verification rather than relying only on `prisma db push`.

Add a reset command for disposable local test data. Add a CI database health check that fails with a clear message when PostgreSQL is unavailable.

**Acceptance criteria:**

- A clean checkout can start PostgreSQL without manual database creation.
- Prisma migrations apply successfully to an empty database.
- The seed command creates the minimum data required by integration tests.
- A second migration run is idempotent.
- The server starts with the documented environment variables.

### 1.3 Separate CI checks from deployment

Keep `.github/workflows/ci.yml` responsible for type checks, tests, database setup, and build verification. Make the backend deployment workflow responsible for publishing an image and deploying it to a named staging target. Add a separate production promotion step that requires an explicit environment approval.

Enable the mobile EAS workflow only after `eas.json`, EAS project identity, build profiles, signing credentials, and environment variables are configured. Until then, the workflow should remain clearly marked as unavailable rather than appearing to provide release builds.

**Acceptance criteria:**

- Pull requests run root type checks, mobile type checks, server tests, mobile tests, Prisma generation, migration application, and builds.
- A successful main-branch build publishes a versioned backend image.
- A staging deployment can be identified by commit SHA.
- Production promotion is protected by an approval gate.
- CI artifacts include server and mobile build outputs or a documented reason when a native artifact cannot be built in CI.

### 1.4 Add branch and workflow protections

Require the CI workflow to pass before merging. Require review for changes to authentication, Prisma schema, privacy code, deployment workflows, and mobile release configuration. Restrict production environment secrets to protected branches and approved workflows.

## Gate 2 — Verify backend security and privacy

### 2.1 Run the existing PostgreSQL integration suite

Start the local PostgreSQL service and run `server/tests/phase2-security.integration.test.ts` with a real `DATABASE_URL`. Resolve all failures rather than weakening the test gate. The suite must cover registration, sign-in, refresh rotation, consent grant and revocation, authorization denial, encrypted PII round-trip, account deletion, and rate limiting.

Add a test report to the build artifact containing the commit SHA, database version, test command, and pass count.

**Acceptance criteria:**

- All database-backed Phase 2 integration tests pass.
- Refresh-token rotation rejects reuse of an invalidated refresh token.
- Consent revocation immediately prevents caregiver access.
- Account deletion removes or anonymizes all required records.
- Reflection data does not appear in caregiver responses or sanitized audit details.
- Rate limiting behaves correctly against the real Express route stack.

### 2.2 Complete API contract and authorization tests

Review every route against `docs/API_SPECIFICATION.md`. For each protected endpoint, test missing authentication, invalid authentication, wrong-role authentication, unknown resource, invalid payload, and valid access. Add explicit tests for the caregiver dashboard payload so private reflection notes, raw event details, tokens, password hashes, and internal fields cannot escape.

Confirm the middleware order remains `authenticate` before `requireRole` on every protected route.

### 2.3 Close security configuration gaps

Add a production configuration validation test that fails when required secrets, secure CORS origins, or a non-development database URL are missing. Verify TLS termination at the staging ingress and configure secure database connections. Document secret rotation and PII encryption-key rotation before staging is declared ready.

Decide whether CSRF protection is required for the deployed API surface. If the API is strictly bearer-token based and has no browser cookie authentication, document that decision and the residual risk instead of leaving the question implicit.

### 2.4 Close privacy governance gaps

Write and approve a retention schedule for account data, pairing data, audit records, playback telemetry, completions, and deletion records. Document the data inventory and processing purpose. Complete a privacy impact assessment for minors and obtain privacy counsel review before public beta distribution.

The engineering acceptance gate is that consent, revocation, deletion, and privacy-safe payload tests pass. The legal/compliance gate is separate and cannot be satisfied by tests alone.

## Gate 3 — Create a usable staging backend

### 3.1 Deploy the backend to staging

Choose one managed PostgreSQL service and one managed container runtime. Provision a staging database, run Prisma migrations, configure the backend image, and expose a TLS-protected API URL. Configure a strict CORS allowlist containing only the staging mobile origin or approved development clients.

Add a health check that verifies process health and a deeper readiness check that verifies database connectivity. Do not expose database credentials or administrative endpoints publicly.

### 3.2 Add staging smoke tests

Create a script or CI job that runs against the staging URL and checks health, registration, sign-in, refresh, pairing, session retrieval, completion idempotency, progress, consent revocation, and deletion using disposable accounts. Run cleanup at the end of each successful or failed smoke test.

Use a unique test namespace or generated email address for every run. Do not use real athlete or caregiver information.

**Acceptance criteria:**

- The staging API responds over TLS.
- Health and readiness checks are monitored.
- A disposable athlete can register, sign in, retrieve a session, complete it, and read progress.
- A disposable caregiver can pair only through the authorized flow.
- Repeating a completion with the same idempotency key does not create a duplicate.
- Revocation and deletion work against the deployed database.

## Gate 4 — Complete mobile API migration verification

### 4.1 Validate API client behavior against staging

Keep the current mocked API tests for deterministic transport behavior. Add a staging integration suite that uses the real deployed API for the full lifecycle. The suite should create disposable users and verify register, age gate, sign-in, pairing code, pairing claim, athlete approval, session retrieval, playback events, completion, progress, consent revocation, and account deletion.

Test the following negative cases against staging: expired access token with valid refresh token, invalid refresh token, `403` wrong role, `404` unknown resource, `409` duplicate or conflict, and `422` invalid payload.

### 4.2 Verify offline synchronization on real persistence

Unit tests already cover queue state transitions. Add a test that persists a queued completion, restarts the app or reloads the persistence layer, restores connectivity, and synchronizes it to staging. Verify that the idempotency key remains unchanged and that a retry after a simulated timeout does not duplicate the completion.

Test a server-wins conflict using a completion already present on the backend. Confirm that the client marks the local item synced or reconciled without overwriting the server record.

### 4.3 Verify session and role persistence

Test registration and sign-in in production mode, app restart, role switching, sign-out, token refresh, and account deletion. Confirm that the route guards use the persisted account state and that a deleted account cannot continue using stale local tokens.

### 4.4 Decide the feature-flag boundary

Keep `EXPO_PUBLIC_API_MODE` as the environment switch between local and production APIs. Before declaring Phase 3 complete, decide whether P1 guidance and relaxation modes are excluded from the beta build or require a separate feature flag. If excluded, add an explicit test that the modes do not appear in the UI or are rejected by the session contract.

## Gate 5 — Finish testing infrastructure and device evidence

### 5.1 Enforce coverage

Run Vitest with coverage for mobile business logic and publish the report in CI. Set a threshold for metrics, offline queue, session guard, API client, and facade code. Start with the plan target of 80 percent, then raise it only when the test suite can sustain the threshold without excluding important files.

The threshold must be enforced in CI, not merely reported locally.

### 5.2 Add executable native E2E tests

Choose one runner. Detox is appropriate if the team will maintain native build configurations; Expo Maestro is appropriate if the team wants simpler black-box flows. Do not install both unless there is a clear requirement.

Implement three smoke suites: athlete lifecycle, caregiver pairing and dashboard authorization, and offline completion synchronization. Run them against a development build connected to staging. Store screenshots, logs, device model, OS version, app build, backend commit SHA, and test result as artifacts.

### 5.3 Complete accessibility verification

Add automated checks where the React Native test environment supports them. Then run manual VoiceOver and TalkBack checks on the actual development build. Verify accessible names, focus order, error announcements, keyboard behavior, dynamic font scaling to 200 percent, contrast requirements, and minimum touch targets.

Record failures as issues with screen name, device, OS, reproduction steps, and severity. Accessibility is not complete until critical issues are fixed and the checklist has signed evidence.

### 5.4 Expand server and facade coverage

Preserve the current mobile API client tests and add stable tests for the API facade using the repository's supported Vitest transformer configuration. If a test module triggers a bundler parser limitation, fix the test configuration or use the compatible test style; do not silently remove the intended coverage.

Add server tests for caregiver payload redaction and server-level error conventions. The integration suite should run these tests against PostgreSQL.

## Gate 6 — Completion review and handoff

At the end of the work, create a release evidence bundle containing the following:

- Commit SHA and environment identifiers.
- Root and mobile TypeScript check output.
- Mobile and server unit-test output.
- PostgreSQL integration-test output.
- Coverage report and enforced thresholds.
- Staging deployment URL and backend image digest.
- Staging smoke-test output.
- Native E2E results and device matrix.
- Accessibility checklist and remediation status.
- Security configuration review.
- Privacy retention and impact-assessment decisions.
- Known limitations and explicit deferrals to Phases 5–9.

Phases 1–4 can then be marked complete only if all required engineering acceptance criteria pass. Legal approvals, store readiness, production monitoring, and real media delivery remain separate release gates for later phases.

## Suggested timeline

| Workstream | Expected effort | Output |
|---|---:|---|
| Local PostgreSQL and CI reproducibility | 1–2 days | Repeatable local and CI setup |
| Backend integration and authorization verification | 2–4 days | Passing database-backed suite and redaction tests |
| Staging deployment and smoke tests | 2–4 days | TLS staging API and disposable-account smoke test |
| Mobile staging integration and offline restart tests | 2–3 days | Real-backend lifecycle evidence |
| Coverage enforcement and test cleanup | 1–2 days | CI coverage gate |
| Native E2E setup and smoke journeys | 3–5 days | Device-run E2E artifacts |
| Accessibility and physical-device verification | 2–4 days | Signed device checklist and fixes |
| Final evidence review | 1 day | Phase 1–4 completion decision |

The schedule assumes that staging credentials, a PostgreSQL provider, device access, and a decision about the native E2E runner are available. It does not include legal review time or store submission time.

## Definition of complete for each phase

### Phase 1

Phase 1 is complete when local and CI infrastructure is reproducible, Prisma migrations apply to an empty PostgreSQL database, the backend image is published and deployed to staging, health/readiness checks work, secrets are managed outside source control, and production promotion has a protected approval path.

### Phase 2

Phase 2 is complete when all database-backed security tests pass, every protected endpoint has authorization and negative-case coverage, PII and audit redaction are verified, TLS and secret rotation are configured, deletion and consent revocation are proven against staging, and privacy governance documents are approved.

### Phase 3

Phase 3 is complete when the production API client passes both mocked transport tests and a real staging lifecycle test, token refresh and role persistence work on a device, offline completion survives restart and reconnect without duplication, and the API mode and P1 feature boundaries are explicit.

### Phase 4

Phase 4 is complete when business-logic coverage meets an enforced threshold, server and mobile integration tests pass, native E2E smoke suites run on supported devices, and accessibility checks have executable or signed manual evidence with no unresolved critical issues.

## Immediate next actions

1. Start PostgreSQL and run the existing Phase 2 integration suite.
2. Fix any failures and add caregiver payload-redaction assertions.
3. Make the CI workflow apply migrations and run the complete test matrix from a clean checkout.
4. Provision staging PostgreSQL and a TLS backend deployment.
5. Add disposable-account staging smoke tests.
6. Run the mobile production mode against staging on both platforms.
7. Choose and install one native E2E runner.
8. Add coverage enforcement and complete the device accessibility matrix.
9. Assemble the evidence bundle and update the production plan only after the acceptance criteria pass.
