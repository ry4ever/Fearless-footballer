import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OfflineCompletionQueueItem, SessionCompletionRequest } from "../../../shared/types";

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

import { apiClient, configureApiClient } from "./apiClient";
import { tokenKey } from "./sessionStore";

const completionRequest: SessionCompletionRequest = {
  sessionId: "session_1",
  sessionVersion: "v1",
  mode: "interactive",
  completionDurationSeconds: 120,
  completedAt: "2026-09-21T22:00:00.000Z",
  reflection: { feeling: "steadier" },
  idempotencyKey: "cmp_integration_1",
};

const completionResponse = {
  completionId: "completion_1",
  streak: { currentStreakDays: 1, bestStreakDays: 1, isNewMilestone: true },
  composure: { previousScore: 50, newScore: 52, delta: 2 },
  weeklyProgress: { completedDays: 1, targetDays: 3, sevenDayPattern: [true] },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  secureValues.clear();
  asyncValues.clear();
  globalThis.fetch = fetchMock;
  network.getNetworkStateAsync.mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  });
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
  configureApiClient({ baseUrl: "https://api.example.test" });
  secureValues.set(tokenKey("athlete", "access"), "access-token");
  secureValues.set(tokenKey("athlete", "refresh"), "refresh-token");
});

afterEach(() => {
  configureApiClient({});
});

describe("production API client lifecycle", () => {
  it("covers authenticated lifecycle endpoints and completion idempotency", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ pairingCode: "123456", expiresAt: "2026-09-22T00:00:00.000Z" }))
      .mockResolvedValueOnce(jsonResponse({ linkId: "link_1", status: "pending" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ session: { id: "session_1" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(completionResponse))
      .mockResolvedValueOnce(jsonResponse({ athleteId: "athlete_1", score: 52 }))
      .mockResolvedValueOnce(jsonResponse({ linkId: "link_1", status: "revoked" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await apiClient.createPairingCode("athlete");
    await apiClient.claimPairingCode("athlete", {
      pairingCode: "123456",
      relationship: "parent",
      consentConfirmed: true,
    });
    await apiClient.approvePairing("athlete", "link_1", { approved: true });
    await apiClient.getAthleteSession("athlete");
    await apiClient.recordPlaybackEvent("athlete", "session_1", {
      eventType: "heartbeat",
      mode: "interactive",
      playbackPositionSeconds: 10,
      clientTimestamp: "2026-09-21T22:00:00.000Z",
    });
    await apiClient.completeSession("athlete", "session_1", completionRequest);
    await apiClient.getAthleteProgress("athlete");
    await apiClient.revokeConsent("athlete", "link_1");
    await apiClient.deleteAccount("athlete", { confirmation: "DELETE_MY_ACCOUNT" });

    const calls = fetchMock.mock.calls;
    expect(calls.map(([url]) => url)).toEqual([
      "https://api.example.test/auth/pairing/code",
      "https://api.example.test/auth/pairing/claim",
      "https://api.example.test/auth/pairing/link_1/approve",
      "https://api.example.test/sessions/today",
      "https://api.example.test/sessions/session_1/events",
      "https://api.example.test/sessions/session_1/complete",
      "https://api.example.test/athlete/progress",
      "https://api.example.test/auth/consent/link_1",
      "https://api.example.test/auth/account",
    ]);
    expect(calls[5][1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer access-token",
        "Idempotency-Key": "cmp_integration_1",
      }),
    }));
  });

  it("refreshes once after a 401 and retries the original request", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "fresh-access", refreshToken: "fresh-refresh", expiresIn: 900 }))
      .mockResolvedValueOnce(jsonResponse({ session: { id: "session_1" } }));

    const result = await apiClient.getAthleteSession("athlete");

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.example.test/auth/refresh");
    expect(fetchMock.mock.calls[2][1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer fresh-access" }),
    }));
  });
});

describe("offline completion synchronization", () => {
  it("marks queued and failed items synced while preserving the idempotency key", async () => {
    const queued: OfflineCompletionQueueItem = {
      id: "queue_cmp_integration_1",
      request: completionRequest,
      createdAt: "2026-09-21T22:00:00.000Z",
      updatedAt: "2026-09-21T22:00:00.000Z",
      attempts: 0,
      status: "queued",
      nextAttemptAt: "2026-09-21T22:00:00.000Z",
    };
    asyncValues.set("fearlessfootballer.session.v1", JSON.stringify({
      currentRole: "athlete",
      offlineCompletionQueue: [queued],
    }));
    fetchMock.mockResolvedValueOnce(jsonResponse(completionResponse));

    const result = await apiClient.syncOfflineCompletions("athlete");

    expect(result).toEqual({ synced: 1, failed: 0 });
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ "Idempotency-Key": "cmp_integration_1" }),
    }));
    const savedState = JSON.parse(asyncValues.get("fearlessfootballer.session.v1") ?? "{}");
    expect(savedState.offlineCompletionQueue[0]).toMatchObject({
      status: "synced",
      attempts: 1,
      syncedAt: expect.any(String),
    });
  });
});

it("does not send requests when the device is offline", async () => {
  network.getNetworkStateAsync.mockResolvedValue({ isConnected: false, isInternetReachable: false });

  await expect(apiClient.getAthleteSession("athlete")).rejects.toMatchObject({
    name: "NetworkError",
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

export {};
