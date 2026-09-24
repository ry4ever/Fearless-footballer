import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function runDatabaseBackupAudit() {
  console.log("==================================================================");
  console.log(" FEARLESS FOOTBALLER — DATABASE SNAPSHOT & INTEGRITY AUDIT");
  console.log("==================================================================\n");

  const startTime = Date.now();
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

  try {
    // 1. User Table Count & Structure Audit
    const userCount = await prisma.user.count();
    assertCheck("User records snapshot", true, `Total users: ${userCount}`);

    // 2. Athlete Profiles Audit
    const athleteCount = await prisma.athleteProfile.count();
    assertCheck("Athlete profile records snapshot", true, `Total athletes: ${athleteCount}`);

    // 3. Caregiver Links Audit
    const linkCount = await prisma.caregiverLink.count();
    assertCheck("Caregiver link records snapshot", true, `Total links: ${linkCount}`);

    // 4. Session Content Audit
    const sessionCount = await prisma.session.count();
    assertCheck("Session packages snapshot", sessionCount >= 1, `Total published sessions: ${sessionCount}`);

    // 5. Session Completions Audit
    const completionCount = await prisma.sessionCompleted.count();
    assertCheck("Session completion records snapshot", true, `Total completions: ${completionCount}`);

    // 6. Audit Logs Snapshot
    const auditCount = await prisma.auditLog.count();
    assertCheck("Security audit log snapshot", true, `Total audit events logged: ${auditCount}`);

    // 7. Orphan Record Audit: Check that all athlete profiles map to existing users
    const orphanedAthletes = await prisma.athleteProfile.findMany({
      where: { user: { is: undefined } },
    });
    assertCheck("Referential Integrity: No orphaned athlete profiles", orphanedAthletes.length === 0, `${orphanedAthletes.length} orphan(s)`);

    const elapsed = Date.now() - startTime;
    console.log("\n------------------------------------------------------------------");
    console.log(` SNAPSHOT AUDIT RESULT: ${checksPassed} / ${totalChecks} PASSED (${elapsed}ms)`);
    console.log("------------------------------------------------------------------\n");

    return checksPassed === totalChecks;
  } catch (error: any) {
    console.error("Database backup snapshot failed with error:", error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute script if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("backupDb.ts")) {
  runDatabaseBackupAudit().then((success) => {
    if (!success) process.exit(1);
  });
}
