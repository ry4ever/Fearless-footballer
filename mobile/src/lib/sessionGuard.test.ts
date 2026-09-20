import { describe, expect, it } from "vitest";
import type {
  PairingLink,
  PairingRelationship,
  UserAccount,
} from "../../../shared/types";
import {
  canAthleteAccessSession,
  canCaregiverAccessDashboard,
  evaluateAgeGateStatus,
  isAllowedRelationship,
  isPairingActiveAndConsented,
} from "./sessionGuard";

function athlete(overrides: Partial<UserAccount> = {}): UserAccount {
  return {
    id: "usr_athlete",
    role: "athlete",
    displayName: "Alex",
    isMinor: false,
    ageGateStatus: "verified",
    pairingStatus: "unlinked",
    ...overrides,
  };
}

function caregiver(overrides: Partial<UserAccount> = {}): UserAccount {
  return {
    id: "usr_caregiver",
    role: "caregiver",
    displayName: "Taylor",
    isMinor: false,
    ageGateStatus: "verified",
    pairingStatus: "unlinked",
    ...overrides,
  };
}

function link(overrides: Partial<PairingLink> = {}): PairingLink {
  return {
    id: "lnk_0001",
    athleteId: "usr_athlete",
    caregiverUserId: "usr_caregiver",
    relationship: "parent",
    status: "pending_athlete_approval",
    consentStatus: "pending",
    ...overrides,
  };
}

describe("age gate transitions", () => {
  it("verifies an adult birth date", () => {
    expect(evaluateAgeGateStatus("1990-01-01", new Date("2026-09-19T12:00:00Z"))).toEqual({
      isMinor: false,
      status: "verified",
    });
  });

  it("requires guardian authorization for a minor", () => {
    expect(evaluateAgeGateStatus("2010-01-01", new Date("2026-09-19T12:00:00Z"))).toEqual({
      isMinor: true,
      status: "pending_guardian_authorization",
    });
  });

  it("restricts invalid and future birth dates", () => {
    expect(evaluateAgeGateStatus("not-a-date", new Date("2026-09-19T12:00:00Z"))).toEqual({
      isMinor: false,
      status: "restricted",
    });
    expect(evaluateAgeGateStatus("2030-01-01", new Date("2026-09-19T12:00:00Z"))).toEqual({
      isMinor: false,
      status: "restricted",
    });
  });
});

describe("athlete session authorization", () => {
  it("allows a verified adult athlete", () => {
    expect(canAthleteAccessSession(athlete())).toBe(true);
  });

  it("blocks a minor before active consent and approval", () => {
    const minor = athlete({
      isMinor: true,
      ageGateStatus: "pending_guardian_authorization",
    });
    expect(canAthleteAccessSession(minor)).toBe(false);
    expect(canAthleteAccessSession(minor, link())).toBe(false);
  });

  it("allows a minor only for the matching active, consented, approved link", () => {
    const minor = athlete({
      isMinor: true,
      ageGateStatus: "pending_guardian_authorization",
      pairingStatus: "active",
    });
    const activeLink = link({
      status: "active",
      consentStatus: "granted",
      athleteApprovedAt: "2026-09-19T12:00:00Z",
    });

    expect(canAthleteAccessSession(minor, activeLink)).toBe(true);
    expect(canAthleteAccessSession(minor, link({ athleteId: "usr_other" }))).toBe(false);
  });

  it("requires an active, granted, approved link", () => {
    expect(
      isPairingActiveAndConsented(
        link({ status: "active", consentStatus: "granted" }),
      ),
    ).toBe(false);
    expect(
      isPairingActiveAndConsented(
        link({
          status: "active",
          consentStatus: "granted",
          athleteApprovedAt: "2026-09-19T12:00:00Z",
          revokedAt: "2026-09-19T12:01:00Z",
        }),
      ),
    ).toBe(false);
  });
});

describe("caregiver dashboard authorization", () => {
  it("blocks unlinked, pending, and revoked caregivers", () => {
    expect(canCaregiverAccessDashboard(caregiver())).toBe(false);
    expect(
      canCaregiverAccessDashboard(
        caregiver({ pairingStatus: "pending_athlete_approval" }),
        link(),
      ),
    ).toBe(false);
    expect(
      canCaregiverAccessDashboard(
        caregiver({ pairingStatus: "revoked" }),
        link({ status: "revoked", consentStatus: "revoked" }),
      ),
    ).toBe(false);
  });

  it("allows only the matching active and consented caregiver", () => {
    const activeLink = link({
      status: "active",
      consentStatus: "granted",
      athleteApprovedAt: "2026-09-19T12:00:00Z",
    });
    expect(canCaregiverAccessDashboard(caregiver({ pairingStatus: "active" }), activeLink)).toBe(
      true,
    );
    expect(
      canCaregiverAccessDashboard(
        caregiver({ id: "usr_other", pairingStatus: "active" }),
        activeLink,
      ),
    ).toBe(false);
  });
});

describe("relationship validation", () => {
  const accepted: PairingRelationship[] = ["parent", "guardian"];
  const rejected = ["coach", "friend", "team", ""];

  it("accepts only parent and guardian relationships", () => {
    for (const relationship of accepted) {
      expect(isAllowedRelationship(relationship)).toBe(true);
    }
    for (const relationship of rejected) {
      expect(isAllowedRelationship(relationship)).toBe(false);
    }
  });
});
