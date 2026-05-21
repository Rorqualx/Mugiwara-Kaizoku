/**
 * Page-specific session validation utilities
 * 
 * This module provides simplified session validation for development.
 * It simulates authentication without requiring a real database or sessions.
 */

import { logApiDebug } from '@/utils/admin-debug';

import type { UserRole } from '@prisma/client';

// Define minimal User and Session types for development
// These are simplified types for dev/test scenarios
type User = {
  id: string;
  userName: string;
  email: string;
  role: UserRole;
};

type Session = {
  id: string;
  userId: string;
  fresh: boolean;
  expiresAt: Date;
};

// Create a development user
const devUser: User = {
  id: 'dev-user-1',
  userName: 'admin',
  email: 'kaizoku@admin.com',
  role: 'ADMIN'
};

// Create a development session
const devSession: Session = {
  id: 'dev-session-1',
  userId: 'dev-user-1',
  fresh: true,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
};

/**
 * Validates session for API routes - DEVELOPMENT IMPLEMENTATION
 *
 * For development purposes, this always returns a valid user and session.
 */
export const validateApiRequest = (): Promise<{ user: User | null; session: Session | null }> => {
  logApiDebug('Using development validateApiRequest');
  return Promise.resolve({ user: devUser, session: devSession });
};

/**
 * Validates session for server-side rendered pages - DEVELOPMENT IMPLEMENTATION
 *
 * For development purposes, this always returns a valid user and session.
 */
export const validateRequest = (): Promise<{ user: User | null; session: Session | null }> => {
  logApiDebug('Using development validateRequest');
  return Promise.resolve({ user: devUser, session: devSession });
};
