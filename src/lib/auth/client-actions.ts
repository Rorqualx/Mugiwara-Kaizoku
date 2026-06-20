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
      // Clear the session cookie but skip NextAuth's own redirect. NextAuth
      // resolves the callbackUrl against NEXTAUTH_URL, which on self-hosted
      // instances (where it is unset) falls back to localhost. Navigate
      // ourselves to a relative path so we always stay on the current origin.
      await signOut({ redirect: false });
    } catch (error: unknown) {
      logger.error('Error signing out:', error);
    } finally {
      window.location.href = '/login';
    }
  };

  return {
    signOut: handleSignOut,
  };
};
