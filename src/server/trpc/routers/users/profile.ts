/**
 * User Profile Router
 *
 * Self-service procedures for authenticated users to manage their own profiles.
 *
 * Procedures:
 * - getProfile: Get current user's profile
 * - updateProfile: Update current user's profile (with password change support)
 *
 * Security Features:
 * - Current password verification for password changes
 * - Session invalidation on password change (OWASP A07:2021)
 * - Password strength validation
 * - Username/email conflict checking
 *
 * Extracted from: users.ts (lines 467-649)
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { eventEmitter } from '@/server/services/eventEmitter';
import { EventType, EventSource } from '@/server/services/events/eventTypes';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { verifyPassword } from '@/server/utils/auth';
import { isError, isSuccess } from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

 
 

// Import from foundation utils
import {
  getUserId,
  mapDbUserToDomain,
  validateAndHashPassword,
  checkUserConflicts,
  buildUserUpdateData,
  passwordSchema,
} from './utils';

import type { UserDomain } from './utils';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verify current password and hash new password for profile update
 * Returns hashed password or throws TRPCError on validation failure
 */
async function verifyAndHashProfilePassword(
  currentUserId: string,
  currentPassword: string,
  newPassword: string
): Promise<string> {
  // Verify current password
  const user = await prisma.user.findUnique({
    where: {
      id: toStringId(currentUserId)
    }
  });

  if (!user?.hashedPassword) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid credentials'
    });
  }

  const isValidPassword = await verifyPassword(currentPassword, user.hashedPassword);
  if (!isValidPassword) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Current password is incorrect'
    });
  }

  // Validate and hash new password
  const hashResult = await validateAndHashPassword(newPassword);
  if (!isSuccess(hashResult)) {
    const errorMessage = isError(hashResult)
      ? hashResult.error.message
      : 'Failed to validate and hash password';
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: errorMessage
    });
  }

  return hashResult.data;
}

/**
 * Build update parameters object for profile update
 * Filters undefined values to satisfy exactOptionalPropertyTypes
 */
function buildProfileUpdateParams(updateData: {
  username?: string | undefined;
  email?: string | undefined;
  avatarUrl?: string | null | undefined;
}, hashedPassword?: string | undefined): {
  username?: string;
  email?: string;
  hashedPassword?: string;
  avatarUrl?: string | null;
} {
  const params: {
    username?: string;
    email?: string;
    hashedPassword?: string;
    avatarUrl?: string | null;
  } = {};

  if (updateData.username !== undefined) {
    params.username = updateData.username;
  }
  if (updateData.email !== undefined) {
    params.email = updateData.email;
  }
  if (hashedPassword !== undefined) {
    params.hashedPassword = hashedPassword;
  }
  if (updateData.avatarUrl !== undefined) {
    params.avatarUrl = updateData.avatarUrl;
  }

  return params;
}

/**
 * Handle password change operations including session invalidation
 * Emits password change event and invalidates all user sessions
 */
async function handlePasswordChange(
  updatedDbUser: { id: unknown; userName: unknown }
): Promise<void> {
  // Delete all sessions for this user to force re-authentication
  await prisma.session.deleteMany({
    where: {
      userId: toStringId(updatedDbUser.id)
    }
  });

  // Emit password change notification
  await eventEmitter.emitWithTracking({
    type: EventType.USER_PASSWORD_CHANGED,
    source: EventSource.USER,
    userId: toStringId(updatedDbUser.id),
    metadata: {
      userId: toStringId(updatedDbUser.id),
      userName: updatedDbUser.userName,
      timestamp: new Date().toISOString(),
      sessionsInvalidated: true
    }
  });

  logger.info(`Password changed for user ${String(updatedDbUser.userName)}, all sessions invalidated`);
}

// ============================================================================
// Router Definition
// ============================================================================

export const usersProfileRouter = router({
  /**
   * Get current user profile
   * Available to all authenticated users
   */
  getProfile: protectedProcedure.query(async ({ ctx }): Promise<UserDomain> => {
    const currentUserId = getUserId(ctx);
    if (!currentUserId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User ID not found in context'
      });
    }

    const dbUser = await prisma.user.findUnique({
      where: {
        id: toStringId(currentUserId)
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
    });

    if (!dbUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found'
      });
    }

    return mapDbUserToDomain(dbUser);
  }),

  /**
   * Update current user profile
   * Available to all authenticated users
   *
   * Features:
   * - Username/email updates
   * - Password changes (requires current password)
   * - Avatar URL updates
   * - Preferences updates
   * - Session invalidation on password change
   */
  updateProfile: protectedProcedure
    .input(z.object({
      username: z.string().min(3).max(50).optional(),
      email: z.string().email().optional(),
      password: passwordSchema.optional(),
      currentPassword: z.string().optional(),
      avatarUrl: z.string().nullable().optional(),
      preferences: z.object({
        theme: z.enum(['light', 'dark', 'system']).optional(),
        language: z.string().optional(),
        notificationsEnabled: z.boolean().optional(),
        downloadNotifications: z.boolean().optional(),
        newChapterNotifications: z.boolean().optional(),
        emailNotifications: z.boolean().optional(),
        defaultPageSize: z.number().optional(),
        defaultView: z.enum(['grid', 'list', 'details']).optional(),
        hideNsfw: z.boolean().optional()
      }).optional()
    }))
    .mutation(async ({ input, ctx }): Promise<UserDomain> => {
      const { password, currentPassword, ...updateData } = input;

      // Get current user ID
      const currentUserId = getUserId(ctx);
      if (!currentUserId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID not found in context'
        });
      }

      // SECURITY: If changing password, verify current password (OWASP A07:2021)
      let hashedPassword: string | undefined;
      if (password) {
        if (!currentPassword) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Current password is required to change password'
          });
        }

        hashedPassword = await verifyAndHashProfilePassword(
          toStringId(currentUserId),
          currentPassword,
          password
        );
      }

      // Check for username/email conflicts (excluding current user)
      if (updateData.username ?? updateData.email) {
        const conflictResult = await checkUserConflicts(
          updateData.username,
          updateData.email,
          toStringId(currentUserId)
        );
        if (isError(conflictResult)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: conflictResult.error.message
          });
        }
      }

      // Build update data using helper
      const updateParams = buildProfileUpdateParams(updateData, hashedPassword);
      const updateDbData = buildUserUpdateData(updateParams);

      // Update user
      const updatedDbUser = await prisma.user.update({
        where: {
          id: toStringId(currentUserId)
        },
        data: updateDbData,
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
      });

      // SECURITY: If password was changed, invalidate all sessions (OWASP A07:2021)
      if (password) {
        await handlePasswordChange(updatedDbUser);
      }

      return mapDbUserToDomain(updatedDbUser);
    }),
});
