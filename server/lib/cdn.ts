import crypto from "crypto";

const CDN_BASE_URL = process.env.CDN_BASE_URL || "https://cdn.fearlessfootballer.com";
const CDN_SIGNING_SECRET = process.env.JWT_ACCESS_SECRET || "fallback-cdn-signing-secret";

export interface SignedUrlResult {
  url: string;
  token: string;
  expiresAt: number;
}

/**
 * Generates an HMAC-SHA256 signed URL token for streaming session media assets.
 * @param mediaPath Path to media asset (e.g., "voice/calm_pregame_v1.aac")
 * @param ttlSeconds Token time-to-live in seconds (default: 3600 = 1 hour)
 */
export function generateSignedMediaUrl(mediaPath: string, ttlSeconds: number = 3600): SignedUrlResult {
  const cleanPath = mediaPath.startsWith("/") ? mediaPath.slice(1) : mediaPath;
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

  const payload = `${cleanPath}:${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", CDN_SIGNING_SECRET)
    .update(payload)
    .digest("hex");

  const token = `${expiresAt}.${signature}`;
  const url = `${CDN_BASE_URL}/${cleanPath}?st=${token}`;

  return { url, token, expiresAt };
}

/**
 * Verifies if a signed URL token is valid and has not expired.
 */
export function verifySignedMediaToken(mediaPath: string, token: string): boolean {
  if (!token || !token.includes(".")) {
    return false;
  }

  const cleanPath = mediaPath.startsWith("/") ? mediaPath.slice(1) : mediaPath;
  const [expiresStr, signature] = token.split(".");
  const expiresAt = parseInt(expiresStr, 10);

  if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) {
    return false; // Expired or invalid timestamp
  }

  const payload = `${cleanPath}:${expiresAt}`;
  const expectedSignature = crypto
    .createHmac("sha256", CDN_SIGNING_SECRET)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"));
}

/**
 * Formats optimized CDN image URLs with WebP variant support.
 */
export function getOptimizedCdnImageUrl(imagePath: string, variant: "hero" | "thumbnail" | "avatar" = "thumbnail"): string {
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  const cleanPath = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
  return `${CDN_BASE_URL}/images/${variant}/${cleanPath}?fmt=webp`;
}
