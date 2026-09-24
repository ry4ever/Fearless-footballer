import { describe, it, expect, beforeEach } from "vitest";
import { mediaCache } from "./mediaCache";
import { SessionPackage } from "../../../shared/types";

describe("MediaCacheManager", () => {
  beforeEach(async () => {
    await mediaCache.clearCache();
  });

  const mockSession: SessionPackage = {
    id: "session-test-1",
    slug: "calm-pregame-1",
    version: "1.0.0",
    title: "Pregame Composure",
    subtitle: "Settle pre-match nerves",
    category: "calm",
    mindset: "calm",
    defaultDurationSeconds: 300,
    mentor: {
      id: "men_alex",
      name: "Alex Rivera",
      title: "Performance Coach",
    },
    availableModes: ["interactive"] as const,
    media: {
      voiceUrl: "https://cdn.fearlessfootballer.com/voice/calm.aac",
      musicBedUrl: "https://cdn.fearlessfootballer.com/music/ambient.aac",
    },
    phases: [
      { number: 1, label: "Center", startSeconds: 0, endSeconds: 60 },
    ],
    prompts: [
      { timestampSeconds: 10, promptText: "Notice your breath" },
    ],
  };

  it("should report uncached URL initially", async () => {
    const isCached = await mediaCache.isCached(mockSession.media.voiceUrl);
    expect(isCached).toBe(false);

    const localUri = await mediaCache.getLocalUri(mockSession.media.voiceUrl);
    expect(localUri).toBe(mockSession.media.voiceUrl);
  });

  it("should download and cache session media files", async () => {
    const cachedResult = await mediaCache.downloadSessionMedia(mockSession);
    expect(cachedResult.cachedVoiceUrl).toContain("file:///app_storage/media/");
    expect(cachedResult.cachedMusicUrl).toContain("file:///app_storage/media/");

    const isVoiceCached = await mediaCache.isCached(mockSession.media.voiceUrl);
    expect(isVoiceCached).toBe(true);

    const localVoiceUri = await mediaCache.getLocalUri(mockSession.media.voiceUrl);
    expect(localVoiceUri).toEqual(cachedResult.cachedVoiceUrl);
  });

  it("should calculate cache stats accurately", async () => {
    let stats = await mediaCache.getCacheStats();
    expect(stats.fileCount).toBe(0);
    expect(stats.totalSizeBytes).toBe(0);

    await mediaCache.downloadSessionMedia(mockSession);
    stats = await mediaCache.getCacheStats();
    expect(stats.fileCount).toBe(2);
    expect(stats.totalSizeBytes).toBeGreaterThan(0);
  });

  it("should clear cached files on request", async () => {
    await mediaCache.downloadSessionMedia(mockSession);
    let stats = await mediaCache.getCacheStats();
    expect(stats.fileCount).toBe(2);

    await mediaCache.clearCache();
    stats = await mediaCache.getCacheStats();
    expect(stats.fileCount).toBe(0);
    expect(await mediaCache.isCached(mockSession.media.voiceUrl)).toBe(false);
  });
});
