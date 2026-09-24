/**
 * Feature flag that selects between the local beta API stub and the
 * production `apiClient`. This lets the app run against the real backend
 * while keeping the local stub available for offline development and testing.
 *
 * Set `EXPO_PUBLIC_API_MODE=production` in the environment to switch.
 * Defaults to `local` so the beta still works without a running backend.
 */

export type ApiMode = "local" | "production";

export function getApiMode(): ApiMode {
  const value = process.env.EXPO_PUBLIC_API_MODE?.trim().toLowerCase();
  return value === "production" ? "production" : "local";
}

export function isProductionApi(): boolean {
  return getApiMode() === "production";
}

export function isLocalApi(): boolean {
  return getApiMode() === "local";
}