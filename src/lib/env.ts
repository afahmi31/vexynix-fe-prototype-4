/**
 * Validated environment accessor.
 * NEXT_PUBLIC_* vars are inlined at build time — changing them requires a rebuild.
 */

/** Throw at boot if a required env var is missing. */
export function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const BFF_ORIGIN =
  process.env.NEXT_PUBLIC_BFF_ORIGIN || "http://localhost:18080";

/** Feature flag: player change-password (endpoint not confirmed in backend). */
export const FEATURE_CHANGE_PASSWORD =
  process.env.NEXT_PUBLIC_FEATURE_CHANGE_PASSWORD === "true";

