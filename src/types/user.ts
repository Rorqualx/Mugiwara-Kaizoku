/**
 * User Type Definitions
 *
 * Single source of truth for user types using Prisma's User model.
 * No backward compatibility or duplicate definitions.
 *
 * @module types/user
 */

import type { User as PrismaUser, UserRole } from '@prisma/client';

/**
 * Re-export Prisma types as the source of truth
 */
export type { PrismaUser as User, UserRole };

/**
 * Public user profile type for safe external display
 */
export interface PublicUser {
  id: string;
  name: string;
  userName: string;
  avatar: string | null;
  createdAt: Date;
}

/**
 * Type guard to check if an object is a User
 */
export function isUser(user: unknown): user is PrismaUser {
  return (
    user !== null &&
    typeof user === 'object' &&
    'id' in user &&
    'email' in user &&
    'userName' in user &&
    'hashedPassword' in user
  );
}

/**
 * Convert User to PublicUser for safe external display
 */
export function toPublicUser(user: PrismaUser): PublicUser {
  return {
    id: user["id"],
    name: user["name"] ?? user.userName,
    userName: user.userName,
    avatar: user.avatar,
    createdAt: user.createdAt
  };
}