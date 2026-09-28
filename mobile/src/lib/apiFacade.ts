/**
 * Unified API facade that exposes a single interface regardless of
 * whether the app is running against the local beta stub or the
 * production backend.
 *
 * In `local` mode (default), delegates to a `LocalBetaApi` instance.
 * In `production` mode, delegates to `apiClient` and normalises
 * `{ status, data }` results into throw-on-error behaviour so the
 * rest of the app can keep using `try/catch` with `LocalApiError`.
 *
 * Production auth flows also persist the authenticated account into
 * `sessionStore` so that route guards and `switchRole` work correctly.
 *
 * Usage:
 *   const api = getApiFacade({ role: "athlete" });
 *   const result = await api.signInAccount({ ... });
 *   // result is the same shape whether local or production
 */

import {
  AgeGateRequest,
  AgeGateResponse,
  AthleteProgress,
  CaregiverDashboardPayload,
  CompletionSyncResponse,
  ConsentRevocationResponse,
  DataDeletionRequest,
  OfflineQueueStatus,
  PairingApprovalRequest,
  PairingApprovalResponse,
  PairingClaimRequest,
  PairingClaimResponse,
  PairingCodeResponse,
  RegisterAccountRequest,
  RegisterAccountResponse,
  SessionCompletionRequest,
  SessionLibraryResponse,
  SessionRetrieveResponse,
  SignInAccountRequest,
  UserAccount,
  PlaybackEventRequest,
} from "../../../shared/types";
import { LocalBetaApi, createLocalBetaApi, LocalApiError } from "./localBetaApi";
import { apiClient, NetworkError } from "./apiClient";
import { getApiMode, isProductionApi } from "./apiMode";
import {
  loadSessionState,
  saveSessionState,
} from "./sessionStore";
import {
  createOfflineCompletionQueueItem,
  getOfflineCompletionQueueStatus,
  upsertOfflineCompletionQueueItem,
} from "./offlineCompletionQueue";

export { isProductionApi, getApiMode, LocalApiError };

export type ApiFacade = Omit<
  LocalBetaApi,
  "resetLocalBetaState"
> & {
  /** Always clears local state; in production mode also clears tokens. */
  resetLocalBetaState(): Promise<void>;
  /**
   * Production: fetch this account's pairing link from the server and store
   * it locally so route guards see changes made on the other person's
   * device. Local mode keeps pairing on-device, so this is a no-op there.
   * Never throws; when offline the last known state is kept.
   */
  syncPairing(): Promise<void>;
};

/**
 * After a successful production register/sign-in, persist the
 * authenticated account and tokens into sessionStore so route
 * guards and switchRole work correctly.
 */
async function persistAuthAccount(
  response: RegisterAccountResponse,
): Promise<void> {
  const account = response.user;
  const tokens = response.tokens;
  const state = await loadSessionState();

  const athleteAccount =
    account.role === "athlete"
      ? account
      : state.athleteAccount;
  const caregiverAccount =
    account.role === "caregiver"
      ? account
      : state.caregiverAccount;

  await saveSessionState(
    {
      ...state,
      athleteAccount,
      caregiverAccount,
      currentRole: account.role,
    },
    { [account.role]: tokens },
  );
}

async function syncPairingForRole(role: UserAccount["role"]): Promise<void> {
  try {
    const result = await apiClient.getPairingStatus(role);
    if (result.status !== 200 || !result.data) return;
    const pairing = result.data.pairing ?? undefined;
    const state = await loadSessionState();
    const accountKey = role === "athlete" ? "athleteAccount" : "caregiverAccount";
    const account = state[accountKey];
    await saveSessionState({
      ...state,
      pairing,
      ...(account ? { [accountKey]: { ...account, pairingStatus: pairing?.status ?? "unlinked" } } : {}),
    });
  } catch {
    // Offline or server unavailable: keep the last known pairing state.
  }
}

/**
 * Stand-in response for a completion saved to the offline queue. The real
 * streak and score arrive from the server once the queue syncs.
 */
function queuedCompletionResponse(request: SessionCompletionRequest): CompletionSyncResponse {
  return {
    completionId: `queued_${request.idempotencyKey}`,
    streak: { currentStreakDays: 0, bestStreakDays: 0, isNewMilestone: false },
    composure: { previousScore: 0, newScore: 0, delta: 0 },
    weeklyProgress: { completedDays: 0, targetDays: 7, sevenDayPattern: [] },
  };
}

export function getApiFacade(dependencies?: {
  role?: UserAccount["role"];
  localApi?: LocalBetaApi;
}): ApiFacade {
  const localApi = dependencies?.localApi ?? createLocalBetaApi();
  const role = dependencies?.role;

  async function assertSignedIn(): Promise<void> {
    if (!role) {
      throw new LocalApiError("No account selected.", 401);
    }
  }

  return {
    async registerAccount(
      request: RegisterAccountRequest,
    ): Promise<RegisterAccountResponse> {
      if (isProductionApi()) {
        const result = await apiClient.register(request);
        if (result.status === 201 && result.data) {
          await persistAuthAccount(result.data);
          await syncPairingForRole(result.data.user.role);
          return result.data;
        }
        throw new LocalApiError(
          result.error?.error ?? "Unable to create athlete account.",
          result.status,
        );
      }
      return localApi.registerAccount(request);
    },

    async signInAccount(
      request: SignInAccountRequest,
    ): Promise<RegisterAccountResponse> {
      if (isProductionApi()) {
        const result = await apiClient.signIn(request);
        if (result.status === 200 && result.data) {
          await persistAuthAccount(result.data);
          await syncPairingForRole(result.data.user.role);
          return result.data;
        }
        throw new LocalApiError(
          result.error?.error ?? "Unable to sign in.",
          result.status,
        );
      }
      return localApi.signInAccount(request);
    },

    async evaluateAgeGate(
      request: AgeGateRequest,
    ): Promise<AgeGateResponse> {
      if (isProductionApi()) {
        const result = await apiClient.evaluateAgeGate(request);
        if (result.status === 200 && result.data) return result.data;
        throw new LocalApiError(
          result.error?.error ?? "Unable to evaluate age gate.",
          result.status,
        );
      }
      return localApi.evaluateAgeGate(request);
    },

    async switchAccountRole(
      targetRole: UserAccount["role"],
    ): Promise<Awaited<ReturnType<LocalBetaApi["switchAccountRole"]>>> {
      if (isProductionApi()) {
        const state = await loadSessionState();
        const account =
          targetRole === "athlete"
            ? state.athleteAccount
            : state.caregiverAccount;
        if (!account || account.role !== targetRole) {
          throw new LocalApiError(
            `No ${targetRole} account is registered on this device.`,
            401,
          );
        }
        await saveSessionState({
          ...state,
          currentRole: targetRole,
        });
        return loadSessionState();
      }
      return localApi.switchAccountRole(targetRole);
    },

    async resetLocalBetaState(): Promise<void> {
      // Clears local state plus every stored token and credential in both modes.
      await localApi.resetLocalBetaState();
    },

    async syncPairing(): Promise<void> {
      if (!isProductionApi() || !role) return;
      await syncPairingForRole(role);
    },

    async createPairingCode(): Promise<PairingCodeResponse> {
      if (isProductionApi()) {
        await assertSignedIn();
        const result = await apiClient.createPairingCode(role!);
        if (result.status === 200 && result.data) return result.data;
        throw new LocalApiError(
          result.error?.error ?? "Unable to create pairing code.",
          result.status,
        );
      }
      return localApi.createPairingCode();
    },

    async claimPairingCode(
      request: PairingClaimRequest,
    ): Promise<PairingClaimResponse> {
      if (isProductionApi()) {
        await assertSignedIn();
        const result = await apiClient.claimPairingCode(role!, request);
        if (result.status === 200 && result.data) {
          await syncPairingForRole(role!);
          return result.data;
        }
        throw new LocalApiError(
          result.error?.error ?? "Unable to claim pairing code.",
          result.status,
        );
      }
      return localApi.claimPairingCode(request);
    },

    async approvePairing(
      linkId: string,
      request: PairingApprovalRequest,
    ): Promise<PairingApprovalResponse> {
      if (isProductionApi()) {
        await assertSignedIn();
        const result = await apiClient.approvePairing(role!, linkId, request);
        if (result.status === 200 && result.data) {
          await syncPairingForRole(role!);
          return result.data;
        }
        throw new LocalApiError(
          result.error?.error ?? "Unable to approve pairing.",
          result.status,
        );
      }
      return localApi.approvePairing(linkId, request);
    },

    async revokePairing(linkId: string): Promise<PairingApprovalResponse> {
      if (isProductionApi()) {
        await assertSignedIn();
        const result = await apiClient.revokePairing(role!, linkId);
        if (result.status === 200 && result.data) {
          await syncPairingForRole(role!);
          return result.data;
        }
        throw new LocalApiError(
          result.error?.error ?? "Unable to revoke pairing.",
          result.status,
        );
      }
      return localApi.revokePairing(linkId);
    },

    async getAthleteSession(): Promise<SessionRetrieveResponse> {
      if (isProductionApi()) {
        await assertSignedIn();
        const result = await apiClient.getAthleteSession(role!);
        if (result.status === 200 && result.data) return result.data;
        throw new LocalApiError(
          result.error?.error ?? "Unable to load session.",
          result.status,
        );
      }
      return localApi.getAthleteSession();
    },

    async getSessionLibrary(): Promise<SessionLibraryResponse> {
      if (isProductionApi()) {
        await assertSignedIn();
        const result = await apiClient.getSessionLibrary(role!);
        if (result.status === 200 && result.data) return result.data;
        throw new LocalApiError(
          result.error?.error ?? "Unable to load sessions.",
          result.status,
        );
      }
      return localApi.getSessionLibrary();
    },

    async recordPlaybackEvent(
      sessionId: string,
      request: PlaybackEventRequest,
    ): Promise<void> {
      if (isProductionApi()) {
        await assertSignedIn();
        const result = await apiClient.recordPlaybackEvent(
          role!,
          sessionId,
          request,
        );
        if (result.status === 204) return;
        throw new LocalApiError(
          result.error?.error ?? "Unable to record event.",
          result.status,
        );
      }
      return localApi.recordPlaybackEvent(sessionId, request);
    },

    async completeSession(
      sessionId: string,
      request: SessionCompletionRequest,
    ): Promise<CompletionSyncResponse> {
      if (isProductionApi()) {
        await assertSignedIn();
        let result;
        try {
          result = await apiClient.completeSession(role!, sessionId, request);
        } catch (error) {
          if (!(error instanceof NetworkError)) throw error;
          result = null;
        }
        if (result && result.status === 200 && result.data) return result.data;
        if (!result || result.status >= 500) {
          // Offline or server trouble: keep the rep on the device and sync later.
          const state = await loadSessionState();
          await saveSessionState(
            upsertOfflineCompletionQueueItem(state, createOfflineCompletionQueueItem(request, new Date())),
          );
          return queuedCompletionResponse(request);
        }
        throw new LocalApiError(
          result.error?.error ?? "Unable to complete session.",
          result.status,
        );
      }
      return localApi.completeSession(sessionId, request);
    },

    async syncOfflineCompletions(): Promise<{ synced: number; failed: number }> {
      if (isProductionApi()) {
        await assertSignedIn();
        return apiClient.syncOfflineCompletions(role!);
      }
      return localApi.syncOfflineCompletions();
    },

    async getAthleteProgress(): Promise<AthleteProgress> {
      if (isProductionApi()) {
        await assertSignedIn();
        const result = await apiClient.getAthleteProgress(role!);
        if (result.status === 200 && result.data) return result.data;
        throw new LocalApiError(
          result.error?.error ?? "Unable to load progress.",
          result.status,
        );
      }
      return localApi.getAthleteProgress();
    },

    async getOfflineQueueStatus(): Promise<OfflineQueueStatus> {
      if (isProductionApi()) {
        await assertSignedIn();
        // The queue lives on this device; the server has nothing pending.
        return getOfflineCompletionQueueStatus(await loadSessionState());
      }
      return localApi.getOfflineQueueStatus();
    },

    async getCaregiverDashboard(
      athleteId: string,
    ): Promise<CaregiverDashboardPayload> {
      if (isProductionApi()) {
        await assertSignedIn();
        const result = await apiClient.getCaregiverDashboard(role!, athleteId);
        if (result.status === 200 && result.data) return result.data;
        throw new LocalApiError(
          result.error?.error ?? "Unable to load dashboard.",
          result.status,
        );
      }
      return localApi.getCaregiverDashboard(athleteId);
    },

    async revokeConsent(linkId: string): Promise<ConsentRevocationResponse> {
      if (isProductionApi()) {
        await assertSignedIn();
        const result = await apiClient.revokeConsent(role!, linkId);
        if (result.status === 200 && result.data) {
          await syncPairingForRole(role!);
          return result.data;
        }
        throw new LocalApiError(
          result.error?.error ?? "Unable to revoke access.",
          result.status,
        );
      }
      return localApi.revokeConsent(linkId);
    },

    async deleteAccount(request: DataDeletionRequest): Promise<void> {
      if (isProductionApi()) {
        await assertSignedIn();
        const result = await apiClient.deleteAccount(role!, request);
        if (result.status === 204) return;
        throw new LocalApiError(
          result.error?.error ?? "Unable to delete this account.",
          result.status,
        );
      }
      return localApi.deleteAccount(request);
    },
  };
}

/**
 * Resolve the API facade for the currently active session role.
 * In production mode this requires the user to be signed in (role is read
 * from the session state stored by the apiClient's token persistence).
 */
export async function getSessionApiFacade(): Promise<ApiFacade> {
  const state = await loadSessionState();
  const role = state.currentRole;
  return getApiFacade({ role });
}
