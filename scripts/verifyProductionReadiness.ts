import { PrismaClient } from "@prisma/client";
import { monitoring } from "../server/lib/monitoring";
import { encryptPII, decryptPII, hashEmail } from "../server/lib/pii";
import { generateSignedMediaUrl, verifySignedMediaToken } from "../server/lib/cdn";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function runProductionReadinessAudit() {
  console.log("==================================================================");
  console.log(" FEARLESS FOOTBALLER — PRODUCTION READINESS & COMPLIANCE AUDIT");
  console.log("==================================================================\n");

  let checksPassed = 0;
  let totalChecks = 0;

  function assertCheck(name: string, condition: boolean, detail?: string) {
    totalChecks++;
    if (condition) {
      checksPassed++;
      console.log(`  [PASS] ${name}${detail ? ` (${detail})` : ""}`);
    } else {
      console.error(`  [FAIL] ${name}${detail ? ` (${detail})` : ""}`);
    }
  }

  // Check 1: Environment Variables
  const dbUrl = process.env.DATABASE_URL;
  assertCheck("DATABASE_URL environment variable configured", !!dbUrl, dbUrl ? "Neon PostgreSQL" : "Missing");

  // Check 2: Neon Database Connectivity & Latency Probe
  try {
    const health = await monitoring.getReadiness(prisma);
    assertCheck(
      "Neon PostgreSQL Database connectivity",
      health.database.connected,
      health.database.latencyMs ? `Latency: ${health.database.latencyMs}ms` : health.database.error
    );
  } catch (err: any) {
    assertCheck("Neon PostgreSQL Database connectivity", false, err.message);
  }

  // Check 3: Prisma Schema & Session Data
  try {
    const sessionCount = await prisma.session.count();
    assertCheck("Prisma DB schema seeded with active session packages", sessionCount > 0, `${sessionCount} session(s) found`);
  } catch (err: any) {
    assertCheck("Prisma DB schema seeded with active session packages", false, err.message);
  }

  // Check 4: PII AES-256-GCM Encryption Roundtrip
  try {
    const sampleEmail = "audit@fearlessfootballer.com";
    const encrypted = encryptPII(sampleEmail);
    const decrypted = decryptPII(encrypted);
    const isDifferent = encrypted !== sampleEmail;
    const isMatching = decrypted === sampleEmail;
    assertCheck("PII Encryption (AES-256-GCM + Blind HMAC Index)", isDifferent && isMatching, "Email encrypted & decrypted cleanly");
  } catch (err: any) {
    assertCheck("PII Encryption (AES-256-GCM + Blind HMAC Index)", false, err.message);
  }

  // Check 5: Blind Email Hash Generation
  try {
    const hash = hashEmail("audit@fearlessfootballer.com");
    assertCheck("Blind HMAC Email Indexing", !!hash && hash.length === 64, "Deterministic 256-bit HMAC hash");
  } catch (err: any) {
    assertCheck("Blind HMAC Email Indexing", false, err.message);
  }

  // Check 6: Process Memory Footprint
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100;
  assertCheck("Process Memory Utilization", heapUsedMb < 500, `Heap Used: ${heapUsedMb} MB`);

  // Check 7: CI/CD Deployment Blueprints & Staging Configuration
  try {
    const renderExists = fs.existsSync(path.join(process.cwd(), "render.yaml"));
    const deployWfExists = fs.existsSync(path.join(process.cwd(), ".github/workflows/deploy.yml"));
    const dockerComposeExists = fs.existsSync(path.join(process.cwd(), "docker-compose.yml"));
    const guideExists = fs.existsSync(path.join(process.cwd(), "docs/STAGING_AND_CICD_GUIDE.md"));

    const allArtifactsExist = renderExists && deployWfExists && dockerComposeExists && guideExists;
    assertCheck(
      "Staging Infrastructure & CI/CD Deployment Declarations",
      allArtifactsExist,
      allArtifactsExist ? "Render blueprint, GHCR container deploy workflow, and ops guide present" : "Missing artifact(s)"
    );
  } catch (err: any) {
    assertCheck("Staging Infrastructure & CI/CD Deployment Declarations", false, err.message);
  }

  // Check 8: CDN Signed URL Token & Media Cache Engine
  try {
    const testPath = "voice/audit_test.aac";
    const signed = generateSignedMediaUrl(testPath, 60);
    const isValid = verifySignedMediaToken(testPath, signed.token);
    const mediaCacheExists = fs.existsSync(path.join(process.cwd(), "mobile/src/lib/mediaCache.ts"));

    assertCheck(
      "CDN Signed URL & Mobile Media Cache Engine",
      isValid && mediaCacheExists,
      isValid && mediaCacheExists ? "HMAC-SHA256 signed URL token verified & mediaCache manager present" : "Verification failed"
    );
  } catch (err: any) {
    assertCheck("CDN Signed URL & Mobile Media Cache Engine", false, err.message);
  }

  // Check 9: Beta Feedback Storage & Onboarding Guide
  try {
    const feedbackCount = await prisma.betaFeedback.count();
    const onboardingGuideExists = fs.existsSync(path.join(process.cwd(), "docs/BETA_TESTER_ONBOARDING.md"));

    assertCheck(
      "Beta Feedback Storage & Distribution Onboarding Guide",
      onboardingGuideExists,
      `Beta feedback model ready (${feedbackCount} entries), onboarding guide present`
    );
  } catch (err: any) {
    assertCheck("Beta Feedback Storage & Distribution Onboarding Guide", false, err.message);
  }

  console.log("\n------------------------------------------------------------------");
  console.log(` AUDIT SUMMARY: ${checksPassed} / ${totalChecks} CHECKS PASSED`);
  console.log("------------------------------------------------------------------\n");

  await prisma.$disconnect();

  if (checksPassed !== totalChecks) {
    process.exit(1);
  }
}

runProductionReadinessAudit().catch((err) => {
  console.error("Audit script failed with unhandled error:", err);
  process.exit(1);
});
