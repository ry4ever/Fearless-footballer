import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app, createAccessToken } from "../index";
import { encryptPII, hashEmail } from "../lib/pii";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let baseUrl: string;
let server: ReturnType<typeof app.listen>;

describe("Phase 9 — Beta Feedback & Operational Dashboard API", () => {
  let athleteToken: string;
  let caregiverToken: string;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    // Start listening on ephemeral port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    // 1. Register Athlete Account
    const athleteRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "athlete",
        email: `phase9_athlete_${Date.now()}@fearlessfootballer.com`,
        password: "Password123!",
        fullName: "Beta Athlete User",
        birthDate: "2010-05-15",
        timezone: "America/New_York",
        privacyAcknowledged: true,
      }),
    });

    expect(athleteRes.status).toBe(201);
    const athleteData = (await athleteRes.json()) as any;
    athleteToken = athleteData.tokens.accessToken;

    // 2. Register Caregiver Account
    const caregiverRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "caregiver",
        email: `phase9_caregiver_${Date.now()}@fearlessfootballer.com`,
        password: "Password123!",
        fullName: "Beta Caregiver User",
        privacyAcknowledged: true,
      }),
    });

    expect(caregiverRes.status).toBe(201);
    const caregiverData = (await caregiverRes.json()) as any;
    caregiverToken = caregiverData.tokens.accessToken;

    // 3. Mentor admin accounts are provisioned directly, never self-registered.
    const adminEmail = `phase9_admin_${Date.now()}@fearlessfootballer.com`;
    const admin = await prisma.user.create({
      data: {
        email: encryptPII(adminEmail),
        emailHash: hashEmail(adminEmail),
        passwordHash: "not-used-in-this-test",
        role: "MENTOR_ADMIN",
        fullName: encryptPII("Beta Admin User"),
        timezone: "UTC",
      },
    });
    adminUserId = admin.id;
    adminToken = createAccessToken(admin.id, "mentor_admin");
  });

  afterAll(async () => {
    if (adminUserId) {
      await prisma.user.delete({ where: { id: adminUserId } }).catch(() => undefined);
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await prisma.$disconnect();
  });

  it("POST /feedback — should record athlete beta feedback cleanly", async () => {
    const res = await fetch(`${baseUrl}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${athleteToken}`,
      },
      body: JSON.stringify({
        rating: 5,
        category: "bug",
        message: "The composure ring animation is super smooth!",
        appVersion: "1.0.0",
        deviceInfo: "iOS 18.1 / iPhone 15 Pro",
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.status).toBe("received");
    expect(body.id).toBeDefined();

    // Verify record in Prisma database
    const item = await prisma.betaFeedback.findUnique({ where: { id: body.id } });
    expect(item).not.toBeNull();
    expect(item?.rating).toBe(5);
    expect(item?.message).toBe("The composure ring animation is super smooth!");
  });

  it("POST /feedback — should reject unauthenticated feedback submissions", async () => {
    const res = await fetch(`${baseUrl}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Unauthenticated attempt",
      }),
    });

    expect(res.status).toBe(401);
  });

  it("GET /admin/beta-dashboard — should return beta activity metrics to a mentor admin", async () => {
    const res = await fetch(`${baseUrl}/admin/beta-dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.activeBetaUsers).toBeGreaterThan(0);
    expect(body.totalAthletes).toBeGreaterThan(0);
    expect(Array.isArray(body.feedbackItems)).toBe(true);
    expect(body.feedbackItems.length).toBeGreaterThan(0);
  });

  it("GET /admin/beta-dashboard — should forbid caregiver access", async () => {
    const res = await fetch(`${baseUrl}/admin/beta-dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${caregiverToken}`,
      },
    });

    expect(res.status).toBe(403);
  });

  it("POST /admin/sessions — should forbid caregiver access", async () => {
    const res = await fetch(`${baseUrl}/admin/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${caregiverToken}`,
      },
      body: JSON.stringify({ slug: "x", title: "x", voiceStreamUrl: "x" }),
    });

    expect(res.status).toBe(403);
  });

  it("PATCH /admin/sessions/:id/publish — returns 404 for an unknown session instead of crashing", async () => {
    const res = await fetch(`${baseUrl}/admin/sessions/does-not-exist/publish`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isPublished: true }),
    });

    expect(res.status).toBe(404);
  });

  it("GET /admin/beta-dashboard — should forbid unauthorized athlete access", async () => {
    const res = await fetch(`${baseUrl}/admin/beta-dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${athleteToken}`,
      },
    });

    expect(res.status).toBe(403);
  });
});
