# Fearless Footballer — Child Safety, Safeguarding & Privacy Policy

**Target Demographic:** Young competitive athletes aged 10–18 and their families.  
**Compliance Standards:** COPPA (USA, 16 CFR Part 312), GDPR-K (EU Regulation 2016/679), UK Age Appropriate Design Code (Children's Code), and California Age-Appropriate Design Code Act (AB 2273).  
**Beta v1.0 scope:** One athlete account, one parent/guardian caregiver account, age gating, consent/pairing approval and revocation, one interactive session, private reflection, and an allow-listed caregiver dashboard. `docs/BETA_SCOPE.md` is the release-scope authority.  

---

## 1. Age Gating & Consent Framework

### 1.1 Age Verification Rules
1. **Under 13 (US) / Under 16 (EU/UK):**
   - Athlete registration prompts for date of birth without retroactive modification.
   - Account operates in restricted "Pending Guardian Authorization" state until a verified caregiver links to the athlete account and provides verifiable parental consent.
   - No behavioral tracking or third-party marketing SDKs are initialized for minors.
2. **Ages 13–17:**
   - Explicit informed consent presented in youth-accessible plain language.
   - Athlete retains direct ownership to grant, modify, or revoke caregiver dashboard access at any time.

---

## 2. The Caregiver Boundary ("Privacy by Design")

Fearless Footballer is built on psychological safety: young footballers must feel safe to express doubt, anxiety, and performance fear without feeling judged or policed by parents or coaches.

### 2.1 Permitted vs. Strictly Prohibited Caregiver Visibility

| Category | Caregiver Visibility | Technical Enforcement |
| :--- | :---: | :--- |
| **Weekly Completion Ratios (e.g. 5/7)** | **PERMITTED** | Aggregated integer count via backend API. |
| **Composure Score Trajectory (e.g. 82, +8)** | **PERMITTED** | Non-clinical numerical score aggregated weekly. |
| **Current Habit Streak (e.g. 4 days)** | **PERMITTED** | Counter computed server-side. |
| **Last Rep Metadata (Name & Duration)** | **PERMITTED** | Session title and completion timestamp. |
| **Supportive Conversation Starters** | **PERMITTED** | Curated pedagogical prompts. |
| **Raw Session Transcripts or Spoken Audio** | ❌ **PROHIBITED** | Not included in Caregiver API payload schemas. |
| **Private Athlete Reflection Text / Notes** | ❌ **PROHIBITED** | Athlete notes stored in restricted table inaccessible by caregiver role. |
| **Playback Remote Controls / Eavesdropping** | ❌ **PROHIBITED** | Parent client lacks player controls or media streaming keys. |

---

## 3. Non-Clinical & Non-Diagnostic Positioning

> [!WARNING]
> **Mandatory Regulatory Disclaimer:**
> Fearless Footballer is a sports performance and athletic mindset rehearsal tool, not a medical or clinical health service.

- **Terminology Guardrails:**
  - Never refer to *Composure Score* as a "mental health evaluation", "clinical diagnosis", or "psychological test".
  - Describe *Composure Score* exclusively as an *"athletic habit and mindset rehearsal consistency index"*.
  - Describe *Mood Trend* as an *"inferred post-rep reflection sentiment"*, not a psychological assessment.

---

## 4. Crisis Escalation & Safety Protocols

Open social messaging, feedback forms, automated distress scanning, and internal safeguarding escalation are **post-beta capabilities** unless the beta test plan explicitly requires a support path. If any beta surface accepts free-text input, it must use the approved safeguarding review and crisis-resource flow before release; the Phase 0 API contract does not transmit reflection notes to caregivers or analytics systems.

---

## 5. Right to Erasure & Account Deletion

In compliance with COPPA and GDPR Article 17:
- Athletes and authorized parents can request immediate, permanent deletion of all stored personal data from within settings.
- Upon request:
  - Personal identity records are hard-deleted within 72 hours.
  - Completion histories are anonymized for aggregate system telemetry.
  - An entry is recorded in immutable audit logs verifying fulfillment.
