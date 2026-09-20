import { sampleSessionPackage } from "../../../shared/sampleSession";
import type {
  AgeGateRequest,
  AgeGateResponse,
  AuthTokenSet,
  BetaUserRole,
  CaregiverDashboardPayload,
  PairingApprovalRequest,
  PairingApprovalResponse,
  PairingClaimRequest,
  PairingClaimResponse,
  PairingCode,
  PairingCodeResponse,
  PairingLink,
  RegisterAccountRequest,
  RegisterAccountResponse,
  SessionRetrieveResponse,
  SignInAccountRequest,
  UserAccount,
} from "../../../shared/types";
import {
  activatePairing,
  canAthleteAccessSession,
  canCaregiverAccessDashboard,
  evaluateAgeGateStatus,
  isAllowedRelationship,
  rejectPairing,
  revokePairing as revokePairingLink,
} from "./sessionGuard";
import {
  clearSessionState,
  type LoadedSessionState,
  type LocalCredential,
  type PersistedSessionState,
  loadSessionState,
  readLocalCredential,
  saveSessionState,
} from "./sessionStore";

export interface LocalBetaApi {
  registerAccount(request: RegisterAccountRequest): Promise<RegisterAccountResponse>;
  signInAccount(request: SignInAccountRequest): Promise<RegisterAccountResponse>;
  evaluateAgeGate(request: AgeGateRequest): Promise<AgeGateResponse>;
  switchAccountRole(role: BetaUserRole): Promise<LoadedSessionState>;
  createPairingCode(): Promise<PairingCodeResponse>;
  claimPairingCode(request: PairingClaimRequest): Promise<PairingClaimResponse>;
  approvePairing(
    linkId: string,
    request: PairingApprovalRequest,
  ): Promise<PairingApprovalResponse>;
  revokePairing(linkId: string): Promise<PairingApprovalResponse>;
  getAthleteSession(): Promise<SessionRetrieveResponse>;
  getCaregiverDashboard(
    athleteId: string,
  ): Promise<CaregiverDashboardPayload>;
  resetLocalBetaState(): Promise<void>;
}

export interface LocalBetaApiDependencies {
  loadSessionState?: () => Promise<LoadedSessionState>;
  saveSessionState?: (
    state: PersistedSessionState,
    tokens?: Partial<Record<BetaUserRole, AuthTokenSet>>,
    credentials?: Partial<Record<BetaUserRole, LocalCredential>>,
  ) => Promise<void>;
  clearSessionState?: () => Promise<void>;
  readLocalCredential?: (role: BetaUserRole) => Promise<LocalCredential | null>;
  now?: () => Date;
}

export class LocalApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function requireAccount(state: LoadedSessionState, role: BetaUserRole) {
  const account = role === "athlete" ? state.athleteAccount : state.caregiverAccount;
  if (!account || account.role !== role) {
    throw new LocalApiError(`No ${role} account is registered on this device.`, 401);
  }
  return account;
}

function requireCurrentAccount(state: LoadedSessionState, role: BetaUserRole) {
  const account = requireAccount(state, role);
  if (state.currentRole !== role || !state.hasTokens) {
    throw new LocalApiError(
      `Sign in as ${role === "athlete" ? "an" : "a"} ${role} to continue.`,
      401,
    );
  }
  return account;
}

async function requireCredential(
  _state: LoadedSessionState,
  role: BetaUserRole,
): Promise<LocalCredential> {
  const credential = await readLocalCredential(role);
  if (!credential) {
    throw new LocalApiError(`No ${role} sign-in record is available.`, 401);
  }
  return credential;
}

function requirePairing(state: LoadedSessionState) {
  if (!state.pairing) {
    throw new LocalApiError("No pairing relationship exists.", 404);
  }
  return state.pairing;
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isRegisterRequest(
  request: RegisterAccountRequest | SignInAccountRequest,
): request is RegisterAccountRequest {
  return (
    "fullName" in request ||
    "displayName" in request ||
    "birthDate" in request ||
    "timezone" in request ||
    "region" in request ||
    "privacyAcknowledged" in request
  );
}

function getDisplayName(request: RegisterAccountRequest) {
  return request.fullName?.trim() || request.displayName?.trim();
}

function validateBaseAccountFields(
  request: RegisterAccountRequest | SignInAccountRequest,
) {
  if (!request.email.trim() || !validateEmail(request.email)) {
    throw new LocalApiError("Enter a valid email address.", 422);
  }
  if (!request.password) {
    throw new LocalApiError("Enter your password.", 422);
  }
  if (isRegisterRequest(request) && !getDisplayName(request)) {
    throw new LocalApiError("Enter a display name.", 422);
  }
}

function hashPassword(email: string, password: string) {
  // Local beta stub only: this verifier is not a production authentication boundary.
  let hash = 2166136261;
  const value = `${email.trim().toLowerCase()}:${password}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `stub_${(hash >>> 0).toString(16)}`;
}

function makeTokens(role: BetaUserRole, accountId: string): AuthTokenSet {
  return {
    accessToken: `demo-${role}-${accountId}-access-token`,
    refreshToken: `demo-${role}-${accountId}-refresh-token`,
    expiresIn: 900,
  };
}

function isoNow(now: () => Date) {
  return now().toISOString();
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

function allocateSequence(state: PersistedSessionState) {
  const sequence = (state.sequence ?? 0) + 1;
  return {
    sequence,
    id: (prefix: string) => `${prefix}_${sequence.toString().padStart(4, "0")}`,
  };
}

function updatePairingStatus(
  account: UserAccount | undefined,
  status: UserAccount["pairingStatus"],
) {
  return account ? { ...account, pairingStatus: status } : undefined;
}

function persistWithRole(
  state: PersistedSessionState,
  role: BetaUserRole,
): PersistedSessionState {
  return { ...state, currentRole: role };
}

export function createLocalBetaApi(
  dependencies: LocalBetaApiDependencies = {},
): LocalBetaApi {
  const load = dependencies.loadSessionState ?? loadSessionState;
  const save = dependencies.saveSessionState ?? saveSessionState;
  const clear = dependencies.clearSessionState ?? clearSessionState;
  const readCredential =
    dependencies.readLocalCredential ?? readLocalCredential;
  const now = dependencies.now ?? (() => new Date());

  async function readState() {
    return load();
  }

  async function writeState(
    state: PersistedSessionState,
    tokens?: Partial<Record<BetaUserRole, AuthTokenSet>>,
    credentials?: Partial<Record<BetaUserRole, LocalCredential>>,
  ) {
    await save(state, tokens, credentials);
    return readState();
  }

  async function registerAccount(
    request: RegisterAccountRequest,
  ): Promise<RegisterAccountResponse> {
    validateBaseAccountFields(request);
    if (request.role !== "athlete" && request.role !== "caregiver") {
      throw new LocalApiError("Choose an athlete or caregiver account.", 422);
    }

    const state = await readState();
    const existing =
      request.role === "athlete" ? state.athleteAccount : state.caregiverAccount;
    if (existing) {
      throw new LocalApiError(`${request.role} account already exists on this device.`, 409);
    }

    let ageGate: ReturnType<typeof evaluateAgeGateStatus>;
    if (request.role === "athlete") {
      if (!request.birthDate) {
        throw new LocalApiError("Date of birth is required for an athlete account.", 422);
      }
      if (!request.timezone?.trim()) {
        throw new LocalApiError("Timezone is required for an athlete account.", 422);
      }
      if (!request.privacyAcknowledged) {
        throw new LocalApiError("Acknowledge the privacy notice to continue.", 422);
      }
      ageGate = evaluateAgeGateStatus(request.birthDate, now());
      if (ageGate.status === "restricted") {
        throw new LocalApiError("Enter a valid date of birth.", 422);
      }
    } else if (!request.privacyAcknowledged) {
      throw new LocalApiError("Acknowledge the privacy notice to continue.", 422);
    } else {
      ageGate = { isMinor: false, status: "verified" };
    }

    const allocation = allocateSequence(state);
    const accountId = allocation.id(
      request.role === "athlete" ? "usr_athlete" : "usr_caregiver",
    );
    const account: UserAccount = {
      id: accountId,
      role: request.role,
      displayName: getDisplayName(request) ?? "",
      isMinor: ageGate.isMinor,
      ageGateStatus: ageGate.status,
      pairingStatus: "unlinked",
    };
    const credential: LocalCredential = {
      email: request.email.trim().toLowerCase(),
      passwordHash: hashPassword(request.email, request.password),
    };
    const nextState: PersistedSessionState =
      request.role === "athlete"
        ? {
            ...state,
            athleteAccount: account,
            sequence: allocation.sequence,
            athleteProfile: {
              timezone: request.timezone?.trim() ?? "UTC",
              ...(request.region?.trim() ? { region: request.region.trim() } : {}),
              privacyAcknowledgedAt: isoNow(now),
            },
          }
        : {
            ...state,
            caregiverAccount: account,
            sequence: allocation.sequence,
            caregiverProfile: {
              privacyAcknowledgedAt: isoNow(now),
            },
          };
    const tokens = makeTokens(request.role, accountId);

    await save(
      persistWithRole(nextState, request.role),
      { [request.role]: tokens },
      { [request.role]: credential },
    );
    return { user: account, tokens };
  }

  async function signInAccount(
    request: SignInAccountRequest,
  ): Promise<RegisterAccountResponse> {
    validateBaseAccountFields(request);
    const state = await readState();
    const account = requireAccount(state, request.role);
    const credential = await requireCredential(state, request.role);
    const expectedHash = hashPassword(request.email, request.password);
    if (
      credential.email !== request.email.trim().toLowerCase() ||
      credential.passwordHash !== expectedHash
    ) {
      throw new LocalApiError("Email or password is incorrect.", 401);
    }

    const tokens = makeTokens(request.role, account.id);
    await save(persistWithRole(state, request.role), {
      [request.role]: tokens,
    });
    return { user: account, tokens };
  }

  async function evaluateAgeGate(
    request: AgeGateRequest,
  ): Promise<AgeGateResponse> {
    if (!request.timezone.trim()) {
      throw new LocalApiError("Timezone is required for the age gate.", 422);
    }
    const result = evaluateAgeGateStatus(request.birthDate, now());
    return {
      isMinor: result.isMinor,
      status: result.status,
      restrictedReason:
        result.status === "pending_guardian_authorization"
          ? "guardian_consent_required"
          : result.status === "restricted"
            ? "age_verification_required"
            : undefined,
    };
  }

  async function switchAccountRole(role: BetaUserRole) {
    const state = await readState();
    requireAccount(state, role);
    return writeState(persistWithRole(state, role));
  }

  async function createPairingCode(): Promise<PairingCodeResponse> {
    const state = await readState();
    const athlete = requireCurrentAccount(state, "athlete");
    if (athlete.ageGateStatus === "restricted") {
      throw new LocalApiError("Resolve the age verification restriction before pairing.", 403);
    }
    if (state.pairing) {
      throw new LocalApiError("This athlete already has a pairing relationship.", 409);
    }

    if (
      state.pairingCode &&
      !state.pairingCodeConsumedAt &&
      new Date(state.pairingCode.expiresAt) > now()
    ) {
      return {
        pairingCode: state.pairingCode.code,
        expiresAt: state.pairingCode.expiresAt,
      };
    }

    const allocation = allocateSequence(state);
    const pairingCode: PairingCode = {
      code: `FEAR-${allocation.sequence.toString().padStart(4, "0")}`,
      expiresAt: addMinutes(now(), 15),
    };
    await save({
      ...state,
      pairingCode,
      pairingCodeConsumedAt: undefined,
      sequence: allocation.sequence,
      currentRole: "athlete",
    });
    return {
      pairingCode: pairingCode.code,
      expiresAt: pairingCode.expiresAt,
    };
  }

  async function claimPairingCode(
    request: PairingClaimRequest,
  ): Promise<PairingClaimResponse> {
    const state = await readState();
    const caregiver = requireCurrentAccount(state, "caregiver");
    if (!isAllowedRelationship(request.relationship)) {
      throw new LocalApiError("Choose parent or guardian.", 422);
    }
    if (!request.consentConfirmed) {
      throw new LocalApiError("Caregiver consent is required to claim this code.", 422);
    }
    if (!state.pairingCode) {
      throw new LocalApiError("That pairing code is not recognized.", 404);
    }

    const suppliedCode = request.pairingCode.trim().toUpperCase();
    if (suppliedCode !== state.pairingCode.code) {
      throw new LocalApiError("That pairing code is not recognized.", 404);
    }
    if (state.pairingCodeConsumedAt) {
      throw new LocalApiError("That pairing code has already been used.", 409);
    }
    if (
      !state.pairingCode.expiresAt ||
      new Date(state.pairingCode.expiresAt) <= now()
    ) {
      throw new LocalApiError("That pairing code has expired.", 409);
    }
    if (!state.athleteAccount) {
      throw new LocalApiError("The athlete account is unavailable.", 404);
    }
    if (state.athleteAccount.ageGateStatus === "restricted") {
      throw new LocalApiError("The athlete account is restricted.", 403);
    }
    if (state.pairing) {
      throw new LocalApiError("This athlete already has a pairing relationship.", 409);
    }

    const allocation = allocateSequence(state);
    const link: PairingLink & { status: "pending_athlete_approval" } = {
      id: allocation.id("lnk"),
      athleteId: state.athleteAccount.id,
      caregiverUserId: caregiver.id,
      relationship: request.relationship,
      status: "pending_athlete_approval",
      pairingCode: suppliedCode,
      pairingExpiresAt: state.pairingCode.expiresAt,
      consentStatus: "granted",
      consentedAt: isoNow(now),
    };
    const athlete = updatePairingStatus(
      state.athleteAccount,
      link.status,
    );
    const updatedCaregiver = updatePairingStatus(caregiver, link.status);
    await save({
      ...state,
      athleteAccount: athlete,
      caregiverAccount: updatedCaregiver,
      pairing: link,
      pairingCodeConsumedAt: isoNow(now),
      sequence: allocation.sequence,
      currentRole: "caregiver",
    });

    return {
      linkId: link.id,
      status: link.status,
      athlete: {
        id: state.athleteAccount.id,
        displayName: state.athleteAccount.displayName,
      },
    };
  }

  async function approvePairing(
    linkId: string,
    request: PairingApprovalRequest,
  ): Promise<PairingApprovalResponse> {
    const state = await readState();
    const athlete = requireCurrentAccount(state, "athlete");
    const link = requirePairing(state);
    if (link.id !== linkId || link.athleteId !== athlete.id) {
      throw new LocalApiError("This athlete cannot approve that relationship.", 403);
    }
    if (link.status !== "pending_athlete_approval") {
      throw new LocalApiError("This relationship is no longer pending.", 409);
    }

    const updatedLink = request.approved
      ? activatePairing(link, isoNow(now))
      : rejectPairing(link, isoNow(now));
    const updatedAthlete = updatePairingStatus(athlete, updatedLink.status);
    const updatedCaregiver = updatePairingStatus(
      state.caregiverAccount,
      updatedLink.status,
    );
    await save({
      ...state,
      athleteAccount: updatedAthlete,
      caregiverAccount: updatedCaregiver,
      pairing: updatedLink,
      currentRole: "athlete",
    });

    return {
      linkId: updatedLink.id,
      status: updatedLink.status,
      athleteApprovedAt: updatedLink.athleteApprovedAt,
      revokedAt: updatedLink.revokedAt,
    };
  }

  async function revokePairing(linkId: string): Promise<PairingApprovalResponse> {
    const state = await readState();
    const athlete = requireCurrentAccount(state, "athlete");
    const link = requirePairing(state);
    if (link.id !== linkId || link.athleteId !== athlete.id) {
      throw new LocalApiError("This athlete cannot revoke that relationship.", 403);
    }
    if (link.status !== "active") {
      throw new LocalApiError("Only an active relationship can be revoked.", 409);
    }

    const updatedLink = revokePairingLink(link, isoNow(now));
    const updatedAthlete = updatePairingStatus(athlete, updatedLink.status);
    const updatedCaregiver = updatePairingStatus(
      state.caregiverAccount,
      updatedLink.status,
    );
    await save({
      ...state,
      athleteAccount: updatedAthlete,
      caregiverAccount: updatedCaregiver,
      pairing: updatedLink,
      currentRole: "athlete",
    });

    return {
      linkId: updatedLink.id,
      status: "revoked",
      revokedAt: updatedLink.revokedAt,
    };
  }

  async function getAthleteSession(): Promise<SessionRetrieveResponse> {
    const state = await readState();
    const athlete = requireCurrentAccount(state, "athlete");
    if (!canAthleteAccessSession(athlete, state.pairing)) {
      throw new LocalApiError("Complete consent and pairing before opening a session.", 403);
    }
    return { session: sampleSessionPackage };
  }

  async function getCaregiverDashboard(
    athleteId: string,
  ): Promise<CaregiverDashboardPayload> {
    const state = await readState();
    const caregiver = requireCurrentAccount(state, "caregiver");
    if (!canCaregiverAccessDashboard(caregiver, state.pairing)) {
      throw new LocalApiError("Caregiver access is not active.", 403);
    }
    if (!state.athleteAccount || state.athleteAccount.id !== athleteId) {
      throw new LocalApiError("Athlete not found.", 404);
    }

    return {
      athlete: {
        id: state.athleteAccount.id,
        name: state.athleteAccount.displayName,
        program: "Matchday Mindset · Week 1",
        status: "active",
      },
      weeklySummary: {
        headline: "Getting started",
        description: "The athlete is ready to complete the first beta session.",
        daysCompleted: 0,
        daysTarget: 7,
        sevenDayPattern: [false, false, false, false, false, false, false],
      },
      metrics: {
        moodTrend: {
          status: "Not enough data",
          subtitle: "Complete a session to build a private baseline.",
          trendData: [],
        },
        composureScore: {
          value: 0,
          changeWeekly: 0,
        },
        currentStreak: {
          days: 0,
          bestDays: 0,
        },
        lastRep: {
          title: "Nerves = Performance",
          duration: "5 min",
          completedAt: "",
          completedToday: false,
        },
      },
      conversationStarters: [
        {
          id: "cs_start",
          category: "TRY THIS TONIGHT",
          prompt: "What would help you feel ready before your next match?",
          guidance: "Invite a story, not a score.",
        },
      ],
      privacyPolicyNotice:
        "Private by design. This view shares progress patterns, not session transcripts, reflections, audio, or playback controls.",
    };
  }

  async function resetLocalBetaState() {
    await clear();
  }

  return {
    registerAccount,
    signInAccount,
    evaluateAgeGate,
    switchAccountRole,
    createPairingCode,
    claimPairingCode,
    approvePairing,
    revokePairing,
    getAthleteSession,
    getCaregiverDashboard,
    resetLocalBetaState,
  };
}

const localBetaApi = createLocalBetaApi();

export const registerAccount = localBetaApi.registerAccount;
export const signInAccount = localBetaApi.signInAccount;
export const evaluateAgeGate = localBetaApi.evaluateAgeGate;
export const switchAccountRole = localBetaApi.switchAccountRole;
export const createPairingCode = localBetaApi.createPairingCode;
export const claimPairingCode = localBetaApi.claimPairingCode;
export const approvePairing = localBetaApi.approvePairing;
export const revokePairing = localBetaApi.revokePairing;
export const getAthleteSession = localBetaApi.getAthleteSession;
export const getCaregiverDashboard = localBetaApi.getCaregiverDashboard;
export const resetLocalBetaState = localBetaApi.resetLocalBetaState;
