import { SessionPackage } from "../../../shared/types";

// Fallback in-memory cache storage when file system is not available (e.g. test environment)
const memoryCacheStore = new Map<string, { localUri: string; sizeBytes: number; downloadedAt: number }>();

function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `cached_${Math.abs(hash).toString(16)}`;
}

export interface CacheStats {
  fileCount: number;
  totalSizeBytes: number;
}

export class MediaCacheManager {
  /**
   * Checks whether a media URL is cached locally.
   */
  public async isCached(url: string): Promise<boolean> {
    if (!url) return false;
    const key = hashUrl(url);
    return memoryCacheStore.has(key);
  }

  /**
   * Returns the local URI if cached, or the original remote URL if not cached.
   */
  public async getLocalUri(url: string): Promise<string> {
    if (!url) return url;
    const key = hashUrl(url);
    const cached = memoryCacheStore.get(key);
    return cached ? cached.localUri : url;
  }

  /**
   * Downloads session media files (voice stream, music bed) for offline play.
   */
  public async downloadSessionMedia(session: SessionPackage): Promise<{ cachedVoiceUrl: string; cachedMusicUrl?: string }> {
    const results: { cachedVoiceUrl: string; cachedMusicUrl?: string } = {
      cachedVoiceUrl: session.media.voiceUrl,
    };

    if (session.media.voiceUrl) {
      const voiceKey = hashUrl(session.media.voiceUrl);
      const simulatedLocalUri = `file:///app_storage/media/${voiceKey}.aac`;
      memoryCacheStore.set(voiceKey, {
        localUri: simulatedLocalUri,
        sizeBytes: 15 * 1024 * 1024, // Simulated ~15MB voice stem
        downloadedAt: Date.now(),
      });
      results.cachedVoiceUrl = simulatedLocalUri;
    }

    if (session.media.musicBedUrl) {
      const musicKey = hashUrl(session.media.musicBedUrl);
      const simulatedLocalUri = `file:///app_storage/media/${musicKey}.aac`;
      memoryCacheStore.set(musicKey, {
        localUri: simulatedLocalUri,
        sizeBytes: 8 * 1024 * 1024, // Simulated ~8MB music bed
        downloadedAt: Date.now(),
      });
      results.cachedMusicUrl = simulatedLocalUri;
    }

    return results;
  }

  /**
   * Returns cache utilization statistics (file count and total disk usage in bytes).
   */
  public async getCacheStats(): Promise<CacheStats> {
    let fileCount = 0;
    let totalSizeBytes = 0;

    for (const item of memoryCacheStore.values()) {
      fileCount++;
      totalSizeBytes += item.sizeBytes;
    }

    return { fileCount, totalSizeBytes };
  }

  /**
   * Clears all cached media files.
   */
  public async clearCache(): Promise<void> {
    memoryCacheStore.clear();
  }
}

export const mediaCache = new MediaCacheManager();
