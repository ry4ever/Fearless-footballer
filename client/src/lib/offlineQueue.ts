import type { SessionCompletionRequest } from "@shared/types";
import { apiClient } from "./apiClient";

export interface QueuedCompletion {
  id: string;
  idempotencyKey: string;
  request: SessionCompletionRequest;
  queuedAt: string;
  attempts: number;
  status: "queued" | "syncing" | "synced" | "failed";
  lastError?: string;
}

const STORAGE_KEY = "fearless_offline_completion_queue";

class OfflineQueueManager {
  private queue: QueuedCompletion[] = [];
  private isSyncing = false;
  private listeners: Set<(queue: QueuedCompletion[]) => void> = new Set();

  constructor() {
    this.loadQueue();
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.flushQueue());
    }
  }

  private loadQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw);
      }
    } catch {
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
      this.notifyListeners();
    } catch {
      // Storage quota exceeded or disabled
    }
  }

  public subscribe(listener: (queue: QueuedCompletion[]) => void) {
    this.listeners.add(listener);
    listener(this.getQueue());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    Array.from(this.listeners).forEach((listener) => {
      listener(this.getQueue());
    });
  }

  public getQueue(): QueuedCompletion[] {
    return [...this.queue];
  }

  public getPendingCount(): number {
    return this.queue.filter((item) => item.status === "queued" || item.status === "failed").length;
  }

  public enqueue(request: SessionCompletionRequest): QueuedCompletion {
    const idempotencyKey = request.idempotencyKey || `opt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const queuedItem: QueuedCompletion = {
      id: idempotencyKey,
      idempotencyKey,
      request,
      queuedAt: new Date().toISOString(),
      attempts: 0,
      status: "queued",
    };

    this.queue.push(queuedItem);
    this.saveQueue();

    // Try background sync if online
    if (navigator.onLine) {
      this.flushQueue();
    }

    return queuedItem;
  }

  public async flushQueue(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing || this.getPendingCount() === 0) {
      return { synced: 0, failed: 0 };
    }

    if (!apiClient.isAuthenticated()) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    let synced = 0;
    let failed = 0;

    const pendingItems = this.queue.filter(
      (item) => item.status === "queued" || item.status === "failed"
    );

    for (const item of pendingItems) {
      item.status = "syncing";
      item.attempts += 1;
      this.saveQueue();

      try {
        await apiClient.completeSession(item.request, item.idempotencyKey);
        item.status = "synced";
        synced++;
      } catch (err: any) {
        item.status = "failed";
        item.lastError = err.message || "Sync error";
        failed++;

        // If auth error, stop processing queue
        if (err.message?.includes("401") || err.message?.includes("Unauthorized")) {
          break;
        }
      }
    }

    // Purge synced items older than 24h
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.queue = this.queue.filter(
      (item) => item.status !== "synced" || new Date(item.queuedAt).getTime() > cutoff
    );

    this.isSyncing = false;
    this.saveQueue();

    return { synced, failed };
  }
}

export const offlineQueue = new OfflineQueueManager();
