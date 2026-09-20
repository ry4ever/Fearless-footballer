import type {
  AgeGateResponse,
  AgeGateStatus,
  BetaUserRole,
  PairingLink,
  PairingRelationship,
  UserAccount,
} from "../../../shared/types";

export function isMinorBirthDate(birthDate: string, now = new Date()) {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > now) return null;

  let age = now.getFullYear() - birth.getFullYear();
  const monthOffset = now.getMonth() - birth.getMonth();
  if (monthOffset < 0 || (monthOffset === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age < 18;
}

export function evaluateAgeGateStatus(
  birthDate: string,
  now = new Date(),
): { isMinor: boolean; status: AgeGateStatus } {
  const isMinor = isMinorBirthDate(birthDate, now);
  if (isMinor === null) {
    return { isMinor: false, status: "restricted" };
  }

  return {
    isMinor,
    status: isMinor ? "pending_guardian_authorization" : "verified",
  };
}

export function applyAgeGateResult(
  account: UserAccount,
  result: AgeGateResponse,
): UserAccount {
  return {
    ...account,
    isMinor: result.isMinor,
    ageGateStatus: result.status,
  };
}

export function isAllowedRelationship(
  relationship: string,
): relationship is PairingRelationship {
  return relationship === "parent" || relationship === "guardian";
}

export function isPairingActiveAndConsented(pairing?: PairingLink) {
  return Boolean(
    pairing &&
      pairing.status === "active" &&
      pairing.consentStatus === "granted" &&
      pairing.athleteApprovedAt &&
      !pairing.revokedAt,
  );
}

export function activatePairing(
  pairing: PairingLink,
  athleteApprovedAt: string,
): PairingLink & { status: "active" } {
  return {
    ...pairing,
    status: "active",
    consentStatus: "granted",
    athleteApprovedAt,
    revokedAt: undefined,
  };
}

export function rejectPairing(
  pairing: PairingLink,
  rejectedAt: string,
): PairingLink & { status: "revoked" } {
  return {
    ...pairing,
    status: "revoked",
    consentStatus: "revoked",
    athleteApprovedAt: undefined,
    revokedAt: rejectedAt,
  };
}

export function revokePairing(
  pairing: PairingLink,
  revokedAt: string,
): PairingLink & { status: "revoked" } {
  return {
    ...pairing,
    status: "revoked",
    consentStatus: "revoked",
    revokedAt,
  };
}

export function canAthleteAccessSession(
  account?: UserAccount,
  pairing?: PairingLink,
) {
  if (
    !account ||
    account.role !== "athlete" ||
    account.ageGateStatus === "restricted"
  ) {
    return false;
  }

  if (account.ageGateStatus === "verified" && !account.isMinor) {
    return true;
  }

  return Boolean(
    account.isMinor &&
      account.ageGateStatus === "pending_guardian_authorization" &&
      pairing?.athleteId === account.id &&
      isPairingActiveAndConsented(pairing),
  );
}

export function canCaregiverAccessDashboard(
  account?: UserAccount,
  pairing?: PairingLink,
) {
  return Boolean(
    account?.role === "caregiver" &&
      account.pairingStatus === "active" &&
      pairing?.caregiverUserId === account.id &&
      isPairingActiveAndConsented(pairing),
  );
}

export function isPendingPairing(pairing?: PairingLink) {
  return pairing?.status === "pending_athlete_approval";
}

export function isRevokedPairing(pairing?: PairingLink) {
  return pairing?.status === "revoked";
}

export function roleLabel(role: BetaUserRole) {
  return role === "athlete" ? "Athlete" : "Caregiver";
}
