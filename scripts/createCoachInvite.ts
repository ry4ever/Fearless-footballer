/**
 * Creates a single-use invite code for a new coach (coach accounts are
 * invite-only).
 *
 *   npm run coach:invite -- "Coach name"          valid for 30 days
 *   npm run coach:invite -- "Coach name" --days 7
 *
 * Uses DATABASE_URL from .env. To create an invite for the live app, run it
 * with the Railway database's public URL as DATABASE_URL. Only a hash of the
 * code is stored, so copy the printed code now.
 */
import { PrismaClient } from "@prisma/client";
import { createCoachInvite } from "../server/lib/coachInvites";

async function main() {
  const args = process.argv.slice(2);
  const daysFlag = args.indexOf("--days");
  const days = daysFlag >= 0 ? Number(args[daysFlag + 1]) : 30;
  const note = args.filter((_, index) => index !== daysFlag && index !== daysFlag + 1).join(" ").trim() || undefined;
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error("--days must be 1–90");

  const prisma = new PrismaClient();
  try {
    const invite = await createCoachInvite(prisma, { note, days });
    console.log(`Coach invite${note ? ` for ${note}` : ""}: ${invite.code}`);
    console.log(`Valid until ${invite.expiresAt.toUTCString()}. It works once.`);
    console.log("The coach chooses \"Coach\" on the sign-in page, then \"Create a coach account\".");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
