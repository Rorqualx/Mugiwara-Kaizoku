/**
 * API Error Handling Middleware
 * 
 * Centralizes error handling for API responses
 */

import { createApiErrorResponse, getErrorStatusCode } from '@/utils/api-helpers';
import { logger } from '@/utils/logger';

import type { ApiRequest } from './apiMiddleware';
import type { NextApiResponse } from 'next';

/**
 * Error handling middleware
 */
export function apiErrorMiddleware(
  error: unknown,
  req: ApiRequest,
  res: NextApiResponse
): Promise<void> {
  // Log error
  logger.error(
    'API error occurred',
    error,
    {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
    }
  );

  // Don't send response if headers already sent
  if (res.headersSent) {
    return Promise.resolve();
  }

  // Create error response
  const errorResponse = createApiErrorResponse(
    error instanceof Error ? error : new Error('An unexpected error occurred')
  );

  // Get status code
  const statusCode = getErrorStatusCode(
    error instanceof Error ? error : new Error()
  );

  // Send error response
  res["status"](statusCode).json(errorResponse);
  return Promise.resolve();
}

/**
 * Wrap async route handlers to catch errors
 */
export function withErrorHandler(
  handler: (req: ApiRequest, res: NextApiResponse) => Promise<void>
): (req: ApiRequest, res: NextApiResponse) => Promise<void> {
  return async (req: ApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
await apiErrorMiddleware(errorMessage, req, res);
    }
  };
}