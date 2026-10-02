import { randomInt } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { hashPairingCode } from "./pii";

/**
 * Coaches who can invite other coaches (Mark), from COACH_ADMIN_EMAILS
 * (comma-separated). They can also create their own coach account without an
 * invite. Compared by email hash, since emails are stored encrypted.
 */
export function coachAdminEmailHashes(hash: (email: string) => string): Set<string> {
  return new Set(
    (process.env.COACH_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
      .map(hash),
  );
}

/** Codes are typed by people: ignore case and stray spaces. */
export function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/** e.g. SQUAD-K7P2QX, without easily confused characters (0/O, 1/I). */
export function randomCode(prefix: string, length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += chars[randomInt(chars.length)];
  }
  return `${prefix}-${code}`;
}

export async function uniqueSquadCode(tx: Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomCode("SQUAD", 6);
    if (!(await tx.coachProfile.findUnique({ where: { squadCode: code } }))) return code;
  }
  throw new Error("Couldn't generate a squad code");
}

/**
 * Creates a single-use coach invite. Only the hash is stored, so the plain
 * code returned here is the only copy.
 */
export async function createCoachInvite(
  prisma: PrismaClient,
  options: { createdById?: string; note?: string; days?: number } = {},
) {
  const code = randomCode("COACH", 10);
  const expiresAt = new Date(Date.now() + (options.days ?? 30) * 24 * 60 * 60 * 1000);
  await prisma.coachInvite.create({
    data: { codeHash: hashPairingCode(code), createdById: options.createdById, note: options.note, expiresAt },
  });
  return { code, expiresAt };
}
