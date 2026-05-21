/**
 * WebSocket Context Module for tRPC
 * 
 * This module provides WebSocket context creation for tRPC, enabling real-time
 * communication capabilities. It handles the conversion between Node.js HTTP
 * request types and Next.js API request types to maintain compatibility.
 * 
 * @module server/trpc/wsContext
 */

import { prisma } from "../db";

import type { Context } from './context';
import type { IncomingMessage } from 'http';
import type { NextApiRequest } from 'next';
import type { WebSocket } from 'ws';

/**
 * Enhanced request type that combines Node.js IncomingMessage with Next.js API request
 * 
 * This type ensures compatibility between WebSocket requests (which use Node's
 * IncomingMessage) and the Next.js API request type expected by our context.
 * 
 * @typedef {IncomingMessage & Partial<NextApiRequest>} EnhancedRequest
 */
type EnhancedRequest = IncomingMessage & Partial<NextApiRequest>;

/**
 * Creates a WebSocket-compatible context for tRPC
 * 
 * This function adapts WebSocket connections to work with our tRPC context by:
 * 1. Converting the Node.js request type to a Next.js compatible request
 * 2. Providing the Prisma client for database operations
 * 3. Maintaining type safety through the Context interface
 * 
 * @param {Object} opts - WebSocket context options
 * @param {IncomingMessage} opts.req - The incoming WebSocket request
 * @param {WebSocket} opts.res - The WebSocket connection
 * @returns {Context} A context object compatible with our tRPC setup
 * 
 * @example
 * ```ts
 * // Usage in WebSocket handler
 * const wsServer = new ws.Server({ server });
 * wsServer.on('connection', (ws, req) => {
 *   const context = createWSContext({ req, res: ws });
 *   // Use context with tRPC procedures
 * });
 * ```
 */
export function createWSContext(opts: {
  req: IncomingMessage;
  res: WebSocket;
}): Context {
  // Cast the IncomingMessage to our enhanced type to make it compatible with NextApiRequest
  const enhancedReq = opts.req as EnhancedRequest;

  return {
    prisma,
    req: enhancedReq as NextApiRequest
  };
}