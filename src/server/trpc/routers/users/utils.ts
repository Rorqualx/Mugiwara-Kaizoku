/**
 * Users Utilities Module
 *
 * Shared helper functions, type definitions, and validation schemas
 * used across all users modules.
 *
 * Extracted from: users.ts (lines 27-189)
 * Includes deduplication helpers to eliminate 104 lines of duplicate code
 */

import { UserRole, Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { hashPassword, validatePasswordStrength } from '@/server/utils/auth';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { isObject, hasProperty } from '@/utils/type-guards';

// ============================================================================
// Domain Types
// ============================================================================

/**
 * Domain shape returned by every users router procedure.
 * Concrete types so tRPC end-to-end inference works for clients.
 */
export interface UserDomain {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date | null;
  avatarUrl: string | null;
  preferences: Record<string, never>;
}

/** Subset of Prisma User selected by every users-router query */
type DbUserSelection = Pick<
  Prisma.UserGetPayload<{
    select: {
      id: true;
      userName: true;
      email: true;
      role: true;
      createdAt: true;
      updatedAt: true;
      lastLogin: true;
      image: true;
      avatar: true;
    };
  }>,
  'id' | 'userName' | 'email' | 'role' | 'createdAt' | 'updatedAt' | 'lastLogin' | 'image' | 'avatar'
>;


// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely extract user ID from context
 */
export function getUserId(ctx: unknown): string | undefined {
  const ctxObj = ctx as Record<string, unknown>;
  const user = isObject(ctxObj) && hasProperty(ctxObj, 'user') ? ctxObj['user'] : undefined;
  if (!isObject(user) || !hasProperty(user, 'id')) {
    return undefined;
  }
  const userId = user['id'];
  return typeof userId === 'string' || typeof userId === 'number'
    ? String(userId)
    : undefined;
}

/**
 * Map database user to domain user
 */
export function mapDbUserToDomain(dbUser: DbUserSelection): UserDomain {
    return {
        id: dbUser.id,
        username: dbUser.userName,
        email: dbUser.email,
        role: dbUser.role,
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
        lastLogin: dbUser.lastLogin,
        avatarUrl: dbUser.image ?? dbUser.avatar,
        preferences: {}
    };
}

/**
 * Get users with pagination and filtering
 */
export async function getUsersWithPagination(
  input: z.infer<typeof paginationSchema>
): Promise<AsyncResult<{
    users: UserDomain[];
    total: number;
    pages: number;
}, Error>> {
    try {
        const { page, limit, search, role } = input;
        const skip = (page - 1) * limit;
        // Build where clause
        const where: Prisma.UserWhereInput = {};
        if (search) {
            where.OR = [
                { userName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (role) {
            where.role = role;
        }
        // Get users and count
        const [dbUsers, total] = await Promise.all([prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: 'desc'
                },
                select: {
                    id: true,
                    userName: true,
                    email: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true,
                    lastLogin: true,
                    image: true,
                    avatar: true
                }
            }), prisma.user.count({
                where
            })]);
        // Map to domain users
        const users = dbUsers.map(mapDbUserToDomain);
        const pages = Math.ceil(total / limit);
        return createSuccessResult({
            users,
            total,
            pages
        });
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to fetch users'));
    }
}

// ============================================================================
// Deduplication Helpers (NEW)
// ============================================================================

/**
 * Validate password strength and hash if valid
 * Eliminates duplication across create/update procedures
 */
export async function validateAndHashPassword(password: string): Promise<AsyncResult<string, Error>> {
  const validation = validatePasswordStrength(password);
  if (!validation.isStrong) {
    return createErrorResult(new Error(validation.feedback.join(', ')));
  }
  const hashedPassword = await hashPassword(password);
  return createSuccessResult(hashedPassword);
}

/**
 * Check for username/email conflicts
 * Eliminates duplication across create/update procedures
 */
export async function checkUserConflicts(
  username?: string,
  email?: string,
  excludeId?: string
): Promise<AsyncResult<void, Error>> {
  const where: Prisma.UserWhereInput = {};

  if (excludeId) {
    where.AND = [
      { id: { not: excludeId } },
      {
        OR: [
          username ? { userName: username } : {},
          email ? { email: email } : {}
        ].filter(obj => Object.keys(obj).length > 0)
      }
    ];
  } else {
    where.OR = [
      username ? { userName: username } : {},
      email ? { email: email } : {}
    ].filter(obj => Object.keys(obj).length > 0);
  }

  const conflictUser = await prisma.user.findFirst({ where });
  if (conflictUser) {
    const message = conflictUser.userName === username
      ? 'Username already exists'
      : 'Email already exists';
    return createErrorResult(new Error(message));
  }
  return createSuccessResult(undefined);
}

/**
 * Build user update data object
 * Eliminates duplication in update procedures
 */
export function buildUserUpdateData(input: {
  username?: string;
  email?: string;
  hashedPassword?: string;
  role?: UserRole;
  avatarUrl?: string | null;
}): Prisma.UserUpdateInput {
  const data: Prisma.UserUpdateInput = {};
  if (input.username) data.userName = input.username;
  if (input.email) data.email = input.email;
  if (input.hashedPassword) data.hashedPassword = input.hashedPassword;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DB only supports ADMIN/USER roles
  if (input.role && (input.role === UserRole.ADMIN || input.role === UserRole.USER)) {
    data.role = input.role;
  }
  if (input.avatarUrl !== undefined) data.image = input.avatarUrl;
  return data;
}

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Shared password schema (OWASP A07:2021 — must match validatePasswordStrength).
 * Min 8 chars, at least one uppercase, one lowercase, one digit.
 */
export const passwordSchema = z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be at most 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

/** Shared preferences shape — accepted by update procedures (not yet persisted). */
const preferencesSchema = z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    language: z.string().optional(),
    notificationsEnabled: z.boolean().optional(),
    downloadNotifications: z.boolean().optional(),
    newChapterNotifications: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
    defaultPageSize: z.number().optional(),
    defaultView: z.enum(['grid', 'list', 'details']).optional(),
    hideNsfw: z.boolean().optional()
});

/**
 * User creation schema
 */
export const createUserSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters').max(50),
    email: z.string().email('Invalid email address'),
    password: passwordSchema,
    role: z.nativeEnum(UserRole).default(UserRole.USER),
    preferences: preferencesSchema.optional()
});

/**
 * User update schema
 */
export const updateUserSchema = z.object({
    id: z.string(),
    username: z.string().min(3).max(50).optional(),
    email: z.string().email().optional(),
    password: passwordSchema.optional(),
    role: z.nativeEnum(UserRole).optional(),
    preferences: preferencesSchema.nullable().optional()
});

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    role: z.nativeEnum(UserRole).optional()
});
