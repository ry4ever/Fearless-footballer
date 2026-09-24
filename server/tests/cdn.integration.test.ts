import { describe, it, expect } from "vitest";
import { generateSignedMediaUrl, verifySignedMediaToken, getOptimizedCdnImageUrl } from "../lib/cdn";

describe("CDN Signed URL & Image Optimization Engine", () => {
  const samplePath = "voice/pregame_composure_v1.aac";

  it("should generate valid HMAC-SHA256 signed URL tokens", () => {
    const result = generateSignedMediaUrl(samplePath, 3600);
    expect(result.url).toContain("st=");
    expect(result.token).toContain(".");
    expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("should verify valid signed URL tokens for exact asset paths", () => {
    const result = generateSignedMediaUrl(samplePath, 3600);
    const isValid = verifySignedMediaToken(samplePath, result.token);
    expect(isValid).toBe(true);
  });

  it("should reject tampered or mismatched asset paths", () => {
    const result = generateSignedMediaUrl(samplePath, 3600);
    const isValid = verifySignedMediaToken("voice/tampered_path.aac", result.token);
    expect(isValid).toBe(false);
  });

  it("should reject expired signed URL tokens", () => {
    // Generate token with negative TTL (expired 10 seconds ago)
    const result = generateSignedMediaUrl(samplePath, -10);
    const isValid = verifySignedMediaToken(samplePath, result.token);
    expect(isValid).toBe(false);
  });

  it("should format WebP optimized CDN image URLs", () => {
    const heroUrl = getOptimizedCdnImageUrl("hero_pitch.png", "hero");
    expect(heroUrl).toContain("/images/hero/hero_pitch.png?fmt=webp");

    const avatarUrl = getOptimizedCdnImageUrl("alex_rivera.png", "avatar");
    expect(avatarUrl).toContain("/images/avatar/alex_rivera.png?fmt=webp");
  });
});
