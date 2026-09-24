import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
const network = vi.hoisted(() => ({ getNetworkStateAsync: vi.fn() }));
const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("expo-secure-store", () => secureStore);
vi.mock("expo-network", () => network);

import { apiClient, configureApiClient } from "./apiClient";

function response(status: number, error = `error_${status}`) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Math, "random").mockReturnValue(0);
  globalThis.fetch = fetchMock;
  network.getNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  secureStore.getItemAsync.mockResolvedValue(null);
  configureApiClient({ baseUrl: "https://api.example.test" });
});

afterEach(() => {
  vi.restoreAllMocks();
  configureApiClient({});
});

describe("api client HTTP error handling", () => {
  it.each([403, 404, 409, 422])("returns a structured %s response without throwing", async (status) => {
    fetchMock.mockResolvedValue(response(status));

    const result = await apiClient.getAthleteProgress("athlete");

    expect(result).toEqual({
      status,
      data: { error: `error_${status}` },
      error: { error: `error_${status}` },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("retries transient 5xx responses and returns the final response", async () => {
    fetchMock
      .mockResolvedValueOnce(response(503, "temporary_1"))
      .mockResolvedValueOnce(response(502, "temporary_2"))
      .mockResolvedValueOnce(response(500, "temporary_3"));

    const result = await apiClient.getAthleteProgress("athlete");

    expect(result.status).toBe(500);
    expect(result.error?.error).toBe("temporary_3");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws NetworkError after exhausting transport retries", async () => {
    fetchMock.mockRejectedValue(new TypeError("socket closed"));

    await expect(apiClient.getAthleteProgress("athlete")).rejects.toMatchObject({
      name: "NetworkError",
      message: expect.stringContaining("socket closed"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
