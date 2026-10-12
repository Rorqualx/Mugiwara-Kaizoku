/**
 * Server Utilities Module
 *
 * Shared utilities, constants, and Next.js initialization for server startup.
 * This is the foundation module that all server startup modules depend on.
 *
 * Extracted from: src/server/index.ts (lines 1-75)
 */

import { Server } from 'http';

import * as express from 'express';
import * as next from 'next';

import { env } from '@/env/server';

import { applySecurityDefaults } from './security-headers';

// ============================================================================
// Express and Next.js Initialization
// ============================================================================

/**
 * Express application instance
 */
export const app = express["default"]();

// No `X-Powered-By`, plus baseline security headers on every response.
// Registered here, at creation, so it runs before any route is mounted.
applySecurityDefaults(app);

/**
 * Server port from environment
 */
export const port = parseInt(env['KAIZOKU_PORT'], 10);

/**
 * Development mode flag
 */
export const dev = env['NODE_ENV'] !== 'production';

/**
 * Server that receives Next.js's own upgrade listener. It never listens.
 *
 * On the first request, Next attaches an `upgrade` listener to the server it
 * is given (or, without one, to the server the request came in on). That
 * listener ends every upgrade whose path matches a route, and `/api/v1/ws`
 * matches `pages/api/v1/ws.ts` — so on the real server it closed each live
 * WebSocket right after our handler accepted it. Next attaches here instead,
 * and `websocket-setup.ts` forwards only the upgrades Next should see
 * (`/_next/`, for HMR).
 */
export const nextUpgradeServer = new Server();

/**
 * Next.js application instance
 */
export const nextApp = next["default"]({ dev, httpServer: nextUpgradeServer });

/**
 * Next.js request handler
 */
export const nextHandler = nextApp.getRequestHandler();

// ============================================================================
// Helper Functions
// ============================================================================

// Re-export formatError from the separate error-utils module to maintain backwards compatibility
// while avoiding import side-effects in API routes
export { formatError } from './error-utils';
