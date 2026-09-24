const allowedDetailKeys = new Set([
  "approved",
  "anonymized",
  "consentSource",
  "durationSeconds",
  "policyVersion",
  "relationship",
  "role",
  "status",
]);

/** Keep audit metadata useful without turning the log into a PII store. */
export function sanitizeAuditDetails(
  details: Record<string, unknown> = {},
): Record<string, string | number | boolean | null> {
  const sanitized: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(details)) {
    if (!allowedDetailKeys.has(key)) continue;
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
