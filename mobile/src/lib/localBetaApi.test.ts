import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({}));
vi.mock("expo-network", () => ({
  getNetworkStateAsync: vi.fn(),
  addNetworkStateListener: vi.fn(() => ({ remove: vi.fn() })),
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));
import type {
  AuthTokenSet,
  BetaUserRole,
  PairingRelationship,
  UserAccount,
} from "../../../shared/types";
import type {
  LocalCredential,
  PersistedSessionState,
} from "./sessionStore";
import { createLocalBetaApi, LocalApiError } from "./localBetaApi";

const storage = vi.hoisted(() => ({
  state: {} as PersistedSessionState,
  tokens: {} as Partial<Record<BetaUserRole, AuthTokenSet>>,
  credentials: {} as Partial<Record<BetaUserRole, LocalCredential>>,
}));

const mocks = vi.hoisted(() => ({
  clearSessionState: vi.fn(),
  loadSessionState: vi.fn(),
  readLocalCredential: vi.fn(),
  saveSessionState: vi.fn(),
}));

vi.mock("./sessionStore", () => ({
  clearSessionState: mocks.clearSessionState,
  loadSessionState: mocks.loadSessionState,
  readLocalCredential: mocks.readLocalCredential,
  saveSessionState: mocks.saveSessionState,
}));


function loadedState() {
  const role = storage.state.currentRole;
  const currentUser =
    role === "athlete"
      ? storage.state.athleteAccount
      : role === "caregiver"
        ? storage.state.caregiverAccount
        : undefined;
  return {
    ...storage.state,
    currentUser,
    hasTokens: Boolean(currentUser && storage.tokens[currentUser.role]),
  };
}

function makeApi(now: () => Date) {
  return createLocalBetaApi({
    clearSessionState: mocks.clearSessionState,
    loadSessionState: mocks.loadSessionState,
    readLocalCredential: mocks.readLocalCredential,
    saveSessionState: mocks.saveSessionState,
    now,
  });
}

beforeEach(() => {
  storage.state = {};
  storage.tokens = {};
  storage.credentials = {};
  vi.clearAllMocks();

  mocks.loadSessionState.mockImplementation(() => Promise.resolve(loadedState()));
  mocks.saveSessionState.mockImplementation(
    async (
      nextState: PersistedSessionState,
      nextTokens?: Partial<Record<BetaUserRole, AuthTokenSet>>,
      nextCredentials?: Partial<Record<BetaUserRole, LocalCredential>>,
    ) => {
      storage.state = nextState;
      if (nextTokens) Object.assign(storage.tokens, nextTokens);
      if (nextCredentials) Object.assign(storage.credentials, nextCredentials);
    },
  );
  mocks.readLocalCredential.mockImplementation(async (role: BetaUserRole) => {
    return storage.credentials[role] ?? null;
  });
  mocks.clearSessionState.mockImplementation(async () => {
    storage.state = {};
    storage.tokens = {};
    storage.credentials = {};
  });
});

describe("local beta account contract", () => {
  it("registers a minor athlete without exposing the password", async () => {
    const api = makeApi(() => new Date("2026-09-19T12:00:00Z"));
    const password = "SecurePassword123!";

    const result = await api.registerAccount({
      role: "athlete",
      displayName: "Alex Rivera",
      email: "alex@example.com",
      password,
      birthDate: "2010-06-15",
      timezone: "America/New_York",
      region: "US",
      privacyAcknowledged: true,
    });

    expect(result.user).toEqual({
      id: "usr_athlete_0001",
      role: "athlete",
      displayName: "Alex Rivera",
      isMinor: true,
      ageGateStatus: "pending_guardian_authorization",
      pairingStatus: "unlinked",
    });
    expect(result.tokens).toEqual({
      accessToken: "demo-athlete-usr_athlete_0001-access-token",
      refreshToken: "demo-athlete-usr_athlete_0001-refresh-token",
      expiresIn: 900,
    });
    expect(JSON.stringify(result)).not.toContain(password);
    expect(storage.state.athleteProfile).toMatchObject({
      timezone: "America/New_York",
      region: "US",
    });
    expect(storage.tokens.athlete).toBe(result.tokens);
    expect(storage.credentials.athlete?.passwordHash).not.toBe(password);
  });

  it("signs in the persisted caregiver with the stored credential", async () => {
    const api = makeApi(() => new Date("2026-09-19T12:00:00Z"));
    await api.registerAccount({
      role: "caregiver",
      displayName: "Taylor",
      email: "taylor@example.com",
      password: "CaregiverPassword123!",
      privacyAcknowledged: true,
    });

    const result = await api.signInAccount({
      role: "caregiver",
      email: "taylor@example.com",
      password: "CaregiverPassword123!",
    });

    expect(result.user.role).toBe("caregiver");
    expect(result.tokens.accessToken).toContain("caregiver");
  });
});

async function registerPairingAccounts(api: ReturnType<typeof makeApi>) {
  const athlete = await api.registerAccount({
    role: "athlete",
    displayName: "Alex",
    email: "alex@example.com",
    password: "AthletePassword123!",
    birthDate: "2010-06-15",
    timezone: "America/New_York",
    privacyAcknowledged: true,
  });
  const caregiver = await api.registerAccount({
    role: "caregiver",
    displayName: "Taylor",
    email: "taylor@example.com",
    password: "CaregiverPassword123!",
    privacyAcknowledged: true,
  });
  await api.switchAccountRole("athlete");
  return { athlete: athlete.user, caregiver: caregiver.user };
}

describe("local beta pairing transitions", () => {
  it("creates, claims, approves, and revokes a parent relationship", async () => {
    const api = makeApi(() => new Date("2026-09-19T12:00:00Z"));
    const { athlete, caregiver } = await registerPairingAccounts(api);
    const code = await api.createPairingCode();

    expect(code.pairingCode).toMatch(/^FEAR-\d{4}$/);
    expect(new Date(code.expiresAt).getTime()).toBeGreaterThan(
      new Date("2026-09-19T12:00:00Z").getTime(),
    );

    await api.switchAccountRole("caregiver");
    const claim = await api.claimPairingCode({
      pairingCode: code.pairingCode,
      relationship: "parent",
      consentConfirmed: true,
    });
    expect(claim).toMatchObject({
      status: "pending_athlete_approval",
      athlete: { id: athlete.id, displayName: athlete.displayName },
    });

    await api.switchAccountRole("athlete");
    await expect(api.getAthleteSession()).rejects.toMatchObject({ status: 403 });
    await api.switchAccountRole("caregiver");
    await expect(api.getCaregiverDashboard(athlete.id)).rejects.toMatchObject({
      status: 403,
    });

    await api.switchAccountRole("athlete");
    await api.approvePairing(claim.linkId, { approved: true });
    await expect(api.getAthleteSession()).resolves.toHaveProperty(
      "session.title",
      "Nerves = Performance",
    );
    await api.switchAccountRole("caregiver");
    await expect(api.getCaregiverDashboard(athlete.id)).resolves.toMatchObject({
      athlete: { id: athlete.id, status: "active" },
    });

    await api.switchAccountRole("athlete");
    await api.revokePairing(claim.linkId);
    await api.switchAccountRole("caregiver");
    await expect(api.getCaregiverDashboard(athlete.id)).rejects.toMatchObject({
      status: 403,
    });
    expect(storage.state.pairing?.status).toBe("revoked");
    expect(storage.state.athleteAccount?.pairingStatus).toBe("revoked");
    expect(storage.state.caregiverAccount?.pairingStatus).toBe("revoked");
  });

  it("rejects unsupported relationships and missing consent", async () => {
    const api = makeApi(() => new Date("2026-09-19T12:00:00Z"));
    await registerPairingAccounts(api);
    const code = await api.createPairingCode();
    await api.switchAccountRole("caregiver");

    await expect(
      api.claimPairingCode({
        pairingCode: code.pairingCode,
        relationship: "coach" as unknown as PairingRelationship,
        consentConfirmed: true,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      api.claimPairingCode({
        pairingCode: code.pairingCode,
        relationship: "guardian",
        consentConfirmed: false,
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("rejects an expired pairing code", async () => {
    let now = new Date("2026-09-19T12:00:00Z");
    const api = makeApi(() => now);
    await registerPairingAccounts(api);
    const code = await api.createPairingCode();
    now = new Date("2026-09-19T12:16:00Z");
    await api.switchAccountRole("caregiver");

    await expect(
      api.claimPairingCode({
        pairingCode: code.pairingCode,
        relationship: "guardian",
        consentConfirmed: true,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("keeps a rejected relationship out of both authorized views", async () => {
    const api = makeApi(() => new Date("2026-09-19T12:00:00Z"));
    const { athlete } = await registerPairingAccounts(api);
    const code = await api.createPairingCode();
    await api.switchAccountRole("caregiver");
    const claim = await api.claimPairingCode({
      pairingCode: code.pairingCode,
      relationship: "guardian",
      consentConfirmed: true,
    });
    await api.switchAccountRole("athlete");
    await api.approvePairing(claim.linkId, { approved: false });

    await expect(api.getAthleteSession()).rejects.toMatchObject({ status: 403 });
    await api.switchAccountRole("caregiver");
    await expect(api.getCaregiverDashboard(athlete.id)).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("local beta authorization errors", () => {
  it("does not allow a restricted athlete to create a pairing code", async () => {
    const restrictedAthlete: UserAccount = {
      id: "usr_athlete",
      role: "athlete",
      displayName: "Alex",
      isMinor: false,
      ageGateStatus: "restricted",
      pairingStatus: "unlinked",
    };
    storage.state = {
      currentRole: "athlete",
      athleteAccount: restrictedAthlete,
      sequence: 1,
    };
    storage.tokens.athlete = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
    };
    const api = makeApi(() => new Date("2026-09-19T12:00:00Z"));

    await expect(api.createPairingCode()).rejects.toMatchObject({ status: 403 });
  });

  it("requires the matching signed-in role for protected endpoints", async () => {
    const api = makeApi(() => new Date("2026-09-19T12:00:00Z"));
    const { athlete } = await registerPairingAccounts(api);
    const code = await api.createPairingCode();
    await api.switchAccountRole("caregiver");
    const claim = await api.claimPairingCode({
      pairingCode: code.pairingCode,
      relationship: "parent",
      consentConfirmed: true,
    });
    await api.switchAccountRole("athlete");
    await api.approvePairing(claim.linkId, { approved: true });

    await expect(api.getCaregiverDashboard(athlete.id)).rejects.toMatchObject({
      status: 401,
    });
    await api.switchAccountRole("caregiver");
    await expect(api.getAthleteSession()).rejects.toMatchObject({ status: 401 });
  });

  it("uses contract-style local errors", async () => {
    const api = makeApi(() => new Date("2026-09-19T12:00:00Z"));
    await expect(
      api.registerAccount({
        role: "athlete",
        displayName: "Alex",
        email: "not-an-email",
        password: "AthletePassword123!",
        birthDate: "2010-06-15",
        timezone: "America/New_York",
        privacyAcknowledged: true,
      }),
    ).rejects.toBeInstanceOf(LocalApiError);
  });
});
