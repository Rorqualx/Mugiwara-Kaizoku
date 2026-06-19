/**
 * Session Cache Module
 * Provides request-scoped caching for getServerSession() calls
 *
 * @module server/auth/session-cache
 */
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/utils/logger';

import type { NextApiRequest, NextApiResponse } from 'next';
import type { Session } from 'next-auth';

/**
 * Symbol used to attach cached session to request object
 * Using Symbol ensures no collision with other properties
 */
const SESSION_CACHE_SYMBOL = Symbol('cachedSession');

/**
 * Extended request type with session cache
 */
interface RequestWithSessionCache extends NextApiRequest {
  [SESSION_CACHE_SYMBOL]?: Session | null;
}

/**
 * Get cached session or fetch and cache if not available
 *
 * This function ensures that getServerSession() is only called once per request,
 * even if multiple tRPC procedures need to access the session.
 *
 * @param req - Next.js API request object
 * @param res - Next.js API response object
 * @returns Session or null if not authenticated
 *
 * @example
 * ```typescript
 * // In tRPC middleware
 * const session = await getCachedSession(req, res);
 * if (!session?.user) {
 *   throw new TRPCError({ code: 'UNAUTHORIZED' });
 * }
 * ```
 */
export async function getCachedSession(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<Session | null> {
  const extendedReq = req as RequestWithSessionCache;

  // Return cached session if exists
  if (SESSION_CACHE_SYMBOL in extendedReq) {
    logger.debug('[SessionCache] Returning cached session');
    return extendedReq[SESSION_CACHE_SYMBOL] ?? null;
  }

  // Fetch and cache session
  const startTime = performance.now();
  const session = await getServerSession(req, res, authOptions);
  const duration = performance.now() - startTime;

  extendedReq[SESSION_CACHE_SYMBOL] = session;

  // Extract userId safely for logging (user.id may not exist on all auth providers)
  const userId = session?.user ? (session.user as { id?: string }).id : undefined;
  logger.debug('[SessionCache] Session fetched and cached', {
    hasSession: !!session,
    userId,
    durationMs: duration.toFixed(2),
  });

  return session;
}

/**
 * Clear cached session from request object
 *
 * Use this when session needs to be refreshed within the same request
 * (e.g., after logout)
 *
 * @param req - Next.js API request object
 */
export function clearSessionCache(req: NextApiRequest): void {
  const extendedReq = req as RequestWithSessionCache;
  delete extendedReq[SESSION_CACHE_SYMBOL];
  logger.debug('[SessionCache] Session cache cleared');
}
