# Fearless Footballer — Antigravity Rules & Guidelines

## 1. Project Overview & Architecture
- **Monorepo / Multi-tier Architecture**:
  - `client/`: Web prototype & athlete HQ (React 18, Vite, TypeScript, Tailwind CSS, Radix UI, Lucide Icons).
  - `mobile/`: Cross-platform mobile app (React Native, Expo SDK 52, Expo Router, `expo-audio`, `expo-secure-store`).
  - `server/`: Production REST API (Node.js ESM, Express, TypeScript, Prisma ORM, PostgreSQL).
  - `shared/`: Shared types and domain schemas (`shared/types.ts`).
  - `prisma/`: Database schema, migrations, and seed data (`prisma/schema.prisma`).
- **Package Manager**: `pnpm` for root and server; `pnpm` / `npm` for `mobile/`.

---

## 2. Essential Commands
- **Type Checking**:
  - Root (Server & Web): `pnpm check`
  - Mobile: `npm --prefix mobile run check` (or `cd mobile && npx tsc --noEmit`)
- **Testing**:
  - Server & Web: `pnpm test`
  - Server Security Unit Tests: `pnpm vitest run server/tests/security.test.ts`
  - Mobile Unit Tests: `npm --prefix mobile test`
- **Database & Prisma**:
  - Generate Client: `pnpm prisma:generate`
  - Apply Migrations: `pnpm prisma:migrate:deploy`
  - Seed QA Data: `pnpm prisma:seed`
  - Reset & Setup: `pnpm db:setup`
- **Development Servers**:
  - Web Client: `pnpm dev`
  - Backend API: `pnpm server:dev`
  - Mobile Expo: `npm --prefix mobile start`

---

## 3. Core Architecture & Domain Boundaries
- **Dual-Role Model**:
  - Users are strictly divided into `athlete` and `caregiver` roles.
  - Pairing requires time-limited 6-character claim codes, caregiver approval, and cryptographic hashing (`hashPairingCode`).
- **Privacy & COPPA/GDPR-K Compliance**:
  - **Age Gating**: Under 13 is restricted (`age_verification_required`), 13–17 requires guardian authorization (`pending_guardian_authorization`), 18+ is verified.
  - **PII Encryption**: Store emails, names, and contact details encrypted at rest using AES-256-GCM with blind HMAC search indices (`server/lib/pii.ts`). Never write raw PII to logs.
  - **Audit Logging**: Sanitize all parameters before logging via `sanitizeAuditDetails` in `server/lib/audit.ts`.
- **Mobile API Layer & Offline Resilience**:
  - Screens must **never** make direct raw fetch calls; always route through `mobile/src/lib/apiFacade.ts`.
  - The facade toggles between `local` beta mock and `production` backend via `EXPO_PUBLIC_API_MODE`.
  - Session completions must be idempotent (`idempotencyKey`) and queued via `mobile/src/lib/offlineCompletionQueue.ts` when offline.
  - Sensitive credentials and JWT tokens must be stored in `expo-secure-store`, **never** in plain AsyncStorage.

---

## 4. Coding Standards & Guardrails
- **TypeScript**:
  - Strict mode enabled. Never introduce `any` types; prefer strict schemas or `unknown` with type guards.
  - Add or update shared contracts in `shared/types.ts` rather than duplicating types between `client`, `mobile`, and `server`.
- **UI & Accessibility**:
  - Mobile components must maintain accessible tap targets (minimum 44×44 pt).
  - Audio playback must account for backgrounding, interruptions, and lock-screen controls via `expo-audio`.
- **Database Safeguards**:
  - Never manually edit files inside `prisma/migrations/`.
  - Always verify schema changes with `pnpm prisma:generate` and migration deployment.
