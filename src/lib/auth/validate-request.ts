/**
 * Session Validation Utilities
 * 
 * This module provides functions to validate user sessions for both API routes
 * and server-side rendered pages, ensuring proper authentication throughout the
 * Kaizoku application.
 * 
 * Features:
 * - API route session validation
 * - Server-side page rendering validation
 * - Consistent error handling
 * - Type-safe session and user data
 * 
 * @module lib/auth/validate-request
 */

import { logger } from '@/utils/logger';

import { auth } from "./auth-options";

import type { ExtendedSession } from "./types";
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next";

/**
 * Validates session for API routes
 * 
 * Checks if the request has a valid authentication session.
 * Used to protect API endpoints from unauthorized access.
 * 
 * @param {NextApiRequest} req - API request object
 * @param {NextApiResponse} res - API response object
 * @returns {Promise<Object>} Object containing user and session information
 */
export const validateApiRequest = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ user: ExtendedSession['user'] | null; session: ExtendedSession | null }> => {
  try {
    const session = await auth(req, res);
    
    if (!session) {
      logger.debug('Authentication required');
      return { user: null, session: null };
    }
    
    // Convert the session to ExtendedSession type with proper role handling
    const extendedSession = session as ExtendedSession;

    // Ensure role is properly typed as UserRole
    const role = String(extendedSession.user.role).toUpperCase();
    if (role === 'ADMIN' || role === 'USER') {
      extendedSession.user.role = role as 'ADMIN' | 'USER';
    }

    return {
      user: extendedSession.user,
      session: extendedSession
    };
  } catch (error: unknown) {
    logger.error('Authentication validation error');
    // Log details only in non-production environment
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('Auth validation details:', error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error));
    }
    return { user: null, session: null };
  }
};

/**
 * Validates session for server-side rendered pages
 * 
 * Checks if the request has a valid authentication session.
 * Used to protect pages from unauthorized access during server-side rendering.
 * 
 * @param {GetServerSidePropsContext} context - Next.js page context
 * @returns {Promise<Object>} Object containing user and session information
 */
export const validateRequest = async (
  context: GetServerSidePropsContext
): Promise<{ user: ExtendedSession['user'] | null; session: ExtendedSession | null }> => {
  try {
    const session = await auth(context.req, context.res);
    
    if (!session) {
      logger.debug('Authentication required for page');
      return { user: null, session: null };
    }
    
    // Convert the session to ExtendedSession type with proper role handling
    const extendedSession = session as ExtendedSession;

    // Ensure role is properly typed as UserRole
    const role = String(extendedSession.user.role).toUpperCase();
    if (role === 'ADMIN' || role === 'USER') {
      extendedSession.user.role = role as 'ADMIN' | 'USER';
    }

    return {
      user: extendedSession.user,
      session: extendedSession
    };
  } catch (error: unknown) {
    logger.error('Page authentication validation error');
    // Log details only in non-production environment
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('Auth validation details:', error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error));
    }
    return { user: null, session: null };
  }
};

/**
 * DEPRECATED: Development mode bypass has been removed for security reasons.
 * Authentication now requires proper credentials in all environments.
 * 
 * For testing purposes, use proper test users and credentials.
 */