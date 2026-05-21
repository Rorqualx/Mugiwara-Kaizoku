/**
 * Authentication library utilities
 * 
 * This module provides utility functions for authentication.
 * The primary authentication is now handled by NextAuth.js.
 */

import { nanoid } from "nanoid";
import { getServerSession } from "next-auth/next";

import { logger } from '@/utils/logger';

import { authOptions } from '../pages/api/auth/[...nextauth]';

import type { GetServerSidePropsContext } from "next";
import type { Session } from "next-auth";

// Import getServerSession with explicit type annotations

// Import the shared prisma instance

/**
 * Generates a random ID of specified length
 * 
 * @param {number} length - Length of the ID to generate
 * @returns {string} Random ID
 */
export const generateId = (length: number = 15): string => {
  return nanoid(length);
};

/**
 * Get the current session on the server side
 * 
 * @param {Object} context - GetServerSideProps context or request/response objects
 * @returns {Promise<Session | null>} Session data or null
 */
export async function auth(context?: GetServerSidePropsContext): Promise<Session | null> {
  try {
    if (context) {
      // Use getServerSession directly with proper typing
      // @ts-ignore - We need to handle type incompatibility between Auth.js versions
      return await getServerSession(context.req, context.res, authOptions);
    }
    
    // If no context, return null - client-side will use useSession hook
    return null;
  } catch (error: unknown) {
    logger.error('Auth function error:', error);
    return null;
  }
}

// Export for compatibility
export { authOptions };