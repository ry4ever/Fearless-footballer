# Fearless Footballer — Phase 0 Mobile Wireframe Specification

**Status:** Approved implementation contract for the beta foundation  
**Platform:** Expo / React Native SDK 57, iOS and Android  
**Scope authority:** [`docs/BETA_SCOPE.md`](../docs/BETA_SCOPE.md)  
**API authority:** [`docs/API_SPECIFICATION.md`](../docs/API_SPECIFICATION.md)

## 1. Purpose

This document defines the small set of native mobile screens and states required for the Phase 0 beta slice. It replaces the broad five-tab prototype as the implementation reference for the next mobile work.

The existing `Fearless HQ and Session Execution Wireframe Specification.md` remains a visual and interaction reference. Its five-tab navigation, Vault, Feed, mentor browsing, generated multi-day blueprint, and other catalog features are not Phase 0 requirements.

## 2. Scope lock

### Included in Phase 0

- One athlete account and one caregiver account.
- Age gate, restricted account state, consent, pairing approval, and revocation.
- One published interactive session: **Nerves = Performance**.
- Native audio playback with pause, resume, seek, phase progress, timed prompts, interruption handling, and completion threshold.
- Private feeling check-in and optional private note.
- Deterministic composure and streak updates.
- Offline completion queue with an idempotency key.
- A separate read-only caregiver dashboard.
- Accessibility, privacy, and non-clinical wording checks.

### Explicitly excluded

- Five-tab navigation.
- Mentor Feed.
- Vault, badges, saved anchors, or bookmark actions.
- Map integration.
- Multiple caregivers or coach relationships.
- Social or community features.
- Advanced personalization and generated multi-day blueprints.
- Push notifications unless the beta test plan explicitly requires them.
- Guidance and relaxation session modes.
- Additional session packages.

## 3. Roles and account states

| Role | Required state | Access |
|---|---|---|
| Athlete | `verified` | Full athlete flow after required consent/pairing rules are satisfied. |
| Athlete minor | `pending_guardian_authorization` or `restricted` | Cannot access session content until caregiver consent and athlete approval are active. |
| Caregiver | `unlinked`, `pending_athlete_approval`, `active`, or `revoked` | Read-only dashboard only while the link is active and consent is granted. |

The server is the authority for age, consent, pairing, and dashboard authorization. The mobile UI must not treat a hidden control as an authorization boundary.

## 4. Route map

```text
/ 
  → /welcome
  → /role
  → /athlete/register
  → /athlete/age-gate
  → /caregiver/register
  → /pairing/code
  → /pairing/claim
  → /pairing/approval
  → /athlete/home
  → /session/:sessionId
  → /session/:sessionId/complete
  → /caregiver/dashboard

Any restricted athlete state → restricted / consent-required state
Any revoked or unlinked caregiver state → caregiver unlinked state
```

The current `mobile/app/index.tsx` scope screen is a temporary foundation screen. Phase 1 replaces it with the welcome, role, account, and pairing routes above.

## 5. Shared visual system

Reuse the existing dark sports-tech direction without copying the web prototype's five-tab shell:

- Background: `#050A19`
- Card surface: `#0B1635` or `#0D1730`
- Primary cyan: `#5EEAD4` or `#69E0FA`
- Streak accent: `#C13BFF`
- Secondary text: `#A8B3C7`
- Primary text: `#F8FAFC`
- Success: `#54D6AE`
- Minimum interactive target: 44 px / 48 dp
- Use stable surfaces behind text and controls; do not rely on neon color alone for state.

Use an approved fictional mentor or abstract avatar. Do not ship celebrity imagery or attribution without content and rights approval.

## 6. Screen specifications

### 6.1 Welcome and role selection

**Purpose:** Establish whether the user is an athlete or caregiver before account creation.

**Required elements:**

- Fearless Footballer brand.
- Short explanation of the private athlete/caregiver relationship.
- Two clear choices: **I am an athlete** and **I am a caregiver**.
- A link to the privacy notice.

**State behavior:**

- Athlete selection leads to registration and age gate.
- Caregiver selection leads to caregiver registration/sign-in and pairing claim.

### 6.2 Athlete registration and age gate

**Purpose:** Create the athlete account and determine whether guardian authorization is required.

**Required elements:**

- Display name.
- Email and password or approved authentication fields.
- Date of birth.
- Timezone.
- Youth-accessible explanation of why the date is collected.
- Consent/privacy acknowledgement where required.

**States:**

- `verified`: continue to the athlete flow.
- `pending_guardian_authorization`: show a clear restricted state and pairing instructions.
- `restricted`: block session access and explain the required next step.

Do not initialize behavioral tracking or third-party marketing SDKs for a restricted minor.

### 6.3 Caregiver registration and sign-in

**Purpose:** Create or authenticate the one caregiver account.

**Required elements:**

- Display name.
- Email and password or approved authentication fields.
- Clear statement that dashboard access requires an athlete pairing code and athlete approval.
- Entry to pairing-code claim.

The caregiver cannot discover or access an athlete dashboard by guessing an athlete ID.

### 6.4 Pairing code, claim, and approval

**Athlete generates code**

- Show a short-lived code and expiry time.
- Explain that the code should be shared only with the intended parent or guardian.
- Provide a clear pending state until the athlete approves.

**Caregiver claims code**

- Enter the code.
- Select `parent` or `guardian`.
- Confirm consent in plain language.
- Show `pending_athlete_approval` until the athlete acts.

**Athlete approves or revokes**

- Show the caregiver display name and relationship.
- Provide explicit **Approve** and **Not now** actions.
- Provide **Revoke access** from the active relationship state.
- Revocation must immediately remove caregiver dashboard access.

`coach` is not a Phase 0 relationship.

### 6.5 Athlete home

**Purpose:** Give an authorized athlete one clear next action without presenting a broader catalog.

**First-run content:**

- Greeting using local time and preferred name.
- Composure state: `—` with “Build your baseline.”
- Current streak: `0/1` with “Complete a session to start your streak.”
- One dominant card for **Nerves = Performance**.
- Session metadata: category, 5-minute duration, subtitle, and **Start rehearsal** CTA.
- Offline/sync status only when relevant.

**Completed state:**

- Show the session as completed.
- Offer **Replay session** and **View reflection** only after a valid completion.
- Update metrics from actual completion, not from opening the player.

**Do not include:**

- Five-tab navigation.
- Mentor shortcut.
- Mindset browse row.
- Seven-day blueprint customization.
- Badges, Feed, Vault, Map, or push-notification entry points.

### 6.6 Session player

**Purpose:** Provide a focused native audio rehearsal with the smallest safe action set.

**Required elements:**

- Back action that preserves position and confirms exit after playback starts.
- Session title and category.
- Approved mentor name or abstract avatar.
- Duration and three phase labels: Center, Reframe, Rehearse.
- Large play/pause control.
- Seek timeline and optional −15/+15 controls.
- Current timed prompt.
- Headphone/offline status.
- Completion threshold based on actual playback, not a tap or scrub.

**Required behavior:**

- Pause/resume and interruption recovery.
- Background audio behavior appropriate to the selected native audio library.
- Headphone/Bluetooth interruption handling before beta release.
- No caregiver insight panel inside the active player.
- No Save/Vault action.

### 6.7 Completion and private reflection

**Purpose:** Record a valid completion and let the athlete make an optional private check-in.

**Required elements:**

- Short completion confirmation.
- Feeling choices: `clearer`, `steadier`, or `more_ready`.
- Optional private note.
- Clear statement that reflection content is private to the athlete.
- Return to athlete home.

Reflection is optional. Skipping it must not invalidate a completed session.

### 6.8 Caregiver dashboard

**Purpose:** Provide a separate, read-only aggregate view for an actively consented caregiver.

**Allowed content:**

- Athlete display name and active relationship state.
- Weekly completion count and target.
- Current/best streak.
- Composure score and weekly change.
- Last completed session title, duration, and timestamp.
- Supportive conversation starters.
- Privacy notice.

**Prohibited content:**

- Audio or media URLs.
- Transcript or captions.
- Prompts, phases, or raw session data.
- Playback controls.
- Reflection feeling selections or notes.
- Live “currently listening” status.

Authorization and consent are enforced by the API, not by hiding UI controls.

### 6.9 Offline and failed-sync states

- Queue a completion request when offline.
- Preserve the original idempotency key across retries.
- Show `Saved on this device` or an equivalent pending state.
- Retry after reconnection.
- Do not reset streak or composure while sync is pending.
- Show a recoverable error if the server rejects the request.

## 7. Privacy and safety invariants

1. A minor cannot access session content before the required consent and pairing state is active.
2. Caregiver access is one-to-one and revocable by the athlete.
3. Reflection notes are athlete-private.
4. Caregiver payloads are explicit allow-lists and contain no raw session resources.
5. The app does not describe Composure Score as a clinical or diagnostic measure.
6. No free-text reflection is sent to standard analytics.
7. Pairing codes, tokens, and consent records are not logged.

## 8. Accessibility requirements

- Support VoiceOver and TalkBack semantic labels for account state, session state, playback position, phase, and completion.
- Do not communicate state through color alone.
- Respect safe areas, dynamic type, and reduced motion.
- Keep all interactive targets at or above the platform minimum.
- Ensure the player and completion flow remain usable without relying on fine-grained scrubbing.

## 9. Asset usage

The existing PNGs are reference material unless explicitly re-approved for beta:

- `fearless-hq-wireframe-v2.png`: visual reference for hierarchy and session-card emphasis; do not copy its five-tab shell.
- `fearless-session-execution-wireframe.png`: reference for player layout and phase/timeline interaction; omit Save/Vault.
- `fearless-onboarding-mockup.png`: visual reference only; Phase 0 onboarding must add age gate and pairing.
- `fearless-hq-mockup.png`: later-state reference only; it shows fabricated metrics and deferred features.
- `fearless-session-parent-mockup.png`: privacy anti-pattern; do not place parent insight inside the active player.

A separate asset manifest should classify each image as `beta`, `reference`, or `deferred` before implementation uses it.

## 10. Acceptance criteria

### Account and pairing

- Athlete and caregiver can register/sign in through role-specific routes.
- A minor sees a restricted state until required consent and pairing are active.
- Caregiver can claim a code as parent/guardian.
- Athlete can approve and revoke the relationship.
- Revocation immediately blocks caregiver dashboard access.

### Athlete session flow

- Authorized athlete sees exactly one published session.
- First-run metrics are honest and not fabricated.
- Player supports pause, resume, seek, phase progress, prompts, and interruption recovery.
- Completion requires actual playback threshold.
- Reflection is optional and private.

### Caregiver and offline flow

- Caregiver dashboard is a separate authorized route.
- Dashboard payload contains only aggregate allow-listed fields.
- Offline completion survives reconnect without duplication.
- Pending sync does not erase local completion state.

### Product quality

- No deferred Feed, Vault, Map, social, multi-caregiver, personalization, push, or extra-session UI is present.
- The app launches from the Expo Router native entrypoint on iOS and Android.
- Accessibility and non-clinical wording checks pass.

## 11. Implementation boundary

Phase 0 does not require a production backend. Mobile may use local fixtures or a stub API, but every stub must preserve these request/response shapes and privacy boundaries so the production API can replace it without redesigning the client.
