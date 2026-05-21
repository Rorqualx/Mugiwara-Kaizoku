/**
 * Auth.js Type Extensions
 * 
 * This file provides type definitions and augmentations for Auth.js,
 * fixing compatibility issues with NextAuth.js types.
 */

import type { DefaultSession } from '@auth/core/types';

declare module '@auth/core/types' {
  /**
   * Extends the default session type to include user properties
   * needed throughout the application.
   */
  interface Session {
    user: {
      id: string;
      userName?: string;
      role: string;
      createdAt?: string;
      updatedAt?: string;
      avatar?: string | null;
    } & DefaultSession['user']
  }

  /**
   * Extends the default user type to include additional
   * properties stored in the database.
   */
  interface User {
    id: string;
    userName?: string;
    role: string;
    createdAt?: string;
    updatedAt?: string;
    avatar?: string | null;
  }
}
