/**
 * Login guard — the request-level protections around the credentials sign-in.
 *
 * NextAuth hands `authorize` a reduced request (headers only, no socket), so
 * the API route resolves the client IP itself and stamps it on the request
 * under a header name no client can guess or pre-fill. `authorize` reads only
 * that stamp; it never looks at `X-Forwarded-For` directly.
 *
 * Also here: the per-IP rate limit on the credentials callback and the dummy
 * bcrypt hash that keeps unknown-username logins as slow as real ones.
 *
 * @module lib/auth/login-guard
 */
import { randomBytes } from 'crypto';

import { hash } from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';

import { resolveClientIp } from '@/server/utils/client-ip';
import type { ClientIpSource } from '@/server/utils/client-ip';
import { logger } from '@/utils/logger';

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import type { NextApiRequest, NextApiResponse } from 'next';

// ---------------------------------------------------------------------------
// Client IP stamp
// ---------------------------------------------------------------------------

/**
 * Per-process header name. The random suffix means a client cannot send the
 * header itself, even on a code path that forgot to call `stampClientIp`.
 */
const CLIENT_IP_HEADER = `x-kaizoku-client-ip-${randomBytes(8).toString('hex')}`;

type HeaderBag = Record<string, string | string[] | undefined>;

/**
 * Record the resolved client IP on the request for `authorize` to read.
 * Always overwrites: when the IP cannot be resolved the stamp is removed.
 */
export function stampClientIp(req: ClientIpSource): string | undefined {
  const ip = resolveClientIp(req);
  const headers: HeaderBag = req.headers;
  if (ip === undefined) {
    Reflect.deleteProperty(headers, CLIENT_IP_HEADER);
  } else {
    headers[CLIENT_IP_HEADER] = ip;
  }
  return ip;
}

/** Read the IP stamped by `stampClientIp`, or `undefined` when there is none. */
export function readStampedClientIp(headers: Record<string, unknown> | undefined): string | undefined {
  const value: unknown = headers?.[CLIENT_IP_HEADER];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

// ---------------------------------------------------------------------------
// Per-IP rate limit on the credentials callback
// ---------------------------------------------------------------------------

/**
 * 30 sign-in attempts per IP per 15 minutes.
 *
 * The (username, IP) lockout already stops a single account being guessed
 * after 5 failures in 30 minutes. This limit caps the total a single address
 * can try across ALL usernames (120/hour). It is deliberately generous: five
 * people behind one NAT address can each run into their own 5-failure lockout
 * (25 attempts) without the household tripping the shared limit.
 */
export const CREDENTIALS_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const CREDENTIALS_RATE_LIMIT_MAX = 30;

/** Bucket used only when no client address can be resolved at all. */
const UNRESOLVED_RATE_LIMIT_KEY = 'unresolved-client';

const RATE_LIMIT_MESSAGE = 'Too many sign-in attempts. Please wait a few minutes and try again.';

type LimiterMiddleware = (req: NextApiRequest, res: NextApiResponse, next: () => void) => unknown;

function requestOrigin(req: ExpressRequest): string {
  const configured = process.env['NEXTAUTH_URL'];
  if (configured !== undefined && configured.length > 0) {
    return configured.replace(/\/+$/, '');
  }
  return `http://${req.headers.host ?? 'localhost'}`;
}

function rejectRateLimited(req: ExpressRequest, res: ExpressResponse): void {
  logger.warn('Sign-in rate limit exceeded', { ip: resolveClientIp(req) ?? 'unresolved' });
  // next-auth's client reads the error from an absolute `url` in the JSON body.
  const url = `${requestOrigin(req)}/login?error=${encodeURIComponent(RATE_LIMIT_MESSAGE)}`;
  res.status(429).json({ url, error: RATE_LIMIT_MESSAGE });
}

/** Build a fresh limiter (own in-memory store). Exported for tests. */
export function createCredentialsRateLimiter(): LimiterMiddleware {
  const limiter = rateLimit({
    windowMs: CREDENTIALS_RATE_LIMIT_WINDOW_MS,
    limit: CREDENTIALS_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    // Same trust rule as everywhere else: socket address unless TRUST_PROXY.
    keyGenerator: (req: ExpressRequest): string => resolveClientIp(req) ?? UNRESOLVED_RATE_LIMIT_KEY,
    handler: rejectRateLimited,
    // The built-in checks assume Express's `req.ip` / `trust proxy`; this runs
    // inside a Next API route with its own key generator.
    validate: false,
  });
  return limiter as unknown as LimiterMiddleware;
}

/**
 * The process-wide limiter lives on `globalThis`, not in module scope. Next
 * re-evaluates server modules (in development whenever another page compiles),
 * and a module-scoped limiter would start again from zero each time — which
 * silently hands an attacker a fresh allowance.
 */
interface LimiterHolder {
  kaizokuCredentialsRateLimiter?: LimiterMiddleware | undefined;
}

/** The shared limiter, created once per process. */
export function getCredentialsRateLimiter(): LimiterMiddleware {
  const holder = globalThis as LimiterHolder;
  const existing = holder.kaizokuCredentialsRateLimiter;
  if (existing !== undefined) {
    return existing;
  }
  const created = createCredentialsRateLimiter();
  holder.kaizokuCredentialsRateLimiter = created;
  return created;
}

/** True for the request that actually tests a password. */
export function isCredentialsSignIn(req: Pick<NextApiRequest, 'method' | 'query'>): boolean {
  const segments = req.query['nextauth'];
  return (
    req.method === 'POST' &&
    Array.isArray(segments) &&
    segments[0] === 'callback' &&
    segments[1] === 'credentials'
  );
}

/**
 * Apply the per-IP limit to a credentials sign-in. Resolves `true` when the
 * request may proceed; `false` when a 429 has already been sent.
 */
export async function allowCredentialsSignIn(
  req: NextApiRequest,
  res: NextApiResponse,
  limiter: LimiterMiddleware = getCredentialsRateLimiter(),
): Promise<boolean> {
  if (!isCredentialsSignIn(req)) {
    return true;
  }
  let allowed = false;
  await Promise.resolve(
    limiter(req, res, () => {
      allowed = true;
    }),
  );
  return allowed;
}

// ---------------------------------------------------------------------------
// Constant-work password check for unknown users
// ---------------------------------------------------------------------------

/** Same cost as real password hashes (`hashPassword` in server/utils/auth). */
const DUMMY_HASH_ROUNDS = 12;

let dummyHashPromise: Promise<string> | undefined;

/**
 * A bcrypt hash of a random value nobody knows, generated once per process.
 * Comparing against it when the username does not exist makes that path cost
 * the same as a wrong password, so response time does not reveal which
 * usernames are real.
 */
export function getDummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hash(randomBytes(32).toString('hex'), DUMMY_HASH_ROUNDS);
  return dummyHashPromise;
}
