import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
} from "node:crypto";

const KEY = process.env.PII_ENCRYPTION_KEY;
const KEY_BYTES = 32;

function getEncryptionKey(): Buffer {
  if (!KEY) {
    throw new Error("PII_ENCRYPTION_KEY is required");
  }
  return scryptSync(KEY, "fearless-footballer-pii-salt", KEY_BYTES);
}

function hashWithPurpose(value: string, purpose: string): string {
  return createHmac("sha256", getEncryptionKey())
    .update(purpose)
    .update("\0")
    .update(value.trim().toLowerCase())
    .digest("hex");
}

export function encryptPII(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptPII(value: string): string {
  const buffer = Buffer.from(value, "base64");
  if (buffer.length < 28) {
    throw new Error("Invalid encrypted PII payload");
  }
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function hashEmail(email: string): string {
  return hashWithPurpose(email, "email");
}

export function hashPairingCode(code: string): string {
  return hashWithPurpose(code, "pairing-code");
}

export function hashResetToken(token: string): string {
  return hashWithPurpose(token, "password-reset-token");
}
