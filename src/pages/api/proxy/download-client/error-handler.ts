/**
 * Download Client Proxy Error Handler Module
 *
 * Error handling and response management for download client proxy operations.
 *
 * Extracted from: src/pages/api/proxy/download-client.ts
 */

import { NextApiResponse } from 'next';

// ============================================================================
// Error Handler Types
// ============================================================================

/**
 * Error response interface
 */
export interface ErrorResponse {
  status: number;
  message: string;
  details?: unknown;
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  clientType: string;
  endpoint: string;
}

// ============================================================================
// Error Response Builder
// ============================================================================

/**
 * Build standardized error response
 */
export function buildErrorResponse(status: number, message: string, details?: unknown): ErrorResponse {
  return {
    status,
    message,
    details
  };
}

/**
 * Handle HTTP client errors
 */
export function handleHttpClientError(error: unknown, _config: ErrorHandlerConfig): ErrorResponse {
  const axiosError = error as {
    response?: {
      status?: number;
      data?: unknown;
    };
    code?: string;
    message?: string;
  };

  // Handle specific HTTP status codes
  if (axiosError.response?.status) {
    switch (axiosError.response.status) {
      case 400:
        return buildErrorResponse(400, 'Bad request to download client', axiosError.response.data);
      case 401:
        return buildErrorResponse(401, 'Authentication failed for download client');
      case 403:
        return buildErrorResponse(403, 'Access forbidden to download client');
      case 404:
        return buildErrorResponse(404, 'Download client endpoint not found');
      case 409:
        // Transmission conflict handled separately
        return buildErrorResponse(409, 'Conflict with download client', axiosError.response.data);
      case 500:
        return buildErrorResponse(500, 'Download client server error', axiosError.response.data);
      case 502:
        return buildErrorResponse(502, 'Bad gateway to download client');
      case 503:
        return buildErrorResponse(503, 'Download client service unavailable');
      default:
        return buildErrorResponse(
          axiosError.response.status,
          `Download client returned error: ${axiosError.response.status}`,
          axiosError.response.data
        );
    }
  }

  // Handle network errors
  if (axiosError.code === 'ECONNREFUSED') {
    return buildErrorResponse(503, 'Download client connection refused');
  }

  if (axiosError.code === 'ETIMEDOUT') {
    return buildErrorResponse(504, 'Download client request timeout');
  }

  // Handle generic errors
  return buildErrorResponse(500, 'Unknown error communicating with download client', error);
}

// ============================================================================
// Response Handler
// ============================================================================

/**
 * Send error response to client
 */
export function sendErrorResponse(res: NextApiResponse, errorResponse: ErrorResponse): void {
  res.status(errorResponse.status).json({
    error: errorResponse.message,
    details: errorResponse.details
  });
}

/**
 * Send success response to client
 */
export function sendSuccessResponse(res: NextApiResponse, data: unknown): void {
  res.status(200).json(data);
}

// ============================================================================
// Main Error Handler
// ============================================================================

/**
 * Main error handler for download client proxy
 */
export function handleProxyError(error: unknown, config: ErrorHandlerConfig, res: NextApiResponse): void {
  const errorResponse = handleHttpClientError(error, config);
  sendErrorResponse(res, errorResponse);
}
