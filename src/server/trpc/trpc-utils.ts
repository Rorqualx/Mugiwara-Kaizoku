/**
 * tRPC Utilities Module
 * 
 * This module initializes and configures the tRPC instance for the application.
 * It provides the core building blocks for creating type-safe APIs by setting up:
 * - Express and WebSocket context types
 * - Superjson transformer for enhanced data serialization
 * - Base router and procedure builders
 * 
 * @module trpcUtils
 */

import { initTRPC } from '@trpc/server';
// @ts-ignore - Using relative path instead of alias path
import superjson from 'superjson';

import type { Context } from '../expressContext';
// @ts-ignore - Using relative path instead of alias path
import type { WSContext } from '../wsContext';

/**
 * tRPC instance initialized with combined Express and WebSocket contexts
 * Uses superjson transformer to handle complex data types like Date and BigInt
 */
const t = initTRPC.context<Context | WSContext>().create({
  transformer: superjson
});

/**
 * Base router builder for creating tRPC routers
 * Used to define API routes and their corresponding handlers
 * 
 * @example
 * ```typescript
 * export const myRouter = router({
 *   getData: procedure.query(async () => {
 *     return { data: 'example' };
 *   })
 * });
 * ```
 */
export const router = t.router;

/**
 * Base procedure builder for creating tRPC procedures
 * Used to define individual API endpoints with input validation and handlers
 * 
 * @example
 * ```typescript
 * const getUser = procedure
 *   .input(z.object({ id: z.string() }))
 *   .query(async ({ input }) => {
 *     return { userId: input["id"] };
 *   });
 * ```
 */
export const procedure = t.procedure;
