/**
 * Canonical NextAuth configuration — single source of truth.
 *
 * This module owns the one `authOptions` used everywhere:
 * - the NextAuth route handler (`src/pages/api/auth/[...nextauth].ts`)
 * - server-side session reads via `getServerSession` (`session-cache.ts`,
 *   the `auth()` helper below, SSR guards in `login.tsx` / `setup.tsx`)
 *
 * Previously a second, divergent config lived in `src/lib/auth/config.ts`
 * (14-day sessions, no brute-force lockout). That duplication is gone;
 * `config.ts` now re-exports from here.
 *
 * Security properties:
 * - bcrypt credential verification
 * - IP+identifier-scoped brute-force lockout (OWASP A07:2021)
 * - JWT sessions with a 1-day cap and hourly refresh
 * - DB-backed token invalidation: every authenticated request re-checks the
 *   user's `tokenVersion` and current role, so password changes and role
 *   changes take effect immediately instead of after token expiry.
 *
 * @module lib/auth/auth-options
 */
import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcryptjs';
import { getServerSession } from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';

import { prisma } from '@/server/db';
import { eventEmitter } from '@/server/services/eventEmitter';
import { EventType, EventSource } from '@/server/services/events/eventTypes';
import { sanitizeError } from '@/server/utils/log-sanitizer';
import { logSecurityEvent, SecurityEventType } from '@/server/utils/security-logger';
import { logger } from '@/utils/logger';

import type { ExtendedSession } from './types';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';
import type { NextAuthOptions } from 'next-auth';
import type { RequestInternal } from 'next-auth';

// Shape returned by `authorize` and threaded through the JWT callback.
interface AuthorizedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  tokenVersion: number;
}

// Custom JWT claims layered on top of the default NextAuth token.
interface ExtendedJWT {
  sub?: string | undefined;
  role?: string | undefined;
  avatar?: string | null | undefined;
  tokenVersion?: number | undefined;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Brute-force lockout (OWASP A07:2021)
// ---------------------------------------------------------------------------

const LOCKOUT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const MAX_FAILED_ATTEMPTS = 5;

interface LoginContext {
  identifier: string;
  ipAddress: string;
  userAgent?: string | undefined;
}

interface UserLoginContext extends LoginContext {
  userId: string;
  userName: string;
  email: string;
  role: string;
}

/**
 * Count recent failed attempts for this (identifier, IP) pair.
 *
 * Scoping by IP as well as identifier means a single attacker can no longer
 * lock out an arbitrary known username from afar — the lock only bites the
 * source that is actually failing.
 */
async function getFailedAttemptCount(identifier: string, ipAddress: string): Promise<number> {
  return prisma.systemEvent.count({
    where: {
      type: 'user.login.failed',
      AND: [
        { details: { path: ['identifier'], equals: identifier } },
        { details: { path: ['ipAddress'], equals: ipAddress } },
      ],
      timestamp: {
        gte: new Date(Date.now() - LOCKOUT_WINDOW_MS),
      },
    },
  });
}

/** Returns true (and logs) when the (identifier, IP) pair is locked out. */
async function handleAccountLockout(context: LoginContext, failedAttempts: number): Promise<boolean> {
  if (failedAttempts < MAX_FAILED_ATTEMPTS) {
    return false;
  }

  await eventEmitter.emitWithTracking({
    type: EventType.USER_SUSPICIOUS_ACTIVITY,
    source: EventSource.USER,
    metadata: {
      identifier: context.identifier,
      reason: 'Account temporarily locked due to multiple failed login attempts',
      ipAddress: context.ipAddress,
      failedAttempts,
      lockoutDuration: '30 minutes',
      timestamp: new Date().toISOString(),
    },
  });

  logSecurityEvent(SecurityEventType.LOGIN_BLOCKED, {
    username: context.identifier,
    ipAddress: context.ipAddress,
    reason: 'Account temporarily locked due to multiple failed login attempts',
    failedAttempts,
    lockoutDuration: '30 minutes',
    ...(context.userAgent && { userAgent: context.userAgent }),
  });

  logger.warn(`Account lockout triggered for ${context.identifier} from IP ${context.ipAddress}`);
  return true;
}

/** Record a failed login attempt for lockout accounting + security logging. */
async function logLoginFailure(
  context: LoginContext,
  reason: string,
  userId?: string,
  userName?: string,
  failedAttempts?: number,
): Promise<void> {
  const metadata: Record<string, unknown> = {
    identifier: context.identifier,
    reason,
    ipAddress: context.ipAddress,
    timestamp: new Date().toISOString(),
  };

  if (userId) {
    metadata['userId'] = userId;
    metadata['userName'] = userName ?? '';
    metadata['failedAttempts'] = (failedAttempts ?? 0) + 1;
    metadata['remainingAttempts'] = Math.max(0, MAX_FAILED_ATTEMPTS - ((failedAttempts ?? 0) + 1));
  }

  await eventEmitter.emitWithTracking({
    type: EventType.USER_LOGIN_FAILED,
    source: EventSource.USER,
    ...(userId && { userId }),
    metadata,
  });

  logSecurityEvent(SecurityEventType.LOGIN_FAILED, {
    ...(userId && { userId: parseInt(userId, 10) }),
    username: userName ?? context.identifier,
    ipAddress: context.ipAddress,
    reason,
    ...(context.userAgent && { userAgent: context.userAgent }),
    ...(failedAttempts !== undefined && {
      failedAttempts: failedAttempts + 1,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - (failedAttempts + 1)),
    }),
  });
}

/** Record a successful login. */
async function logLoginSuccess(context: UserLoginContext): Promise<void> {
  await eventEmitter.emitWithTracking({
    type: EventType.USER_LOGGED_IN,
    source: EventSource.USER,
    userId: context.userId,
    metadata: {
      userId: context.userId,
      userName: context.userName,
      email: context.email,
      role: context.role,
      ipAddress: context.ipAddress,
      timestamp: new Date().toISOString(),
    },
  });

  logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
    userId: parseInt(context.userId, 10),
    username: context.userName,
    ipAddress: context.ipAddress,
    ...(context.userAgent && { userAgent: context.userAgent }),
    action: 'login',
  });
}

/** Clear failed-attempt records for an identifier after a successful login. */
async function clearFailedAttempts(identifier: string): Promise<void> {
  await prisma.systemEvent.deleteMany({
    where: {
      type: 'user.login.failed',
      details: { path: ['identifier'], equals: identifier },
    },
  });
}

/** Pull the client IP from the credentials-provider request headers. */
function extractIpAddress(headers: RequestInternal['headers']): string {
  const forwarded: unknown = headers?.['x-forwarded-for'];
  const real: unknown = headers?.['x-real-ip'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  if (typeof real === 'string' && real.length > 0) {
    return real;
  }
  return 'unknown';
}

/**
 * Credentials authorize handler. Hoisted to module scope to keep the provider
 * config flat. Validates the password with bcrypt behind an (identifier, IP)
 * brute-force lockout, and returns the user (with `tokenVersion`) on success.
 */
async function authorizeCredentials(
  credentials: Record<'identifier' | 'password', string> | undefined,
  request: Pick<RequestInternal, 'headers'>,
): Promise<AuthorizedUser | null> {
  if (!credentials?.identifier || !credentials.password) {
    return null;
  }

  try {
    const ipAddress = extractIpAddress(request.headers);
    const userAgent = (request.headers?.['user-agent'] as string | undefined) ?? undefined;
    const loginContext: LoginContext = {
      identifier: credentials.identifier,
      ipAddress,
      ...(userAgent !== undefined ? { userAgent } : {}),
    };

    // Brute-force lockout, scoped to (identifier, IP).
    const failedAttempts = await getFailedAttemptCount(credentials.identifier, ipAddress);
    if (await handleAccountLockout(loginContext, failedAttempts)) {
      return null;
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: credentials.identifier }, { userName: credentials.identifier }] },
    });

    if (!user?.hashedPassword) {
      await logLoginFailure(loginContext, 'User not found');
      return null;
    }

    const passwordMatch = await compare(credentials.password, user.hashedPassword);
    if (!passwordMatch) {
      await logLoginFailure(loginContext, 'Invalid password', String(user.id), user.userName, failedAttempts);
      return null;
    }

    await clearFailedAttempts(credentials.identifier);
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    await logLoginSuccess({
      ...loginContext,
      userId: String(user.id),
      userName: user.userName,
      email: user.email,
      role: String(user.role),
    });

    // Role kept in canonical DB casing (ADMIN | USER) so every downstream check
    // (`adminProcedure`, middleware) compares against the same value.
    return {
      id: String(user.id),
      name: user.userName,
      email: user.email,
      role: String(user.role),
      avatar: user.avatar,
      tokenVersion: user.tokenVersion,
    };
  } catch (error: unknown) {
    logger.error('Authorization error');
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('Auth error details:', sanitizeError(error));
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// JWT + session callbacks
// ---------------------------------------------------------------------------

/**
 * Build the JWT. On sign-in we capture role + tokenVersion from the authorized
 * user. On every later request we re-read the user from the DB: a tokenVersion
 * mismatch (or a missing user) invalidates the token, and the live role is
 * refreshed so demotions take effect without re-login.
 */
async function jwtCallback(params: { token: ExtendedJWT; user?: unknown }): Promise<ExtendedJWT> {
  const { token, user } = params;

  if (user) {
    const authUser = user as AuthorizedUser;
    token.role = authUser.role;
    token.avatar = authUser.avatar;
    token.tokenVersion = authUser.tokenVersion;
    return token;
  }

  if (token.sub) {
    const dbUser = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { role: true, avatar: true, tokenVersion: true },
    });

    // User gone or token superseded by a password/role change → invalidate.
    if (!dbUser || dbUser.tokenVersion !== token.tokenVersion) {
      return {};
    }

    token.role = dbUser.role;
    token.avatar = dbUser.avatar;
  }

  return token;
}

/**
 * Project JWT claims onto the session. An invalidated token (empty, no `sub`)
 * yields a session without a user, which every guard treats as unauthenticated.
 */
function sessionCallback(params: { session: ExtendedSession; token: ExtendedJWT }): ExtendedSession {
  const { session, token } = params;

  if (!token.sub) {
    return { ...session, user: undefined } as unknown as ExtendedSession;
  }

  const existingUser = session.user as Partial<ExtendedSession['user']> | undefined;
  const sessionUser: ExtendedSession['user'] = {
    id: token.sub,
    name: existingUser?.name ?? null,
    email: existingUser?.email ?? null,
    image: existingUser?.image ?? null,
    role: (token.role ?? 'USER') as ExtendedSession['user']['role'],
    avatar: typeof token.avatar === 'string' ? token.avatar : null,
  };

  return { ...session, user: sessionUser };
}

// ---------------------------------------------------------------------------
// Canonical NextAuth options
// ---------------------------------------------------------------------------

/** Record a manual logout. JWT-strategy `signOut` events carry the token. */
async function logLogout(token: ExtendedJWT | null | undefined): Promise<void> {
  if (!token?.sub) return;
  await eventEmitter.emitWithTracking({
    type: EventType.USER_LOGGED_OUT,
    source: EventSource.USER,
    userId: token.sub,
    metadata: {
      userId: token.sub,
      userName: typeof token['name'] === 'string' ? token['name'] : '',
      logoutType: 'manual',
    },
  });
}

/** NextAuth `signOut` event handler — emits logout tracking. */
async function signOutEvent(message: { token?: ExtendedJWT | null }): Promise<void> {
  await logLogout(message.token);
}

export const authOptions: NextAuthOptions = {
  // Adapter types differ slightly across @auth/prisma-adapter and next-auth v4.
  adapter: PrismaAdapter(prisma) as NonNullable<NextAuthOptions['adapter']>,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        identifier: { label: 'Username or Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: authorizeCredentials as never,
    }),
  ],
  session: {
    strategy: 'jwt',
    // Stolen tokens expire after 24h; tokenVersion invalidation kills them sooner.
    maxAge: 24 * 60 * 60,
    // Re-run the jwt callback hourly so role/tokenVersion stay fresh.
    updateAge: 60 * 60,
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    jwt: jwtCallback as never,
    session: sessionCallback as never,
  },
  events: {
    signOut: signOutEvent as never,
  },
  // Only set `secret` when one is configured; startup env-validation
  // (`validateEnvironmentSecrets`) fails fast in production if it is missing.
  ...(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
    ? { secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET }
    : {}),
  // Never enable debug in production — it can leak sensitive data.
  debug: process.env['AUTH_DEBUG'] === 'true' && process.env.NODE_ENV !== 'production',
  logger: {
    error(code, metadata) {
      if (process.env.NODE_ENV === 'production') {
        logger.error(`Auth error: ${code}`);
      } else {
        logger.error(`Auth error: ${code}`, { code, metadata });
      }
    },
    warn(code) {
      logger.warn(`Auth warning: ${code}`);
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(`Auth debug: ${code}`, { code, metadata });
      }
    },
  },
};

/** Backwards-compatible alias for the former `config.ts` export name. */
export const authConfig = authOptions;

/**
 * Server-side session accessor for API routes and `getServerSideProps`.
 * Returns the extended session or null. Call with `(req, res)` from API
 * routes / SSR, or with no args from contexts that only need a null result.
 */
export async function auth(
  req?: NextApiRequest | GetServerSidePropsContext['req'],
  res?: NextApiResponse | GetServerSidePropsContext['res'],
): Promise<ExtendedSession | null> {
  try {
    if (!req || !res) {
      return null;
    }
    const session = await getServerSession(
      req as NextApiRequest,
      res as NextApiResponse,
      authOptions,
    );
    return (session as ExtendedSession | null) ?? null;
  } catch (error: unknown) {
    logger.error('Auth function error:', error);
    return null;
  }
}
