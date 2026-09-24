import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionCompletionRequest } from "../../../shared/types";

const network = vi.hoisted(() => ({
  addNetworkStateListener: vi.fn(),
  getNetworkStateAsync: vi.fn(),
}));
vi.mock("expo-network", () => network);

import {
  addConnectivityListener,
  createOfflineCompletionQueueItem,
  findOfflineCompletionQueueItem,
  getDueRetryItems,
  getOfflineCompletionQueueStatus,
  serverWinsConflict,
  updateOfflineCompletionQueueItem,
  upsertOfflineCompletionQueueItem,
} from "./offlineCompletionQueue";

const request: SessionCompletionRequest = {
  sessionId: "session_1",
  sessionVersion: "v1",
  mode: "interactive",
  completionDurationSeconds: 120,
  completedAt: "2026-09-21T12:00:00.000Z",
  idempotencyKey: "cmp_1",
};

beforeEach(() => {
  vi.clearAllMocks();
  network.addNetworkStateListener.mockReturnValue({ remove: vi.fn() });
  network.getNetworkStateAsync.mockResolvedValue({ isConnected: false, isInternetReachable: false });
});

describe("offline completion queue", () => {
  it("creates and upserts idempotent queue items", () => {
    const item = createOfflineCompletionQueueItem(request, new Date("2026-09-21T12:00:00.000Z"));
    const state = upsertOfflineCompletionQueueItem({}, item);
    const replacement = { ...item, attempts: 1, status: "failed" as const };
    const updated = upsertOfflineCompletionQueueItem(state, replacement);

    expect(item).toMatchObject({ id: "queue_cmp_1", status: "queued", attempts: 0 });
    expect(updated.offlineCompletionQueue).toHaveLength(1);
    expect(findOfflineCompletionQueueItem(updated, "cmp_1")).toMatchObject({ attempts: 1, status: "failed" });
  });

  it("tracks syncing, failed, and synced status with retry metadata", () => {
    const item = createOfflineCompletionQueueItem(request, new Date("2026-09-21T12:00:00.000Z"));
    const state = upsertOfflineCompletionQueueItem({}, item);
    const failed = updateOfflineCompletionQueueItem(state, "cmp_1", {
      status: "failed",
      attempts: 1,
      lastError: "server unavailable",
      updatedAt: "2026-09-21T12:01:00.000Z",
      scheduleRetry: true,
    });

    expect(findOfflineCompletionQueueItem(failed, "cmp_1")).toMatchObject({
      status: "failed",
      attempts: 1,
      lastError: "server unavailable",
      nextAttemptAt: expect.any(String),
    });
    expect(getDueRetryItems(failed, new Date("2030-01-01T00:00:00.000Z"))).toHaveLength(1);

    const synced = updateOfflineCompletionQueueItem(failed, "cmp_1", {
      status: "synced",
      syncedAt: "2026-09-21T12:03:00.000Z",
      updatedAt: "2026-09-21T12:03:00.000Z",
      lastError: undefined,
    });
    expect(getOfflineCompletionQueueStatus(synced)).toEqual({
      pending: 0,
      lastSyncedAt: "2026-09-21T12:03:00.000Z",
    });
  });

  it("fires only on an offline-to-online transition and cleans up", async () => {
    const onOnline = vi.fn();
    const subscription = { remove: vi.fn() };
    network.addNetworkStateListener.mockReturnValue(subscription);
    const unsubscribe = addConnectivityListener(onOnline);
    await Promise.resolve();

    const listener = network.addNetworkStateListener.mock.calls[0][0] as (state: object) => void;
    listener({ isConnected: false, isInternetReachable: false });
    listener({ isConnected: true, isInternetReachable: true });
    listener({ isConnected: true, isInternetReachable: true });

    expect(onOnline).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(subscription.remove).toHaveBeenCalledOnce();
  });

  it("prefers the server timestamp during conflict resolution", () => {
    expect(serverWinsConflict(request, "2026-09-21T12:00:00.000Z")).toBe(true);
    expect(serverWinsConflict(request, "2026-09-21T11:59:59.000Z")).toBe(false);
    expect(serverWinsConflict({ ...request, completedAt: "invalid" }, "invalid")).toBe(true);
  });

  it("models the queued-to-synced integration transition", () => {
    const item = createOfflineCompletionQueueItem(request, new Date("2026-09-21T12:00:00.000Z"));
    let state = upsertOfflineCompletionQueueItem({}, item);
    state = updateOfflineCompletionQueueItem(state, "cmp_1", {
      status: "syncing",
      attempts: 1,
      lastAttemptAt: "2026-09-21T12:01:00.000Z",
      updatedAt: "2026-09-21T12:01:00.000Z",
    });
    state = updateOfflineCompletionQueueItem(state, "cmp_1", {
      status: "synced",
      syncedAt: "2026-09-21T12:01:01.000Z",
      updatedAt: "2026-09-21T12:01:01.000Z",
      lastError: undefined,
    });

    expect(state.offlineCompletionQueue?.[0]).toMatchObject({
      status: "synced",
      attempts: 1,
      syncedAt: "2026-09-21T12:01:01.000Z",
    });
    expect(getOfflineCompletionQueueStatus(state).pending).toBe(0);
  });
});
