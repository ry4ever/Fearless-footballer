import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { app } from "../index";

let testPort: number; let baseUrl: string; let server: ReturnType<typeof app.listen>;
describe("Rate limiter key check 11", () => {
  beforeAll(async () => { server = app.listen(0); testPort = (server.address() as any).port; baseUrl = `http://localhost:${testPort}`; }, 30000);
  afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); }, 10000);
  beforeEach(() => {});
  it("test A: 5 sign-ins", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/auth/sign-in`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${i}` }, body: JSON.stringify({ role: "athlete", email: `a-${Date.now()}-${i}@example.com`, password: "Wrong" }) });
      console.log(`A${i+1}=${res.status}`);
    }
  }, 15000);
  it("test B: 5 sign-ins after test A", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/auth/sign-in`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${i+100}` }, body: JSON.stringify({ role: "athlete", email: `b-${Date.now()}-${i}@example.com`, password: "Wrong" }) });
      console.log(`B${i+1}=${res.status}`);
    }
  }, 15000);
});
