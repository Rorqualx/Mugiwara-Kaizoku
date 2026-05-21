"use client";

/**
 * Client-side authentication action hooks
 *
 * Provides hooks for client-side authentication operations.
 * User CRUD goes through the tRPC `users` router; this hook only
 * exposes the sign-out flow.
 */

import { signOut } from "next-auth/react";

import { logger } from '@/utils/logger';

export const useAuthActions = (): {
  signOut: () => Promise<void>;
} => {
  const handleSignOut = async (): Promise<void> => {
    logger.info("Sign out action called");

    try {
      await signOut({ callbackUrl: '/login' });
    } catch (error: unknown) {
      logger.error('Error signing out:', error);
      window.location.href = '/login';
    }
  };

  return {
    signOut: handleSignOut,
  };
};
