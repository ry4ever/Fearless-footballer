import { sampleSessionPackage } from "../../../shared/sampleSession";
import type {
  AthleteProgress,
  ComposureMetrics,
  ComposureUpdate,
  CompletionSyncResponse,
  ReflectionFeeling,
  SessionCompletion,
  StreakUpdate,
  WeeklyProgress,
} from "../../../shared/types";

const FEELING_VALUES: Record<ReflectionFeeling, number> = {
  clearer: 3,
  steadier: 2,
  more_ready: 1,
};

function partsToDateKey(parts: Intl.DateTimeFormatPart[]) {
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return "1970-01-01";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function getLocalDateKey(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    return partsToDateKey(parts);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function utcDateKey(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function shiftLocalDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return utcDateKey(year, month, day + days);
}

function uniqueCompletions(completions: SessionCompletion[]) {
  const unique = new Map<string, SessionCompletion>();
  for (const completion of completions) {
    const key = completion.idempotencyKey || completion.id;
    const current = unique.get(key);
    if (!current || completion.completedAt > current.completedAt) {
      unique.set(key, completion);
    }
  }
  return [...unique.values()].sort(
    (left, right) => left.completedAt.localeCompare(right.completedAt),
  );
}

function calculateStreaks(completionDays: Set<string>, todayKey: string) {
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...completionDays].sort()) {
    run = previous && shiftLocalDateKey(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  const endedYesterday = completionDays.has(shiftLocalDateKey(todayKey, -1));
  let current = 0;
  let anchor = completionDays.has(todayKey)
    ? todayKey
    : endedYesterday
      ? shiftLocalDateKey(todayKey, -1)
      : null;
  while (anchor && completionDays.has(anchor)) {
    current += 1;
    anchor = shiftLocalDateKey(anchor, -1);
  }

  return { currentStreakDays: current, bestStreakDays: best };
}

function completionUsesSession(
  completion: SessionCompletion,
  sessionId: string,
) {
  return completion.sessionId === sessionId;
}

export function calculateComposureMetrics(
  completions: SessionCompletion[],
  timezone: string,
  now = new Date(),
): ComposureMetrics {
  const unique = uniqueCompletions(completions);
  const todayKey = getLocalDateKey(now, timezone);
  const completionDays = new Set(
    unique.map((completion) => getLocalDateKey(new Date(completion.completedAt), timezone)),
  );
  const streak = calculateStreaks(completionDays, todayKey);
  const sevenDayPattern = Array.from({ length: 7 }, (_, index) => {
    const dateKey = shiftLocalDateKey(todayKey, index - 6);
    return completionDays.has(dateKey);
  });
  const currentWeekStart = shiftLocalDateKey(todayKey, -6);
  const weeklyCompletions = unique.filter((completion) => {
    const completionDay = getLocalDateKey(new Date(completion.completedAt), timezone);
    return completionDay >= currentWeekStart && completionDay <= todayKey;
  });
  const reflectionCheckIns = unique.filter((completion) => completion.reflection).length;
  const weeklyReflectionCheckIns = weeklyCompletions.filter(
    (completion) => completion.reflection,
  ).length;
  const streakBonus = streak.currentStreakDays >= 7 ? 3 : streak.currentStreakDays >= 3 ? 1 : 0;
  const score = Math.max(0, unique.length * 2 + reflectionCheckIns + streakBonus);
  const deltaWeekly = weeklyCompletions.length * 2 + weeklyReflectionCheckIns;

  return {
    score,
    deltaWeekly,
    ...streak,
    weeklyTargetDays: 7,
    weeklyCompletedDays: sevenDayPattern.filter(Boolean).length,
    sevenDayPattern,
  };
}

export function calculateAthleteProgress(
  completions: SessionCompletion[],
  athleteId: string,
  athleteName: string,
  timezone: string,
  now = new Date(),
): AthleteProgress {
  const metrics = calculateComposureMetrics(completions, timezone, now);
  const unique = uniqueCompletions(completions);
  const todayKey = getLocalDateKey(now, timezone);
  const lastRep = unique.at(-1);
  const recentCheckIns = unique
    .slice(-7)
    .map((completion) => completion.reflection?.feeling)
    .filter((feeling): feeling is ReflectionFeeling => Boolean(feeling))
    .map((feeling) => FEELING_VALUES[feeling]);
  const lastRepSession = lastRep
    ? sampleSessionPackage.id === lastRep.sessionId
      ? sampleSessionPackage
      : null
    : null;

  return {
    ...metrics,
    athleteId,
    athleteName,
    lastRep: lastRep
      ? {
          title: lastRepSession?.title ?? "Completed rehearsal",
          duration: lastRepSession
            ? `${Math.round(lastRepSession.defaultDurationSeconds / 60)} min`
            : `${Math.round(lastRep.durationSeconds / 60)} min`,
          completedAt: lastRep.completedAt,
          completedToday:
            getLocalDateKey(new Date(lastRep.completedAt), timezone) === todayKey,
        }
      : {
          title: "No completed reps",
          duration: "0 min",
          completedAt: "",
          completedToday: false,
        },
    moodTrend: {
      status: recentCheckIns.length ? "Private check-ins recorded" : "No check-ins yet",
      subtitle: "Reflection details remain private to the athlete.",
      trendValues: recentCheckIns,
    },
  };
}

export function buildCompletionSyncResponse(
  previous: ComposureMetrics,
  next: ComposureMetrics,
): CompletionSyncResponse {
  const streak: StreakUpdate = {
    currentStreakDays: next.currentStreakDays,
    bestStreakDays: next.bestStreakDays,
    isNewMilestone:
      next.bestStreakDays > previous.bestStreakDays ||
      (next.currentStreakDays > 0 &&
        next.currentStreakDays % 7 === 0 &&
        previous.currentStreakDays !== next.currentStreakDays),
  };
  const composure: ComposureUpdate = {
    previousScore: previous.score,
    newScore: next.score,
    delta: next.score - previous.score,
  };
  const weeklyProgress: WeeklyProgress = {
    completedDays: next.weeklyCompletedDays,
    targetDays: next.weeklyTargetDays,
    sevenDayPattern: next.sevenDayPattern,
  };

  return { completionId: "", streak, composure, weeklyProgress };
}

export function isCompletionForSession(
  completion: SessionCompletion,
  sessionId: string,
) {
  return completionUsesSession(completion, sessionId);
}
