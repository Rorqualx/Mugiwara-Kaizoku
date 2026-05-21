/**
 * API Authentication Middleware
 *
 * Handles both API key and session-based authentication for requests
 */

import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { ApiAuthenticationError, createApiErrorResponse } from '@/utils/api-helpers';
import { isSuccess } from '@/utils/async-result';

import { apiAuthService } from '../services/apiAuth';

import type { ApiRequest, AuthContext } from './apiMiddleware';
import type { NextApiResponse } from 'next';
import type { Session } from 'next-auth';

/**
 * Public endpoints that don't require authentication
 */
const PUBLIC_ENDPOINTS = [
  '/api/v1/health',
  '/api/v1/openapi',
  '/api/v1/docs',
  '/api/prowlarr',  // Prowlarr proxy has its own authentication
  '/api/image-proxy',  // Image proxy is public for serving cached images
];

/**
 * Authentication middleware
 */
export async function apiAuthMiddleware(req: ApiRequest, res: NextApiResponse): Promise<void> {
  // Skip auth for public endpoints
  const requestUrl = req.url;
  if (requestUrl && PUBLIC_ENDPOINTS.some(endpoint => requestUrl.startsWith(endpoint))) {
    return;
  }

  // Skip auth for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return;
  }

  try {
    // Check if this is a reader endpoint (uses session auth)
    if (req.url?.startsWith('/api/reader')) {
      // Use session-based authentication for reader endpoints
      const session = await getServerSession(req, res, authOptions);

      if (!session?.user) {
        throw new ApiAuthenticationError('Authentication required');
      }

      // Extract user info with type safety
    const userId = (session.user as { id: string }).id;
    const userEmail = (session.user as { email?: string }).email ?? null;

      // Attach session info to request
      const authContext: AuthContext = {
        userId,
        email: userEmail,
        session: session as Session
      };

      // eslint-disable-next-line no-param-reassign -- Intentional mutation for middleware pattern
      req.auth = authContext;

      // Set user context headers
      res.setHeader('X-User-ID', userId);

      return;
    }

    // For non-reader endpoints, use API key authentication
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      throw new ApiAuthenticationError('API key required');
    }

    // Validate API key
    const authResult = await apiAuthService.validateApiKey(apiKey);

    if (!isSuccess(authResult)) {
      throw new ApiAuthenticationError('Invalid API key');
    }

    // Extract auth data with proper typing
    const authData = authResult.data as {
      userId?: string;
      apiKey?: string;
      permissions?: Array<{ resource: string; actions: string[] }>;
    };

    // Attach auth to request
    // Build auth context without assigning undefined for optional properties
    const authContext: AuthContext = {
      userId: authData.userId ?? ''
    };
    // Only add optional properties if they have values
    if (authData.apiKey !== undefined) {
      authContext.apiKey = authData.apiKey;
    }
    if (authData.permissions !== undefined) {
      authContext.permissions = authData.permissions;
    }

    // eslint-disable-next-line no-param-reassign -- Intentional mutation for middleware pattern
    req.auth = authContext;

    // Set user context headers
    res.setHeader('X-User-ID', authContext.userId);
    res.setHeader('X-API-Key-ID', authContext.apiKey ?? '');
  } catch (error: unknown) {
    // Type-safe error extraction
    let authError: Error;
    if (error instanceof Error) {
      authError = error;
    } else if (typeof error === 'string') {
      authError = new ApiAuthenticationError(error);
    } else {
      authError = new ApiAuthenticationError();
    }
    
    // Return auth error with proper typing
    const errorResponse = createApiErrorResponse(authError);

    res.status(401).json(errorResponse);
    return;
  }
}

/**
 * Extract API key from request
 */
function extractApiKey(req: ApiRequest): string | undefined {
  // Check X-API-Key header
  const headerKey = req.headers['x-api-key'];
  if (headerKey) {
    return Array.isArray(headerKey) ? headerKey[0] : headerKey;
  }

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const [type, key] = authHeader.split(' ');
    if (type && type.toLowerCase() === 'apikey') {
      return key;
    }
  }

  // Check query parameter (not recommended for production)
  if (req.query["apiKey"] && typeof req.query["apiKey"] === 'string') {
    return req.query["apiKey"];
  }

  return undefined;
}
