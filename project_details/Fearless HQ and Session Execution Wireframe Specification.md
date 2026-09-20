# Fearless HQ and Session Execution Wireframe Specification

> [!IMPORTANT]
> **Reference-only document.** This specification contains broad catalog, navigation, and personalization concepts that are outside the Phase 0 beta. The implementation contract for the beta mobile client is [`Phase 0 Mobile Wireframe Specification.md`](./Phase%200%20Mobile%20Wireframe%20Specification.md), together with `docs/BETA_SCOPE.md` and `docs/API_SPECIFICATION.md`. Do not implement the five-tab shell, Vault, Feed, generated multi-day blueprint, mentor browsing, or caregiver panel inside the active player without a separate scope decision.

## 1. Scope

This specification extends the completed onboarding flow into the first two post-onboarding experiences: the Fearless HQ dashboard and the session execution interface. It assumes the athlete has completed the five-question onboarding flow, received a generated seven-day Fearless Blueprint, and entered the default Recommended mode.

The design adapts Calm’s strongest interaction patterns—content-first home, immersive card surfaces, browseable day or category controls, one prominent action, and persistent navigation—to a football-performance ritual. The interface must feel focused and private. HQ helps the athlete decide what to do next. Session Execution helps the athlete complete the rep without distraction.

The two screens are intentionally different. HQ is a command center with several levels of information hierarchy. Session Execution is an immersive player with a narrow action set and no parent oversight during active playback.

## 2. Shared design system

Use the onboarding tokens without introducing a second visual language.

| Token | Value | Use |
|---|---|---|
| Ink 950 | `#050A19` | App background and player overlays |
| Navy 900 | `#0B1635` | Cards, bottom navigation, schedule surfaces |
| Blue 600 | `#008BCE` | Borders, inactive controls, structural dividers |
| Cyan 300 | `#69E0FA` | Primary CTA, active state, progress, focus ring |
| Magenta 500 | `#C13BFF` | Streak emphasis, energy accents, selected secondary states |
| Coral 400 | `#FF7C72` | Warm session states and reflection moments |
| Gray 400 | `#A3ACAC` | Secondary text and metadata |
| White 000 | `#FFFFFF` | Primary text |
| Success 400 | `#54D6AE` | Completion and positive trend |

Typography uses Montserrat Bold and Regular, with a system sans-serif fallback. Use a 32px page title, 24px section heading, 18px card title, 16px body, 14px metadata, and 12px overline. Maintain a 4px base unit and 8px layout rhythm. Major cards use a 20px radius, controls use a 14px radius, and pills use a 999px radius. Every target is at least 44px.

Atmospheric gradients may sit behind content, but text and controls must sit on sufficiently stable surfaces. Literal player photography should be reserved for the HQ hero card or session cover. It should not dominate every viewport.

## 3. Navigation model

Use a persistent five-item bottom navigation on HQ and all browseable post-onboarding surfaces.

```text
┌─────────────────────────────────────┐
│                                     │
│         PAGE CONTENT                │
│                                     │
├─────────────────────────────────────┤
│  HQ       Reps      Vault  Feed  Profile │
└─────────────────────────────────────┘
```

HQ is active on the dashboard. Reps, Vault, Feed, and Profile remain available but should not interrupt active session playback. During Session Execution, replace the persistent navigation with a focused player header and a back action. The user may exit the session, but accidental exit must preserve playback state and require a deliberate confirmation if the session has started.

## 4. Fearless HQ dashboard

### 4.1 Purpose

Fearless HQ is the athlete’s daily command center. It must answer three questions in order:

1. **How am I doing?** Show Composure Score state and Current Streak.
2. **What should I do now?** Highlight today’s recommended rep.
3. **What else can I explore?** Show the seven-day plan, customization entry, mentor shortcut, and mindset browsing.

The first post-onboarding HQ state must not fabricate performance data. Until the athlete completes a session, Composure Score should show an intentional baseline state such as “—” or “Build your baseline.” Current Streak should show `0/1` with the explanation “Complete a session to start your streak.”

### 4.2 HQ wireframe

```text
┌─────────────────────────────────────┐
│ FEARLESS HQ                    [bell]│
│                                     │
│ GOOD EVENING,                       │
│ Alex                                │
│                                     │
│ ┌───────────────┐ ┌───────────────┐ │
│ │ COMPOSURE     │ │ CURRENT       │ │
│ │ SCORE         │ │ STREAK        │ │
│ │ —             │ │ 0 / 1         │ │
│ │ Build your    │ │ Complete a    │ │
│ │ baseline.     │ │ session.      │ │
│ └───────────────┘ └───────────────┘ │
│                                     │
│ TODAY’S FEARLESS REP                │
│ ┌─────────────────────────────────┐ │
│ │ [cover image / stadium light]   │ │
│ │ Nerves = Performance             │ │
│ │ [Composure]   5 min             │ │
│ │ Turn adrenaline into information│ │
│ │ [ Start rehearsal          → ]   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 7-DAY BLUEPRINT     [Recommended]  │
│ [Customize]                         │
│ [MON] [TUE] [WED] [THU] [FRI] ...  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ MENTOR SHORTCUT                  │ │
│ │ Matthew McConaughey              │ │
│ │ The Power of Presence        →   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [HQ] [Reps] [Vault] [Feed] [Profile]│
└─────────────────────────────────────┘
```

### 4.3 Header

The header uses a compact Fearless HQ label, a notification icon, and the greeting. The greeting should use local time and the athlete’s preferred name. If the name is missing, use “Good to see you” rather than a placeholder token.

The notification icon should remain quiet. It may show a small cyan indicator for an actionable event, but it should not compete with the daily rep. Notifications should deep-link to the relevant session or plan state.

### 4.4 Metric block

Use two adjacent metric cards on larger mobile widths and a vertical stack on smaller devices. The Composure Score card contains the current score, score state, and a small info affordance. The first-run state is not a score of zero. It is “—” with “Build your baseline.” After the first valid session completion, the card can show a score and a short update explanation.

The Current Streak card uses a flame icon and a progress expression such as `0/1` for the current day. After completion, it may show `1 day` or `1/1`, but the copy should avoid making the user interpret multiple measures simultaneously. The streak card should link to a detail view only after the primary daily action is visible.

### 4.5 Today’s Fearless Rep card

This is the dominant organism on HQ. It inherits the first session from the onboarding Blueprint Preview. The card contains:

- Overline: “TODAY’S FEARLESS REP”
- Session title: for example, “Nerves = Performance”
- Category pill: “Composure”
- Duration: “5 min”
- One coaching line: “Turn adrenaline into information.”
- Primary CTA: “Start rehearsal”
- Optional status icon when completed, paused, locked, or offline

The CTA must be the brightest control on the screen. A user who ignores every other element should still understand how to begin the recommended rep.

### 4.6 Seven-day blueprint strip

The blueprint strip is a horizontally scrollable day selector. Each day is a 64–72px touch target with a day label and a completion or plan state. The selected day uses a cyan border and light fill. The current day is selected by default. Tapping another day updates the session detail below the strip or opens a lightweight day detail sheet; it must not navigate away from HQ.

Recommended mode is visible as a status label. “Customize” is a secondary control that enters the Reps/Custom editing mode. It should not be presented as a competing full-width CTA.

Day states include scheduled, completed, recovery, optional, missed, imported, and offline-cached. Empty days are not permitted; use Recovery, Replay, or Optional labels according to the generated plan.

### 4.7 Secondary content

The mentor shortcut is a low-volume content card. It should appear only when relevant mentor or academy content exists. The card contains attribution, session or routine title, a short context line, and a single arrow action. It should never displace Today’s Fearless Rep above the fold.

A mindset browse row may appear below the mentor shortcut or behind a “Browse” affordance. Suggested categories are Calm, Focus, Confidence, Resilience, and Performance. These categories are filters, not separate primary navigation items.

## 5. HQ states

### 5.1 First-run state

The first-run state shows the generated session, `Composure Score —`, and `Current Streak 0/1`. The user’s first action is starting the session. Avoid showing badges or rewards before the athlete has earned them.

### 5.2 Active day with session incomplete

Show the recommended card with “Continue rehearsal” if playback was interrupted. The card should show the last playback position only if the athlete has opted into a resumable session experience; otherwise use “Start rehearsal” and restart from the beginning.

### 5.3 Completed day

Replace the primary CTA with “Replay session” or “View reflection,” while preserving a visible completion state. The metric block should update after actual playback completion. Do not imply progress from simply opening the player.

### 5.4 Offline state

If the session is cached, show a small “Available offline” label and allow playback. If the session is not cached, retain the card but show “Connect to download” with a secondary action. The HQ should remain browsable and should not show a blocking error.

### 5.5 Failed sync state

If the session completed but telemetry has not synced, show “Saved on this device” and a retry icon. Do not reset the streak or score in the UI while sync is pending. The server should reconcile the event idempotently.

## 6. Session Execution interface

### 6.1 Purpose

Session Execution is a focused audio and visual rehearsal experience. It begins when the athlete taps Start rehearsal from HQ. Its job is to help the athlete complete one mental rep with minimal interruption and clear progress.

The session player should support background audio, lock-screen controls, skip backward and forward, interruption recovery, offline playback when cached, and completion based on actual playback duration. The parent should not see a live insight layer during active execution.

### 6.2 Session player wireframe

```text
┌─────────────────────────────────────┐
│ [Back]                      [Save]   │
│                                     │
│ Nerves = Performance                │
│ [ COMPOSURE ]                       │
│                                     │
│ [mentor avatar] Alex Rivera         │
│ FOOTBALL MENTOR       05:00         │
│                                     │
│ ①────────────②────────────③         │
│ Center       Reframe      Rehearse  │
│                                     │
│             [  ▶  ]                 │
│                                     │
│ 00:00 ━━━━━━━━━━━━━━━━━━━ 05:00     │
│                                     │
│ Notice the adrenaline.              │
│ It is information.                  │
│                                     │
│ [ −15 ]        [pause]       [ +15 ]│
│                                     │
│ [headphones] OFFLINE / HEADPHONES   │
│             RECOMMENDED             │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ AT THE END OF THIS SESSION      │ │
│ │ Finish strong                   │ │
│ │ Reflect on what you learned. →  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 6.3 Header and metadata

The header contains Back and Save. Back should be a 44px control and should preserve the session position. If the athlete has started playback, tapping Back opens a lightweight confirmation sheet: “Leave this rehearsal?” Actions: “Keep listening” and “Leave session.” Save bookmarks the session to the Vault and must provide a non-blocking confirmation.

The title and category establish context. The mentor row includes a portrait or abstract avatar, mentor name, role, and duration. If the mentor identity is not final, use an abstract avatar rather than placeholder celebrity content.

### 6.4 Phase progress

The recommended execution model has three phases: Center, Reframe, and Rehearse. The phase strip is a progress cue, not a manual stepper. The audio timeline remains the source of truth for completion. Active phase text uses Cyan 300. Future phases use Blue 600. Completed phases use Success 400 or a neutral check state.

The system may advance phase labels from audio markers. If a user scrubs forward, the current phase should update to the new playback position, but the user must not be forced to complete phases in order.

### 6.5 Playback controls

The primary control is a large play or pause button with a minimum 64px visual diameter and a 44px semantic target. Secondary controls are skip back 15 seconds and skip forward 15 seconds. The timeline is seekable, but the system should prevent a seek or early exit from being recorded as completion.

Playback events should update the timeline immediately. The player should tolerate audio interruptions from calls or other media and offer resume. The app should use platform-standard audio-session behavior.

### 6.6 Coaching prompt

A single coaching line appears below the timeline. The line may update at phase boundaries, but it should never become a scrolling transcript during the active rep. Examples include:

- “Notice the adrenaline. It is information.”
- “Choose your first action.”
- “See the next play before it arrives.”

The prompt is supportive copy, not a diagnostic statement. It should be readable at a glance and remain optional for users who prefer audio-only practice.

### 6.7 Audio readiness and offline state

Before playback begins, show headphone guidance as a small status line: “Headphones recommended.” If the asset is cached, add “Available offline.” If it is streaming, show a download or connection state without blocking playback when buffering is within the product threshold.

If audio cannot load, present an actionable error: “This rep is not available right now.” Actions: “Retry” and “Back to HQ.” Preserve the generated plan and do not mark the session complete.

## 7. Session completion and reflection

### 7.1 Completion rule

A session is complete only when actual audio playback reaches the configured completion threshold. The threshold should be defined by product and analytics teams, such as the final playback marker or a minimum percentage of the asset. A play-button tap, opening the player, or scrubbing to the end must not count as completion.

When completion fires, update the local session record first, then update Composure Score and Current Streak after the telemetry event is accepted locally. Sync to the server in the background with an idempotent session event id.

### 7.2 Completion state

At the end of the audio, show a short completion moment rather than a large reward screen.

```text
┌─────────────────────────────────────┐
│             SESSION COMPLETE        │
│                                     │
│        [success ring / check]       │
│                                     │
│        Rep complete.                │
│        You showed up today.         │
│                                     │
│  How do you feel right now?         │
│  [Clearer] [Same] [More ready]      │
│                                     │
│  [ Back to Fearless HQ ]            │
└─────────────────────────────────────┘
```

The reflection is optional and should use a small, non-clinical set of choices. Do not force a mood score or present a parent-facing sentiment claim based on one tap. If the athlete skips reflection, the session remains complete.

The parent-facing insight should be generated after completion and should use aggregate, plain-language data. It should not appear inside the active player.

## 8. Interaction map

```text
HQ / Start rehearsal
        │
        ▼
Session preflight ── unavailable ──► retry / back to HQ
        │
        ▼
Session player ── back ──► confirm leave / preserve position
        │
        ├── pause / resume
        ├── seek / skip
        ├── interruption ──► resume
        └── actual completion
                │
                ▼
Reflection optional
        │
        ▼
HQ updated: session complete, streak updated, next rep ready
```

## 9. Data model additions

```text
FearlessSessionState {
  sessionId
  blueprintId
  status: scheduled | in_progress | completed | abandoned | unavailable
  positionSeconds
  durationSeconds
  currentPhase
  startedAt?
  completedAt?
  completionSource: playback_threshold | none
  localSyncStatus: local | synced | pending | failed
  reflection?
}
```

The HQ should read from the same session state that the player writes. This prevents the preview, HQ card, player, and parent summary from showing conflicting completion states.

## 10. Analytics events

Track `hq_viewed`, `hq_primary_rep_viewed`, `hq_start_rehearsal_tapped`, `session_preflight_viewed`, `session_started`, `session_paused`, `session_resumed`, `session_seeked`, `session_interrupted`, `session_backgrounded`, `session_completed`, `session_reflection_selected`, `session_reflection_skipped`, `session_saved`, and `session_abandoned`.

Include session id, blueprint id, phase, playback position, connection state, cached state, and app version. Do not include raw audio transcript or private free-text reflection in standard analytics payloads.

## 11. Accessibility and trust requirements

The dashboard and player must support VoiceOver and TalkBack with semantic labels for score state, streak state, day selection, playback position, and completion. For example: “Composure Score. No baseline yet. Complete your first rep to build your baseline.”

Do not communicate selected state through color alone. The active day, active phase, completed session, and current playback state need text or icon equivalents. Respect dynamic type, safe areas, reduced motion, and screen reader focus order.

The athlete’s active rehearsal is private by default. Parent insight is a separate role-aware surface. The app should not expose a live “currently listening” status to the parent unless the privacy model explicitly requires it and the athlete has consented.

## 12. Acceptance criteria

### Fearless HQ

- After onboarding completion, HQ displays the generated first session without requiring re-entry.
- The first-run state shows an honest baseline state, not a fabricated Composure Score.
- Today’s Fearless Rep is visually dominant and reachable within one tap.
- Current day selection and seven-day blueprint states are visible without opening a separate calendar.
- Recommended mode is visible and Custom mode is discoverable without competing with the primary rep.
- Offline and failed-sync states preserve usability and explain what is happening.

### Session Execution

- Tapping Start rehearsal opens the correct generated session.
- Playback supports pause, resume, skip back, skip forward, interruption recovery, and background audio.
- The phase strip updates from audio markers but does not replace the audio timeline.
- A session is not marked complete from opening, tapping play, or scrubbing.
- Completion updates local session state, then updates HQ metrics and syncs idempotently.
- Parent insight is not shown during active execution.
- Completion reflection is optional and non-clinical.

### Product quality

- Both interfaces use the onboarding tokens and shared component conventions.
- Primary actions are visually clear without relying on neon decoration.
- The dashboard supports exploration while the player suppresses distraction.
- All interactive targets meet minimum size and accessibility requirements.

## References

[1]: /home/ubuntu/fearless_footballer_onboarding_wireframe_spec.md "Fearless Footballer User Onboarding Wireframe Specification"

[2]: /home/ubuntu/projects/fearless-footballer-ef7c4235/Fearless%20Footballer%20Specification%20Blueprint.pdf "Fearless Footballer Specification Blueprint"

[3]: /home/ubuntu/fearless_footballer_muapi_implementation_plan.md "Fearless Footballer UI Implementation Plan"

[4]: https://drive.google.com/file/d/1tOAq-b5Ws3NkHs-INKyR_yAEn42yoUP4/view "Fearless Footballer visual reference supplied by the user"
