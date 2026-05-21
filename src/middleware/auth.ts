/**
 * Authentication Middleware
 *
 * Provides middleware functions for protecting API routes and components
 * based on authentication and role requirements.
 *
 * Features:
 * - API route protection
 * - Role-based access control
 * - Session validation
 * - Development mode support
 *
 * @module middleware/auth
 */

import { auth } from '../lib/auth/config';
import { logger } from '../server/utils/logger';

import type { ExtendedSession } from '../lib/auth/types';
import type { NextApiRequest, NextApiResponse, NextApiHandler } from 'next';



/**
 * API route middleware that requires authentication
 * 
 * Wraps an API handler to ensure the user is authenticated before
 * allowing access to the handler functionality.
 * 
 * @param {NextApiHandler} handler - The API handler to protect
 * @param {boolean} requireAdmin - Whether admin role is required
 * @returns {NextApiHandler} Protected API handler
 */
export function withAuth(handler: NextApiHandler, requireAdmin = false): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Validate the user's session using Auth.js
      const session = await auth(req, res);

      // If no session found, user is not authenticated
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized - Authentication required'
        });
      }

      // If admin role is required, check the user's role
      if (requireAdmin) {
        // Use proper type guard for ExtendedSession
        const extendedSession = session as ExtendedSession;

        // Check if user has admin role using safer type checking
        const sessionRecord = session as unknown as Record<string, unknown>;
        const userRecord = sessionRecord['user'] as Record<string, unknown> | undefined;
        const userRole = userRecord?.['role'];

        // Also check using the typed session with safer access
        const extendedUser = extendedSession.user as unknown as Record<string, unknown>;
        const extendedUserRole = extendedUser['role'];

        // Use safer role checking with proper type guards
        const isAdminRole = (role: unknown): boolean => {
          if (typeof role === 'string') {
            return role.toUpperCase() === 'ADMIN';
          }
          return false;
        };

        if (!isAdminRole(extendedUserRole) && !isAdminRole(userRole)) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden - Admin access required'
          });
        }
      }

      // User is authenticated and has required role, proceed to handler
      return await handler(req, res);
    } catch (error: unknown) {
      logger.error('Authentication middleware error');

      // Only log detailed errors in non-production environments
      if (process.env.NODE_ENV !== 'production') {
        logger.debug('Auth middleware details:', error instanceof Error ? error.message : String(error));
      }

      return res.status(500).json({
        success: false,
        error: 'Authentication error'
      });
    }
  };
}

/**
 * API response for rate limiting
 * 
 * Standardized response for rate-limited requests
 * 
 * @param {NextApiResponse} res - The response object
 * @returns {void}
 */
export function sendRateLimitResponse(res: NextApiResponse): void {
  res.status(429).json({
    success: false,
    error: 'Too many requests. Please try again later.'
  });
}

/**
 * API response for CSRF token validation failure
 * 
 * Standardized response for failed CSRF validation
 * 
 * @param {NextApiResponse} res - The response object
 * @returns {void}
 */
export function sendCsrfFailureResponse(res: NextApiResponse): void {
  res.status(403).json({
    success: false,
    error: 'CSRF token validation failed'
  });
}