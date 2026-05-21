/**
 * Authentication Types
 *
 * Type definitions for authentication configuration.
 */

import type { UserRole } from '@prisma/client';
import type { Session } from "next-auth";

/**
 * Type for the credentials expected by the authorize function
 */
export interface Credentials {
  identifier: string;
  password: string;
}

/**
 * Extended Session type for our application
 */
export interface ExtendedSession extends Omit<Session, 'user'> {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
    role: UserRole;
    avatar?: string | null;
  };
}

/**
 * JWT token extension for storing user role and avatar
 */
export interface ExtendedJWT {
  sub?: string;
  role?: UserRole;
  avatar?: string | null;
}

/**
 * Type guard to check if a session is an ExtendedSession
 */
export function isExtendedSession(session: unknown): session is ExtendedSession {
  if (!session || typeof session !== 'object') {
    return false;
  }

  const sess = session as Record<string, unknown>;

  // Check if user object exists and has required properties
  if (!sess["user"] || typeof sess["user"] !== 'object') {
    return false;
  }

  const user = sess["user"] as Record<string, unknown>;

  return (
    typeof user["id"] === 'string' &&
    (user["name"] === null || typeof user["name"] === 'string') &&
    (user["email"] === null || typeof user["email"] === 'string') &&
    typeof user["role"] === 'string'
  );
}