# Fearless Footballer — App Store Privacy Declarations & Data Safety Form

**Target Audience:** Young Athletes (Under 13 & 13–17) and Caregivers / Parents  
**Compliance Standards:** COPPA (US), GDPR-K (EU/UK), Apple App Store Kids Category Guidelines, Google Play Families Policy

---

## 1. Apple App Store Privacy Nutrition Labels (App Store Connect)

When submitting **Fearless Footballer** to Apple App Store Connect under the **Health & Fitness / Sports / Kids Category**, complete the **App Privacy** section as follows:

### Data Collection Summary
- **Data Used to Track You:** **NO** (Fearless Footballer does NOT track users across third-party apps or websites).
- **Data Linked to You:**
  - **Contact Info (Email Address, Full Name):** Used strictly for Authentication, Account Security, and Caregiver Consent. Stored encrypted at rest using AES-256-GCM.
  - **Health & Fitness (Composure Score, Streak Days, Weekly Blueprint Progress):** Used for App Functionality and Athlete Progress Tracking.
- **Data Not Linked to You:**
  - **Diagnostics (Crash Logs, Performance Data):** Anonymous, privacy-minimized system logs used for technical error tracking.

### Detailed Apple Data Types Table

| Data Type | Collected? | Linked to User? | Used for Tracking? | Purpose |
|---|---|---|---|---|
| **Name** | Yes | Yes | No | Account Identification & Caregiver Linking |
| **Email Address** | Yes | Yes | No | Auth & Account Recovery |
| **Fitness (Composure Score)** | Yes | Yes | No | App Functionality & Athlete Progress |
| **User Content (Reflection Notes)** | Stored Locally | Yes | No | Private Athlete Journaling (Never sent to Caregivers or 3rd parties) |
| **Diagnostics (Crash Data)** | Yes | No | No | App Performance & Bug Fixes |
| **Identifiers (User ID)** | Yes | Yes | No | Account Authentication |

---

## 2. Google Play Data Safety Declarations (Google Play Console)

Complete the **Data Safety** questionnaire in Google Play Console with the following responses:

### Data Collection & Sharing Questions
1. **Does your app collect or share any of the required user data types?** -> **YES**
2. **Is all of the user data collected by your app encrypted in transit?** -> **YES** (TLS 1.3 enforced)
3. **Do you provide a way for users to request that their data be deleted?** -> **YES** (In-app account deletion route `DELETE /auth/account` per COPPA requirements)

### Detailed Google Data Types Table

| Category | Data Type | Collected | Shared | Required / Optional | Purpose |
|---|---|---|---|---|---|
| **Personal Info** | Name | Yes | No | Required | Account setup & pairing |
| **Personal Info** | Email address | Yes | No | Required | Authentication & safety |
| **Health and Fitness** | Fitness info | Yes | No | Optional | Composure & streak metrics |
| **App Info and Performance** | Crash logs | Yes | No | Required | Analytics & debugging |
| **Device or other IDs** | Device ID | Yes | No | Required | Token security & offline queue |

---

## 3. COPPA & GDPR-K Compliance Declaration

Fearless Footballer strictly adheres to children's privacy regulations:

### Age Gating & Consent Mechanisms
1. **Under 13 Athletes (`restricted` / `age_verification_required`):**
   - Require verified Guardian / Caregiver account authorization before account creation.
   - PII is encrypted using AES-256-GCM prior to database storage.
   - Caregivers are provided with a dedicated read-only dashboard showing aggregate completion metrics without exposing private journaling notes.

2. **13–17 Athletes (`pending_guardian_authorization`):**
   - Require Guardian notification and time-limited 6-character claim code pairing (`hashPairingCode`).

3. **Data Deletion Rights:**
   - Caregivers or athletes can trigger immediate transactional deletion of all user records, profile details, link records, and audit history via the in-app settings screen or API endpoint.

---

## 4. App Store Listing Metadata & Descriptions

### Store Listing Copy

- **App Name:** Fearless Footballer
- **Subtitle (iOS - 30 chars max):** Elite Soccer Mental Training
- **Short Description (Android - 80 chars max):** Master pre-match composure, sharpen focus, and build elite mindset reps for matchday.

### Full Description (App Store & Google Play)

> **Fearless Footballer** is the premier mental training app designed specifically for soccer players. Transform pre-match nerves into competitive energy, sharpen your matchday focus, and build unshakeable composure on the pitch.
>
> **KEY FEATURES:**
> - **TODAY’S FEARLESS REP:** 5-minute guided audio rehearsals designed by elite sports psychologists and football mentors.
> - **7-DAY BLUEPRINT:** Tailored weekly mental conditioning rhythms built around your target mindset—Calm, Sharp, Brave, or Unshakeable.
> - **COMPOSURE SCORE & STREAKS:** Track your mental readiness, lock in daily training streaks, and earn achievements.
> - **MENTOR AUDIO SOUNDSCAPES:** Immersive, binaural audio sessions designed for offline playback before matchday.
> - **PRIVACY & SAFETY FIRST:** Built with COPPA and GDPR-K compliance at its core. Independent caregiver overview keeps parents informed while protecting young athletes' personal reflections.
>
> Train your brain like you train your feet. Download Fearless Footballer today and bring unshakeable confidence to every match.

---

## 5. Store Listing Keywords (iOS)

`soccer,football,mental training,composure,focus,mindset,athlete,pre-match,rehearsal,sports psychology,cooperative,caregiver`
