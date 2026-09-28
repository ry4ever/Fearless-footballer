import { existsSync } from "node:fs";
import path from "node:path";

// The integration tests delete every row in the main tables, so they must
// never run against DATABASE_URL. They only use TEST_DATABASE_URL, which has
// to point at a database that is safe to wipe.
const envFile = path.resolve(import.meta.dirname, "../../.env");
if (existsSync(envFile)) {
  // Does not override variables already set (e.g. by CI).
  process.loadEnvFile(envFile);
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set. The server tests wipe the database, so they " +
      "refuse to fall back to DATABASE_URL. Point TEST_DATABASE_URL at a " +
      "disposable database (see .env.example)."
  );
}
process.env.DATABASE_URL = testDatabaseUrl;

process.env.PII_ENCRYPTION_KEY = "test-pii-encryption-key";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.NODE_ENV = "test";
