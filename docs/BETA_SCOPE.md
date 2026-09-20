# Fearless Footballer — Beta v1.0 Scope Lock

**Status:** Phase 0 decision record  
**Date:** 2026-09-19  
**Target:** iOS and Android beta client

## Platform decision

The beta client is **React Native with Expo SDK 57 (managed workflow)**. The existing React/Vite application remains a **design and interaction reference only**. It is not the beta release client, and beta feature work must not be added to its screen flow.

The mobile client should reuse product language, session metadata, privacy boundaries, and visual direction from the web prototype where useful. It must not reuse the web app's hash-based navigation, browser-only audio engine, hardcoded dashboard state, or five-tab prototype shell as release architecture.

## P0 — Required beta slice

The beta is a thin vertical slice, not a reduced version of every prototype screen.

1. **One athlete account**
   - Athlete registration and age gate.
   - One athlete profile and one active caregiver relationship.
   - Youth-accessible consent language and a restricted state until required consent is recorded.

2. **One caregiver account**
   - Caregiver registration and sign-in.
   - One-to-one pairing with the athlete.
   - Explicit athlete approval and revocation of caregiver access.

3. **Consent and pairing flow**
   - Athlete generates a short-lived pairing code.
   - Caregiver claims the code and records the relationship and consent decision.
   - Athlete approves the pending link before caregiver data becomes visible.
   - Revocation immediately removes caregiver access.

4. **One production-ready session package**
   - Exactly one published beta session: **Nerves = Performance**.
   - Versioned metadata, phases, prompts, captions/transcript reference, and interactive-mode media contract.
   - Guidance and relaxation modes are P1 and ship only when their media packages pass the same readiness gate.

5. **Interactive playback**
   - Play, pause, seek, phase progress, timed prompts, and session completion.
   - Native mobile audio behavior is required for the beta; browser Web Audio synthesis is not an acceptable substitute.
   - Handle app backgrounding, audio interruption, and headphone/Bluetooth changes before release.

6. **Completion and private reflection**
   - Persist a completion event only after the athlete reaches the completion threshold.
   - Offer the private feeling check-in and optional private note.
   - Reflection content is visible only to the athlete and is never included in caregiver payloads.

7. **Composure and streak metrics**
   - Show the athlete's current composure index, weekly change, current streak, best streak, and weekly completion rhythm.
   - Use the documented non-clinical naming and timezone-aware streak rules.
   - Keep metric calculation deterministic and testable.

8. **Read-only caregiver dashboard**
   - Show only aggregate progress patterns, last-rep metadata, streak/composure indices, and supportive conversation starters.
   - Do not expose playback controls, audio, transcripts, responses, reflection text, or raw session data.
   - Enforce the caregiver relationship and active consent server-side; do not rely on hiding controls in the UI.

9. **Offline completion queue**
   - Queue a completion event when the device is offline.
   - Retry safely after reconnection.
   - Use an idempotency key so a retry cannot duplicate a completion, streak, or composure update.

## P1 — Conditional or next slice

- Guidance and relaxation playback when their audio/caption packages are ready.
- Accessibility, legal/privacy copy, analytics minimization, and hardening required for public beta distribution.
- Physical-device QA, TestFlight, and Google Play Internal Testing.
- Backend production hardening and media CDN delivery needed to replace any beta stub or local fixture.

## Explicitly deferred

The following are outside beta v1.0 and must not be pulled into the P0 implementation:

- Mentor Feed.
- Vault badges and saved anchors.
- Map integration.
- Multiple caregivers.
- Social or community features.
- Advanced personalization.
- Push notifications unless the beta test plan explicitly requires them.
- Additional session packages beyond the one beta package.

## Release gates

A build is eligible for beta distribution only when all P0 gates pass:

- Expo SDK 57 mobile app launches on iOS and Android from the native entrypoint.
- Athlete and caregiver can complete the age/consent/pairing lifecycle.
- The single session package plays interactively and completes reliably.
- Completion, private reflection, streak, and composure updates are persisted and idempotent.
- Offline completion survives reconnect without duplication.
- Caregiver dashboard authorization and privacy invariants pass API-level tests.
- Accessibility, child-safety, and non-clinical wording checks pass.
- The React/Vite prototype is not packaged, linked, or treated as the beta client.

## Implementation order

1. Expo shell and typed route structure.
2. Shared beta contracts and one session fixture.
3. Age gate, accounts, consent, and pairing.
4. Native session playback.
5. Completion, reflection, metrics, and offline queue.
6. Read-only caregiver dashboard.
7. Privacy, accessibility, legal, hardening, and device QA.

## Reference status of the web prototype

`client/` is retained for visual review, content exploration, and design comparison. Its hardcoded screens, hash navigation, browser audio engine, and mock state are not beta acceptance evidence. The Phase 0 mobile screen contract is [`project_details/Phase 0 Mobile Wireframe Specification.md`](../project_details/Phase%200%20Mobile%20Wireframe%20Specification.md); the broader legacy wireframe specification and its five-tab concepts remain reference-only. New beta behavior belongs under `mobile/`, with shared contracts under `shared/` and backend contracts under `docs/` or the API service when that service is implemented.
