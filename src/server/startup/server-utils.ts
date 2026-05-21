/**
 * Server Utilities Module
 *
 * Shared utilities, constants, and Next.js initialization for server startup.
 * This is the foundation module that all server startup modules depend on.
 *
 * Extracted from: src/server/index.ts (lines 1-75)
 */

import * as express from 'express';
import * as next from 'next';

import { env } from '@/env/server';

// ============================================================================
// Express and Next.js Initialization
// ============================================================================

/**
 * Express application instance
 */
export const app = express["default"]();

/**
 * Server port from environment
 */
export const port = parseInt(env['KAIZOKU_PORT'], 10);

/**
 * Development mode flag
 */
export const dev = env['NODE_ENV'] !== 'production';

/**
 * Next.js application instance
 */
export const nextApp = next["default"]({ dev });

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
