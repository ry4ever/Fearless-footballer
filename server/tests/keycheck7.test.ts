import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { app } from "../index";
import { resetRateLimiters } from "../lib/security";

let testPort: number;
let baseUrl: string;
let server: ReturnType<typeof app.listen>;

describe("Rate limiter key check 7", () => {
  beforeAll(async () => {
    server = app.listen(0);
    testPort = (server.address() as any).port;
    baseUrl = `http://localhost:${testPort}`;
  }, 30000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }, 10000);

  beforeEach(async () => {
    await resetRateLimiters();
  });

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

  it("test B: 1 sign-in after resetAll", async () => {
    const res = await fetch(`${baseUrl}/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "athlete", email: `b-${Date.now()}@example.com`, password: "Wrong" }),
    });
    console.log(`  B attempt: status=${res.status}`);
    expect(res.status).toBe(401);
  }, 15000);
});
