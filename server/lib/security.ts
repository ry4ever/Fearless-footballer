import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { MemoryStore, rateLimit } from "express-rate-limit";
import { z } from "zod";

const app = express();

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or fewer")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/\d/, "Password must contain at least one number");

const authStore = new MemoryStore();
const globalStore = new MemoryStore();

const authLimiter = rateLimit({
  store: authStore,
  windowMs: Number.parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS ?? "900000", 10) || 15 * 60 * 1000,
  limit: Number.parseInt(process.env.RATE_LIMIT_AUTH_LIMIT ?? "5", 10) || 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again later." },
});

const globalLimiter = rateLimit({
  store: globalStore,
  windowMs: Number.parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS ?? "900000", 10) || 15 * 60 * 1000,
  limit: Number.parseInt(process.env.RATE_LIMIT_GLOBAL_LIMIT ?? "100", 10) || 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const corsOrigin =
  process.env.CORS_ORIGIN ??
  process.env.CORS_ORIGINS ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");

// In production the origin is never "*", so only origins explicitly listed are
// reflected back to the client. A comma-separated list is accepted.
const allowedOrigins = corsOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin && origin !== "*");

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin / non-browser requests
  return allowedOrigins.includes(origin);
}

function isProductionPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length < 16 ||
    normalized.includes("change-me") ||
    normalized.includes("your-") ||
    normalized.includes("example") ||
    normalized === "changeme"
  );
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.header("Origin");
  const isUnsafeMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (origin && !isAllowedOrigin(origin)) {
    if (isUnsafeMethod) {
      res.status(403).json({ error: "Origin is not allowed" });
      return;
    }
    next();
    return;
  }

  if (isAllowedOrigin(origin)) {
    res.header("Access-Control-Allow-Origin", origin && origin !== "null" ? origin : corsOrigin);
    res.header("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
    res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.header("Vary", "Origin");
  }

  if (req.method === "OPTIONS" && origin) {
    res.status(204).end();
    return;
  }

  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((error: Error & { type?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (error.type === "entity.too.large") {
    res.status(413).json({ error: "Request body too large" });
    return;
  }
  next();
});

app.use(globalLimiter);

export function validateProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;

  const requiredSecrets = {
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    PII_ENCRYPTION_KEY: process.env.PII_ENCRYPTION_KEY,
  };

  for (const [name, value] of Object.entries(requiredSecrets)) {
    if (isProductionPlaceholder(value)) {
      throw new Error(`${name} must be set to a production secret`);
    }
  }

  if (!process.env.DATABASE_URL || isProductionPlaceholder(process.env.DATABASE_URL)) {
    throw new Error("DATABASE_URL must be set for production");
  }

  if (!corsOrigin || allowedOrigins.length === 0) {
    throw new Error("CORS_ORIGIN must explicitly list production origins");
  }

  for (const origin of allowedOrigins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error("CORS_ORIGIN contains an invalid URL");
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      parsed.origin !== origin
    ) {
      throw new Error("CORS_ORIGIN contains an unsafe production origin");
    }
  }
}

export { app, authLimiter, globalLimiter, corsOrigin, passwordSchema };

export async function resetRateLimiters(): Promise<void> {
  // Integration tests run in a single process; clear every key between tests
  // so requests from one test cannot affect a later test. Production behavior
  // is unchanged because this helper is only called by the test suite.
  authStore.resetAll();
  globalStore.resetAll();
}
