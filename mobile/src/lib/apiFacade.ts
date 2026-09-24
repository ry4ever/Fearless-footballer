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
  SessionRetrieveResponse,
  SignInAccountRequest,
  UserAccount,
  PlaybackEventRequest,
} from "../../../shared/types";
import { LocalBetaApi, createLocalBetaApi, LocalApiError } from "./localBetaApi";
import { apiClient } from "./apiClient";
import { getApiMode, isProductionApi } from "./apiMode";
import {
  loadSessionState,
  saveSessionState,
} from "./sessionStore";

export { isProductionApi, getApiMode, LocalApiError };

export type ApiFacade = Omit<
  LocalBetaApi,
  "resetLocalBetaState"
> & {
  /** Always clears local state; in production mode also clears tokens. */
  resetLocalBetaState(): Promise<void>;
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
      await localApi.resetLocalBetaState();
      if (isProductionApi()) {
        await loadSessionState().then(async (state) => {
          await saveSessionState({
            ...state,
            currentRole: undefined,
          });
        });
      }
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
        if (result.status === 200 && result.data) return result.data;
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
        if (result.status === 200 && result.data) return result.data;
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
        if (result.status === 200 && result.data) return result.data;
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
        const result = await apiClient.completeSession(role!, sessionId, request);
        if (result.status === 200 && result.data) return result.data;
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
        const result = await apiClient.getOfflineQueueStatus(role!);
        if (result.status === 200 && result.data) return result.data;
        throw new LocalApiError(
          result.error?.error ?? "Unable to load queue status.",
          result.status,
        );
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
        if (result.status === 200 && result.data) return result.data;
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
