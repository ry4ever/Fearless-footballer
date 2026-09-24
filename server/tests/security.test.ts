import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { passwordSchema } from "../lib/security";
import { evaluateAgeGate } from "../index";
import { decryptPII, encryptPII, hashPairingCode, hashResetToken } from "../lib/pii";
import { sanitizeAuditDetails } from "../lib/audit";
import { createRefreshToken, createAccessToken } from "../index";

describe("Password Validation", () => {
  it("accepts valid passwords with 8+ chars, letter, and number", () => {
    expect(passwordSchema.safeParse("Password1").success).toBe(true);
    expect(passwordSchema.safeParse("test1234").success).toBe(true);
    expect(passwordSchema.safeParse("Abcdefg1").success).toBe(true);
  });

  it("rejects passwords under 8 characters", () => {
    expect(passwordSchema.safeParse("Pass1").success).toBe(false);
    expect(passwordSchema.safeParse("Abc1").success).toBe(false);
  });

  it("rejects passwords without letters", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
  });

  it("rejects passwords without numbers", () => {
    expect(passwordSchema.safeParse("Password").success).toBe(false);
  });

  it("rejects passwords over 128 characters", () => {
    const long = "a".repeat(129) + "1";
    expect(passwordSchema.safeParse(long).success).toBe(false);
  });
});

describe("Age Gate Evaluation", () => {
  const now = new Date("2026-09-21T00:00:00.000Z");

  it("marks children under 13 as minor and restricted", () => {
    const birthDate = "2015-01-01"; // 11 years old
    const result = evaluateAgeGate(birthDate, now);
    expect(result.isMinor).toBe(true);
    expect(result.status).toBe("restricted");
    expect(result.restrictedReason).toBe("age_verification_required");
  });

  it("marks teens 13-17 as minor and needs guardian consent", () => {
    const birthDate13 = "2013-09-21"; // 13 years old
    const birthDate17 = "2009-09-21"; // 17 years old
    const result13 = evaluateAgeGate(birthDate13, now);
    const result17 = evaluateAgeGate(birthDate17, now);
    expect(result13.isMinor).toBe(true);
    expect(result13.status).toBe("pending_guardian_authorization");
    expect(result17.isMinor).toBe(true);
    expect(result17.status).toBe("pending_guardian_authorization");
  });

  it("marks adults 18+ as verified and not a minor", () => {
    const birthDate = "2000-01-01"; // 26 years old
    const result = evaluateAgeGate(birthDate, now);
    expect(result.isMinor).toBe(false);
    expect(result.status).toBe("verified");
  });

  it("rejects invalid birth dates", () => {
    const result = evaluateAgeGate("invalid-date", now);
    expect(result.isMinor).toBe(false);
    expect(result.status).toBe("restricted");
    expect(result.restrictedReason).toBe("age_verification_required");
  });
});

describe("PII Encryption/Decryption", () => {
  it("roundtrips email encryption correctly", () => {
    const email = "test@example.com";
    const encrypted = encryptPII(email);
    const decrypted = decryptPII(encrypted);
    expect(decrypted).toBe(email);
  });

  it("roundtrips name encryption correctly", () => {
    const name = "John Doe";
    const encrypted = encryptPII(name);
    const decrypted = decryptPII(encrypted);
    expect(decrypted).toBe(name);
  });

  it("produces different ciphertext for same input (random IV)", () => {
    const input = "consistent@example.com";
    const encrypted1 = encryptPII(input);
    const encrypted2 = encryptPII(input);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("detects tampered ciphertext", () => {
    const email = "test@example.com";
    const encrypted = encryptPII(email);
    const tampered = encrypted.slice(0, -10) + "0000000000";
    expect(() => decryptPII(tampered)).toThrow();
  });
});

describe("Token Version Rotation", () => {
  const userId = "test-user-123";
  const role = "athlete" as const;

  it("creates access tokens without email or other PII claims", () => {
    const token = createAccessToken(userId, role);
    const payload = verifyToken(token, process.env.JWT_ACCESS_SECRET!);
    expect(payload.sub).toBe(userId);
    expect(payload.role).toBe(role);
    expect(payload.email).toBeUndefined();
    expect((payload as any).exp).toBeGreaterThan(Date.now() / 1000);
  });

  it("creates refresh tokens with a version claim but no email", () => {
    const version = 1;
    const token = createRefreshToken(userId, role, version);
    const payload = verifyToken(token, process.env.JWT_REFRESH_SECRET!);
    expect(payload.sub).toBe(userId);
    expect(payload.role).toBe(role);
    expect(payload.email).toBeUndefined();
    expect(payload.refreshVersion).toBe(version);
  });

  it("creates different tokens for different versions", () => {
    const token1 = createRefreshToken(userId, role, 1);
    const token2 = createRefreshToken(userId, role, 2);
    const payload1 = verifyToken(token1, process.env.JWT_REFRESH_SECRET!);
    const payload2 = verifyToken(token2, process.env.JWT_REFRESH_SECRET!);
    expect(payload1.refreshVersion).toBe(1);
    expect(payload2.refreshVersion).toBe(2);
  });
});

describe("Privacy-sensitive identifiers", () => {
  it("hashes pairing codes and reset tokens without retaining plaintext", () => {
    const pairingHash = hashPairingCode("FEAR-AB12");
    const resetHash = hashResetToken("reset-token-value");

    expect(pairingHash).not.toBe("FEAR-AB12");
    expect(resetHash).not.toBe("reset-token-value");
    expect(hashPairingCode("fear-ab12")).toBe(pairingHash);
    expect(hashResetToken("reset-token-value")).toBe(resetHash);
    expect(pairingHash).not.toBe(resetHash);
  });

  it("drops pairing, token, reflection, and media metadata from audit details", () => {
    expect(
      sanitizeAuditDetails({
        pairingCode: "FEAR-AB12",
        resetToken: "secret",
        reflection: "private note",
        transcript: "private transcript",
        durationSeconds: 42,
        approved: true,
      }),
    ).toEqual({ durationSeconds: 42, approved: true });
  });
});

describe("Rate Limiting", () => {
  let app: express.Express;
  let address: string;

  beforeAll(async () => {
    const { authLimiter } = await import("../lib/security");
    app = express();
    app.use(authLimiter);
    app.get("/test", (_req, res) => res.json({ ok: true }));
    const server = app.listen(0);
    address = `http://localhost:${(server.address() as any).port}`;
    afterAll(() => server.close());
  });

  it("allows requests under the limit", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await fetch(address + "/test");
      expect(res.status).toBe(200);
    }
  });

  it("blocks requests over the limit", async () => {
    for (let i = 0; i < 5; i++) {
      await fetch(address + "/test");
    }
    const res = await fetch(address + "/test");
    expect(res.status).toBe(429);
  });
});

// Helper to verify JWT without full decode
function verifyToken(token: string, secret: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
  return payload;
}
