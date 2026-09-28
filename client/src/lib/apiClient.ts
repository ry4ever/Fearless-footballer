import type {
  AthleteProgress,
  AuthTokenSet,
  BetaUserRole,
  CaregiverDashboardPayload,
  CompletionSyncResponse,
  PairingApprovalResponse,
  PairingClaimResponse,
  PairingCodeResponse,
  PairingLink,
  PairingRelationship,
  PairingStatusResponse,
  PlaybackEventRequest,
  RegisterAccountRequest,
  SessionCompletionRequest,
  SessionLibraryResponse,
  SessionRetrieveResponse,
  UserAccount,
} from "@shared/types";

/**
 * API base URL. Empty means same origin: in production Vercel rewrites the
 * API paths to the backend, and in development the Vite dev server proxies
 * them (see vite.config.ts). Set VITE_API_URL to call another origin.
 */
const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? "";

const ACCESS_KEY = "fearless_access_token";
const REFRESH_KEY = "fearless_refresh_token";
const USER_KEY = "fearless_user";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode); the session just won't survive a reload.
  }
}

type SessionListener = (user: UserAccount | null) => void;

class ApiClient {
  private accessToken: string | null = readStorage(ACCESS_KEY);
  private refreshTokenValue: string | null = readStorage(REFRESH_KEY);
  private refreshPromise: Promise<AuthTokenSet | null> | null = null;
  private listeners = new Set<SessionListener>();

  /** The signed-in account saved at sign-in; the API has no "who am I" endpoint. */
  public getStoredUser(): UserAccount | null {
    const raw = readStorage(USER_KEY);
    if (!raw || !this.refreshTokenValue) return null;
    try {
      return JSON.parse(raw) as UserAccount;
    } catch {
      return null;
    }
  }

  /** Called with null when the session ends, including an expired refresh token. */
  public onSessionChange(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setTokens(tokens: AuthTokenSet | null) {
    this.accessToken = tokens?.accessToken ?? null;
    this.refreshTokenValue = tokens?.refreshToken ?? null;
    writeStorage(ACCESS_KEY, this.accessToken);
    writeStorage(REFRESH_KEY, this.refreshTokenValue);
  }

  private startSession(user: UserAccount, tokens: AuthTokenSet) {
    this.setTokens(tokens);
    writeStorage(USER_KEY, JSON.stringify(user));
    this.listeners.forEach((listener) => listener(user));
  }

  private endSession() {
    this.setTokens(null);
    writeStorage(USER_KEY, null);
    this.listeners.forEach((listener) => listener(null));
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth = true,
    isRetry = false,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (requiresAuth && this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    } catch {
      throw new ApiError("Can't reach Fearless right now. Check your connection and try again.", 0);
    }

    if (response.status === 401 && requiresAuth && !isRetry && this.refreshTokenValue) {
      const refreshed = await this.refreshTokens();
      if (refreshed) return this.request<T>(endpoint, options, requiresAuth, true);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = typeof body?.error === "string" ? body.error : `Request failed (${response.status})`;
      throw new ApiError(message, response.status);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private refreshTokens(): Promise<AuthTokenSet | null> {
    if (this.refreshPromise) return this.refreshPromise;
    const refreshToken = this.refreshTokenValue;
    if (!refreshToken) return Promise.resolve(null);

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          // Only end the session if nothing replaced the token meanwhile.
          if (this.refreshTokenValue === refreshToken) this.endSession();
          return null;
        }
        // The server returns the rotated token set directly, not wrapped in { tokens }.
        const tokens = (await res.json()) as AuthTokenSet;
        this.setTokens(tokens);
        return tokens;
      } catch {
        // Network failure: keep the stored tokens so the user isn't signed out while offline.
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // --- Auth ---
  public async register(req: RegisterAccountRequest): Promise<UserAccount> {
    const data = await this.request<{ user: UserAccount; tokens: AuthTokenSet }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(req) },
      false,
    );
    this.startSession(data.user, data.tokens);
    return data.user;
  }

  public async signIn(email: string, password: string, role: BetaUserRole): Promise<UserAccount> {
    const data = await this.request<{ user: UserAccount; tokens: AuthTokenSet }>(
      "/auth/sign-in",
      { method: "POST", body: JSON.stringify({ role, email, password }) },
      false,
    );
    this.startSession(data.user, data.tokens);
    return data.user;
  }

  /** Tokens are stateless on the server, so signing out is local. */
  public signOut() {
    this.endSession();
  }

  public async deleteAccount(): Promise<void> {
    await this.request<void>("/auth/account", {
      method: "DELETE",
      body: JSON.stringify({ confirmation: "DELETE_MY_ACCOUNT" }),
    });
    this.endSession();
  }

  // --- Pairing ---
  public async getPairing(): Promise<PairingLink | null> {
    const data = await this.request<PairingStatusResponse>("/auth/pairing");
    return data.pairing;
  }

  public createPairingCode(): Promise<PairingCodeResponse> {
    return this.request<PairingCodeResponse>("/auth/pairing/code", { method: "POST" });
  }

  public claimPairingCode(pairingCode: string, relationship: PairingRelationship): Promise<PairingClaimResponse> {
    return this.request<PairingClaimResponse>("/auth/pairing/claim", {
      method: "POST",
      body: JSON.stringify({ pairingCode, relationship, consentConfirmed: true }),
    });
  }

  public approvePairing(linkId: string, approved: boolean): Promise<PairingApprovalResponse> {
    return this.request<PairingApprovalResponse>(`/auth/pairing/${encodeURIComponent(linkId)}/approve`, {
      method: "POST",
      body: JSON.stringify({ approved }),
    });
  }

  /** Athlete ends an active caregiver link. */
  public revokePairing(linkId: string): Promise<PairingApprovalResponse> {
    return this.request<PairingApprovalResponse>(`/auth/pairing/${encodeURIComponent(linkId)}`, {
      method: "DELETE",
    });
  }

  /** Caregiver withdraws consent, ending the link. */
  public revokeConsent(linkId: string): Promise<unknown> {
    return this.request(`/auth/consent/${encodeURIComponent(linkId)}`, { method: "DELETE" });
  }

  // --- Sessions ---
  public async getTodaySession() {
    const data = await this.request<SessionRetrieveResponse>("/sessions/today");
    return data.session;
  }

  /** Every playable and coming-soon session, plus programmes. */
  public getLibrary(): Promise<SessionLibraryResponse> {
    return this.request<SessionLibraryResponse>("/sessions");
  }

  /** Analytics only: failures are ignored so they never interrupt playback. */
  public recordPlaybackEvent(sessionId: string, event: PlaybackEventRequest) {
    this.request<void>(`/sessions/${encodeURIComponent(sessionId)}/events`, {
      method: "POST",
      body: JSON.stringify(event),
    }).catch(() => undefined);
  }

  public completeSession(req: SessionCompletionRequest): Promise<CompletionSyncResponse> {
    return this.request<CompletionSyncResponse>(`/sessions/${encodeURIComponent(req.sessionId)}/complete`, {
      method: "POST",
      headers: { "Idempotency-Key": req.idempotencyKey },
      body: JSON.stringify(req),
    });
  }

  // --- Progress ---
  public getAthleteProgress(): Promise<AthleteProgress> {
    return this.request<AthleteProgress>("/athlete/progress");
  }

  public getCaregiverDashboard(athleteId: string): Promise<CaregiverDashboardPayload> {
    return this.request<CaregiverDashboardPayload>(`/caregiver/athletes/${encodeURIComponent(athleteId)}/dashboard`);
  }
}

export const apiClient = new ApiClient();
