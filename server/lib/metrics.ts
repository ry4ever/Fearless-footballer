/**
 * Deterministic athlete progress metrics.
 *
 * Everything here is derived from the completion history alone, so the same
 * history always produces the same numbers regardless of how often a
 * dashboard is viewed. Day boundaries follow the athlete's own timezone.
 */

export interface CompletionRecord {
  completedAt: Date;
  hasReflection: boolean;
}

export interface AthleteMetrics {
  /** Distinct active days in the 7 local days ending today. */
  activeDaysLast7: number;
  /** Oldest → newest, the 7 local days ending today. */
  sevenDayPattern: boolean[];
  /** Consecutive active days ending today, or yesterday if today is not done yet. */
  currentStreak: number;
  bestStreak: number;
  score: number;
  /** Score as it stood 7 days ago. */
  scoreWeekAgo: number;
  /** Score at the end of each of the 7 local days ending today. */
  scoreTrend: number[];
  /** Local Monday (YYYY-MM-DD) of the week containing `now`. */
  weekStartKey: string;
}

export const BASELINE_SCORE = 70;
const DAY_MS = 24 * 60 * 60 * 1000;

function resolveTimezone(timezone: string | null | undefined): string {
  if (!timezone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

/** YYYY-MM-DD for `date` as seen in `timezone`. */
export function localDayKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Day keys are calendar dates, so arithmetic on them is done in UTC. */
function shiftDayKey(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function dayKeyDiff(later: string, earlier: string): number {
  return Math.round(
    (new Date(`${later}T00:00:00.000Z`).getTime() -
      new Date(`${earlier}T00:00:00.000Z`).getTime()) /
      DAY_MS
  );
}

function streakEndingOn(activeDays: Set<string>, endKey: string): number {
  let streak = 0;
  let cursor = endKey;
  while (activeDays.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

/**
 * Composure score as of the end of `todayKey`:
 * baseline + 3 per active day in the trailing 7 days (max 21)
 *          + 1 per streak day (max 7)
 *          + 2 if any rep in the trailing 7 days had a reflection.
 * Range is BASELINE_SCORE..100.
 */
function scoreAsOf(
  activeDays: Set<string>,
  reflectionDays: Set<string>,
  todayKey: string
): number {
  const window = Array.from({ length: 7 }, (_, index) =>
    shiftDayKey(todayKey, -index)
  );
  const active = window.filter(key => activeDays.has(key)).length;
  const reflected = window.some(key => reflectionDays.has(key));
  const streak = activeDays.has(todayKey)
    ? streakEndingOn(activeDays, todayKey)
    : streakEndingOn(activeDays, shiftDayKey(todayKey, -1));
  const score =
    BASELINE_SCORE + active * 3 + Math.min(streak, 7) + (reflected ? 2 : 0);
  return Math.min(100, Math.max(0, score));
}

export function computeAthleteMetrics(
  completions: CompletionRecord[],
  timezone: string | null | undefined,
  now: Date
): AthleteMetrics {
  const tz = resolveTimezone(timezone);
  const todayKey = localDayKey(now, tz);

  // Ignore completions stamped in the future relative to `now`.
  const past = completions.filter(
    completion => completion.completedAt.getTime() <= now.getTime()
  );
  const activeDays = new Set(
    past.map(completion => localDayKey(completion.completedAt, tz))
  );
  const reflectionDays = new Set(
    past
      .filter(completion => completion.hasReflection)
      .map(completion => localDayKey(completion.completedAt, tz))
  );

  const last7Keys = Array.from({ length: 7 }, (_, index) =>
    shiftDayKey(todayKey, index - 6)
  );
  const sevenDayPattern = last7Keys.map(key => activeDays.has(key));

  const currentStreak = activeDays.has(todayKey)
    ? streakEndingOn(activeDays, todayKey)
    : streakEndingOn(activeDays, shiftDayKey(todayKey, -1));

  let bestStreak = 0;
  let run = 0;
  let previous: string | undefined;
  for (const key of Array.from(activeDays).sort()) {
    run = previous && dayKeyDiff(key, previous) === 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = key;
  }

  const dayOfWeek = new Date(`${todayKey}T00:00:00.000Z`).getUTCDay() || 7;

  return {
    activeDaysLast7: sevenDayPattern.filter(Boolean).length,
    sevenDayPattern,
    currentStreak,
    bestStreak,
    score: scoreAsOf(activeDays, reflectionDays, todayKey),
    scoreWeekAgo: scoreAsOf(
      activeDays,
      reflectionDays,
      shiftDayKey(todayKey, -7)
    ),
    scoreTrend: last7Keys.map(key =>
      scoreAsOf(activeDays, reflectionDays, key)
    ),
    weekStartKey: shiftDayKey(todayKey, 1 - dayOfWeek),
  };
}
