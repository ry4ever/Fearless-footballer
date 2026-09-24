import { describe, expect, it } from "vitest";
import type { SessionCompletion } from "../../../shared/types";
import {
  buildCompletionSyncResponse,
  calculateAthleteProgress,
  calculateComposureMetrics,
  getLocalDateKey,
  isCompletionForSession,
} from "./metrics";

function completion(overrides: Partial<SessionCompletion> = {}): SessionCompletion {
  return {
    id: "completion_1",
    sessionId: "session_1",
    sessionVersion: "v1",
    mode: "interactive",
    durationSeconds: 120,
    completedAt: "2026-09-21T12:00:00.000Z",
    ...overrides,
  };
}

describe("metrics", () => {
  it("uses the configured timezone when deriving a local date", () => {
    const instant = new Date("2026-09-22T00:30:00.000Z");
    expect(getLocalDateKey(instant, "America/Los_Angeles")).toBe("2026-09-21");
    expect(getLocalDateKey(instant, "Asia/Tokyo")).toBe("2026-09-22");
  });

  it("deduplicates idempotent completions and calculates streaks", () => {
    const now = new Date("2026-09-21T12:00:00.000Z");
    const completions = [
      completion({ id: "old", idempotencyKey: "same", completedAt: "2026-09-19T12:00:00.000Z" }),
      completion({ id: "new", idempotencyKey: "same", completedAt: "2026-09-20T12:00:00.000Z", reflection: { feeling: "clearer" } }),
      completion({ id: "today", idempotencyKey: "today", completedAt: "2026-09-21T12:00:00.000Z", reflection: { feeling: "steadier" } }),
    ];

    expect(calculateComposureMetrics(completions, "UTC", now)).toMatchObject({
      score: 6,
      deltaWeekly: 6,
      currentStreakDays: 2,
      bestStreakDays: 2,
      weeklyCompletedDays: 2,
      weeklyTargetDays: 7,
      sevenDayPattern: [false, false, false, false, false, true, true],
    });
  });

  it("does not count completions outside the rolling seven-day window", () => {
    const now = new Date("2026-09-21T12:00:00.000Z");
    const metrics = calculateComposureMetrics([
      completion({ id: "old", completedAt: "2026-09-10T12:00:00.000Z" }),
      completion({ id: "recent", completedAt: "2026-09-18T12:00:00.000Z" }),
    ], "UTC", now);

    expect(metrics.weeklyCompletedDays).toBe(1);
    expect(metrics.deltaWeekly).toBe(2);
    expect(metrics.score).toBe(4);
  });

  it("builds athlete progress and keeps reflection details private", () => {
    const progress = calculateAthleteProgress(
      [completion({ reflection: { feeling: "more_ready", note: "private" } })],
      "athlete_1",
      "Alex",
      "UTC",
      new Date("2026-09-21T12:00:00.000Z"),
    );

    expect(progress.athleteId).toBe("athlete_1");
    expect(progress.athleteName).toBe("Alex");
    expect(progress.lastRep.completedToday).toBe(true);
    expect(progress.moodTrend.status).toBe("Private check-ins recorded");
    expect(progress.moodTrend.trendValues).toEqual([1]);
    expect(JSON.stringify(progress)).not.toContain('"note"');
  });

  it("builds sync deltas and identifies the relevant session", () => {
    const previous = calculateComposureMetrics([], "UTC");
    const next = calculateComposureMetrics([completion()], "UTC", new Date("2026-09-21T12:00:00.000Z"));
    const response = buildCompletionSyncResponse(previous, next);

    expect(response.composure).toEqual({ previousScore: 0, newScore: 2, delta: 2 });
    expect(response.weeklyProgress.completedDays).toBe(1);
    expect(isCompletionForSession(completion(), "session_1")).toBe(true);
    expect(isCompletionForSession(completion(), "other")).toBe(false);
  });
});
