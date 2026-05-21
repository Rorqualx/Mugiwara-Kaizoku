/**
 * API Middleware
 * 
 * Main middleware that combines all API middleware components
 */

import { randomUUID } from 'crypto';

import { apiAuthMiddleware } from './apiAuth';
import { apiCorsMiddleware } from './apiCors';
import { apiErrorMiddleware } from './apiError';
import { apiLoggingMiddleware } from './apiLogging';
import { apiPerformanceMiddleware } from './apiPerformance';

import type { NextApiRequest, NextApiResponse } from 'next';

export interface AuthContext {
  userId: string;
  email?: string | null | undefined;
  apiKey?: string | undefined;
  session?: unknown;
  permissions?: Array<{
    resource: string;
    actions: string[];
  }>;
}

export interface ApiRequest extends NextApiRequest {
  requestId?: string;
  auth?: AuthContext;
}

/**
 * Enhance request with requestId without direct param reassignment
 */
function enhanceRequestWithId(req: ApiRequest): string {
  const headerValue = req.headers['x-request-id'];
  const requestId = (typeof headerValue === 'string' ? headerValue : undefined) ?? randomUUID();
  Object.assign(req, { requestId });
  return requestId;
}

/**
 * Run middleware chain recursively to avoid await-in-loop
 */
async function runMiddlewareChain(
  middlewares: ReadonlyArray<(req: ApiRequest, res: NextApiResponse) => Promise<void> | void>,
  index: number,
  req: ApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (index >= middlewares.length || res.headersSent) {
    return;
  }
  const currentMiddleware = middlewares[index];
  if (currentMiddleware) {
    await currentMiddleware(req, res);
  }
  await runMiddlewareChain(middlewares, index + 1, req, res);
}

/**
 * Compose multiple middleware functions
 */
function compose(...middlewares: Array<(req: ApiRequest, res: NextApiResponse) => Promise<void> | void>): (req: ApiRequest, res: NextApiResponse) => Promise<void> {
  return async (req: ApiRequest, res: NextApiResponse) => {
    await runMiddlewareChain(middlewares, 0, req, res);
  };
}

/**
 * Main API middleware
 * 
 * Combines all middleware components and wraps the handler
 */
export function apiMiddleware(
  handler: (req: ApiRequest, res: NextApiResponse) => Promise<void> | void
): (req: ApiRequest, res: NextApiResponse) => Promise<void> {
  return async (req: ApiRequest, res: NextApiResponse) => {
    // Generate request ID using helper to avoid param reassignment
    const requestId = enhanceRequestWithId(req);
    res.setHeader('X-Request-ID', requestId);

    try {
      // Run middleware stack
      const middleware = compose(
        apiCorsMiddleware,
        apiPerformanceMiddleware,
        apiLoggingMiddleware,
        apiAuthMiddleware,
      );

      await middleware(req, res);

      if (!res.headersSent) {
        // Run the actual handler
        await handler(req, res);
      }
    } catch (error: unknown) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      await apiErrorMiddleware(errorMessage, req, res);
    }
  };
}