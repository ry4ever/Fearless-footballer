import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("expo-network", () => network);

import { apiClient, configureApiClient } from "./apiClient";

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = fetchMock;
  network.getNetworkStateAsync.mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  });
  secureStore.getItemAsync.mockImplementation(async (key: string) =>
    key.endsWith("athlete.access") ? "access-token" : null,
  );
  configureApiClient({ baseUrl: "https://api.example.test" });
});

afterEach(() => {
  configureApiClient({});
});

describe("account privacy API actions", () => {
  it("revokes consent with the authenticated role", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ linkId: "lnk_1", status: "revoked" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await apiClient.revokeConsent("athlete", "lnk_1");

    expect(result).toMatchObject({ status: 200, data: { status: "revoked" } });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/auth/consent/lnk_1",
      expect.objectContaining({ method: "DELETE", headers: expect.objectContaining({ Authorization: "Bearer access-token" }) }),
    );
  });

  it("sends the explicit deletion confirmation", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await apiClient.deleteAccount("athlete", {
      confirmation: "DELETE_MY_ACCOUNT",
    });

    expect(result.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/auth/account",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE_MY_ACCOUNT" }),
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });
});
