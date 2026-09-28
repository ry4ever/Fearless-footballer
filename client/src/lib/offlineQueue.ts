import type { SessionCompletionRequest } from "@shared/types";
import { ApiError, apiClient } from "./apiClient";

/**
 * Completions that couldn't reach the server (offline or a 5xx) wait here
 * and are retried when the browser comes back online or the app starts.
 * Items are removed once the server accepts them or rejects them for good,
 * so everything in the queue is pending. The idempotency key makes retries
 * safe even if an earlier attempt actually landed.
 */
export interface QueuedCompletion {
  userId: string;
  request: SessionCompletionRequest;
  queuedAt: string;
  attempts: number;
  lastError?: string;
}

const STORAGE_KEY = "fearless_offline_completion_queue";

/** True when retrying later could succeed (no connection, server trouble, auth, rate limit). */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status >= 500 || [401, 408, 429].includes(error.status);
}

class OfflineQueueManager {
  private queue: QueuedCompletion[] = this.load();
  private flushing: Promise<number> | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => void this.flush());
    }
  }

  private load(): QueuedCompletion[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as QueuedCompletion[]).filter((item) => item?.userId && item.request) : [];
    } catch {
      return [];
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Storage unavailable; the queue still works for this page load.
    }
    this.listeners.forEach((listener) => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public pendingCount(userId: string): number {
    return this.queue.filter((item) => item.userId === userId).length;
  }

  public enqueue(userId: string, request: SessionCompletionRequest) {
    if (this.queue.some((item) => item.request.idempotencyKey === request.idempotencyKey)) return;
    this.queue.push({ userId, request, queuedAt: new Date().toISOString(), attempts: 0 });
    this.save();
  }

  /** Sends the signed-in user's queued completions. Returns how many were accepted. */
  public flush(): Promise<number> {
    if (!this.flushing) {
      this.flushing = this.flushNow().finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  private async flushNow(): Promise<number> {
    const user = apiClient.getStoredUser();
    if (!user) return 0;

    let accepted = 0;
    for (const item of this.queue.filter((queued) => queued.userId === user.id)) {
      try {
        await apiClient.completeSession(item.request);
        accepted += 1;
        this.remove(item.request.idempotencyKey);
      } catch (error) {
        if (!isRetryableError(error)) {
          // Rejected for good (e.g. session retired); retrying can't help.
          this.remove(item.request.idempotencyKey);
          continue;
        }
        item.attempts += 1;
        item.lastError = error instanceof Error ? error.message : "Sync failed";
        this.save();
        // Still offline or unauthorised: stop and try again later.
        break;
      }
    }
    return accepted;
  }

  private remove(idempotencyKey: string) {
    this.queue = this.queue.filter((item) => item.request.idempotencyKey !== idempotencyKey);
    this.save();
  }
}

export const offlineQueue = new OfflineQueueManager();
