import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { app } from "../index";
import { resetRateLimiters } from "../lib/security";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

let testPort: number;
let baseUrl: string;
let server: ReturnType<typeof app.listen>;

describe("Rate limiter key check 5", () => {
  beforeAll(async () => {
    server = app.listen(0);
    testPort = (server.address() as any).port;
    baseUrl = `http://localhost:${testPort}`;
  }, 30000);
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }, 10000);
  beforeEach(async () => {
    await resetRateLimiters();
    // Clean user-specific data between tests
    await prisma.sessionCompleted.deleteMany();
    await prisma.reflection.deleteMany();
    await prisma.metricSnapshot.deleteMany();
    await prisma.caregiverLink.deleteMany();
    await prisma.athleteProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.auditLog.deleteMany();
    // Comment out seeding for now
    // await seedTestData();
  }, 15000);

  it("test A: 2 sign-ins", async () => {
    for (let i = 0; i < 2; i++) {
      const res = await fetch(`${baseUrl}/auth/sign-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "athlete", email: `a-${Date.now()}-${i}@example.com`, password: "Wrong" }),
      });
      console.log(`  A attempt ${i+1}: status=${res.status}`);
    }
    expect(true).toBe(true);
  }, 15000);

  it("test B: 1 sign-in after await reset", async () => {
    const res = await fetch(`${baseUrl}/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "athlete", email: `b-${Date.now()}@example.com`, password: "Wrong" }),
    });
    console.log(`  B attempt: status=${res.status}`);
    expect(res.status).toBe(401);
  }, 15000);
});
