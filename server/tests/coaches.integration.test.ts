import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { app } from "../index";
import { createCoachInvite } from "../lib/coachInvites";

const prisma = new PrismaClient();
let baseUrl: string;
let server: ReturnType<typeof app.listen>;
const stamp = Date.now();

async function call(path: string, options: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function register(role: "athlete" | "caregiver" | "coach", name: string, extra: Record<string, unknown> = {}) {
  return call("/auth/register", {
    body: {
      role,
      fullName: name,
      email: `coach-test-${role}-${name.replace(/\s+/g, "")}-${stamp}@example.test`,
      password: "Password123!",
      privacyAcknowledged: true,
      ...(role === "athlete" ? { birthDate: "2010-05-15", timezone: "Europe/London" } : {}),
      ...extra,
    },
  });
}

/** An athlete with an active, consented parent link. */
async function pairedAthlete(name: string) {
  const athlete = await register("athlete", name);
  const parent = await register("caregiver", `${name} Parent`);
  const profile = await prisma.athleteProfile.findUniqueOrThrow({ where: { userId: athlete.body.user.id } });
  await prisma.caregiverLink.create({
    data: {
      athleteId: profile.id,
      caregiverUserId: parent.body.user.id,
      relationship: "parent",
      status: "ACTIVE",
      coppaConsent: true,
      consentedAt: new Date(),
      athleteApprovedAt: new Date(),
    },
  });
  return { athleteToken: athlete.body.tokens.accessToken as string, parentToken: parent.body.tokens.accessToken as string };
}

describe("Coaches", () => {
  const adminEmail = `coach-test-coach-MarkAdmin-${stamp}@example.test`;

  const sessionIds: string[] = [];

  beforeAll(async () => {
    process.env.COACH_ADMIN_EMAILS = ` other@example.test , ${adminEmail.toUpperCase()} `;
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
    for (const [index, title] of ["Coach Plan One", "Coach Plan Two"].entries()) {
      const session = await prisma.session.create({
        data: {
          version: "1.0.0",
          category: "PERFORMANCE",
          mentorName: "Mark Bowden",
          mentorTitle: "Football Mentor",
          transcriptText: "",
          slug: `coach-plan-${index}-${stamp}`,
          title,
          subtitle: "",
          defaultDuration: 600,
          voiceStreamUrl: "audio/coach/plan.mp3",
          isPublished: true,
          focusArea: "Sharpen Your Game",
          audio: { create: [{ mode: "INTERACTIVE", withMusic: true, url: "audio/coach/plan.mp3", durationSeconds: 600 }] },
        },
      });
      sessionIds.push(session.id);
    }
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { id: { in: sessionIds } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it(
    "invite-only sign-up, parent-approved squad link, progress-only view and a coach's plan",
    async () => {
      // Coach accounts need a valid invite, and each invite works once.
      expect((await register("coach", "No Invite Coach")).status).toBe(422);
      const invite = await createCoachInvite(prisma, { note: "Test coach" });
      const coach = await register("coach", "Coach Carter", { inviteCode: invite.code.toLowerCase() });
      expect(coach.status).toBe(201);
      expect(coach.body.user.role).toBe("coach");
      expect((await register("coach", "Second Coach", { inviteCode: invite.code })).status).toBe(422);
      const coachToken = coach.body.tokens.accessToken as string;

      // Coaches can't use athlete routes and athletes can't use coach routes.
      const squad = await call("/coach/squad", { token: coachToken });
      expect(squad.status).toBe(200);
      expect(squad.body.squadCode).toMatch(/^SQUAD-/);
      expect((await call("/sessions", { token: coachToken })).status).toBe(403);

      const { athleteToken, parentToken } = await pairedAthlete("Squad Player");
      expect((await call("/coach/squad", { token: athleteToken })).status).toBe(403);
      expect((await call("/athlete/coach", { token: athleteToken, body: { squadCode: "SQUAD-NOPE00" } })).status).toBe(404);

      // The athlete asks to join; nothing is visible to the coach until the parent approves.
      const joined = await call("/athlete/coach", { token: athleteToken, body: { squadCode: ` ${squad.body.squadCode.toLowerCase()} ` } });
      expect(joined.status).toBe(201);
      expect(joined.body.coach).toMatchObject({ coachName: "Coach Carter", status: "pending_parent" });
      const linkId = joined.body.coach.id as string;
      expect((await call("/athlete/coach", { token: athleteToken, body: { squadCode: squad.body.squadCode } })).status).toBe(409);

      const pendingSquad = await call("/coach/squad", { token: coachToken });
      const pending = pendingSquad.body.athletes.find((item: { linkId: string }) => item.linkId === linkId);
      expect(pending).toMatchObject({ athleteName: "Squad Player", status: "pending_parent" });
      expect(pending.totalCompletions).toBeUndefined();
      expect((await call(`/coach/athletes/${linkId}`, { token: coachToken })).status).toBe(404);

      // Another family's parent can't approve it.
      const stranger = await register("caregiver", "Other Parent");
      expect(
        (await call(`/caregiver/coaches/${linkId}/decision`, { token: stranger.body.tokens.accessToken, body: { approved: true } })).status,
      ).toBe(404);

      const requests = await call("/caregiver/coaches", { token: parentToken });
      expect(requests.body.coaches).toEqual([
        expect.objectContaining({ id: linkId, coachName: "Coach Carter", athleteName: "Squad Player", status: "pending_parent" }),
      ]);
      expect((await call(`/caregiver/coaches/${linkId}/decision`, { token: parentToken, body: { approved: true } })).body).toEqual({
        status: "active",
      });

      // Now the coach sees progress – and nothing private.
      const detail = await call(`/coach/athletes/${linkId}`, { token: coachToken });
      expect(detail.status).toBe(200);
      expect(detail.body.progress.totalCompletions).toBe(0);
      expect(JSON.stringify(detail.body)).not.toMatch(/reflection|note|email|birth/i);
      expect(detail.body.sessions.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining(sessionIds));

      // The coach's plan: sessions in order, each available session once.
      const badPlan = await call(`/coach/athletes/${linkId}/plan`, { method: "PUT", token: coachToken, body: { sessionIds: ["nope"] } });
      expect(badPlan.status).toBe(422);
      const dupes = await call(`/coach/athletes/${linkId}/plan`, {
        method: "PUT",
        token: coachToken,
        body: { sessionIds: [sessionIds[0], sessionIds[0]] },
      });
      expect(dupes.status).toBe(422);
      const plan = await call(`/coach/athletes/${linkId}/plan`, {
        method: "PUT",
        token: coachToken,
        body: { sessionIds: [sessionIds[1], sessionIds[0]] },
      });
      expect(plan.status).toBe(200);
      const library = await call("/sessions", { token: athleteToken });
      expect(library.body.coachPlan).toMatchObject({ coachName: "Coach Carter", sessionIds: [sessionIds[1], sessionIds[0]] });

      // Leaving the squad ends the coach's access and the plan.
      expect((await call(`/athlete/coach/${linkId}`, { method: "DELETE", token: athleteToken })).status).toBe(204);
      expect((await call(`/coach/athletes/${linkId}`, { token: coachToken })).status).toBe(404);
      expect((await call("/sessions", { token: athleteToken })).body.coachPlan).toBeUndefined();
      expect((await call("/athlete/coach", { token: athleteToken })).body.coach).toBeNull();
    },
    { timeout: 120000 },
  );

  it(
    "Mark (COACH_ADMIN_EMAILS) signs up without an invite and manages invites; other coaches can't",
    async () => {
      const mark = await register("coach", "Mark Admin");
      expect(mark.status).toBe(201);
      const markToken = mark.body.tokens.accessToken as string;
      expect((await call("/coach/squad", { token: markToken })).body.canInviteCoaches).toBe(true);

      const created = await call("/coach/invites", { token: markToken, body: { note: "Coach Jamie" } });
      expect(created.status).toBe(201);
      expect(created.body.inviteCode).toMatch(/^COACH-/);
      const listed = await call("/coach/invites", { token: markToken });
      const open = listed.body.invites.find((invite: { note?: string }) => invite.note === "Coach Jamie");
      expect(open).toMatchObject({ status: "open" });
      expect(JSON.stringify(listed.body)).not.toContain(created.body.inviteCode);

      // The invite works for a new coach, and then shows as used.
      const jamie = await register("coach", "Coach Jamie", { inviteCode: created.body.inviteCode });
      expect(jamie.status).toBe(201);
      const after = (await call("/coach/invites", { token: markToken })).body.invites.find(
        (invite: { id: string }) => invite.id === open.id,
      );
      expect(after).toMatchObject({ status: "used", usedByName: "Coach Jamie" });

      // Other coaches can't see or make invites.
      const jamieToken = jamie.body.tokens.accessToken as string;
      expect((await call("/coach/squad", { token: jamieToken })).body.canInviteCoaches).toBe(false);
      expect((await call("/coach/invites", { token: jamieToken })).status).toBe(403);
      expect((await call("/coach/invites", { token: jamieToken, body: {} })).status).toBe(403);

      // Unused invites can be cancelled; used ones can't.
      const spare = await call("/coach/invites", { token: markToken, body: {} });
      const spareId = (await call("/coach/invites", { token: markToken })).body.invites[0].id as string;
      expect((await call(`/coach/invites/${spareId}`, { method: "DELETE", token: markToken })).status).toBe(204);
      expect((await register("coach", "Too Late", { inviteCode: spare.body.inviteCode })).status).toBe(422);
      expect((await call(`/coach/invites/${open.id}`, { method: "DELETE", token: markToken })).status).toBe(404);
    },
    { timeout: 120000 },
  );
});
