import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type {
  AuthTokenSet,
  BetaUserRole,
  PairingCode,
  PairingLink,
  UserAccount,
} from "../../../shared/types";

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
}

export interface LoadedSessionState extends PersistedSessionState {
  currentUser?: UserAccount;
  hasTokens: boolean;
}

function tokenKey(role: BetaUserRole, kind: "access" | "refresh") {
  return `${TOKEN_PREFIX}${role}.${kind}`;
}

function credentialKey(role: BetaUserRole) {
  return `${CREDENTIAL_PREFIX}${role}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
    ...(typeof value.consentedAt === "string" ? { consentedAt: value.consentedAt } : {}),
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

  return {
    ...state,
    currentUser,
    hasTokens: Boolean(
      state.currentRole &&
        (state.currentRole === "athlete" ? athleteTokens : caregiverTokens),
    ),
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
