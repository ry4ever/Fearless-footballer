import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionCompletionRequest } from "../../../shared/types";

const secureValues = new Map<string, string>();
const asyncValues = new Map<string, string>();
const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));
const network = vi.hoisted(() => ({
  getNetworkStateAsync: vi.fn(),
}));
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("expo-secure-store", () => secureStore);
vi.mock("@react-native-async-storage/async-storage", () => ({ default: asyncStorage }));
vi.mock("expo-network", () => network);

import { getApiFacade } from "./apiFacade";
import { apiClient, configureApiClient } from "./apiClient";
import { loadSessionState } from "./sessionStore";

const athleteUser = {
  id: "user_athlete",
  role: "athlete" as const,
  displayName: "Sam",
  isMinor: true,
  ageGateStatus: "pending_guardian_authorization" as const,
  pairingStatus: "unlinked" as const,
};

const activeLink = {
  id: "link_1",
  athleteId: "user_athlete",
  caregiverUserId: "user_caregiver",
  relationship: "parent",
  status: "active",
  consentStatus: "granted",
  consentedAt: "2026-09-27T10:00:00.000Z",
  athleteApprovedAt: "2026-09-27T10:05:00.000Z",
};

const completionRequest: SessionCompletionRequest = {
  sessionId: "session_1",
  sessionVersion: "1.0.0",
  mode: "interactive",
  completionDurationSeconds: 300,
  completedAt: "2026-09-27T10:00:00.000Z",
  reflection: { feeling: "steadier" },
  idempotencyKey: "cmp_offline_1",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setOnline(online: boolean) {
  network.getNetworkStateAsync.mockResolvedValue({ isConnected: online, isInternetReachable: online });
}

beforeEach(() => {
  vi.clearAllMocks();
  secureValues.clear();
  asyncValues.clear();
  process.env.EXPO_PUBLIC_API_MODE = "production";
  globalThis.fetch = fetchMock;
  setOnline(true);
  secureStore.getItemAsync.mockImplementation(async (key: string) => secureValues.get(key) ?? null);
  secureStore.setItemAsync.mockImplementation(async (key: string, value: string) => {
    secureValues.set(key, value);
  });
  secureStore.deleteItemAsync.mockImplementation(async (key: string) => {
    secureValues.delete(key);
  });
  asyncStorage.getItem.mockImplementation(async (key: string) => asyncValues.get(key) ?? null);
  asyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
    asyncValues.set(key, value);
  });
  asyncStorage.removeItem.mockImplementation(async (key: string) => {
    asyncValues.delete(key);
  });
  configureApiClient({ baseUrl: "https://api.example.test" });
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_API_MODE;
  configureApiClient({});
});

async function signInAthlete() {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/auth/sign-in")) {
      return jsonResponse({
        user: athleteUser,
        tokens: { accessToken: "access", refreshToken: "refresh", expiresIn: 900 },
      });
    }
    if (url.endsWith("/auth/pairing")) return jsonResponse({ pairing: activeLink });
    return jsonResponse({ error: "unexpected" }, 500);
  });
  await getApiFacade().signInAccount({ role: "athlete", email: "sam@example.com", password: "Password123" });
}

describe("apiFacade in production mode", () => {
  it("stores the server's pairing link after sign-in so route guards can open sessions", async () => {
    await signInAthlete();

    const state = await loadSessionState();
    expect(state.currentRole).toBe("athlete");
    expect(state.pairing?.id).toBe("link_1");
    expect(state.pairing?.status).toBe("active");
    expect(state.athleteAccount?.pairingStatus).toBe("active");
  });

  it("clears a revoked link on the next sync", async () => {
    await signInAthlete();
    fetchMock.mockImplementation(async () => jsonResponse({ pairing: null }));

    await getApiFacade({ role: "athlete" }).syncPairing();

    const state = await loadSessionState();
    expect(state.pairing).toBeUndefined();
    expect(state.athleteAccount?.pairingStatus).toBe("unlinked");
  });

  it("keeps the last known pairing when offline", async () => {
    await signInAthlete();
    setOnline(false);

    await getApiFacade({ role: "athlete" }).syncPairing();

    expect((await loadSessionState()).pairing?.status).toBe("active");
  });

  it("queues a completion on the device when offline instead of losing it", async () => {
    await signInAthlete();
    setOnline(false);
    const api = getApiFacade({ role: "athlete" });

    const response = await api.completeSession("session_1", completionRequest);

    expect(response.completionId).toBe("queued_cmp_offline_1");
    expect((await api.getOfflineQueueStatus()).pending).toBe(1);
  });

  it("drops a queued completion the server permanently rejects", async () => {
    await signInAthlete();
    setOnline(false);
    const api = getApiFacade({ role: "athlete" });
    await api.completeSession("session_1", completionRequest);

    setOnline(true);
    fetchMock.mockImplementation(async () =>
      jsonResponse({ error: "Complete at least 240 seconds of playback before finishing" }, 422),
    );
    const result = await apiClient.syncOfflineCompletions("athlete");

    expect(result.failed).toBe(1);
    expect((await api.getOfflineQueueStatus()).pending).toBe(0);
  });

  it("clears stored tokens when local state is reset", async () => {
    await signInAthlete();
    expect(secureValues.size).toBeGreaterThan(0);

    await getApiFacade().resetLocalBetaState();

    expect(secureValues.size).toBe(0);
    expect((await loadSessionState()).hasTokens).toBe(false);
  });
});
