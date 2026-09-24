import { describe, expect, it } from "vitest";
import {
  addPlaybackInterval,
  formatClock,
  getActivePhase,
  getCurrentPrompt,
  getPlaybackPercent,
  isCompletionEligible,
  measurePlaybackSeconds,
  mergePlaybackIntervals,
} from "./sessionPlayer";

const phases = [
  { number: 2, label: "Second", startSeconds: 60, endSeconds: 120 },
  { number: 1, label: "First", startSeconds: 0, endSeconds: 60 },
];
const prompts = [
  { timestampSeconds: 45, promptText: "Breathe" },
  { timestampSeconds: 10, promptText: "Notice" },
];

describe("session player utilities", () => {
  it("merges overlapping and near-contiguous playback intervals", () => {
    expect(mergePlaybackIntervals([
      { startSeconds: 10, endSeconds: 20 },
      { startSeconds: 20.5, endSeconds: 30 },
      { startSeconds: 40, endSeconds: 45 },
      { startSeconds: 50, endSeconds: 49 },
    ])).toEqual([
      { startSeconds: 10, endSeconds: 30 },
      { startSeconds: 40, endSeconds: 45 },
    ]);
    expect(measurePlaybackSeconds([{ startSeconds: 0, endSeconds: 10 }, { startSeconds: 9, endSeconds: 20 }])).toBe(20);
  });

  it("adds valid intervals and ignores invalid ranges", () => {
    const initial = [{ startSeconds: 10, endSeconds: 20 }];
    expect(addPlaybackInterval(initial, 19, 25)).toEqual([{ startSeconds: 10, endSeconds: 25 }]);
    expect(addPlaybackInterval(initial, 5, 5)).toEqual(initial);
    expect(addPlaybackInterval(initial, Number.NaN, 10)).toEqual(initial);
  });

  it("selects the active phase and latest prompt independent of input order", () => {
    expect(getActivePhase(phases, 60)?.label).toBe("Second");
    expect(getActivePhase(phases, 120)).toBeNull();
    expect(getCurrentPrompt(prompts, 20)?.promptText).toBe("Notice");
    expect(getCurrentPrompt(prompts, 50)?.promptText).toBe("Breathe");
    expect(getCurrentPrompt(prompts, 5)).toBeNull();
  });

  it("guards completion threshold and formats bounded playback progress", () => {
    expect(isCompletionEligible(80, 100)).toBe(true);
    expect(isCompletionEligible(79.9, 100)).toBe(false);
    expect(isCompletionEligible(100, 0)).toBe(false);
    expect(formatClock(65.4)).toBe("1:05");
    expect(formatClock(-4)).toBe("0:00");
    expect(getPlaybackPercent(50, 100, 200)).toBe(50);
    expect(getPlaybackPercent(300, 0, 200)).toBe(100);
    expect(getPlaybackPercent(10, 0, 0)).toBe(0);
  });
});
