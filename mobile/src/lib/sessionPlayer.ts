import type { SessionPhase, SessionPrompt, SessionPackage } from "../../../shared/types";

export const COMPLETION_THRESHOLD = 0.8;

export interface PlaybackInterval {
  startSeconds: number;
  endSeconds: number;
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function addPlaybackInterval(
  intervals: PlaybackInterval[],
  startSeconds: number,
  endSeconds: number,
) {
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
    return intervals;
  }

  const next = intervals.map((interval) => ({ ...interval }));
  const start = Math.max(0, startSeconds);
  const end = Math.max(start, endSeconds);
  let inserted = false;

  for (let index = 0; index < next.length; index += 1) {
    const interval = next[index];
    if (start <= interval.endSeconds + 0.75 && end >= interval.startSeconds - 0.75) {
      interval.startSeconds = Math.min(interval.startSeconds, start);
      interval.endSeconds = Math.max(interval.endSeconds, end);
      inserted = true;
      break;
    }
  }

  if (!inserted) next.push({ startSeconds: start, endSeconds: end });

  return mergePlaybackIntervals(next);
}

export function mergePlaybackIntervals(intervals: PlaybackInterval[]) {
  const ordered = [...intervals]
    .filter(
      (interval) =>
        Number.isFinite(interval.startSeconds) &&
        Number.isFinite(interval.endSeconds) &&
        interval.endSeconds > interval.startSeconds,
    )
    .sort((left, right) => left.startSeconds - right.startSeconds);
  const merged: PlaybackInterval[] = [];

  for (const interval of ordered) {
    const previous = merged.at(-1);
    if (previous && interval.startSeconds <= previous.endSeconds + 0.75) {
      previous.endSeconds = Math.max(previous.endSeconds, interval.endSeconds);
    } else {
      merged.push({ ...interval });
    }
  }

  return merged;
}

export function measurePlaybackSeconds(intervals: PlaybackInterval[]) {
  return mergePlaybackIntervals(intervals).reduce(
    (total, interval) => total + interval.endSeconds - interval.startSeconds,
    0,
  );
}

export function getActivePhase(phases: SessionPhase[], currentTime: number) {
  return (
    [...phases]
      .sort((left, right) => left.startSeconds - right.startSeconds)
      .find(
        (phase) =>
          currentTime >= phase.startSeconds && currentTime < phase.endSeconds,
      ) ?? null
  );
}

export function getCurrentPrompt(prompts: SessionPrompt[], currentTime: number) {
  return (
    [...prompts]
      .sort((left, right) => left.timestampSeconds - right.timestampSeconds)
      .filter((prompt) => currentTime >= prompt.timestampSeconds)
      .at(-1) ?? null
  );
}

export function isCompletionEligible(
  playbackSeconds: number,
  defaultDurationSeconds: number,
) {
  return (
    Number.isFinite(playbackSeconds) &&
    Number.isFinite(defaultDurationSeconds) &&
    defaultDurationSeconds > 0 &&
    playbackSeconds >= defaultDurationSeconds * COMPLETION_THRESHOLD
  );
}

export function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function getPlaybackPercent(
  currentTime: number,
  duration: number,
  fallbackDuration: number,
) {
  const denominator = duration > 0 ? duration : fallbackDuration;
  return denominator > 0 ? clamp((currentTime / denominator) * 100, 0, 100) : 0;
}

export function getSessionMetadata(
  session: SessionPackage | null,
  sessionId: string,
) {
  return session?.id === sessionId ? session : null;
}
