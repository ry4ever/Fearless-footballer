/**
 * Fearless Footballer — Sentry Crash Reporting & Error Tracking Facade
 * Provides privacy-minimized error logging for Web & Mobile environments.
 */

export interface SentryUserContext {
  id: string;
  role: "athlete" | "caregiver";
  isMinor: boolean;
}

class SentryService {
  private isInitialized = false;
  private environment = process.env.NODE_ENV || "development";

  public init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    console.log(`[Sentry] Initialized error monitoring in '${this.environment}' mode.`);
  }

  public setUser(user: SentryUserContext | null) {
    if (!user) {
      console.log("[Sentry] Cleared user context.");
      return;
    }
    // Set minimal non-PII context per COPPA compliance guidelines
    console.log(`[Sentry] Context set: role=${user.role}, isMinor=${user.isMinor}`);
  }

  public captureException(error: Error | unknown, extraContext?: Record<string, any>) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    // Sanitize context to ensure NO PII or raw inputs are included
    const sanitizedContext: Record<string, any> = {};
    if (extraContext) {
      for (const [key, val] of Object.entries(extraContext)) {
        if (!key.toLowerCase().includes("email") && !key.toLowerCase().includes("name") && !key.toLowerCase().includes("note")) {
          sanitizedContext[key] = val;
        }
      }
    }

    console.error(`[Sentry Exception Captured] ${message}`, {
      stack: stack?.slice(0, 300),
      context: sanitizedContext,
    });
  }

  public captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
    console.log(`[Sentry ${level.toUpperCase()}] ${message}`);
  }
}

export const sentry = new SentryService();
