/**
 * Fearless Footballer — CDN Media Pipeline Manager
 * Manages signed URL generation, CDN asset delivery, WebP thumbnail variants, and AAC audio streaming.
 */

const CDN_BASE_URL = process.env.VITE_CDN_URL || "https://cdn.fearlessfootballer.com";

export interface MediaAssetOptions {
  signedToken?: string;
  format?: "aac" | "mp3" | "webp" | "jpg";
  quality?: "low" | "medium" | "high";
}

class CdnPipelineManager {
  public getVoiceStreamUrl(path: string, options: MediaAssetOptions = {}): string {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path; // Already absolute URL
    }
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    const tokenParam = options.signedToken ? `?st=${options.signedToken}` : "";
    return `${CDN_BASE_URL}/voice/${cleanPath}${tokenParam}`;
  }

  public getMusicBedUrl(path: string): string {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `${CDN_BASE_URL}/music/${cleanPath}`;
  }

  public getOptimizedImageUrl(path: string, variant: "hero" | "thumbnail" | "avatar" = "thumbnail"): string {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `${CDN_BASE_URL}/images/${variant}/${cleanPath}?fmt=webp`;
  }
}

export const cdnPipeline = new CdnPipelineManager();
