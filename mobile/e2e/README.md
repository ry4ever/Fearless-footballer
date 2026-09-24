# Mobile E2E and Accessibility Test Plan

Phase 4 introduces the scenario contract for a future device runner. The current repository does not include a native simulator or Detox installation, so these scenarios are intentionally kept separate from the Vitest unit suite and are ready to port to Detox or Expo Maestro when a device runner is available.

## Runner setup

Use a development build rather than Expo Go for native authentication and audio behavior. Configure the app with `EXPO_PUBLIC_API_MODE=local` for deterministic beta journeys, or `EXPO_PUBLIC_API_MODE=production` with a reachable backend for API validation. Seed a clean device before each suite and clear SecureStore plus AsyncStorage between tests.

A Detox implementation should add `detox`, a native build configuration, and scripts equivalent to `e2e:build` and `e2e:test`. Until that native toolchain is provisioned, the cases below are the acceptance contract and the mobile Vitest suite remains the automated gate in CI.

## Scenarios

### Athlete journey (`athlete.md`)

1. Open the welcome screen and register an athlete account.
2. Complete the age gate and verify the athlete home screen is reachable.
3. Open the rehearsal, play enough media to pass the 80% threshold, and verify the completion check-in.
4. Select a feeling, save the completion, and verify the progress/streak summary.
5. Sign out and verify protected athlete routes redirect to welcome.

### Caregiver journey (`caregiver.md`)

1. Register a caregiver account and complete the age gate.
2. Create or claim a pairing code and approve the athlete relationship.
3. Open the caregiver dashboard and verify only aggregate progress is displayed.
4. Revoke consent and verify the dashboard is no longer accessible.

### Offline journey (`offline.md`)

1. Start a rehearsal, disable network connectivity, and complete the check-in.
2. Verify the completion is shown as saved on the device and has a pending queue count.
3. Restore connectivity and verify the completion transitions to synced exactly once.
4. Relaunch the app and verify the queue remains empty and the idempotency key prevents duplication.

## Accessibility checklist

For each scenario, run VoiceOver on iOS and TalkBack on Android. Verify that all buttons, fields, choice cards, progress indicators, and navigation controls have meaningful accessible labels; focus order follows the visual reading order; errors are announced; content remains usable at 200% font scaling; touch targets are at least 44×44 pt on iOS and 48×48 dp on Android; and text/background combinations meet WCAG AA contrast of at least 4.5:1 for normal text.

Record device, OS version, build, screen, and result for every manual pass. Automated component-level accessibility checks can be added with `react-native-axe` once a React Native testing renderer is provisioned.
