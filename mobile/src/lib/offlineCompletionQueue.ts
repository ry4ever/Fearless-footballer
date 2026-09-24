import * as Network from "expo-network";
import type {
  CompletionSyncStatus,
  OfflineCompletionQueueItem,
  SessionCompletionRequest,
} from "../../../shared/types";
import type { PersistedSessionState } from "./sessionStore";
/**
 * Offline completion queue with exponential backoff retry scheduling.
 *
 * State machine:
 *   queued ──► syncing ──► synced
 *                │
 *                └──► failed ──► (retry scheduled via nextAttemptAt)
 *
 * Retry scheduling uses exponential backoff with decorrelated jitter.
 * Failed items get `nextAttemptAt` set so a connectivity listener or
 * periodic sync can pick them up without polling.
 */

export async function hasInternetConnection(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    return false;
  }
}

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8_000;
const MAX_RETRIES = 3;

function computeBackoff(attempt: number): number {
  const base = Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * 2 ** (attempt - 1));
  return Math.floor(Math.random() * base);
}

function scheduleNextAttempt(attempts: number): string {
  const delayMs = computeBackoff(attempts);
  return new Date(Date.now() + delayMs).toISOString();
}

export function createOfflineCompletionQueueItem(
  request: SessionCompletionRequest,
  now: Date,
): OfflineCompletionQueueItem {
  const timestamp = now.toISOString();
  return {
    id: `queue_${request.idempotencyKey}`,
    request,
    createdAt: timestamp,
    updatedAt: timestamp,
    attempts: 0,
    status: "queued",
    nextAttemptAt: timestamp,
  };
}

export function upsertOfflineCompletionQueueItem(
  state: PersistedSessionState,
  item: OfflineCompletionQueueItem,
): PersistedSessionState {
  const existingIndex = state.offlineCompletionQueue?.findIndex(
    (queued) => queued.request.idempotencyKey === item.request.idempotencyKey,
  ) ?? -1;
  const queue = [...(state.offlineCompletionQueue ?? [])];
  if (existingIndex >= 0) queue[existingIndex] = item;
  else queue.push(item);
  return { ...state, offlineCompletionQueue: queue };
}

export function updateOfflineCompletionQueueItem(
  state: PersistedSessionState,
  idempotencyKey: string,
  update: {
    status: CompletionSyncStatus;
    attempts?: number;
    lastError?: string;
    lastAttemptAt?: string;
    syncedAt?: string;
    updatedAt: string;
    /** When true, recompute nextAttemptAt using exponential backoff. */
    scheduleRetry?: boolean;
  },
) {
  const queue = (state.offlineCompletionQueue ?? []).map((item) =>
    item.request.idempotencyKey === idempotencyKey
      ? {
          ...item,
          ...update,
          lastError: update.lastError ?? item.lastError,
          ...(update.scheduleRetry
            ? { nextAttemptAt: scheduleNextAttempt((update.attempts ?? item.attempts) + 1) }
            : {}),
        }
      : item,
  );
  return { ...state, offlineCompletionQueue: queue };
}

export function findOfflineCompletionQueueItem(
  state: PersistedSessionState,
  idempotencyKey: string,
) {
  return state.offlineCompletionQueue?.find(
    (item) => item.request.idempotencyKey === idempotencyKey,
  );
}

export function getOfflineCompletionQueueStatus(state: PersistedSessionState) {
  const pendingItems = state.offlineCompletionQueue?.filter(
    (item) => item.status === "queued" || item.status === "failed" || item.status === "syncing",
  ) ?? [];
  const lastSynced = state.offlineCompletionQueue
    ?.filter((item) => item.status === "synced")
    .sort((left, right) => (right.syncedAt ?? "").localeCompare(left.syncedAt ?? ""))[0];

  return {
    pending: pendingItems.length,
    ...(lastSynced?.syncedAt ? { lastSyncedAt: lastSynced.syncedAt } : {}),
  };
}

/** Returns items that are due for retry (nextAttemptAt is in the past). */
export function getDueRetryItems(
  state: PersistedSessionState,
  now: Date = new Date(),
): OfflineCompletionQueueItem[] {
  return (
    state.offlineCompletionQueue?.filter(
      (item) =>
        (item.status === "queued" || item.status === "failed") &&
        item.nextAttemptAt &&
        new Date(item.nextAttemptAt) <= now,
    ) ?? []
  );
}

/** Returns items currently in a syncing state (to prevent double-processing). */
export function getSyncingItems(state: PersistedSessionState): OfflineCompletionQueueItem[] {
  return state.offlineCompletionQueue?.filter((item) => item.status === "syncing") ?? [];
}

/**
 * Connectivity listener that fires a callback when the device goes from
 * offline to online. Returns a cleanup function to remove the listener.
 *
 * Usage in a React component:
 *   useEffect(() => {
 *     const unsubscribe = addConnectivityListener(() => {
 *       // Trigger offline queue sync
 *     });
 *     return unsubscribe;
 *   }, []);
 */
export function addConnectivityListener(
  onOnline: () => void,
): () => void {
  let wasOnline = false;

  const subscription = Network.addNetworkStateListener(async (state) => {
    const isOnline = state.isConnected === true && state.isInternetReachable !== false;
    if (!wasOnline && isOnline) {
      // Transitioned from offline to online
      onOnline();
    }
    wasOnline = isOnline;
  });

  // Initialize wasOnline by checking immediately
  Network.getNetworkStateAsync().then((state) => {
    wasOnline = state.isConnected === true && state.isInternetReachable !== false;
  });

  return () => {
    subscription.remove();
  };
}

/**
 * Conflict resolution: server timestamp wins.
 * Given a local completion request and a server completion record with the
 * same idempotency key, this function returns true if the server record
 * should be kept (server timestamp is newer or equal).
 */
export function serverWinsConflict(
  localRequest: SessionCompletionRequest,
  serverCompletedAt: string,
): boolean {
  const localTime = Date.parse(localRequest.completedAt);
  const serverTime = Date.parse(serverCompletedAt);
  if (Number.isNaN(localTime) || Number.isNaN(serverTime)) {
    // If parsing fails, err on the side of keeping server data
    return true;
  }
  return serverTime >= localTime;
}