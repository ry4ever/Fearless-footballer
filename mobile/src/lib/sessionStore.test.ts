import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserAccount } from "../../../shared/types";

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  removeItem: vi.fn(),
  setItem: vi.fn(),
}));
const secureStore = vi.hoisted(() => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: asyncStorage,
}));
vi.mock("expo-secure-store", () => secureStore);

import {
  clearSessionState,
  loadSessionState,
  signOutSession,
  saveSessionState,
} from "./sessionStore";

const athlete: UserAccount = {
  id: "usr_athlete",
  role: "athlete",
  displayName: "Alex",
  isMinor: true,
  ageGateStatus: "pending_guardian_authorization",
  pairingStatus: "pending_athlete_approval",
};

function stateWithAthlete() {
  return {
    currentRole: "athlete" as const,
    athleteAccount: athlete,
    sequence: 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  asyncStorage.getItem.mockResolvedValue(null);
  asyncStorage.setItem.mockResolvedValue(undefined);
  asyncStorage.removeItem.mockResolvedValue(undefined);
  secureStore.getItemAsync.mockResolvedValue(null);
  secureStore.setItemAsync.mockResolvedValue(undefined);
  secureStore.deleteItemAsync.mockResolvedValue(undefined);
});

describe("session storage boundaries", () => {
  it("loads account state from AsyncStorage and tokens from SecureStore", async () => {
    const state = stateWithAthlete();
    asyncStorage.getItem.mockResolvedValue(JSON.stringify(state));
    secureStore.getItemAsync.mockImplementation(async (key: string) => {
      return key.endsWith(".access") ? "access-token" : "refresh-token";
    });

    const loaded = await loadSessionState();

    expect(asyncStorage.getItem).toHaveBeenCalledWith(
      "fearlessfootballer.session.v1",
    );
    expect(secureStore.getItemAsync).toHaveBeenCalledWith(
      "fearlessfootballer.token.athlete.access",
    );
    expect(secureStore.getItemAsync).toHaveBeenCalledWith(
      "fearlessfootballer.token.athlete.refresh",
    );
    expect(loaded.currentUser).toEqual(athlete);
    expect(loaded.hasTokens).toBe(true);
  });

  it("writes account and pairing state to AsyncStorage", async () => {
    const state = {
      ...stateWithAthlete(),
      pairing: {
        id: "lnk_0001",
        athleteId: athlete.id,
        caregiverUserId: "usr_caregiver",
        relationship: "parent" as const,
        status: "pending_athlete_approval" as const,
        consentStatus: "granted" as const,
        consentedAt: "2026-09-19T12:00:00Z",
      },
    };

    await saveSessionState(state);

    expect(asyncStorage.setItem).toHaveBeenCalledWith(
      "fearlessfootballer.session.v1",
      JSON.stringify(state),
    );
    const stored = JSON.parse(
      asyncStorage.setItem.mock.calls[0][1] as string,
    ) as typeof state;
    expect(stored.pairing).toEqual(state.pairing);
  });

  it("writes tokens and credential records only to SecureStore", async () => {
    const tokens = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
    };
    const credentials = {
      email: "alex@example.com",
      passwordHash: "stub_password_hash",
    };

    await saveSessionState(stateWithAthlete(), { athlete: tokens }, { athlete: credentials });

    expect(asyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(asyncStorage.setItem.mock.calls[0][1])).not.toContain(
      "access-token",
    );
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      "fearlessfootballer.token.athlete.access",
      tokens.accessToken,
    );
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      "fearlessfootballer.token.athlete.refresh",
      tokens.refreshToken,
    );
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      "fearlessfootballer.credential.athlete",
      JSON.stringify(credentials),
    );
  });

  it("clears all token and credential records", async () => {
    await clearSessionState();

    expect(asyncStorage.removeItem).toHaveBeenCalledWith(
      "fearlessfootballer.session.v1",
    );
    expect(secureStore.deleteItemAsync).toHaveBeenCalledTimes(6);
  });

  it("signs out without deleting reusable account metadata", async () => {
    asyncStorage.getItem.mockResolvedValue(JSON.stringify(stateWithAthlete()));

    await signOutSession();

    expect(secureStore.deleteItemAsync).toHaveBeenCalledTimes(4);
    expect(asyncStorage.setItem).toHaveBeenCalledTimes(1);
    const signedOutState = JSON.parse(
      asyncStorage.setItem.mock.calls[0][1] as string,
    ) as ReturnType<typeof stateWithAthlete>;
    expect(signedOutState.currentRole).toBeUndefined();
    expect(signedOutState.athleteAccount).toEqual(athlete);
  });
});
