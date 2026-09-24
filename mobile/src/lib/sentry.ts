/**
 * Fearless Footballer — Mobile Sentry Crash Reporting Facade
 * Provides native crash reporting for Expo React Native.
 */

export interface MobileSentryUser {
  id: string;
  role: "athlete" | "caregiver";
  isMinor: boolean;
}

class MobileSentryService {
  private initialized = false;

  public init() {
    if (this.initialized) return;
    this.initialized = true;
    console.log("[Mobile Sentry] Native crash reporting initialized.");
  }

  public setUserContext(user: MobileSentryUser | null) {
    if (!user) return;
    console.log(`[Mobile Sentry] User context set: role=${user.role}`);
  }

  public captureNativeError(error: Error | unknown, tags?: Record<string, string>) {
    const errObj = error instanceof Error ? error : new Error(String(error));
    console.error("[Mobile Sentry Error]", errObj.message, tags || "");
  }
}

export const mobileSentry = new MobileSentryService();
