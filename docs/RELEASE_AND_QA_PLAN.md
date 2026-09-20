# Fearless Footballer — Release, QA & Accessibility Plan

**Release Target:** Mobile Beta v1.0  
**Distribution Channels:** Apple TestFlight & Google Play Internal Testing Tracks  

---

## 1. Physical Device Testing Matrix

Testing on real physical hardware is mandatory for media playback, lockscreen controls, and Bluetooth audio routing.

| Platform | Tier | Target Hardware | OS Target | Focus Areas |
| :--- | :--- | :--- | :--- | :--- |
| **iOS** | Primary | iPhone 15 / 16 (Pro/Max) | iOS 18.x | Dynamic Island, Lockscreen live transport, Dynamic Type. |
| **iOS** | Legacy | iPhone 11 / SE (3rd Gen) | iOS 16.x – 17.x | Small viewport (4.7"), memory constraints, audio stability under load. |
| **Android** | Primary | Google Pixel 8 / 9 | Android 14 – 15 | Media notification styling, gesture navigation, background limits. |
| **Android** | Budget | Samsung Galaxy A14 / A34 | Android 13 – 14 | Low RAM (4GB), thermal throttling, audio focus transitions. |

---

## 2. Core Functional Test Scenarios

### Test Suite A: Audio Playback & Real-World Interruptions
- [ ] **Lock Screen Playback:** Start session, lock device. Verify audio continues without stutter, lock screen displays session title, artwork, and scrub controls.
- [ ] **Incoming Call Interruption:** Play session, place inbound phone call to device. Audio ducks and pauses immediately; resuming call resumes audio cleanly.
- [ ] **Bluetooth Headphone Disconnect:** Disconnect AirPods / Bluetooth headset during playback. Player auto-pauses immediately to prevent unexpected speaker broadcast.
- [ ] **Audio Focus Conflict:** Launch Spotify or YouTube while session is playing. Fearless Footballer session halts gracefully and yields audio focus.

### Test Suite B: Offline Rehearsal & Synchronization
- [ ] **Offline Execution:** Download "Nerves = Performance", engage Airplane Mode. Launch session, complete 5-minute rep, enter reflection. Verify completion is cached locally.
- [ ] **Reconnection Sync:** Disable Airplane Mode. Verify client transmits queued completion event to API and increments streak without duplicating records.

### Test Suite C: Athlete & Parent Linking Lifecycle
- [ ] **Pairing Flow:** Athlete generates 6-digit code. Caregiver enters code. Athlete receives in-app confirmation modal and approves.
- [ ] **Dashboard Verification:** Caregiver sees updated completion count and Composure score; caregiver cannot access reflection text or raw audio.
- [ ] **Access Revocation:** Athlete taps "Unlink Caregiver". Caregiver session immediately invalidates dashboard data and shows unlinked empty state.

---

## 3. Accessibility & Usability (WCAG 2.1 Level AA)

### Accessibility Checklist:
- [ ] **Color Contrast:** Text and neon accents against dark backgrounds satisfy minimum 4.5:1 ratio (normal text) and 3:1 (large headings and graphical UI controls).
- [ ] **Screen Readers (VoiceOver & TalkBack):**
  - All icon buttons (`Bell`, `Settings`, `Play/Pause`, `Skip 15s`, `Close`) have descriptive accessibility labels (`aria-label` / `accessibilityLabel`).
  - Active phase indicator announces current phase (`Phase 1 of 3: Center, active`).
- [ ] **Dynamic Type & Font Scaling:** UI containers accommodate up to 200% font size without truncated critical text or broken touch targets.
- [ ] **Touch Target Sizing:** All tappable controls are at least 44x44 points (iOS) and 48x48 dp (Android).
- [ ] **Reduced Motion:** If system "Reduce Motion" setting is active, disable background pulsing glow and particle animations; retain instantaneous transitions.

---

## 4. App Store & Google Play Readiness Checklist

- [ ] **Age Rating Declaration:**
  - Apple: Rated 4+ or 9+ (Sports / Health & Fitness).
  - Google Play: ESRB Everyone / PEGI 3.
- [ ] **Apple App Tracking Transparency (ATT):** Not required (zero third-party cross-app tracking).
- [ ] **Apple Privacy Nutrition Labels:**
  - *Data Used to Track You:* None.
  - *Data Linked to You:* User ID, Contact Info (Email), Diagnostics.
  - *Data Not Linked to You:* Product Interaction, Crash Data.
- [ ] **Google Play Data Safety Section:** Completed declaring encrypted transit, user deletion rights, and child safety compliance.
