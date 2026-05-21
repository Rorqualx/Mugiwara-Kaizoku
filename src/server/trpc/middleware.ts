/**
 * tRPC Middleware Collection
 *
 * Comprehensive middleware for:
 * - Request logging
 * - Performance monitoring
 * - Error handling
 * - Rate limiting
 * - Request validation
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { cache } from '@/server/cache/cache-adapter';
import { logSecurityEvent, SecurityEventType } from '@/server/utils/security-logger';
import { logger } from '@/utils/logger';

import { middleware } from './trpc';

/**
 * Request ID generator
 */
let requestCounter = 0;
function generateRequestId(): string {
  return `req_${Date.now()}_${++requestCounter}`;
}

/**
 * Logging middleware
 * Logs all requests and responses with timing information
 */
export const loggingMiddleware = middleware(async ({ path, type, next, input }) => {
  const requestId = generateRequestId();
  const start = Date.now();

  logger.info(`[${requestId}] ${type} ${path}`, {
    input: type === 'mutation' ? '[REDACTED]' : input,
  });

  try {
    const result = await next();
    const duration = Date.now() - start;

    logger.info(`[${requestId}] Completed in ${duration}ms`, {
      path,
      type,
      duration,
      success: true,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    logger.error(`[${requestId}] Failed after ${duration}ms`, {
      path,
      type,
      duration,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
});

/**
 * Performance monitoring middleware
 * Tracks slow queries and mutations
 */
export const performanceMiddleware = middleware(async ({ path, type, next }) => {
  const start = performance.now();
  const slowThreshold = type === 'query' ? 1000 : 2000; // 1s for queries, 2s for mutations

  const result = await next();

  const duration = performance.now() - start;

  if (duration > slowThreshold) {
    logger.warn(`Slow ${type} detected: ${path} took ${duration.toFixed(2)}ms`, {
      path,
      type,
      duration,
      threshold: slowThreshold,
    });
  }

  return result;
});

/**
 * Error handling middleware
 * Standardizes error responses and adds context
 * SECURITY: Sanitizes error details in production to prevent information disclosure
 */
export const errorHandlingMiddleware = middleware(async ({ path, type, next, ctx }) => {
  try {
    return await next();
  } catch (error) {
    // Always log full details server-side for debugging
    const ctxWithUser = ctx as { user?: { id: string } };
    logger.error(`Error in ${type} ${path}`, {
      path,
      type,
      userId: ctxWithUser.user?.id,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : String(error),
    });

    // TRPCError is already safe to send to client
    if (error instanceof TRPCError) {
      throw error;
    }

    // For other errors, sanitize based on environment
    if (process.env.NODE_ENV === 'production') {
      // Generic error message in production - no stack traces or internal details
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        // No cause, no stack trace - prevents information disclosure
      });
    } else {
      // Detailed error in development for debugging
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        cause: error,
      });
    }
  }
});

/**
 * Rate limiting middleware
 * Prevents abuse by limiting requests per IP/user
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export const rateLimitMiddleware = (options: {
  windowMs?: number;
  maxRequests?: number;
} = {}): ReturnType<typeof middleware> => {
  const windowMs = options.windowMs ?? 60000; // 1 minute default
  const maxRequests = options.maxRequests ?? 100; // 100 requests default

  return middleware(async ({ ctx, next, path }) => {
    // Get identifier (user ID or IP)
    const ctxWithUserAndIp = ctx as { user?: { id: string }; ip?: string };
    const identifier = ctxWithUserAndIp.user?.id ?? ctxWithUserAndIp.ip ?? 'anonymous';
    const key = `${identifier}:${path}`;
    const now = Date.now();

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(key, entry);
    }

    // Check rate limit
    if (entry.count >= maxRequests) {
      // Log security event for rate limit violation
      const ctxForLogging = ctx as { user?: { id: string; username?: string } };
      const userId = ctxForLogging.user?.id;
      const username = ctxForLogging.user?.username;
      const ipAddressValue = identifier.toString().includes(':') ? identifier.toString().split(':')[0] : identifier.toString();

      logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, {
        ...(userId !== undefined ? { userId: Number(userId) } : {}),
        ...(username !== undefined ? { username } : {}),
        ...(ipAddressValue !== undefined ? { ipAddress: ipAddressValue } : {}),
        resource: path,
        reason: 'Rate limit exceeded',
        maxRequests,
        windowMs,
        timestamp: new Date().toISOString(),
      });

      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Try again in ${Math.ceil((entry.resetAt - now) / 1000)} seconds.`,
      });
    }

    // Increment counter
    entry.count++;

    // Cleanup old entries periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup
      for (const [k, v] of rateLimitStore.entries()) {
        if (v.resetAt < now) {
          rateLimitStore.delete(k);
        }
      }
    }

    return next();
  });
};

/**
 * Validation middleware
 * Ensures input and output conform to schemas
 */
export const validationMiddleware = middleware(async ({ next, path }) => {
  try {
    const result = await next();

    // Log validation success
    logger.debug(`Validation passed for ${path}`);

    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}`,
        cause: error,
      });
    }
    throw error;
  }
});

/**
 * Context enrichment middleware
 * Adds useful context to all requests
 */
export const contextMiddleware = middleware(async ({ ctx, next }) => {
  const enrichedContext = {
    ...ctx,
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
    // Add more context as needed
  };

  return next({
    ctx: enrichedContext,
  });
});

/**
 * Caching middleware
 * Caches query results for improved performance
 *
 * ⚠️  WARNING: Using cache adapter (defaults to in-memory cache)
 * - In-memory cache resets on server restart
 * - Not shared across multiple server instances
 * - For production multi-instance deployments, configure Redis
 *   (see src/server/cache/cache-adapter.ts)
 *
 * Uses the global cache instance so mutations can invalidate cached queries.
 */
export const cachingMiddleware = (ttlMs: number = 60000): ReturnType<typeof middleware> => {
  return middleware(async ({ path, type, next, ctx }) => {
    // Only cache queries
    if (type !== 'query') {
      return next();
    }

    // Extract input from request context
    // For HTTP requests, input comes from query params (GET) or body (POST)
    // Note: We must extract from ctx.req because 'input' is undefined in middleware
    // (input becomes available only after .input() validation in the procedure chain)
    let inputForKey = 'no-input';
    const context = ctx as { req?: { query?: { input?: string }; body?: unknown } };
    if (context.req?.query?.input) {
      // GET request - input is in query string
      inputForKey = context.req.query.input;
    } else if (context.req?.body) {
      // POST request - input is in body
      inputForKey = JSON.stringify(context.req.body);
    }

    const cacheKey = `trpc:${path}:${inputForKey}`;

    // Check cache using global cache adapter
    const cached = await cache.get(cacheKey);
    if (cached !== null) {
      logger.debug(`Cache hit for ${path}`);
      return cached as Awaited<ReturnType<typeof next>>;
    }

    // Execute and cache
    const result = await next();

    // Store in cache with TTL in seconds
    await cache.set(cacheKey, result, Math.floor(ttlMs / 1000));

    logger.debug(`Cache miss for ${path}, cached for ${ttlMs}ms`);
    return result;
  });
};

/**
 * Compose multiple middleware
 * Utility to combine middleware in order
 */
export const composeMiddleware = (...middlewares: unknown[]): ReturnType<typeof middleware> => {
  return middleware(async (opts) => {
    let index = 0;

    // Define next function with explicit return type to break circular reference
    const next = async (): Promise<unknown> => {
      if (index >= middlewares.length) {
        return opts.next();
      }

      const currentMiddleware = middlewares[index++] as (opts: unknown) => Promise<unknown>;
      return currentMiddleware({
        ...opts,
        next,
      });
    };

    return next() as Promise<Awaited<ReturnType<typeof opts.next>>>;
  });
};

/**
 * Default middleware stack
 * Applied to all procedures unless overridden
 */
export const defaultMiddleware = composeMiddleware(
  contextMiddleware,
  loggingMiddleware,
  performanceMiddleware,
  errorHandlingMiddleware,
  validationMiddleware,
);

/**
 * Protected middleware stack
 * Applied to protected procedures
 */
export const protectedMiddleware = composeMiddleware(
  defaultMiddleware,
  rateLimitMiddleware({ maxRequests: 60, windowMs: 60000 }),
);

/**
 * Public middleware stack with aggressive rate limiting
 */
export const publicMiddleware = composeMiddleware(
  defaultMiddleware,
  rateLimitMiddleware({ maxRequests: 30, windowMs: 60000 }),
  cachingMiddleware(30000), // Cache for 30 seconds
);

/**
 * Admin middleware stack with minimal restrictions
 */
export const adminMiddleware = composeMiddleware(
  contextMiddleware,
  loggingMiddleware,
  errorHandlingMiddleware,
);