# Mobile E2E Tests (Maestro)

This directory contains Maestro end-to-end flows for the Fearless Footballer mobile app.

## Running locally

1. Build a development native build (not Expo Go):

   ```bash
   npx expo prebuild
   npx expo run:android --variant debug
   # or: npx expo run:ios --configuration Debug
   ```

2. Ensure Maestro CLI is installed (`brew install maestro` or [download](https://maestro.mobile.dev/)).

3. Run a flow from the `mobile/` directory:

   ```bash
   maestro run maestro/flows/welcomescreen.yaml
   ```

4. Run all flows:

   ```bash
   maestro run maestro/flows
   ```

## Flows

- `welcomescreen.yaml` — smoke test from welcome through role selection to athlete registration screen.
- `athlete-register.yaml` — full athlete journey: register, age gate, home, and sign-out.
- `athlete-restricted.yaml` — restricted athlete path before pairing approval.

## CI

Add a job to `.github/workflows/ci.yml` that:

1. Builds a native debug APK/IPA.
2. Installs the Maestro CLI.
3. Runs `maestro test maestro/flows`.