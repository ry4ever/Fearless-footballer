import { describe, expect, it } from "vitest";
import { BASELINE_SCORE, computeAthleteMetrics, localDayKey } from "../lib/metrics";

const at = (iso: string, hasReflection = false) => ({ completedAt: new Date(iso), hasReflection });

describe("computeAthleteMetrics", () => {
  it("returns the baseline for an athlete with no reps", () => {
    const metrics = computeAthleteMetrics([], "UTC", new Date("2026-09-27T12:00:00Z"));
    expect(metrics.score).toBe(BASELINE_SCORE);
    expect(metrics.currentStreak).toBe(0);
    expect(metrics.bestStreak).toBe(0);
    expect(metrics.sevenDayPattern).toEqual([false, false, false, false, false, false, false]);
  });

  it("is deterministic: the same history always yields the same score", () => {
    const history = [at("2026-09-25T10:00:00Z"), at("2026-09-26T10:00:00Z", true)];
    const now = new Date("2026-09-27T12:00:00Z");
    const first = computeAthleteMetrics(history, "UTC", now);
    const second = computeAthleteMetrics(history, "UTC", now);
    expect(second.score).toBe(first.score);
  });

  it("does not grow faster with each rep (no compounding)", () => {
    const now = new Date("2026-09-27T20:00:00Z");
    const days = ["21", "22", "23", "24", "25", "26", "27"].map((d) => at(`2026-09-${d}T10:00:00Z`));
    const scores = days.map((_, index) => computeAthleteMetrics(days.slice(0, index + 1), "UTC", now).score);
    for (const score of scores) expect(score).toBeLessThanOrEqual(100);
    // Seven straight days with no reflection: 70 + 7*3 + 7 = 98.
    expect(scores[6]).toBe(98);
  });

  it("keeps the streak alive when today's rep is not done yet", () => {
    const history = [at("2026-09-25T10:00:00Z"), at("2026-09-26T10:00:00Z")];
    const metrics = computeAthleteMetrics(history, "UTC", new Date("2026-09-27T08:00:00Z"));
    expect(metrics.currentStreak).toBe(2);
  });

  it("breaks the streak after a missed day", () => {
    const history = [at("2026-09-24T10:00:00Z"), at("2026-09-25T10:00:00Z")];
    const metrics = computeAthleteMetrics(history, "UTC", new Date("2026-09-27T08:00:00Z"));
    expect(metrics.currentStreak).toBe(0);
    expect(metrics.bestStreak).toBe(2);
  });

  it("uses the athlete's timezone for day boundaries", () => {
    // 02:00 UTC on the 27th is still the evening of the 26th in New York.
    const history = [at("2026-09-26T14:00:00Z"), at("2026-09-27T02:00:00Z")];
    const now = new Date("2026-09-27T03:00:00Z");
    expect(computeAthleteMetrics(history, "America/New_York", now).activeDaysLast7).toBe(1);
    expect(computeAthleteMetrics(history, "UTC", now).activeDaysLast7).toBe(2);
    expect(localDayKey(now, "America/New_York")).toBe("2026-09-26");
  });

  it("falls back to UTC for an unknown timezone", () => {
    const metrics = computeAthleteMetrics([at("2026-09-27T10:00:00Z")], "Not/AZone", new Date("2026-09-27T12:00:00Z"));
    expect(metrics.activeDaysLast7).toBe(1);
  });

  it("covers the full trailing 7 days in the pattern, not just since Monday", () => {
    // 2026-09-27 is a Sunday; the 21st (Monday) through the 27th, plus the 22nd.
    const history = [at("2026-09-21T10:00:00Z"), at("2026-09-27T10:00:00Z")];
    const metrics = computeAthleteMetrics(history, "UTC", new Date("2026-09-27T12:00:00Z"));
    expect(metrics.sevenDayPattern).toEqual([true, false, false, false, false, false, true]);
    expect(metrics.weekStartKey).toBe("2026-09-21");
  });

  it("reports a weekly delta and a 7-day trend", () => {
    const history = [at("2026-09-26T10:00:00Z", true), at("2026-09-27T10:00:00Z")];
    const metrics = computeAthleteMetrics(history, "UTC", new Date("2026-09-27T12:00:00Z"));
    expect(metrics.scoreWeekAgo).toBe(BASELINE_SCORE);
    expect(metrics.score).toBeGreaterThan(metrics.scoreWeekAgo);
    expect(metrics.scoreTrend).toHaveLength(7);
    expect(metrics.scoreTrend[6]).toBe(metrics.score);
  });

  it("ignores completions stamped in the future", () => {
    const metrics = computeAthleteMetrics([at("2026-10-05T10:00:00Z")], "UTC", new Date("2026-09-27T12:00:00Z"));
    expect(metrics.activeDaysLast7).toBe(0);
  });
});
