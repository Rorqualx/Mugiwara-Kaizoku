/**
 * WebSocket Context Module for tRPC Integration
 * 
 * This module provides context creation functionality for tRPC when using WebSocket
 * connections. It injects the Prisma client and WebSocket request object into the
 * tRPC context, making them available throughout the WebSocket-based API procedures.
 * 
 * The WebSocket context is particularly important for real-time features like:
 * - Live updates
 * - Push notifications
 * - Bi-directional communication
 * - Long-running operations
 * 
 * @module wsContext
 */

import { prisma } from "./db";

import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateWSSContextFnOptions } from '@trpc/server/adapters/ws';

/**
 * Creates a context object for tRPC procedures when using WebSocket connections
 * 
 * This function is called for each new WebSocket connection to create a context
 * object that will be available in all WebSocket-based tRPC procedures. It provides:
 * - Prisma client for database operations
 * - WebSocket request object for connection details
 * 
 * @param {CreateWSSContextFnOptions} opts - Options provided by the WebSocket adapter
 * @returns {Object} Context object containing prisma client and request object
 * 
 * @example
 * // Usage in tRPC WebSocket subscription
 * export const onEvent = t.procedure.subscription(({ ctx }) => {
 *   return new Observable((emit) => {
 *     // Access prisma client from context
 *     const listener = ctx.prisma?.event.findMany()
 *       .then(events => emit.next(events));
 *     
 *     // Access WebSocket request details
 *     const clientIP = ctx.req.socket.remoteAddress;
 *     
 *     return () => {
 *       // Cleanup when client disconnects
 *       listener.unsubscribe();
 *     };
 *   });
 * });
 */
export function createWSContext(opts: CreateWSSContextFnOptions): {
  prisma: typeof prisma;
  req: CreateWSSContextFnOptions['req'];
} {
  return {
    prisma,
    req: opts.req
  };
}

/**
 * Type definition for the WebSocket context
 * 
 * This type represents the shape of the context object that will be
 * available in all WebSocket-based tRPC procedures. It includes:
 * - PrismaClient instance
 * - WebSocket Request object
 * 
 * @example
 * // Using WSContext type in a custom middleware
 * const withUser = t.middleware(({ ctx }: { ctx: WSContext }) => {
 *   if (!ctx.req.headers.authorization) {
 *     throw new TRPCError({ code: 'UNAUTHORIZED' });
 *   }
 *   return next();
 * });
 */
export type WSContext = inferAsyncReturnType<typeof createWSContext>;