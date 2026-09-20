# Fearless Footballer — Beta v1.0 API & Event Contract

**Specification format:** OpenAPI 3.1-style JSON contracts and event protocol  
**Scope:** Phase 0 mobile beta contracts only  
**Base URL (production):** `https://api.fearlessfootballer.com/v1`  
**Authentication:** `Authorization: Bearer <JWT>` for authenticated requests  
**Beta roles:** `athlete` and `caregiver` only

This document defines the stable contract for the thin mobile beta. It does not require a backend implementation in Phase 0; mobile and API work can use local fixtures or a stub while preserving these request and response shapes.

## 1. Authentication, age gate, and account state

### `POST /auth/register`

Creates an athlete or caregiver account. The server derives `isMinor` from the supplied birth date and returns a restricted athlete state when guardian authorization is required.

```json
// Request
{
  "email": "alex.rivera@example.com",
  "password": "SecurePassword123!",
  "role": "athlete",
  "fullName": "Alex Rivera",
  "birthDate": "2010-06-15",
  "timezone": "America/New_York"
}

// Response (201)
{
  "user": {
    "id": "usr_94b1f20d",
    "role": "athlete",
    "displayName": "Alex Rivera",
    "isMinor": true,
    "ageGateStatus": "pending_guardian_authorization",
    "pairingStatus": "unlinked"
  },
  "tokens": {
    "accessToken": "<short-lived JWT>",
    "expiresIn": 900,
    "refreshToken": "<secure refresh token>"
  }
}
```

The response must never return a password, password hash, or raw consent artifact.

### `POST /auth/age-gate`

Evaluates a birth date and timezone without changing the account unless the server explicitly supports that transition.

```json
// Request
{
  "birthDate": "2010-06-15",
  "timezone": "America/New_York",
  "region": "US"
}

// Response
{
  "isMinor": true,
  "status": "pending_guardian_authorization",
  "restrictedReason": "guardian_consent_required"
}
```

Allowed `status` values are `verified`, `pending_guardian_authorization`, and `restricted`. A minor remains unable to access session content until the required consent and pairing lifecycle is complete.

## 2. Consent and one-to-one pairing

### `POST /auth/pairing/code`

Called by an authenticated athlete. The code is short-lived and may be used only to create one pending caregiver relationship.

```json
// Response (200)
{
  "pairingCode": "FEAR-8294",
  "expiresAt": "2026-09-18T23:15:00Z"
}
```

### `POST /auth/pairing/claim`

Called by an authenticated caregiver. Beta relationships are limited to `parent` and `guardian`; `coach` is not a Phase 0 relationship.

```json
// Request
{
  "pairingCode": "FEAR-8294",
  "relationship": "parent",
  "consentConfirmed": true
}

// Response (200)
{
  "linkId": "lnk_71a0b3",
  "status": "pending_athlete_approval",
  "athlete": {
    "id": "usr_94b1f20d",
    "displayName": "Alex"
  }
}
```

### `POST /auth/pairing/{linkId}/approve`

Called by the athlete. `approved: true` activates the relationship; `approved: false` leaves it pending or rejects it according to server policy.

```json
// Request
{ "approved": true }

// Response (200)
{
  "linkId": "lnk_71a0b3",
  "status": "active",
  "athleteApprovedAt": "2026-09-18T23:05:00Z"
}
```

### `DELETE /auth/pairing/{linkId}`

Called by the athlete to revoke caregiver access. The server must invalidate caregiver dashboard authorization immediately and record the revocation timestamp.

```json
// Response (200)
{
  "linkId": "lnk_71a0b3",
  "status": "revoked",
  "revokedAt": "2026-09-18T23:20:00Z"
}
```

Pairing states are `unlinked`, `pending_athlete_approval`, `active`, and `revoked`. Consent states are `pending`, `granted`, and `revoked`.

## 3. One published beta session

### `GET /sessions/today`

Returns exactly one published beta session. The Phase 0 response advertises interactive mode only.

```json
// Response (200)
{
  "session": {
    "id": "ses_nerves_performance_v1",
    "slug": "nerves-equals-performance",
    "version": "1.0.0",
    "title": "Nerves = Performance",
    "subtitle": "Turn adrenaline into information.",
    "category": "composure",
    "mindset": "calm",
    "defaultDurationSeconds": 300,
    "mentor": {
      "id": "men_alex_rivera",
      "name": "Alex Rivera",
      "title": "FOOTBALL MENTOR",
      "avatarUrl": "https://cdn.fearlessfootballer.com/mentors/alex_rivera.png"
    },
    "thumbnailUrl": "https://cdn.fearlessfootballer.com/sessions/nerves_cover.jpg",
    "availableModes": ["interactive"],
    "media": {
      "voiceUrl": "https://cdn.fearlessfootballer.com/audio/v1/nerves_voice_stem.aac",
      "musicBedUrl": "https://cdn.fearlessfootballer.com/audio/v1/stadium_ambient_bed.aac",
      "captionsUrl": "https://cdn.fearlessfootballer.com/captions/v1/nerves_en.vtt",
      "transcriptUrl": "https://cdn.fearlessfootballer.com/transcripts/v1/nerves_en.txt",
      "transcriptLocale": "en"
    },
    "phases": [
      { "number": 1, "label": "Center", "startSeconds": 0, "endSeconds": 90 },
      { "number": 2, "label": "Reframe", "startSeconds": 90, "endSeconds": 210 },
      { "number": 3, "label": "Rehearse", "startSeconds": 210, "endSeconds": 300 }
    ],
    "prompts": [
      {
        "timestampSeconds": 15,
        "promptText": "Notice the adrenaline. It is information.",
        "subText": "Take one deep diaphragm breath. Four seconds in, six seconds out."
      },
      {
        "timestampSeconds": 120,
        "promptText": "Name the first action you want available under pressure.",
        "subText": "Choose one cue to carry into the next play."
      },
      {
        "timestampSeconds": 240,
        "promptText": "See yourself executing that cue in front of the crowd.",
        "subText": "Own the next play."
      }
    ]
  }
}
```

`media.voiceUrl`, `media.captionsUrl`, and `media.transcriptUrl` are athlete-session resources. They must never appear in a caregiver response. Guidance and relaxation are not beta modes and must not be returned by this endpoint in Phase 0.

## 4. Playback events

### `POST /sessions/{sessionId}/events`

Tracks non-sensitive playback lifecycle events. The client sends the session version and current position so the server can validate completion.

```json
// Request
{
  "eventType": "start",
  "mode": "interactive",
  "musicEnabled": true,
  "playbackPositionSeconds": 15.4,
  "clientTimestamp": "2026-09-18T23:10:00Z"
}
```

Allowed event types are `start`, `heartbeat`, `pause`, `seek`, and `finish`. Playback events must not include reflection text, microphone input, or raw audio.

## 5. Completion, reflection, and offline synchronization

### `POST /sessions/{sessionId}/complete`

Persists a completion only when the athlete reaches the documented threshold (at least 80% of the session duration). The request includes an idempotency key so an offline retry cannot duplicate a completion or metric update.

```json
// Headers
// Authorization: Bearer <athlete_token>
// Idempotency-Key: cmp_9041fa_2026-09-18T23:10:00Z

// Request
{
  "mode": "interactive",
  "sessionVersion": "1.0.0",
  "completionDurationSeconds": 300,
  "completedAt": "2026-09-18T23:10:00Z",
  "reflection": {
    "feeling": "clearer",
    "note": "I could name my anchor before the drill."
  },
  "idempotencyKey": "cmp_9041fa_2026-09-18T23:10:00Z"
}

// Response (200)
{
  "completionId": "cmp_9041fa",
  "streak": {
    "currentStreakDays": 1,
    "bestStreakDays": 5,
    "isNewMilestone": true
  },
  "composure": {
    "previousScore": 80,
    "newScore": 82,
    "delta": 2
  },
  "weeklyProgress": {
    "completedDays": 1,
    "targetDays": 7,
    "sevenDayPattern": [true, false, false, false, false, false, false]
  }
}
```

Reflection notes are private to the athlete. The server stores them in a restricted record and excludes them from every caregiver payload, analytics export, and dashboard response.

An offline client stores the same request in a local queue with `queued`, `syncing`, `synced`, or `failed` state, an attempt count, timestamps, and the unchanged idempotency key. Reconnection retries the request without generating a new key.

## 6. Read-only caregiver dashboard

### `GET /caregiver/athletes/{athleteId}/dashboard`

The server must verify all of the following before returning data:

1. The caller is an authenticated caregiver.
2. A caregiver link exists for the requested athlete.
3. The link is active and consent is granted.
4. The athlete has not revoked access.

```json
// Response (200)
{
  "athlete": {
    "id": "usr_94b1f20d",
    "name": "Alex Rivera",
    "program": "Matchday Mindset · Week 1",
    "status": "active"
  },
  "weeklySummary": {
    "headline": "Building composure",
    "description": "Alex has completed one mindset rep this week.",
    "daysCompleted": 1,
    "daysTarget": 7,
    "sevenDayPattern": [true, false, false, false, false, false, false]
  },
  "metrics": {
    "moodTrend": {
      "status": "Steady",
      "subtitle": "A private post-rep check-in was completed.",
      "trendData": [1]
    },
    "composureScore": {
      "value": 82,
      "changeWeekly": 2
    },
    "currentStreak": {
      "days": 1,
      "bestDays": 5
    },
    "lastRep": {
      "title": "Nerves = Performance",
      "duration": "5 min",
      "completedAt": "2026-09-18T23:10:00Z",
      "completedToday": true
    }
  },
  "conversationStarters": [
    {
      "id": "cs_reset",
      "category": "TRY THIS TONIGHT",
      "prompt": "What helped you reset today?",
      "guidance": "Invite a story, not a score."
    }
  ],
  "privacyPolicyNotice": "Private by design. This view shares progress patterns, not session transcripts, reflections, audio, or playback controls."
}
```

The caregiver response is an explicit allow-list. It contains no `media`, `prompts`, `phases`, `transcriptUrl`, reflection fields, session responses, playback controls, or audio/streaming credentials. Hiding these fields only in the UI is insufficient.

## 7. Calculation contracts

### Composure score

The beta score is a non-clinical athletic habit and mindset-rehearsal consistency index. A deterministic server-side implementation should use the documented baseline, completion weight, consistency factor, reflection check-in bonus, inactivity decay, and lower bound. The API exposes only the resulting integer score and weekly delta.

### Streaks

- Evaluate days in the athlete's configured timezone.
- A local calendar day runs from `00:00:00` through `23:59:59`.
- One completed session at or above 80% of its duration satisfies the day.
- Calculate current and best streaks server-side from completion timestamps.
- Use the completion idempotency key to prevent duplicate day counts.

## 8. Privacy and error conventions

- Return `401` for missing or expired authentication.
- Return `403` when a caregiver is not actively linked and consented.
- Return `404` for an unknown athlete or session rather than revealing whether a protected relationship exists.
- Return `409` for an expired or already-used pairing code and for an idempotency-key payload mismatch.
- Return `422` for invalid age, consent, playback, or completion payloads.
- Do not log reflection notes, access tokens, pairing codes, or raw audio/caption content.
