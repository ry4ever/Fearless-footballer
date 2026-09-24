import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type {
  AuthTokenSet,
  BetaUserRole,
  CompletionSyncResponse,
  OfflineCompletionQueueItem,
  PairingCode,
  PairingLink,
  SessionCompletion,
  SessionCompletionRequest,
  UserAccount,
} from "../../../shared/types";
import { calculateAthleteProgress } from "./metrics";
import type { PlaybackInterval } from "./sessionPlayer";

const STATE_KEY = "fearlessfootballer.session.v1";
const TOKEN_PREFIX = "fearlessfootballer.token.";
const CREDENTIAL_PREFIX = "fearlessfootballer.credential.";

export interface LocalCredential {
  email: string;
  passwordHash: string;
}

export interface AthleteLocalProfile {
  timezone: string;
  region?: string;
  privacyAcknowledgedAt?: string;
}

export interface CaregiverLocalProfile {
  privacyAcknowledgedAt?: string;
}

export interface SessionPlaybackProgress {
  positionSeconds: number;
  playedIntervals: PlaybackInterval[];
  updatedAt: string;
}

export interface CompletionIdempotencyRecord {
  request: SessionCompletionRequest;
  response: CompletionSyncResponse;
  createdAt: string;
}

export interface PersistedSessionState {
  athleteAccount?: UserAccount;
  caregiverAccount?: UserAccount;
  currentRole?: BetaUserRole;
  pairing?: PairingLink;
  pairingCode?: PairingCode;
  pairingCodeConsumedAt?: string;
  sequence?: number;
  athleteProfile?: AthleteLocalProfile;
  caregiverProfile?: CaregiverLocalProfile;
  completions?: SessionCompletion[];
  completionIdempotency?: Record<string, CompletionIdempotencyRecord>;
  pendingCompletionKeys?: Record<string, string>;
  playbackProgress?: Record<string, SessionPlaybackProgress>;
  offlineCompletionQueue?: OfflineCompletionQueueItem[];
}

export interface LoadedSessionState extends PersistedSessionState {
  currentUser?: UserAccount;
  hasTokens: boolean;
  athleteProgress?: ReturnType<typeof calculateAthleteProgress>;
}

export function tokenKey(role: BetaUserRole, kind: "access" | "refresh") {
  return `${TOKEN_PREFIX}${role}.${kind}`;
}

export function credentialKey(role: BetaUserRole) {
  return `${CREDENTIAL_PREFIX}${role}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRole(value: unknown): value is BetaUserRole {
  return value === "athlete" || value === "caregiver";
}

function isAgeGateStatus(
  value: unknown,
): value is "verified" | "pending_guardian_authorization" | "restricted" {
  return (
    value === "verified" ||
    value === "pending_guardian_authorization" ||
    value === "restricted"
  );
}

function isPairingStatus(
  value: unknown,
): value is "unlinked" | "pending_athlete_approval" | "active" | "revoked" {
  return (
    value === "unlinked" ||
    value === "pending_athlete_approval" ||
    value === "active" ||
    value === "revoked"
  );
}

function isConsentStatus(value: unknown): value is "pending" | "granted" | "revoked" {
  return value === "pending" || value === "granted" || value === "revoked";
}

function isRelationship(value: unknown): value is "parent" | "guardian" {
  return value === "parent" || value === "guardian";
}

function isReflectionFeeling(
  value: unknown,
): value is "clearer" | "steadier" | "more_ready" {
  return value === "clearer" || value === "steadier" || value === "more_ready";
}

function parseUserAccount(value: unknown): UserAccount | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isRole(value.role) ||
    typeof value.displayName !== "string" ||
    typeof value.isMinor !== "boolean" ||
    !isAgeGateStatus(value.ageGateStatus) ||
    !isPairingStatus(value.pairingStatus)
  ) {
    return undefined;
  }

  return {
    id: value.id,
    role: value.role,
    displayName: value.displayName,
    isMinor: value.isMinor,
    ageGateStatus: value.ageGateStatus,
    pairingStatus: value.pairingStatus,
  };
}

function parsePairingCode(value: unknown): PairingCode | undefined {
  if (
    !isRecord(value) ||
    typeof value.code !== "string" ||
    typeof value.expiresAt !== "string"
  ) {
    return undefined;
  }
  return { code: value.code, expiresAt: value.expiresAt };
}

function parsePairingLink(value: unknown): PairingLink | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.athleteId !== "string" ||
    typeof value.caregiverUserId !== "string" ||
    !isRelationship(value.relationship) ||
    !isPairingStatus(value.status) ||
    !isConsentStatus(value.consentStatus) ||
    (value.consentPolicyVersion !== undefined &&
      typeof value.consentPolicyVersion !== "string") ||
    (value.consentSource !== undefined && typeof value.consentSource !== "string") ||
    (value.consentActorId !== undefined && typeof value.consentActorId !== "string") ||
    (value.consentRevokedAt !== undefined && typeof value.consentRevokedAt !== "string") ||
    (value.pairingCode !== undefined && typeof value.pairingCode !== "string") ||
    (value.pairingExpiresAt !== undefined && typeof value.pairingExpiresAt !== "string") ||
    (value.consentedAt !== undefined && typeof value.consentedAt !== "string") ||
    (value.athleteApprovedAt !== undefined && typeof value.athleteApprovedAt !== "string") ||
    (value.revokedAt !== undefined && typeof value.revokedAt !== "string")
  ) {
    return undefined;
  }

  return {
    id: value.id,
    athleteId: value.athleteId,
    caregiverUserId: value.caregiverUserId,
    relationship: value.relationship,
    status: value.status,
    ...(typeof value.pairingCode === "string" ? { pairingCode: value.pairingCode } : {}),
    ...(typeof value.pairingExpiresAt === "string"
      ? { pairingExpiresAt: value.pairingExpiresAt }
      : {}),
    consentStatus: value.consentStatus,
    ...(typeof value.consentPolicyVersion === "string"
      ? { consentPolicyVersion: value.consentPolicyVersion }
      : {}),
    ...(typeof value.consentSource === "string"
      ? { consentSource: value.consentSource }
      : {}),
    ...(typeof value.consentActorId === "string"
      ? { consentActorId: value.consentActorId }
      : {}),
    ...(typeof value.consentedAt === "string" ? { consentedAt: value.consentedAt } : {}),
    ...(typeof value.consentRevokedAt === "string"
      ? { consentRevokedAt: value.consentRevokedAt }
      : {}),
    ...(typeof value.athleteApprovedAt === "string"
      ? { athleteApprovedAt: value.athleteApprovedAt }
      : {}),
    ...(typeof value.revokedAt === "string" ? { revokedAt: value.revokedAt } : {}),
  };
}

function parseAthleteProfile(value: unknown): AthleteLocalProfile | undefined {
  if (!isRecord(value) || typeof value.timezone !== "string") return undefined;
  return {
    timezone: value.timezone,
    ...(typeof value.region === "string" ? { region: value.region } : {}),
    ...(typeof value.privacyAcknowledgedAt === "string"
      ? { privacyAcknowledgedAt: value.privacyAcknowledgedAt }
      : {}),
  };
}

function parseCaregiverProfile(value: unknown): CaregiverLocalProfile | undefined {
  if (!isRecord(value)) return undefined;
  return {
    ...(typeof value.privacyAcknowledgedAt === "string"
      ? { privacyAcknowledgedAt: value.privacyAcknowledgedAt }
      : {}),
  };
}

function parsePlaybackInterval(value: unknown): PlaybackInterval | undefined {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.startSeconds) ||
    !isFiniteNumber(value.endSeconds) ||
    value.endSeconds <= value.startSeconds
  ) {
    return undefined;
  }
  return { startSeconds: value.startSeconds, endSeconds: value.endSeconds };
}

function parsePlaybackProgress(value: unknown): SessionPlaybackProgress | undefined {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.positionSeconds) ||
    value.positionSeconds < 0 ||
    typeof value.updatedAt !== "string" ||
    !Array.isArray(value.playedIntervals)
  ) {
    return undefined;
  }
  const playedIntervals = value.playedIntervals
    .map(parsePlaybackInterval)
    .filter((interval): interval is PlaybackInterval => Boolean(interval));
  return {
    positionSeconds: value.positionSeconds,
    playedIntervals,
    updatedAt: value.updatedAt,
  };
}

function parseReflection(value: unknown) {
  if (!isRecord(value) || !isReflectionFeeling(value.feeling)) return undefined;
  return {
    feeling: value.feeling,
    ...(typeof value.note === "string" && value.note.trim()
      ? { note: value.note.trim() }
      : {}),
  };
}

function parseCompletion(value: unknown): SessionCompletion | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.sessionId !== "string" ||
    typeof value.sessionVersion !== "string" ||
    value.mode !== "interactive" ||
    !isFiniteNumber(value.durationSeconds) ||
    value.durationSeconds < 0 ||
    typeof value.completedAt !== "string" ||
    (value.reflection !== undefined && !parseReflection(value.reflection)) ||
    (value.idempotencyKey !== undefined && typeof value.idempotencyKey !== "string")
  ) {
    return undefined;
  }
  const reflection = parseReflection(value.reflection);
  return {
    id: value.id,
    sessionId: value.sessionId,
    sessionVersion: value.sessionVersion,
    mode: "interactive",
    durationSeconds: value.durationSeconds,
    completedAt: value.completedAt,
    ...(reflection ? { reflection } : {}),
    ...(typeof value.idempotencyKey === "string"
      ? { idempotencyKey: value.idempotencyKey }
      : {}),
  };
}

function parseIdempotencyRecord(
  value: unknown,
): CompletionIdempotencyRecord | undefined {
  if (
    !isRecord(value) ||
    !isRecord(value.request) ||
    !isRecord(value.response) ||
    typeof value.createdAt !== "string"
  ) {
    return undefined;
  }
  const request = value.request;
  const response = value.response;
  const reflection = parseReflection(request.reflection);
  if (
    typeof request.sessionId !== "string" ||
    typeof request.sessionVersion !== "string" ||
    request.mode !== "interactive" ||
    !isFiniteNumber(request.completionDurationSeconds) ||
    typeof request.completedAt !== "string" ||
    typeof request.idempotencyKey !== "string" ||
    (request.reflection !== undefined && !reflection) ||
    typeof response.completionId !== "string" ||
    !isRecord(response.streak) ||
    !isRecord(response.composure) ||
    !isRecord(response.weeklyProgress)
  ) {
    return undefined;
  }
  return {
    request: {
      sessionId: request.sessionId,
      sessionVersion: request.sessionVersion,
      mode: "interactive",
      completionDurationSeconds: request.completionDurationSeconds,
      completedAt: request.completedAt,
      ...(reflection ? { reflection } : {}),
      idempotencyKey: request.idempotencyKey,
    },
    response: response as unknown as CompletionSyncResponse,
    createdAt: value.createdAt,
  };
}

function parseQueueItem(value: unknown): OfflineCompletionQueueItem | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isRecord(value.request) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !isFiniteNumber(value.attempts) ||
    typeof value.status !== "string"
  ) {
    return undefined;
  }
  const status = value.status;
  if (
    status !== "queued" &&
    status !== "syncing" &&
    status !== "synced" &&
    status !== "failed"
  ) {
    return undefined;
  }
  return {
    id: value.id,
    request: value.request as unknown as SessionCompletionRequest,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    attempts: value.attempts,
    status,
    ...(typeof value.lastError === "string" ? { lastError: value.lastError } : {}),
  };
}

function parseRecordOfStrings(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") return undefined;
    result[key] = entry;
  }
  return result;
}

function parsePersistedState(raw: string | null): PersistedSessionState {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};

    const athleteAccount = parseUserAccount(parsed.athleteAccount);
    const caregiverAccount = parseUserAccount(parsed.caregiverAccount);
    const pairing = parsePairingLink(parsed.pairing);
    const pairingCode = parsePairingCode(parsed.pairingCode);
    const athleteProfile = parseAthleteProfile(parsed.athleteProfile);
    const caregiverProfile = parseCaregiverProfile(parsed.caregiverProfile);
    const sequence =
      typeof parsed.sequence === "number" &&
      Number.isInteger(parsed.sequence) &&
      parsed.sequence >= 0
        ? parsed.sequence
        : undefined;
    const completions = Array.isArray(parsed.completions)
      ? parsed.completions
          .map(parseCompletion)
          .filter((completion): completion is SessionCompletion => Boolean(completion))
      : undefined;
    const playbackProgress = isRecord(parsed.playbackProgress)
      ? Object.fromEntries(
          Object.entries(parsed.playbackProgress)
            .map(([sessionId, progress]) => [
              sessionId,
              parsePlaybackProgress(progress),
            ] as const)
            .filter(
              (entry): entry is readonly [string, SessionPlaybackProgress] =>
                Boolean(entry[1]),
            ),
        )
      : undefined;
    const completionIdempotency = isRecord(parsed.completionIdempotency)
      ? Object.fromEntries(
          Object.entries(parsed.completionIdempotency)
            .map(([key, entry]) => [key, parseIdempotencyRecord(entry)] as const)
            .filter(
              (entry): entry is readonly [string, CompletionIdempotencyRecord] =>
                Boolean(entry[1]),
            ),
        )
      : undefined;
    const pendingCompletionKeys = parseRecordOfStrings(parsed.pendingCompletionKeys);
    const offlineCompletionQueue = Array.isArray(parsed.offlineCompletionQueue)
      ? parsed.offlineCompletionQueue
          .map(parseQueueItem)
          .filter((item): item is OfflineCompletionQueueItem => Boolean(item))
      : undefined;

    return {
      ...(athleteAccount ? { athleteAccount } : {}),
      ...(caregiverAccount ? { caregiverAccount } : {}),
      ...(isRole(parsed.currentRole) ? { currentRole: parsed.currentRole } : {}),
      ...(pairing ? { pairing } : {}),
      ...(pairingCode ? { pairingCode } : {}),
      ...(typeof parsed.pairingCodeConsumedAt === "string"
        ? { pairingCodeConsumedAt: parsed.pairingCodeConsumedAt }
        : {}),
      ...(sequence !== undefined ? { sequence } : {}),
      ...(athleteProfile ? { athleteProfile } : {}),
      ...(caregiverProfile ? { caregiverProfile } : {}),
      ...(completions?.length ? { completions } : {}),
      ...(completionIdempotency && Object.keys(completionIdempotency).length
        ? { completionIdempotency }
        : {}),
      ...(pendingCompletionKeys && Object.keys(pendingCompletionKeys).length
        ? { pendingCompletionKeys }
        : {}),
      ...(playbackProgress && Object.keys(playbackProgress).length
        ? { playbackProgress }
        : {}),
      ...(offlineCompletionQueue?.length ? { offlineCompletionQueue } : {}),
    };
  } catch {
    return {};
  }
}

async function readTokens(role?: BetaUserRole): Promise<AuthTokenSet | null> {
  if (!role) return null;

  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(tokenKey(role, "access")),
    SecureStore.getItemAsync(tokenKey(role, "refresh")),
  ]);

  if (!accessToken || !refreshToken) return null;

  return {
    accessToken,
    refreshToken,
    expiresIn: 900,
  };
}

export async function loadSessionState(): Promise<LoadedSessionState> {
  const [storedState, athleteTokens, caregiverTokens] = await Promise.all([
    AsyncStorage.getItem(STATE_KEY),
    readTokens("athlete"),
    readTokens("caregiver"),
  ]);

  const state = parsePersistedState(storedState);
  const currentUser =
    state.currentRole === "athlete"
      ? state.athleteAccount
      : state.currentRole === "caregiver"
        ? state.caregiverAccount
        : undefined;
  const athleteProgress =
    state.athleteAccount && state.athleteProfile
      ? calculateAthleteProgress(
          state.completions ?? [],
          state.athleteAccount.id,
          state.athleteAccount.displayName,
          state.athleteProfile.timezone,
        )
      : undefined;

  return {
    ...state,
    currentUser,
    hasTokens: Boolean(
      state.currentRole &&
        (state.currentRole === "athlete" ? athleteTokens : caregiverTokens),
    ),
    ...(athleteProgress ? { athleteProgress } : {}),
  };
}

export async function saveSessionState(
  state: PersistedSessionState,
  tokens?: Partial<Record<BetaUserRole, AuthTokenSet>>,
  credentials?: Partial<Record<BetaUserRole, LocalCredential>>,
) {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));

  const writes: Promise<void>[] = [];
  if (tokens?.athlete) {
    writes.push(
      SecureStore.setItemAsync(tokenKey("athlete", "access"), tokens.athlete.accessToken),
      SecureStore.setItemAsync(tokenKey("athlete", "refresh"), tokens.athlete.refreshToken),
    );
  }
  if (tokens?.caregiver) {
    writes.push(
      SecureStore.setItemAsync(tokenKey("caregiver", "access"), tokens.caregiver.accessToken),
      SecureStore.setItemAsync(tokenKey("caregiver", "refresh"), tokens.caregiver.refreshToken),
    );
  }
  if (credentials?.athlete) {
    writes.push(
      SecureStore.setItemAsync(
        credentialKey("athlete"),
        JSON.stringify(credentials.athlete),
      ),
    );
  }
  if (credentials?.caregiver) {
    writes.push(
      SecureStore.setItemAsync(
        credentialKey("caregiver"),
        JSON.stringify(credentials.caregiver),
      ),
    );
  }

  await Promise.all(writes);
}

export async function readLocalCredential(
  role: BetaUserRole,
): Promise<LocalCredential | null> {
  const raw = await SecureStore.getItemAsync(credentialKey(role));
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      typeof parsed.email !== "string" ||
      typeof parsed.passwordHash !== "string"
    ) {
      return null;
    }
    return { email: parsed.email, passwordHash: parsed.passwordHash };
  } catch {
    return null;
  }
}

export async function savePlaybackProgress(
  sessionId: string,
  progress: SessionPlaybackProgress,
) {
  const state = await loadSessionState();
  await saveSessionState({
    ...state,
    playbackProgress: {
      ...(state.playbackProgress ?? {}),
      [sessionId]: progress,
    },
  });
}

export async function loadPlaybackProgress(
  sessionId: string,
): Promise<SessionPlaybackProgress | null> {
  const state = await loadSessionState();
  return state.playbackProgress?.[sessionId] ?? null;
}

export async function getOrCreatePendingCompletionKey(sessionId: string) {
  const state = await loadSessionState();
  const existing = state.pendingCompletionKeys?.[sessionId];
  if (existing) return existing;
  const key = `cmp_${Date.now().toString(36)}_${sessionId}`;
  await saveSessionState({
    ...state,
    pendingCompletionKeys: {
      ...(state.pendingCompletionKeys ?? {}),
      [sessionId]: key,
    },
  });
  return key;
}

export async function clearPendingCompletionKey(sessionId: string) {
  const state = await loadSessionState();
  if (!state.pendingCompletionKeys?.[sessionId]) return;
  const pendingCompletionKeys = { ...state.pendingCompletionKeys };
  delete pendingCompletionKeys[sessionId];
  await saveSessionState({ ...state, pendingCompletionKeys });
}

export async function clearSessionState() {
  await AsyncStorage.removeItem(STATE_KEY);
  await Promise.all([
    SecureStore.deleteItemAsync(tokenKey("athlete", "access")),
    SecureStore.deleteItemAsync(tokenKey("athlete", "refresh")),
    SecureStore.deleteItemAsync(tokenKey("caregiver", "access")),
    SecureStore.deleteItemAsync(tokenKey("caregiver", "refresh")),
    SecureStore.deleteItemAsync(credentialKey("athlete")),
    SecureStore.deleteItemAsync(credentialKey("caregiver")),
  ]);
}

export async function signOutSession() {
  const [storedState] = await Promise.all([
    AsyncStorage.getItem(STATE_KEY),
    SecureStore.deleteItemAsync(tokenKey("athlete", "access")),
    SecureStore.deleteItemAsync(tokenKey("athlete", "refresh")),
    SecureStore.deleteItemAsync(tokenKey("caregiver", "access")),
    SecureStore.deleteItemAsync(tokenKey("caregiver", "refresh")),
  ]);
  const state = parsePersistedState(storedState);
  if (state.currentRole) {
    await AsyncStorage.setItem(
      STATE_KEY,
      JSON.stringify({ ...state, currentRole: undefined }),
    );
  }
}

export function withCurrentRole(
  state: PersistedSessionState,
  role: BetaUserRole,
): LoadedSessionState {
  return {
    ...state,
    currentRole: role,
    currentUser: role === "athlete" ? state.athleteAccount : state.caregiverAccount,
    hasTokens: false,
  };
}

export type { PlaybackInterval };
