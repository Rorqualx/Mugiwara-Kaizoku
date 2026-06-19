/**
 * tRPC Procedure Builders
 *
 * Typed procedure builders for different authorization levels.
 * These replace the generic 'procedure' with explicit auth requirements.
 *
 * SECURITY: All authentication bypasses and mock users have been removed (OWASP A01:2021)
 *
 * @module server/trpc/procedures
 */
import { TRPCError } from '@trpc/server';

import { getCachedSession } from '@/server/auth/session-cache';

import {
  loggingMiddleware,
  performanceMiddleware,
  errorHandlingMiddleware,
  rateLimitMiddleware,
  cachingMiddleware,
  checkRateLimit,
} from './middleware';
import { procedure } from './trpc';

import type { Context } from './context';
import type { WSContext } from '../wsContext';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Session } from 'next-auth';

/**
 * Extended context type for protected procedures with authenticated session
 */
type ProtectedContext = (Context | WSContext) & {
  session: Session;
  user: NonNullable<Session['user']> & {
    role: string;
  };
};

/**
 * Public procedure - No authentication required
 *
 * Use for endpoints that should be accessible to everyone:
 * - Public data queries
 * - Health checks
 * - Public search
 *
 * @example
 * ```ts
 * export const healthCheck = publicProcedure
 *   .query(() => ({ status: 'ok' }));
 * ```
 */
export const publicProcedure = procedure
  .use(loggingMiddleware)
  .use(performanceMiddleware)
  .use(errorHandlingMiddleware)
  .use(rateLimitMiddleware({ maxRequests: 30, windowMs: 60000 }))
  .use(cachingMiddleware(30000)); // Cache for 30 seconds

/**
 * Protected procedure - Requires authenticated user
 *
 * SECURITY FIX: Removed mock user fallback (OWASP A01:2021 - Broken Access Control)
 * Now properly validates NextAuth session before allowing access.
 *
 * Use for endpoints that require a logged-in user:
 * - User-specific data
 * - Personal settings
 * - User actions
 *
 * @example
 * ```ts
 * export const getMyProfile = protectedProcedure
 *   .query(({ ctx }) => {
 *     return getUserById(ctx.user.id);
 *   });
 * ```
 */
export const protectedProcedure = procedure
  .use(loggingMiddleware)
  .use(performanceMiddleware)
  .use(errorHandlingMiddleware)
  .use(rateLimitMiddleware({ maxRequests: 60, windowMs: 60000 })) // 60 req/min for authenticated users
  .use(async ({ ctx, next }) => {
    // Check for user in context
    const context = ctx as Context | WSContext;

    // Get the request and response objects from context
    const req = 'req' in context ? context.req : undefined;
    const res = 'res' in context ? context.res : undefined;

    // For HTTP contexts, verify we have request and response objects
    if (!req || !res) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Request/Response objects not available in context',
      });
    }

    // SECURITY FIX: Get real session using NextAuth (no mock fallback)
    // Uses request-scoped cache to avoid multiple lookups per request
    const session = await getCachedSession(
      req as NextApiRequest,
      res as NextApiResponse
    );

    if (!session?.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to access this resource',
      });
    }

    return next({
      ctx: {
        ...ctx,
        session,
        user: session.user,
      } as ProtectedContext,
    });
  });

/**
 * Settings procedure - No caching for settings queries
 *
 * Use for settings endpoints that should always return fresh data:
 * - Configuration queries
 * - Settings updates
 *
 * @example
 * ```ts
 * export const getSettings = settingsProcedure
 *   .query(() => getLatestSettings());
 * ```
 */
export const settingsProcedure = protectedProcedure;
  // Note: No caching middleware for settings — inherits auth from protectedProcedure

/**
 * Uncached public procedure - Public access without caching
 *
 * Use for public endpoints that should always return fresh data:
 * - Provider searches (especially slow providers like Fandom)
 * - Real-time data queries
 * - Data that changes frequently
 *
 * @example
 * ```ts
 * export const searchProviders = uncachedPublicProcedure
 *   .query(() => getLatestSearchResults());
 * ```
 */
export const uncachedPublicProcedure = procedure
  .use(loggingMiddleware)
  .use(performanceMiddleware)
  .use(errorHandlingMiddleware)
  .use(rateLimitMiddleware({ maxRequests: 30, windowMs: 60000 }));
  // Note: No caching middleware - always returns fresh data

/**
 * Admin procedure - Requires admin role
 *
 * SECURITY FIX: Removed admin bypass (OWASP A01:2021 - Broken Access Control)
 * Now properly validates user has ADMIN role before allowing access.
 *
 * Use for endpoints that require admin privileges:
 * - System configuration
 * - User management
 * - Dangerous operations
 *
 * @example
 * ```ts
 * export const deleteUser = adminProcedure
 *   .input(z.object({ userId: z.number() }))
 *   .mutation(({ input }) => {
 *     return deleteUserById(input.userId);
 *   });
 * ```
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // Type assertion is safe here because protectedProcedure ensures session and user exist
  const protectedCtx = ctx as ProtectedContext;

  // Type assertion is safe because ProtectedContext extends user with role property
  const userWithRole = protectedCtx.user as { role: string };
  const isAdmin = userWithRole.role === 'ADMIN';

  if (!isAdmin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You must be an admin to access this resource',
    });
  }

  return next({
    ctx: protectedCtx,
  });
});

/**
 * System procedure - For internal system operations
 *
 * SECURITY FIX: Removed development mode bypass (OWASP A01:2021 - Broken Access Control)
 * Now requires valid system token in X-System-Token header.
 *
 * Use for endpoints that should only be called by the system itself:
 * - Background jobs
 * - Internal health checks
 * - System maintenance
 *
 * @example
 * ```ts
 * export const runMaintenance = systemProcedure
 *   .mutation(() => {
 *     return performSystemMaintenance();
 *   });
 * ```
 */
export const systemProcedure = procedure
  .use(loggingMiddleware)
  .use(errorHandlingMiddleware) // Minimal middleware for system procedures
  .use(async ({ ctx, next }) => {
    const context = ctx as Context | WSContext;

    // Get the request object from context
    const req = 'req' in context ? context.req : undefined;

    if (!req) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Request object not available in context',
      });
    }

    // SECURITY FIX: Validate system token (removed development mode bypass)
    const systemToken = req.headers['x-system-token'];
    const expectedToken = process.env['SYSTEM_API_TOKEN'];

    if (!systemToken || !expectedToken || systemToken !== expectedToken) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Valid system token required',
      });
    }

    return next({
      ctx: {
        ...ctx,
        isSystem: true,
      },
    });
  });

/**
 * Rate-limited procedure - Adds rate limiting
 *
 * Wraps any procedure with rate limiting
 *
 * @param limit - Requests per minute
 * @param procedure - Base procedure to wrap
 */
export function rateLimitedProcedure<T extends typeof procedure>(
  limit: number,
  baseProcedure: T
): T {
  const windowMs = 60 * 1000;

  return baseProcedure.use(async ({ ctx, next, path }) => {
    // Identity: authenticated user id, else client IP, else a shared anonymous
    // bucket. `ctx.ip` is populated in createContext; fall back to the socket.
    const ctxWithIp = ctx as { user?: { id?: string }; ip?: string };
    const req = 'req' in ctx ? (ctx as Context).req : undefined;
    const ipAddress = ctxWithIp.ip ?? req?.socket.remoteAddress;
    const identifier = ctxWithIp.user?.id ?? (typeof ipAddress === 'string' ? ipAddress : undefined) ?? 'anonymous';

    // Postgres-backed, shared across instances (see checkRateLimit).
    const { allowed } = await checkRateLimit(`proc:${identifier}:${path}`, limit, windowMs);
    if (!allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Maximum ${limit} requests per minute.`,
      });
    }

    return next();
  }) as T;
}

// Export all procedures for use in routers
export default {
  public: publicProcedure,
  uncachedPublic: uncachedPublicProcedure,
  protected: protectedProcedure,
  admin: adminProcedure,
  system: systemProcedure,
  settings: settingsProcedure,
  rateLimited: rateLimitedProcedure,
};
