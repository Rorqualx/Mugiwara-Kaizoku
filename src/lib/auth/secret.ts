/**
 * NextAuth secret resolution
 *
 * NextAuth signs/encrypts the JWT session cookie (and the CSRF token) with a
 * single secret. The same value must be used everywhere the token is signed or
 * verified — `auth-options` (signing), the `[...nextauth]` handler, the
 * middleware `getToken`, and the WebSocket `decode`. If the value differs
 * between any of them, or changes between restarts, previously-issued cookies
 * become unreadable and users get silently logged out / stuck "half logged in".
 *
 * Preference order:
 *   1. `AUTH_SECRET` / `NEXTAUTH_SECRET` env var (the operator-configured value).
 *   2. A persisted, auto-generated secret on the data volume — so self-hosted
 *      instances with no secret configured still get ONE stable secret that
 *      survives restarts and redeploys, with zero operator action.
 *
 * The resolved value is also written back into `process.env` so any NextAuth
 * internals that read the env directly stay consistent with us.
 *
 * @module lib/auth/secret
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/** Minimum acceptable secret length (chars). */
const MIN_SECRET_LENGTH = 16;

/** Persisted location for the auto-generated fallback secret. */
const SECRET_FILE = path.join(process.cwd(), 'data', '.nextauth-secret');

let cached: string | null = null;

/** Read an existing persisted secret, or generate + persist a new one. */
function loadOrCreatePersistedSecret(): string {
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (existing.length >= MIN_SECRET_LENGTH) return existing;
    }
  } catch {
    // fall through to generation
  }

  const generated = crypto.randomBytes(32).toString('base64');
  try {
    fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
    fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
    // Guard against a concurrent first-write race: prefer whatever is on disk.
    const onDisk = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (onDisk.length >= MIN_SECRET_LENGTH) return onDisk;
  } catch {
    // Can't persist (read-only fs); fall back to an in-process secret. Still
    // consistent within this process run, just not across restarts.
  }
  return generated;
}

/**
 * Resolve the NextAuth secret. Memoised so every caller in this process gets
 * the exact same value. Safe to call at module load.
 */
export function resolveAuthSecret(): string {
  if (cached) return cached;

  const fromEnv = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  cached = fromEnv && fromEnv.length >= MIN_SECRET_LENGTH
    ? fromEnv
    : loadOrCreatePersistedSecret();

  // Keep env-readers (NextAuth internals, getToken's implicit fallback) aligned.
  process.env.AUTH_SECRET = cached;
  process.env.NEXTAUTH_SECRET = cached;

  return cached;
}
