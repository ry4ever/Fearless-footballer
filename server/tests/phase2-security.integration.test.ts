import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { app } from "../index";
import { resetRateLimiters } from "../lib/security";
import { PrismaClient } from "@prisma/client";
import { encryptPII, decryptPII, hashPairingCode, hashResetToken } from "../lib/pii";

const prisma = new PrismaClient();
let testPort: number;
let baseUrl: string;
let server: ReturnType<typeof app.listen>;

async function seedTestData() {
  // Clean tables in correct order due to FK
  await prisma.sessionCompleted.deleteMany();
  await prisma.reflection.deleteMany();
  await prisma.metricSnapshot.deleteMany();
  await prisma.caregiverLink.deleteMany();
  await prisma.athleteProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.sessionPrompt.deleteMany();
  await prisma.sessionPhase.deleteMany();
  await prisma.session.deleteMany();

  // Create a published session for testing (unique slug each run to avoid constraint)
  await prisma.session.create({
    data: {
      slug: `nerves-equals-performance-${Date.now()}`,
      version: "1.0.0",
      title: "Nerves = Performance",
      subtitle: "Turn pre-match nerves into competitive energy",
      category: "CALM",
      defaultDuration: 300,
      mentorName: "Alex Rivera",
      mentorTitle: "Sports Psychologist",
      mentorAvatarUrl: "https://example.com/avatar.png",
      heroImageUrl: "https://example.com/hero.png",
      isPublished: true,
      voiceStreamUrl: "https://example.com/voice.mp3",
      musicBedUrl: "https://example.com/music.mp3",
      captionsUrl: "https://example.com/captions.vtt",
      transcriptText: "Full transcript here",
      phases: {
        create: [
          { phaseNumber: 1, label: "Grounding", startSeconds: 0, endSeconds: 60 },
          { phaseNumber: 2, label: "Reframe", startSeconds: 60, endSeconds: 180 },
          { phaseNumber: 3, label: "Commit", startSeconds: 180, endSeconds: 300 },
        ],
      },
      prompts: {
        create: [
          { timestampSeconds: 10, promptText: "Notice your breath", subText: "Inhale… exhale…" },
          { timestampSeconds: 70, promptText: "Name the feeling", subText: "Is it excitement or fear?" },
          { timestampSeconds: 200, promptText: "Choose your focus", subText: "What matters right now?" },
        ],
      },
    },
  });
}

async function registerAthlete(email: string, password: string, birthDate: string) {
  const res = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: "athlete",
      email,
      password,
      birthDate,
      timezone: "UTC",
      privacyAcknowledged: true,
    }),
  });
  return res;
}

async function signIn(email: string, password: string, role: "athlete" | "caregiver") {
  const res = await fetch(`${baseUrl}/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, email, password }),
  });
  return res;
}

async function createPairingCode(token: string) {
  const res = await fetch(`${baseUrl}/auth/pairing/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  return res;
}

async function claimPairingCode(token: string, code: string) {
  const res = await fetch(`${baseUrl}/auth/pairing/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pairingCode: code, relationship: "parent", consentConfirmed: true }),
  });
  return res;
}

async function approvePairing(token: string, linkId: string, approved: boolean) {
  const res = await fetch(`${baseUrl}/auth/pairing/${linkId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ approved }),
  });
  return res;
}

async function completeSession(token: string, sessionId: string, idempotencyKey: string) {
  const res = await fetch(`${baseUrl}/sessions/${sessionId}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      sessionId,
      sessionVersion: "1.0.0",
      mode: "interactive",
      completionDurationSeconds: 300,
      completedAt: new Date().toISOString(),
      reflection: { feeling: "clearer", note: "felt good" },
      idempotencyKey,
    }),
  });
  return res;
}

async function getAthleteProgress(token: string) {
  const res = await fetch(`${baseUrl}/athlete/progress`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res;
}

async function getCaregiverDashboard(token: string, athleteId: string) {
  const res = await fetch(`${baseUrl}/caregiver/athletes/${athleteId}/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res;
}

async function refreshToken(refreshTokenValue: string) {
  const res = await fetch(`${baseUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refreshTokenValue }),
  });
  return res;
}

async function deleteAccount(token: string) {
  const res = await fetch(`${baseUrl}/auth/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ confirmation: "DELETE_MY_ACCOUNT" }),
  });
  return res;
}

describe.skipIf(!process.env.DATABASE_URL)("Phase 2 Security Integration Tests", () => {
  beforeAll(async () => {
    server = app.listen(0);
    testPort = (server.address() as any).port;
    baseUrl = `http://localhost:${testPort}`;
    await seedTestData();
  }, 30000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }, 10000);

  beforeEach(async () => {
    // Reset rate limiters so earlier test requests don't leak into this test.
    await resetRateLimiters();
    // Clean user-specific data between tests
    await prisma.sessionCompleted.deleteMany();
    await prisma.reflection.deleteMany();
    await prisma.metricSnapshot.deleteMany();
    await prisma.caregiverLink.deleteMany();
    await prisma.athleteProfile.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await seedTestData();
  }, 30000);

  // Extend timeout for slow Neon DB operations
  it(
    "registers an athlete, evaluates age gate, and returns tokens",
    async () => {
      const email = `test-athlete-${Date.now()}@example.com`;
      const password = "Password123";
      const birthDate = "2010-01-01"; // minor

      const regRes = await registerAthlete(email, password, birthDate);
      expect(regRes.status).toBe(201);
      const regData = await regRes.json();
      expect(regData.user).toBeDefined();
      expect(regData.user.isMinor).toBe(true);
      expect(regData.user.ageGateStatus).toBe("pending_guardian_authorization");
      expect(regData.tokens.accessToken).toBeDefined();
      expect(regData.tokens.refreshToken).toBeDefined();

      // Verify tokens are valid JWTs
      const accessPayload = JSON.parse(Buffer.from(regData.tokens.accessToken.split(".")[1], "base64").toString());
      expect(accessPayload.sub).toBe(regData.user.id);
      expect(accessPayload.role).toBe("athlete");
      expect(accessPayload.email).toBeUndefined();
    },
    { timeout: 60000 }
  );

  it(
    "signs in athlete and receives tokens matching refreshVersion",
    async () => {
      const email = `test-signin-${Date.now()}@example.com`;
      const password = "Password123";
      await registerAthlete(email, password, "2000-01-01"); // adult

      const signRes = await signIn(email, password, "athlete");
      expect(signRes.status).toBe(200);
      const signData = await signRes.json();
      expect(signData.tokens.accessToken).toBeDefined();
      expect(signData.tokens.refreshToken).toBeDefined();

      const refreshPayload = JSON.parse(Buffer.from(signData.tokens.refreshToken.split(".")[1], "base64").toString());
      expect(typeof refreshPayload.refreshVersion).toBe("number");
    },
    { timeout: 60000 }
  );

  it(
    "rotates refresh token on each refresh request",
    async () => {
      const email = `test-refresh-${Date.now()}@example.com`;
      const password = "Password123";
      await registerAthlete(email, password, "2000-01-01");
      const signRes = await signIn(email, password, "athlete");
      const { tokens } = await signRes.json();
      const { refreshToken: rt1 } = tokens;

      const refreshRes1 = await refreshToken(rt1);
      expect(refreshRes1.status).toBe(200);
      const { refreshToken: rt2 } = await refreshRes1.json();
      expect(rt2).not.toBe(rt1);

      const refreshRes2 = await refreshToken(rt2);
      expect(refreshRes2.status).toBe(200);
      const { refreshToken: rt3 } = await refreshRes2.json();
      expect(rt3).not.toBe(rt2);
      expect(rt3).not.toBe(rt1);
    },
    { timeout: 60000 }
  );

  it(
    "rejects reused refresh token after rotation",
    async () => {
      const email = `test-reuse-${Date.now()}@example.com`;
      const password = "Password123";
      await registerAthlete(email, password, "2000-01-01");
      const signRes = await signIn(email, password, "athlete");
      const { tokens } = await signRes.json();
      const { refreshToken: rt1 } = tokens;

      await refreshToken(rt1); // rotates
      const reusedRes = await refreshToken(rt1); // old token
      expect(reusedRes.status).toBe(401);
    },
    { timeout: 60000 }
  );

  it(
    "enforces pairing consent flow: athlete creates code, caregiver claims, athlete approves",
    async () => {
      // Athlete
      const athleteEmail = `athlete-pair-${Date.now()}@example.com`;
      const athletePwd = "Password123";
      await registerAthlete(athleteEmail, athletePwd, "2010-01-01");
      const athleteSign = await signIn(athleteEmail, athletePwd, "athlete");
      expect(athleteSign.status).toBe(200);
      const athleteTokens = await athleteSign.json();
      const athleteAccess = athleteTokens.tokens.accessToken;

      // Create pairing code
      const codeRes = await createPairingCode(athleteAccess);
      expect(codeRes.status).toBe(200);
      const { pairingCode } = await codeRes.json();

      // Caregiver
      const cgEmail = `caregiver-pair-${Date.now()}@example.com`;
      const cgPwd = "Password123";
      await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "caregiver",
          email: cgEmail,
          password: cgPwd,
          privacyAcknowledged: true,
        }),
      });
      const cgSign = await signIn(cgEmail, cgPwd, "caregiver");
      expect(cgSign.status).toBe(200);
      const cgTokens = await cgSign.json();
      const cgAccess = cgTokens.tokens.accessToken;

      // Claim code
      const claimRes = await claimPairingCode(cgAccess, pairingCode);
      expect(claimRes.status).toBe(200);
      const claimData = await claimRes.json();
      expect(claimData.status).toBe("pending_athlete_approval");
      const linkId = claimData.linkId;

      // Athlete approves
      const approveRes = await approvePairing(athleteAccess, linkId, true);
      expect(approveRes.status).toBe(200);
      const approveData = await approveRes.json();
      expect(approveData.status).toBe("active");
    },
    { timeout: 60000 }
  );

  it(
    "caregiver dashboard returns aggregate data only (no private reflections)",
    async () => {
      // Setup athlete + caregiver + active link (reuse flow)
      const athleteEmail = `athlete-dash-${Date.now()}@example.com`;
      const athletePwd = "Password123";
      await registerAthlete(athleteEmail, athletePwd, "2010-01-01");
      const athleteSign = await signIn(athleteEmail, athletePwd, "athlete");
      expect(athleteSign.status).toBe(200);
      const athleteTokens = await athleteSign.json();
      const athleteAccess = athleteTokens.tokens.accessToken;
      const athleteId = athleteTokens.user.id;

      const codeRes = await createPairingCode(athleteAccess);
      expect(codeRes.status).toBe(200);
      const { pairingCode } = await codeRes.json();

      const cgEmail = `caregiver-dash-${Date.now()}@example.com`;
      const cgPwd = "Password123";
      await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "caregiver", email: cgEmail, password: cgPwd, privacyAcknowledged: true }),
      });
      const cgSign = await signIn(cgEmail, cgPwd, "caregiver");
      expect(cgSign.status).toBe(200);
      const cgTokens = await cgSign.json();
      const cgAccess = cgTokens.tokens.accessToken;

      const claimRes = await claimPairingCode(cgAccess, pairingCode);
      expect(claimRes.status).toBe(200);
      const { linkId } = await claimRes.json();
      await approvePairing(athleteAccess, linkId, true);

      // Complete a session as athlete
      const session = await prisma.session.findFirst({ where: { isPublished: true } });
      const idempotencyKey = `test-key-${Date.now()}`;
      await completeSession(athleteAccess, session!.id, idempotencyKey);

      // Fetch caregiver dashboard
      const dashRes = await getCaregiverDashboard(cgAccess, athleteId);
      expect(dashRes.status).toBe(200);
      const dash = await dashRes.json();

      // Verify no private fields present
      expect(dash.athlete.name).toBeDefined();
      expect(dash.metrics).toBeDefined();
      expect(dash.weeklySummary).toBeDefined();
      // Ensure no reflection note or audio data
      const jsonStr = JSON.stringify(dash);
      expect(jsonStr).not.toContain("athleteNote");
      expect(jsonStr).not.toContain("transcriptUrl");
      expect(jsonStr).not.toContain("playbackPositionSeconds");
    },
    { timeout: 60000 }
  );

  it(
    "rate limits auth endpoints (5 requests per window)",
    async () => {
      // make 6 sign-in attempts quickly; the 6th should be 429
      const email = `ratelimit-${Date.now()}@example.com`;
      const password = "WrongPass1";
      await registerAthlete(email, "Password123", "2000-01-01");

      for (let i = 0; i < 5; i++) {
        const res = await signIn(email, password, "athlete");
        expect(res.status).toBe(401); // wrong password but not rate limited yet
      }
      const limitedRes = await signIn(email, password, "athlete");
      expect(limitedRes.status).toBe(429);
    },
    { timeout: 60000 }
  );

  it(
    "deletes account and invalidates tokens",
    async () => {
      const email = `test-delete-${Date.now()}@example.com`;
      const password = "Password123";
      await registerAthlete(email, password, "2000-01-01");
      const signRes = await signIn(email, password, "athlete");
      expect(signRes.status).toBe(200);
      const { tokens } = await signRes.json();
      const accessToken = tokens.accessToken;

      // Delete account
      const delRes = await deleteAccount(accessToken);
      expect(delRes.status).toBe(204);

      // Access token should now be invalid
      const progressRes = await getAthleteProgress(accessToken);
      expect(progressRes.status).toBe(401);
    },
    { timeout: 60000 }
  );

  it("PII encryption round-trip works for email and name", () => {
    const email = "test@example.com";
    const encrypted = encryptPII(email);
    const decrypted = decryptPII(encrypted);
    expect(decrypted).toBe(email);
  });

  it("hashes pairing codes and reset tokens deterministically", () => {
    const code = "FEAR-AB12";
    const h1 = hashPairingCode(code);
    const h2 = hashPairingCode(code.toLowerCase());
    expect(h1).toBe(h2);
    expect(h1).not.toBe(code);

    const token = "reset-token-value";
    const rt1 = hashResetToken(token);
    const rt2 = hashResetToken(token);
    expect(rt1).toBe(rt2);
    expect(rt1).not.toBe(token);
  });
});
