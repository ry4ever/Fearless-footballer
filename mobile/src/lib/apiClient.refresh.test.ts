import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const secureValues = new Map<string, string>();
const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
const network = vi.hoisted(() => ({
  getNetworkStateAsync: vi.fn(),
}));
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("expo-secure-store", () => secureStore);
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock("expo-network", () => network);

import { apiClient, configureApiClient } from "./apiClient";
import { tokenKey } from "./sessionStore";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  secureValues.clear();
  globalThis.fetch = fetchMock;
  network.getNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  secureStore.getItemAsync.mockImplementation(async (key: string) => secureValues.get(key) ?? null);
  secureStore.setItemAsync.mockImplementation(async (key: string, value: string) => {
    secureValues.set(key, value);
  });
  secureStore.deleteItemAsync.mockImplementation(async (key: string) => {
    secureValues.delete(key);
  });
  configureApiClient({ baseUrl: "https://api.example.test" });
  secureValues.set(tokenKey("athlete", "access"), "expired-access");
  secureValues.set(tokenKey("athlete", "refresh"), "refresh-1");
});

afterEach(() => {
  configureApiClient({});
});

describe("apiClient token refresh", () => {
  it("shares one refresh call across concurrent 401s and keeps the rotated tokens", async () => {
    // Mirrors the server: refresh tokens rotate on use, so a second refresh
    // with the same token is rejected.
    const usedRefreshTokens = new Set<string>();
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        const { refreshToken } = JSON.parse(String(init.body));
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (refreshToken !== "refresh-1" || usedRefreshTokens.has(refreshToken)) {
          return jsonResponse({ error: "Refresh token has been rotated" }, 401);
        }
        usedRefreshTokens.add(refreshToken);
        return jsonResponse({ accessToken: "access-2", refreshToken: "refresh-2", expiresIn: 900 });
      }
      const auth = new Headers(init.headers).get("Authorization");
      if (auth !== "Bearer access-2") {
        return jsonResponse({ error: "Invalid or expired token" }, 401);
      }
      return jsonResponse({ pending: 0 });
    });

    const results = await Promise.all([
      apiClient.getOfflineQueueStatus("athlete"),
      apiClient.getOfflineQueueStatus("athlete"),
      apiClient.getAthleteProgress("athlete"),
    ]);

    expect(results.map((result) => result.status)).toEqual([200, 200, 200]);
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
    expect(secureValues.get(tokenKey("athlete", "access"))).toBe("access-2");
    expect(secureValues.get(tokenKey("athlete", "refresh"))).toBe("refresh-2");
  });
});
