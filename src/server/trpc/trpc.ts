/**
 * tRPC Core Configuration Module
 * 
 * This module initializes and exports the core tRPC instance with:
 * - Express and WebSocket context support
 * - SuperJSON transformer for enhanced data serialization
 * - Base router and procedure builders
 * 
 * @module server/trpc/trpc
 */

import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

import type { Context } from '../expressContext';
import type { WSContext } from '../wsContext';

/**
 * Core tRPC instance
 * 
 * Initialized with:
 * - Combined Context type supporting both Express and WebSocket contexts
 * - SuperJSON transformer for handling dates, BigInt, and other complex types
 * 
 * @private
 */
const t = initTRPC.context<Context | WSContext>().create({
  /**
   * SuperJSON transformer configuration
   * Enables serialization of:
   * - Date objects
   * - BigInt
   * - Map/Set
   * - Error objects
   * - Undefined values
   * - Regular expressions
   */
  transformer: superjson
});

/**
 * Router builder
 * 
 * Used to create new tRPC routers that can contain multiple procedures.
 * 
 * @example
 * ```ts
 * export const appRouter = router({
 *   hello: procedure.query(() => 'world'),
 *   posts: postsRouter
 * });
 * ```
 */
export const router = t.router;

/**
 * Base procedure
 *
 * Used to create new tRPC procedures (queries/mutations).
 * Can be extended with middleware for authentication, validation, etc.
 *
 * @example
 * ```ts
 * const hello = procedure
 *   .input(z.string())
 *   .query(({ input }) => `Hello ${input}!`);
 * ```
 */
export const procedure = t.procedure;

/**
 * Middleware builder
 *
 * Used to create custom middleware that can be applied to procedures.
 *
 * @example
 * ```ts
 * const loggerMiddleware = middleware(async ({ path, type, next }) => {
 *   logger.info(`${type} ${path}`);
 *   return next();
 * });
 * ```
 */
export const middleware = t.middleware;
