/**
 * NextAuth Middleware Type Extensions
 * 
 * This file extends the NextAuth middleware types to provide proper typing
 * for the request object in middleware functions.
 */

import type { UserRole } from '../utils/typescript-compat';

declare module 'next-auth/middleware' {
  /**
   * Extends the NextRequestWithAuth interface to include the auth property
   * This property is added by the withAuth wrapper but is not properly typed in NextAuth
   */
  interface NextRequestWithAuth {
    auth?: {
      /**
       * The JWT token from the session
       */
      token?: {
        id: string;
        role: UserRole;
        avatar?: string;
        name?: string;
        email?: string;
        exp?: number;
        iat?: number;
        jti?: string;
      };
    };
  }
}