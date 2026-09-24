import type {
  AuthTokenSet,
  CaregiverDashboardPayload,
  PairingLink,
  CompletionSyncResponse,
  PairingCodeResponse,
  RegisterAccountRequest,
  SessionCompletionRequest,
  SessionPackage,
  UserAccount,
} from "@shared/types";

const API_BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
  (typeof process !== "undefined" && process.env?.VITE_API_URL) ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost" ? "" : "http://localhost:5000");

class ApiClient {
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private refreshPromise: Promise<AuthTokenSet | null> | null = null;

  constructor() {
    this.accessToken = localStorage.getItem("fearless_access_token");
    this.refreshTokenValue = localStorage.getItem("fearless_refresh_token");
  }

  public setTokens(tokens: AuthTokenSet | null) {
    if (tokens) {
      this.accessToken = tokens.accessToken;
      this.refreshTokenValue = tokens.refreshToken;
      localStorage.setItem("fearless_access_token", tokens.accessToken);
      localStorage.setItem("fearless_refresh_token", tokens.refreshToken);
    } else {
      this.accessToken = null;
      this.refreshTokenValue = null;
      localStorage.removeItem("fearless_access_token");
      localStorage.removeItem("fearless_refresh_token");
    }
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth = true,
    isRetry = false
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (requiresAuth && this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });

      if (response.status === 401 && requiresAuth && !isRetry && this.refreshTokenValue) {
        // Attempt token refresh on 401
        const newTokens = await this.refreshTokens();
        if (newTokens) {
          return this.request<T>(endpoint, options, requiresAuth, true);
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "HTTP Error " + response.status }));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (err: any) {
      if (err.name === "TypeError" && err.message.includes("fetch")) {
        throw new Error("Network connection error. Server unreachable.");
      }
      throw err;
    }
  }

  private async refreshTokens(): Promise<AuthTokenSet | null> {
    if (this.refreshPromise) return this.refreshPromise;
    if (!this.refreshTokenValue) return null;

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: this.refreshTokenValue }),
        });

        if (!res.ok) {
          this.setTokens(null);
          return null;
        }

        const data = await res.json();
        this.setTokens(data.tokens);
        return data.tokens;
      } catch {
        this.setTokens(null);
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // --- Auth API ---
  public async register(req: RegisterAccountRequest): Promise<{ user: UserAccount; tokens: AuthTokenSet }> {
    const data = await this.request<{ user: UserAccount; tokens: AuthTokenSet }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(req),
    }, false);
    this.setTokens(data.tokens);
    return data;
  }

  public async signIn(email: string, password: string, role: "athlete" | "caregiver"): Promise<{ user: UserAccount; tokens: AuthTokenSet }> {
    const data = await this.request<{ user: UserAccount; tokens: AuthTokenSet }>("/auth/sign-in", {
      method: "POST",
      body: JSON.stringify({ role, email, password }),
    }, false);
    this.setTokens(data.tokens);
    return data;
  }

  public async logout(): Promise<void> {
    if (this.accessToken) {
      await this.request<void>("/auth/logout", { method: "POST" }).catch(() => {});
    }
    this.setTokens(null);
  }

  // --- Pairing API ---
  public async createPairingCode(): Promise<PairingCodeResponse> {
    return this.request<PairingCodeResponse>("/auth/pairing/code", { method: "POST" });
  }

  public async claimPairingCode(code: string, relationship = "parent"): Promise<PairingLink> {
    return this.request<PairingLink>("/auth/pairing/claim", {
      method: "POST",
      body: JSON.stringify({ pairingCode: code, relationship, consentConfirmed: true }),
    });
  }

  public async approvePairingLink(linkId: string, approve: boolean): Promise<PairingLink> {
    return this.request<PairingLink>(`/auth/pairing/link/${linkId}/approve`, {
      method: "POST",
      body: JSON.stringify({ approve }),
    });
  }

  // --- Sessions API ---
  public async getTodaySession(): Promise<SessionPackage> {
    return this.request<SessionPackage>("/sessions/today");
  }

  public async completeSession(req: SessionCompletionRequest, idempotencyKey: string): Promise<CompletionSyncResponse> {
    return this.request<CompletionSyncResponse>(`/sessions/${req.sessionId}/complete`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(req),
    });
  }

  // --- Caregiver API ---
  public async getCaregiverDashboard(athleteId: string): Promise<CaregiverDashboardPayload> {
    return this.request<CaregiverDashboardPayload>(`/caregiver/athletes/${athleteId}/dashboard`);
  }

  // --- Account Privacy & Deletion ---
  public async deleteAccount(): Promise<void> {
    await this.request<void>("/auth/account", { method: "DELETE" });
    this.setTokens(null);
  }
}

export const apiClient = new ApiClient();
