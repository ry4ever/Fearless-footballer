import { PrismaClient } from "@prisma/client";
import { seedSampleSession } from "./seed";

/**
 * Runs on every container start. If the database has no published session
 * (e.g. a brand-new production database), add the built-in sample session so
 * players have something to train with. Once real content is published this
 * does nothing, and it never changes existing sessions.
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    const published = await prisma.session.count({ where: { isPublished: true } });
    if (published > 0) {
      console.log(`Sessions: ${published} published; sample session not needed.`);
      return;
    }
    const session = await seedSampleSession(prisma);
    console.log(`Sessions: none published; added sample session "${session.title}".`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // Never block the server from starting over sample content.
  console.error("Could not check or add the sample session:", error);
});
