import * as SecureStore from "expo-secure-store";
import * as Network from "expo-network";
import type {
  AgeGateRequest,
  AgeGateResponse,
  AuthTokenSet,
  BetaUserRole,
  CaregiverDashboardPayload,
  CompletionSyncResponse,
  OfflineCompletionQueueItem,
  OfflineQueueStatus,
  ConsentRevocationResponse,
  DataDeletionRequest,
  PairingApprovalRequest,
  PairingApprovalResponse,
  PairingClaimRequest,
  PairingClaimResponse,
  PairingCodeResponse,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  PlaybackEventRequest,
  RefreshTokenRequest,
  RegisterAccountRequest,
  RegisterAccountResponse,
  SessionCompletionRequest,
  SessionRetrieveResponse,
  SignInAccountRequest,
} from "../../../shared/types";
import type { AthleteProgress, UserAccount } from "../../../shared/types";
import {
  loadSessionState,
  saveSessionState,
  tokenKey,
  type PersistedSessionState,
} from "./sessionStore";

/**
 * Production API client for the Fearless Footballer backend.
 *
 * Responsibilities:
 *  - Stores JWT access/refresh tokens in `expo-secure-store` under the same
 *    key scheme as `sessionStore.ts` (`fearlessfootballer.token.<role>.<kind>`).
 *  - Automatically attaches `Authorization: Bearer <access>` on authenticated
 *    requests and transparently refreshes the access token on 401 responses.
 *  - Returns `{ status, data }` tuples so callers can react to 401/403/409/422
 *    without try/catch for every request (the SessionProvider catches 401 to
 *    redirect to sign-in).
 *  - Retries network failures and 5xx responses with exponential backoff +
 *    decorrelated jitter.
 *  - Honors configurable per-request timeouts (15s default, 60s for
 *    completion/upload requests).
 *  - Supports an `Idempotency-Key` header for completion requests so offline
 *    queue deduplication survives across devices and retries.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const DEFAULT_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8_000;

export interface ApiClientOptions {
  role?: BetaUserRole;
  /** Override the base URL (mainly for tests). */
  baseUrl?: string;
  /** Override secure-store access (mainly for tests). */
  secureStore?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    deleteItem: (key: string) => Promise<void>;
  };
  /** Override network status detection (mainly for tests). */
  networkStatus?: () => Promise<boolean>;
}

export interface ApiResult<T> {
  status: number;
  data: T | null;
  /** The raw error body when the request failed, for debugging. */
  error?: ApiErrorBody;
}

export interface ApiErrorBody {
  error?: string;
}

/** Errors that the client throws for transport-level failures (no HTTP
 * response received). Authentication/authorization failures are *not*
 * thrown — they are returned as `ApiResult` with the appropriate status. */
export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "NetworkError";
  }
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestConfig {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** When true, the request is retried on network failure / 5xx. */
  retryable?: boolean;
  /** Idempotency key sent as the `Idempotency-Key` header. */
  idempotencyKey?: string;
  /** When true, attaches the bearer token and refreshes on 401. */
  authenticated?: boolean;
  role?: BetaUserRole;
}

let storedOptions: ApiClientOptions = {};

/** Configure the shared client (role + optional test overrides). */
export function configureApiClient(options: ApiClientOptions = {}) {
  storedOptions = options;
}

const store = {
  async getItem(key: string): Promise<string | null> {
    if (storedOptions.secureStore) return storedOptions.secureStore.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (storedOptions.secureStore) {
      await storedOptions.secureStore.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (storedOptions.secureStore) {
      await storedOptions.secureStore.deleteItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const baseUrl = () => storedOptions.baseUrl ?? BASE_URL;

async function isOnline(): Promise<boolean> {
  if (storedOptions.networkStatus) return storedOptions.networkStatus();
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    return false;
  }
}

export async function hasInternetConnection(): Promise<boolean> {
  return isOnline();
}

async function getTokens(role: BetaUserRole): Promise<{ access: string | null; refresh: string | null }> {
  const [access, refresh] = await Promise.all([
    store.getItem(tokenKey(role, "access")),
    store.getItem(tokenKey(role, "refresh")),
  ]);
  return { access, refresh };
}

export async function saveTokens(
  role: BetaUserRole,
  tokens: AuthTokenSet,
): Promise<void> {
  await Promise.all([
    store.setItem(tokenKey(role, "access"), tokens.accessToken),
    store.setItem(tokenKey(role, "refresh"), tokens.refreshToken),
  ]);
}

export async function clearTokens(role: BetaUserRole): Promise<void> {
  await Promise.all([
    store.deleteItem(tokenKey(role, "access")),
    store.deleteItem(tokenKey(role, "refresh")),
  ]);
}

/**
 * Resolve a valid access token for the configured role, refreshing it if the
 * current access token is missing or the role has a refresh token available.
 * Returns `null` when no tokens are stored (unauthenticated user).
 */
async function resolveAccessToken(role: BetaUserRole): Promise<string | null> {
  const { access, refresh } = await getTokens(role);
  if (access) return access;
  if (refresh) {
    const refreshed = await refreshTokens(role, refresh);
    return refreshed?.accessToken ?? null;
  }
  return null;
}

async function refreshTokens(role: BetaUserRole, refreshToken: string): Promise<AuthTokenSet | null> {
  try {
    const result = await request<AuthTokenSet>(
      "POST",
      "/auth/refresh",
      { refreshToken } as RefreshTokenRequest,
      { role, authenticated: false, retryable: false, timeoutMs: DEFAULT_TIMEOUT_MS },
    );
    if (result.status === 200 && result.data) {
      await saveTokens(role, result.data);
      return result.data;
    }
    // Refresh failed — clear stale tokens so the session provider can redirect.
    await clearTokens(role);
    return null;
  } catch {
    return null;
  }
}

function computeBackoff(attempt: number): number {
  // Exponential backoff with full jitter: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
  const base = Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * 2 ** (attempt - 1));
  return Math.floor(Math.random() * base);
}

async function wait(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function parseBody<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Low-level request with retry + timeout. Returns the *last* response even on
 * failure, or throws a NetworkError if no response was ever received. */
async function request<T>(
  method: HttpMethod,
  url: string,
  body?: unknown,
  config: RequestConfig = {},
): Promise<ApiResult<T>> {
  const {
    role,
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryable = true,
    idempotencyKey,
    authenticated = false,
  } = config;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;

    if (retryable && attempt > 1) {
      await wait(computeBackoff(attempt - 1));
    }

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (authenticated && role) {
      const token = await resolveAccessToken(role);
      if (token) {
        requestHeaders.Authorization = `Bearer ${token}`;
      }
    }

    if (idempotencyKey) {
      requestHeaders["Idempotency-Key"] = idempotencyKey;
    }

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const signal = (() => {
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      return controller.signal;
    })();

    let response: Response;
    try {
      const init: RequestInit = {
        method,
        headers: requestHeaders,
        signal,
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }

      response = await fetch(`${baseUrl()}${url}`, init);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        if (retryable && attempt < MAX_RETRIES) {
          continue;
        }
        throw new NetworkError(
          `Request to ${url} timed out after ${timeoutMs}ms`,
          error,
        );
      }
      // Network-level failure (offline, DNS, connection reset).
      if (retryable && attempt < MAX_RETRIES) {
        continue;
      }
      throw new NetworkError(
        `Network error calling ${url}: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    // Retry on 5xx (server errors are assumed transient).
    if (retryable && response.status >= 500 && attempt < MAX_RETRIES) {
      continue;
    }

    // 401 on an authenticated request: try a silent refresh once, then retry.
    if (authenticated && response.status === 401 && role) {
      const { refresh } = await getTokens(role);
      if (refresh && attempt === 1) {
        const refreshed = await refreshTokens(role, refresh);
        if (refreshed?.accessToken) {
          // Retry the original request with the fresh token.
          attempt = 0;
          continue;
        }
        // Refresh exhausted — fall through to return the 401 so the caller
        // (SessionProvider) can sign the user out.
      }
    }

    const data = await parseBody<T>(response);
    const result: ApiResult<T> = { status: response.status, data: data ?? null };
    if (data && typeof data === "object" && "error" in data) {
      result.error = data as unknown as ApiErrorBody;
    }
    return result;
  }
}

/** Typed wrapper that returns the result of `request`. */
async function apiRequest<T>(
  method: HttpMethod,
  url: string,
  body: unknown,
  config: RequestConfig,
): Promise<ApiResult<T>> {
  const online = await isOnline();
  if (!online) {
    throw new NetworkError("No internet connection");
  }
  return request<T>(method, url, body, config);
}

// =============================================================================
// Public endpoints
// =============================================================================

export const apiClient = {
  // ---- Authentication -------------------------------------------------------

  async register(
    request: RegisterAccountRequest,
  ): Promise<ApiResult<RegisterAccountResponse>> {
    const result = await apiRequest<RegisterAccountResponse>(
      "POST",
      "/auth/register",
      request,
      { role: request.role, retryable: false, timeoutMs: DEFAULT_TIMEOUT_MS },
    );
    if (result.status === 201 && result.data?.tokens) {
      await saveTokens(request.role, result.data.tokens);
    }
    return result;
  },

  async signIn(
    request: SignInAccountRequest,
  ): Promise<ApiResult<RegisterAccountResponse>> {
    const result = await apiRequest<RegisterAccountResponse>(
      "POST",
      "/auth/sign-in",
      request,
      { role: request.role, retryable: false, timeoutMs: DEFAULT_TIMEOUT_MS },
    );
    if (result.status === 200 && result.data?.tokens) {
      await saveTokens(request.role, result.data.tokens);
    }
    return result;
  },

  async signOut(role: BetaUserRole): Promise<void> {
    await clearTokens(role);
  },

  async requestPasswordReset(
    request: PasswordResetRequest,
  ): Promise<ApiResult<void>> {
    return apiRequest<void>("POST", "/auth/password/reset-request", request, {
      retryable: false,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
  },

  async confirmPasswordReset(
    request: PasswordResetConfirmRequest,
  ): Promise<ApiResult<void>> {
    return apiRequest<void>("POST", "/auth/password/reset", request, {
      retryable: false,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
  },

  async evaluateAgeGate(request: AgeGateRequest): Promise<ApiResult<AgeGateResponse>> {
    return apiRequest<AgeGateResponse>("POST", "/auth/age-gate", request, {
      retryable: false,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
  },

  // ---- Pairing --------------------------------------------------------------

  async createPairingCode(role: BetaUserRole): Promise<ApiResult<PairingCodeResponse>> {
    return apiRequest<PairingCodeResponse>("POST", "/auth/pairing/code", {}, { role, authenticated: true });
  },

  async claimPairingCode(
    role: BetaUserRole,
    request: PairingClaimRequest,
  ): Promise<ApiResult<PairingClaimResponse>> {
    return apiRequest<PairingClaimResponse>("POST", "/auth/pairing/claim", request, {
      role,
      authenticated: true,
    });
  },

  async approvePairing(
    role: BetaUserRole,
    linkId: string,
    request: PairingApprovalRequest,
  ): Promise<ApiResult<PairingApprovalResponse>> {
    return apiRequest<PairingApprovalResponse>(
      "POST",
      `/auth/pairing/${linkId}/approve`,
      request,
      { role, authenticated: true },
    );
  },

  async revokePairing(role: BetaUserRole, linkId: string): Promise<ApiResult<PairingApprovalResponse>> {
    return apiRequest<PairingApprovalResponse>("DELETE", `/auth/pairing/${linkId}`, undefined, {
      role,
      authenticated: true,
    });
  },

  async revokeConsent(
    role: BetaUserRole,
    linkId: string,
  ): Promise<ApiResult<ConsentRevocationResponse>> {
    return apiRequest<ConsentRevocationResponse>("DELETE", `/auth/consent/${linkId}`, undefined, {
      role,
      authenticated: true,
      retryable: false,
    });
  },

  async deleteAccount(
    role: BetaUserRole,
    request: DataDeletionRequest,
  ): Promise<ApiResult<void>> {
    return apiRequest<void>("DELETE", "/auth/account", request, {
      role,
      authenticated: true,
      retryable: false,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
  },

  // ---- Sessions --------------------------------------------------------------

  async getAthleteSession(role: BetaUserRole): Promise<ApiResult<SessionRetrieveResponse>> {
    return apiRequest<SessionRetrieveResponse>("GET", "/sessions/today", undefined, {
      role,
      authenticated: true,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
  },

  async recordPlaybackEvent(
    role: BetaUserRole,
    sessionId: string,
    request: PlaybackEventRequest,
  ): Promise<ApiResult<void>> {
    return apiRequest<void>(
      "POST",
      `/sessions/${sessionId}/events`,
      request,
      { role, authenticated: true, retryable: false, timeoutMs: DEFAULT_TIMEOUT_MS },
    );
  },

  async completeSession(
    role: BetaUserRole,
    sessionId: string,
    request: SessionCompletionRequest,
  ): Promise<ApiResult<CompletionSyncResponse>> {
    return apiRequest<CompletionSyncResponse>(
      "POST",
      `/sessions/${sessionId}/complete`,
      request,
      {
        role,
        authenticated: true,
        idempotencyKey: request.idempotencyKey,
        timeoutMs: UPLOAD_TIMEOUT_MS,
      },
    );
  },

  /**
   * Syncs offline-completion queue items against the production backend.
   *
   * Reads the local queue from `sessionStore`, sends each pending item with its
   * `Idempotency-Key` header, and updates the queue with the server response
   * (or a failed status with the error message). Returns counts of what was
   * synced and what failed. Items already marked `synced` are skipped.
   */
  async syncOfflineCompletions(
    role: BetaUserRole,
    options: {
      /** Items to attempt; defaults to all pending items in the local queue. */
      items?: OfflineCompletionQueueItem[];
      /** Called after each item is processed with the updated queue state. */
      onProgress?: (synced: number, failed: number) => void;
    } = {},
  ): Promise<{ synced: number; failed: number }> {
    const { updateOfflineCompletionQueueItem } = await import("./offlineCompletionQueue");

    const state = await loadSessionState();
    const items = options.items ?? (state.offlineCompletionQueue ?? []).filter(
      (item) => item.status === "queued" || item.status === "failed",
    );

    let synced = 0;
    let failed = 0;
    let nextState: PersistedSessionState = state;

    for (const item of items) {
      const timestamp = new Date().toISOString();
      nextState = updateOfflineCompletionQueueItem(
        nextState,
        item.request.idempotencyKey,
        {
          status: "syncing",
          attempts: item.attempts + 1,
          lastAttemptAt: timestamp,
          updatedAt: timestamp,
        },
      );

      try {
        const result = await this.completeSession(
          role,
          item.request.sessionId,
          item.request,
        );
        if (result.status === 200 && result.data) {
          nextState = updateOfflineCompletionQueueItem(
            nextState,
            item.request.idempotencyKey,
            {
              status: "synced",
              syncedAt: timestamp,
              updatedAt: timestamp,
              lastError: undefined,
            },
          );
          synced += 1;
        } else {
          const error = result.error?.error ?? `Server returned ${result.status}`;
          nextState = updateOfflineCompletionQueueItem(
            nextState,
            item.request.idempotencyKey,
            {
              status: "failed",
              updatedAt: timestamp,
              lastError: error,
              scheduleRetry: true,
            },
          );
          failed += 1;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to sync completion.";
        nextState = updateOfflineCompletionQueueItem(
          nextState,
          item.request.idempotencyKey,
          {
            status: "failed",
            updatedAt: timestamp,
            lastError: message,
            scheduleRetry: true,
          },
        );
        failed += 1;
      }

      await saveSessionState(nextState);
      options.onProgress?.(synced, failed);
    }

    return { synced, failed };
  },

  // ---- Aggregations ----------------------------------------------------------

  async getAthleteProgress(role: BetaUserRole): Promise<ApiResult<AthleteProgress>> {
    return apiRequest<AthleteProgress>("GET", "/athlete/progress", undefined, {
      role,
      authenticated: true,
    });
  },

  async updateAthleteProfile(
    role: BetaUserRole,
    request: { displayName?: string; timezone?: string; region?: string },
  ): Promise<ApiResult<{ displayName: string; timezone: string; region?: string }>> {
    return apiRequest<{ displayName: string; timezone: string; region?: string }>(
      "PATCH",
      "/athlete/profile",
      request,
      { role, authenticated: true, retryable: false, timeoutMs: DEFAULT_TIMEOUT_MS },
    );
  },

  async getOfflineQueueStatus(role: BetaUserRole): Promise<ApiResult<OfflineQueueStatus>> {
    return apiRequest<OfflineQueueStatus>("GET", "/athlete/queue-status", undefined, {
      role,
      authenticated: true,
    });
  },

  async getCaregiverDashboard(
    role: BetaUserRole,
    athleteId: string,
  ): Promise<ApiResult<CaregiverDashboardPayload>> {
    return apiRequest<CaregiverDashboardPayload>(
      "GET",
      `/caregiver/athletes/${athleteId}/dashboard`,
      undefined,
      { role, authenticated: true },
    );
  },
};
