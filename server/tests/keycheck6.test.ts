import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { app } from "../index";
import { resetRateLimiters } from "../lib/security";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function seedTestData() {
  await prisma.session.create({
    data: {
      slug: `nerves-equals-performance-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

let testPort: number;
let baseUrl: string;
let server: ReturnType<typeof app.listen>;

describe("Rate limiter key check 6", () => {
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
    await prisma.sessionCompleted.deleteMany();
    await prisma.reflection.deleteMany();
    await prisma.metricSnapshot.deleteMany();
    await prisma.caregiverLink.deleteMany();
    await prisma.athleteProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.auditLog.deleteMany();
    await seedTestData();
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
