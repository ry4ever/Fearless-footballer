type EventCategory = "session" | "navigation" | "mindset" | "auth" | "offline" | "error";

export interface AnalyticsEvent {
  name: string;
  category: EventCategory;
  timestamp: string;
  payload?: Record<string, string | number | boolean>;
}

class ObservabilityManager {
  private events: AnalyticsEvent[] = [];
  private isProduction = process.env.NODE_ENV === "production";

  public trackEvent(name: string, category: EventCategory, payload?: Record<string, string | number | boolean>) {
    // Sanitize payload to guarantee NO PII or private text is ever logged
    const sanitizedPayload: Record<string, string | number | boolean> = {};
    if (payload) {
      for (const [key, value] of Object.entries(payload)) {
        if (key.toLowerCase().includes("note") || key.toLowerCase().includes("email") || key.toLowerCase().includes("name") || key.toLowerCase().includes("text")) {
          continue; // Omit PII / free text
        }
        sanitizedPayload[key] = value;
      }
    }

    const event: AnalyticsEvent = {
      name,
      category,
      timestamp: new Date().toISOString(),
      payload: Object.keys(sanitizedPayload).length > 0 ? sanitizedPayload : undefined,
    };

    this.events.push(event);

    if (!this.isProduction) {
      console.log(`[Analytics Tracked] ${category.toUpperCase()}:${name}`, event.payload || "");
    }

    // Keep last 100 events locally for debugging
    if (this.events.length > 100) {
      this.events.shift();
    }
  }

  public reportError(error: Error | string, context?: Record<string, any>) {
    const errorMessage = typeof error === "string" ? error : error.message;
    console.error(`[Observability Error] ${errorMessage}`, context || "");

    this.trackEvent("error_occurred", "error", {
      message: errorMessage.slice(0, 100),
      ...(context?.component ? { component: context.component } : {}),
    });
  }

  public getRecentEvents(): AnalyticsEvent[] {
    return [...this.events];
  }
}

export const observability = new ObservabilityManager();
