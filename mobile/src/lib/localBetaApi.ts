import type {
  AgeGateRequest,
  AgeGateResponse,
  AthleteProgress,
  AuthTokenSet,
  BetaUserRole,
  CaregiverDashboardPayload,
  CompletionSyncResponse,
  ConsentRevocationResponse,
  DataDeletionRequest,
  OfflineQueueStatus,
  PairingApprovalRequest,
  PairingApprovalResponse,
  PairingClaimRequest,
  PairingClaimResponse,
  PairingCode,
  PairingCodeResponse,
  PairingLink,
  PlaybackEventRequest,
  RegisterAccountRequest,
  RegisterAccountResponse,
  SessionCompletion,
  SessionCompletionRequest,
  SessionRetrieveResponse,
  SignInAccountRequest,
  UserAccount,
} from "../../../shared/types";
import type {
  CompletionIdempotencyRecord,
  LoadedSessionState,
  LocalCredential,
  PersistedSessionState,
} from "./sessionStore";
import { sampleSessionPackage } from "../../../shared/sampleSession";
import {
  buildCompletionSyncResponse,
  calculateAthleteProgress,
} from "./metrics";
import {
  createOfflineCompletionQueueItem,
  findOfflineCompletionQueueItem,
  getOfflineCompletionQueueStatus as getQueueStatusFromState,
  hasInternetConnection,
  updateOfflineCompletionQueueItem,
  upsertOfflineCompletionQueueItem,
} from "./offlineCompletionQueue";
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
  clearPendingCompletionKey,
  clearSessionState,
  getOrCreatePendingCompletionKey,
  loadSessionState,
  readLocalCredential,
  savePlaybackProgress,
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
  recordPlaybackEvent(
    sessionId: string,
    request: PlaybackEventRequest,
  ): Promise<void>;
  completeSession(
    sessionId: string,
    request: SessionCompletionRequest,
  ): Promise<CompletionSyncResponse>;
  syncOfflineCompletions(): Promise<{ synced: number; failed: number }>;
  getAthleteProgress(): Promise<AthleteProgress>;
  getOfflineQueueStatus(): Promise<OfflineQueueStatus>;
  getCaregiverDashboard(
    athleteId: string,
  ): Promise<CaregiverDashboardPayload>;
  revokeConsent(linkId: string): Promise<ConsentRevocationResponse>;
  deleteAccount(request: DataDeletionRequest): Promise<void>;
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
  isOnline?: () => Promise<boolean>;
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

function requireAthleteAccess(state: LoadedSessionState) {
  const athlete = requireCurrentAccount(state, "athlete");
  if (!canAthleteAccessSession(athlete, state.pairing)) {
    throw new LocalApiError("Complete consent and pairing before opening a session.", 403);
  }
  return athlete;
}

function requireAthleteAccountForSync(state: LoadedSessionState) {
  const athlete = requireAccount(state, "athlete");
  if (!canAthleteAccessSession(athlete, state.pairing)) {
    throw new LocalApiError("Athlete session access is not active.", 403);
  }
  return athlete;
}

function validateReflection(request: SessionCompletionRequest) {
  if (!request.reflection) return;
  if (
    request.reflection.feeling !== "clearer" &&
    request.reflection.feeling !== "steadier" &&
    request.reflection.feeling !== "more_ready"
  ) {
    throw new LocalApiError("Choose how you feel after the rehearsal.", 422);
  }
  if (
    request.reflection.note !== undefined &&
    (typeof request.reflection.note !== "string" || request.reflection.note.length > 1000)
  ) {
    throw new LocalApiError("Keep the private note under 1,000 characters.", 422);
  }
}

function requestsMatch(
  left: SessionCompletionRequest,
  right: SessionCompletionRequest,
) {
  return (
    left.sessionId === right.sessionId &&
    left.sessionVersion === right.sessionVersion &&
    left.mode === right.mode &&
    left.completionDurationSeconds === right.completionDurationSeconds &&
    left.completedAt === right.completedAt &&
    left.idempotencyKey === right.idempotencyKey &&
    JSON.stringify(left.reflection ?? null) ===
      JSON.stringify(right.reflection ?? null)
  );
}

function validateCompletionRequest(
  state: LoadedSessionState,
  sessionId: string,
  request: SessionCompletionRequest,
) {
  if (request.sessionId !== sessionId || request.sessionId !== sampleSessionPackage.id) {
    throw new LocalApiError("This completion does not match the beta session.", 404);
  }
  if (request.sessionVersion !== sampleSessionPackage.version) {
    throw new LocalApiError("This session version is no longer available.", 404);
  }
  if (request.mode !== "interactive") {
    throw new LocalApiError("Only interactive mode is available in this beta.", 422);
  }
  if (
    !Number.isFinite(request.completionDurationSeconds) ||
    request.completionDurationSeconds < 0 ||
    request.completionDurationSeconds > sampleSessionPackage.defaultDurationSeconds + 1
  ) {
    throw new LocalApiError("Enter a valid playback duration.", 422);
  }
  const threshold = sampleSessionPackage.defaultDurationSeconds * 0.8;
  if (request.completionDurationSeconds < threshold) {
    throw new LocalApiError(
      `Complete at least ${Math.round(threshold)} seconds of playback before finishing.`,
      422,
    );
  }
  if (!request.idempotencyKey?.trim()) {
    throw new LocalApiError("A completion idempotency key is required.", 422);
  }
  if (!request.completedAt || Number.isNaN(Date.parse(request.completedAt))) {
    throw new LocalApiError("Enter a valid completion timestamp.", 422);
  }
  validateReflection(request);

  const existing = state.completionIdempotency?.[request.idempotencyKey];
  if (existing && !requestsMatch(existing.request, request)) {
    throw new LocalApiError(
      "This idempotency key was already used for a different completion.",
      409,
    );
  }
}

function applyCompletion(
  state: PersistedSessionState,
  athlete: UserAccount,
  request: SessionCompletionRequest,
  now: () => Date,
): {
  state: PersistedSessionState;
  response: CompletionSyncResponse;
} {
  const existing = state.completionIdempotency?.[request.idempotencyKey];
  if (existing) {
    return { state, response: existing.response };
  }

  const allocation = allocateSequence(state);
  const completion: SessionCompletion = {
    id: allocation.id("cmp"),
    sessionId: request.sessionId,
    sessionVersion: request.sessionVersion,
    mode: request.mode,
    durationSeconds: request.completionDurationSeconds,
    completedAt: request.completedAt,
    ...(request.reflection ? { reflection: request.reflection } : {}),
    idempotencyKey: request.idempotencyKey,
  };
  const timezone = state.athleteProfile?.timezone ?? "UTC";
  const previous = calculateAthleteProgress(
    state.completions ?? [],
    athlete.id,
    athlete.displayName,
    timezone,
    now(),
  );
  const completions = [...(state.completions ?? []), completion];
  const next = calculateAthleteProgress(
    completions,
    athlete.id,
    athlete.displayName,
    timezone,
    now(),
  );
  const response = {
    ...buildCompletionSyncResponse(previous, next),
    completionId: completion.id,
  };
  const idempotencyRecord: CompletionIdempotencyRecord = {
    request,
    response,
    createdAt: isoNow(now),
  };

  return {
    state: {
      ...state,
      sequence: allocation.sequence,
      completions,
      completionIdempotency: {
        ...(state.completionIdempotency ?? {}),
        [request.idempotencyKey]: idempotencyRecord,
      },
    },
    response,
  };
}

function dashboardForState(
  state: LoadedSessionState,
  athleteId: string,
  now: Date,
): CaregiverDashboardPayload {
  const athlete = state.athleteAccount;
  if (!athlete || athlete.id !== athleteId) {
    throw new LocalApiError("Athlete not found.", 404);
  }
  const progress = calculateAthleteProgress(
    state.completions ?? [],
    athlete.id,
    athlete.displayName,
    state.athleteProfile?.timezone ?? "UTC",
    now,
  );
  const completedDays = progress.weeklyCompletedDays;
  const headline =
    completedDays === 0
      ? "Getting started"
      : completedDays === 1
        ? "Building composure"
        : "Keeping a steady rhythm";
  const description =
    completedDays === 0
      ? "The athlete is ready to complete the first beta session."
      : completedDays === 1
        ? "The athlete completed one mindset rep this week."
        : `The athlete completed ${completedDays} mindset reps this week.`;
  const lastRepTitle = progress.lastRep.completedAt
    ? progress.lastRep.title
    : "No completed reps";

  return {
    athlete: {
      id: athlete.id,
      name: athlete.displayName,
      program: "Matchday Mindset · Week 1",
      status: "active",
    },
    weeklySummary: {
      headline,
      description,
      daysCompleted: completedDays,
      daysTarget: 7,
      sevenDayPattern: progress.sevenDayPattern,
    },
    metrics: {
      moodTrend: {
        status: progress.moodTrend.status,
        subtitle: progress.moodTrend.subtitle,
        trendData: progress.moodTrend.trendValues,
      },
      composureScore: {
        value: progress.score,
        changeWeekly: progress.deltaWeekly,
      },
      currentStreak: {
        days: progress.currentStreakDays,
        bestDays: progress.bestStreakDays,
      },
      lastRep: {
        title: lastRepTitle,
        duration: progress.lastRep.duration,
        completedAt: progress.lastRep.completedAt,
        completedToday: progress.lastRep.completedToday,
      },
    },
    conversationStarters: [
      {
        id: completedDays ? "cs_progress" : "cs_start",
        category: "TRY THIS TONIGHT",
        prompt: completedDays
          ? "What helped you stay steady during the week?"
          : "What would help you feel ready before your next match?",
        guidance: "Invite a story, not a score.",
      },
    ],
    privacyPolicyNotice:
      "Private by design. This view shares progress patterns, not session transcripts, reflections, audio, or playback controls.",
  };
}

export function createLocalBetaApi(
  dependencies: LocalBetaApiDependencies = {},
): LocalBetaApi {
  const load = dependencies.loadSessionState ?? loadSessionState;
  const save = dependencies.saveSessionState ?? saveSessionState;
  const clear = dependencies.clearSessionState ?? clearSessionState;
  const readCredential =
    dependencies.readLocalCredential ?? readLocalCredential;
  const isOnline = dependencies.isOnline ?? hasInternetConnection;
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
      consentPolicyVersion: "beta-v1",
      consentSource: "caregiver_claim",
      consentActorId: caregiver.id,
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
    requireAthleteAccess(state);
    return { session: sampleSessionPackage };
  }

  async function recordPlaybackEvent(
    sessionId: string,
    request: PlaybackEventRequest,
  ): Promise<void> {
    const state = await readState();
    requireAthleteAccess(state);
    if (sessionId !== sampleSessionPackage.id) {
      throw new LocalApiError("This session is not available.", 404);
    }
    if (
      request.mode !== "interactive" ||
      !Number.isFinite(request.playbackPositionSeconds) ||
      request.playbackPositionSeconds < 0
    ) {
      throw new LocalApiError("Playback event payload is invalid.", 422);
    }
    await savePlaybackProgress(sessionId, {
      positionSeconds: request.playbackPositionSeconds,
      playedIntervals: state.playbackProgress?.[sessionId]?.playedIntervals ?? [],
      updatedAt: isoNow(now),
    });
  }

  async function completeSession(
    sessionId: string,
    request: SessionCompletionRequest,
  ): Promise<CompletionSyncResponse> {
    const state = await readState();
    const athlete = requireAthleteAccess(state);
    validateCompletionRequest(state, sessionId, request);

    const existing = state.completionIdempotency?.[request.idempotencyKey];
    if (existing) {
      return existing.response;
    }

    const applied = applyCompletion(state, athlete, request, now);
    const online = await isOnline();
    const timestamp = isoNow(now);
    const queueItem = createOfflineCompletionQueueItem(request, now());
    const queuedItem = online
      ? {
          ...queueItem,
          attempts: 1,
          lastAttemptAt: timestamp,
          syncedAt: timestamp,
          status: "synced" as const,
        }
      : queueItem;
    const nextState = upsertOfflineCompletionQueueItem(applied.state, queuedItem);
    await save(nextState);
    return applied.response;
  }

  async function syncOfflineCompletions(): Promise<{ synced: number; failed: number }> {
    if (!(await isOnline())) return { synced: 0, failed: 0 };

    const initialState = await readState();
    requireAthleteAccountForSync(initialState);
    let state: PersistedSessionState = initialState;
    let synced = 0;
    let failed = 0;

    for (const item of state.offlineCompletionQueue ?? []) {
      if (item.status === "synced" || item.status === "syncing") continue;
      const timestamp = isoNow(now);
      state = updateOfflineCompletionQueueItem(state, item.request.idempotencyKey, {
        status: "syncing",
        attempts: item.attempts + 1,
        lastAttemptAt: timestamp,
        updatedAt: timestamp,
      });
      await save(state);

      try {
        const existing = state.completionIdempotency?.[item.request.idempotencyKey];
        if (!existing) {
          const athlete = requireAccount(initialState, "athlete");
          validateCompletionRequest(initialState, item.request.sessionId, item.request);
          const applied = applyCompletion(state, athlete, item.request, now);
          state = applied.state;
        }
        state = updateOfflineCompletionQueueItem(state, item.request.idempotencyKey, {
          status: "synced",
          syncedAt: timestamp,
          updatedAt: timestamp,
          lastError: undefined,
        });
        await save(state);
        synced += 1;
      } catch (error) {
        state = updateOfflineCompletionQueueItem(state, item.request.idempotencyKey, {
          status: "failed",
          updatedAt: timestamp,
          lastError: error instanceof Error ? error.message : "Unable to sync completion.",
        });
        await save(state);
        failed += 1;
      }
    }

    return { synced, failed };
  }

  async function getAthleteProgress(): Promise<AthleteProgress> {
    const state = await readState();
    const athlete = requireCurrentAccount(state, "athlete");
    if (!state.athleteProfile) {
      throw new LocalApiError("Athlete profile is unavailable.", 404);
    }
    return calculateAthleteProgress(
      state.completions ?? [],
      athlete.id,
      athlete.displayName,
      state.athleteProfile.timezone,
      now(),
    );
  }

  async function getOfflineQueueStatus(): Promise<OfflineQueueStatus> {
    const state = await readState();
    return getQueueStatusFromState(state);
  }

  async function getCaregiverDashboard(
    athleteId: string,
  ): Promise<CaregiverDashboardPayload> {
    const state = await readState();
    const caregiver = requireCurrentAccount(state, "caregiver");
    if (!canCaregiverAccessDashboard(caregiver, state.pairing)) {
      throw new LocalApiError("Caregiver access is not active.", 403);
    }
    return dashboardForState(state, athleteId, now());
  }

  async function revokeConsent(linkId: string): Promise<ConsentRevocationResponse> {
    const state = await readState();
    const athlete = requireCurrentAccount(state, "athlete");
    const link = requirePairing(state);
    if (link.id !== linkId || link.athleteId !== athlete.id) {
      throw new LocalApiError("This athlete cannot revoke that relationship.", 403);
    }
    if (link.status !== "active") {
      throw new LocalApiError("This relationship is not active.", 409);
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

  async function deleteAccount(_request: DataDeletionRequest): Promise<void> {
    // Token and credential clearing is handled by the caller via clearSessionState.
    // This is a hook for future server-driven cleanup logic.
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
    recordPlaybackEvent,
    completeSession,
    syncOfflineCompletions,
    getAthleteProgress,
    getOfflineQueueStatus,
    getCaregiverDashboard,
    revokeConsent,
    deleteAccount,
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
export const recordPlaybackEvent = localBetaApi.recordPlaybackEvent;
export const completeSession = localBetaApi.completeSession;
export const syncOfflineCompletions = localBetaApi.syncOfflineCompletions;
export const getAthleteProgress = localBetaApi.getAthleteProgress;
export const getOfflineQueueStatus = localBetaApi.getOfflineQueueStatus;
export const getCaregiverDashboard = localBetaApi.getCaregiverDashboard;
export const revokeConsent = localBetaApi.revokeConsent;
export const deleteAccount = localBetaApi.deleteAccount;
export const resetLocalBetaState = localBetaApi.resetLocalBetaState;
