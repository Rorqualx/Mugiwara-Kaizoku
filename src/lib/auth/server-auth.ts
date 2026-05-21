/**
 * Server Authentication Utilities
 *
 * This module provides server-side authentication functions for API routes
 * and server components.
 *
 * @module lib/auth/server-auth
 */

import type { AsyncResult} from '@/utils/async-result';
import { isSuccess, isError, createSuccessResult, createErrorResult, createContextualError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { auth } from './config';
import { validateCredentials } from './credentials';

/**
 * Server-side sign in function for API routes
 * @param credentials - User credentials
 * @returns Authentication result
 */
export async function signIn(identifier: string, password: string): Promise<AsyncResult<unknown, Error>> {
  try {
    // Validate credentials using the shared utility
    const validationResult = await validateCredentials(identifier, password);

    if (isError(validationResult)) {
      return createErrorResult(
        createContextualError(
          validationResult.error.message || 'Invalid credentials',
          'INVALID_CREDENTIALS'
        )
      );
    }

    if (isSuccess(validationResult)) {
      // In NextAuth v4, sign in is handled via the API route
      // Return the validation result for now
      return createSuccessResult(validationResult.data);
    }

    // Handle idle or loading states
    return createErrorResult(
      createContextualError(
        'Unexpected validation state',
        'UNEXPECTED_STATE'
      )
    );
  } catch (error: unknown) {
    logger.error('Server-side sign in error:', error);
    return createErrorResult(
      createContextualError(
        error instanceof Error ? error.message : 'Authentication failed',
        'AUTH_ERROR'
      )
    );
  }
}

/**
 * Server-side sign out function for API routes
 * @returns Logout result
 */
export function signOut(): Promise<AsyncResult<null, Error>> {
  // In NextAuth v4, sign out is handled via the API route
  // Return success for now
  return Promise.resolve(createSuccessResult(null));
}

/**
 * Gets the current session from the server
 * @returns Current auth session
 */
export async function getSession(): Promise<Awaited<ReturnType<typeof auth>>> {
  return auth();
}

/**
 * Exports credentials validation for server-side use
 */
export { validateCredentials };

export default {
  signIn,
  signOut,
  getSession,
  validateCredentials
};