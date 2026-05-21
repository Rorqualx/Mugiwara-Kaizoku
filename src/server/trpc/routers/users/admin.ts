/**
 * Admin User Management Router
 *
 * Admin-only procedures for user management operations.
 *
 * Procedures:
 * - getAll: Get paginated users with filtering
 * - getById: Get single user by ID
 * - create: Create new user with validation
 * - update: Update existing user
 * - delete: Delete user with safeguards
 *
 * Extracted from: users.ts (lines 193-466)
 */

import { UserRole, Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { eventEmitter } from '@/server/services/eventEmitter';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { adminProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { isSuccess, isError } from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';


 
 

// Import from foundation utils
import {
  getUserId,
  mapDbUserToDomain,
  getUsersWithPagination,
  validateAndHashPassword,
  checkUserConflicts,
  buildUserUpdateData,
  createUserSchema,
  updateUserSchema,
  paginationSchema,
} from './utils';

import type { UserDomain } from './utils';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate admin update operation
 * Checks for self-role removal and username/email conflicts
 */
async function validateAdminUpdate(
  id: string,
  updateData: { username?: string; email?: string; role?: UserRole },
  currentUserId: string | undefined
): Promise<{ isValid: true } | { isValid: false; code: 'FORBIDDEN' | 'CONFLICT'; message: string }> {
  // Self-protection check: Prevent admin from removing their own admin role
  if (
    currentUserId &&
    toStringId(currentUserId) === id &&
    updateData.role &&
    updateData.role !== UserRole.ADMIN
  ) {
    return {
      isValid: false,
      code: 'FORBIDDEN',
      message: 'Cannot remove your own admin role'
    };
  }

  // Conflict check: Validate username/email uniqueness
  if (updateData.username ?? updateData.email) {
    const conflictResult = await checkUserConflicts(
      updateData.username,
      updateData.email,
      id
    );
    if (isError(conflictResult)) {
      return {
        isValid: false,
        code: 'CONFLICT',
        message: conflictResult.error.message
      };
    }
  }

  return { isValid: true };
}

export const usersAdminRouter = router({
  /**
   * Get all users with pagination and filtering
   * Requires admin role
   */
  getAll: adminProcedure.input(paginationSchema).query(async ({ input }): Promise<{
    users: UserDomain[];
    total: number;
    pages: number;
  }> => {
    const result = await getUsersWithPagination(input);
    if (isSuccess(result)) {
      return result.data;
    }
    // Type guard to ensure we have error
    if (isError(result)) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: result.error instanceof Error ? result.error.message : String(result.error),
      });
    }
    // This should never happen due to AsyncResult exhaustiveness
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unknown error occurred',
    });
  }),

  /**
   * Get a single user by ID
   * Requires admin role
   */
  getById: adminProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input }): Promise<UserDomain> => {
      const dbUser = await prisma.user.findUnique({
        where: {
          id: input.id,
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
          avatar: true,
        },
      });

      if (!dbUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return mapDbUserToDomain(dbUser);
    }),

  /**
   * Create a new user
   * Requires admin role
   */
  create: adminProcedure.input(createUserSchema).mutation(async ({ input }): Promise<UserDomain> => {
    // SECURITY: Validate password strength and hash (OWASP A07:2021)
    const hashResult = await validateAndHashPassword(input.password);
    if (!isSuccess(hashResult)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: isError(hashResult) ? hashResult.error.message : 'Password validation failed',
      });
    }
    const hashedPassword = hashResult.data;

    // Check for username/email conflicts
    const conflictResult = await checkUserConflicts(input.username, input.email);
    if (isError(conflictResult)) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: conflictResult.error.message,
      });
    }

    // Create user - don't include role if it's GUEST since DB doesn't support it
    const createData: Prisma.UserCreateInput = {
      id: nanoid(),
      userName: input.username,
      email: input.email,
      hashedPassword,
      updatedAt: new Date(),
      // Only add role if it's ADMIN or USER (conditionally include)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DB only supports ADMIN/USER roles
      ...(input.role === UserRole.ADMIN || input.role === UserRole.USER
        ? { role: input.role }
        : {}),
    };

    const dbUser = await prisma.user.create({
      data: createData,
      select: {
        id: true,
        userName: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        image: true,
        avatar: true,
      },
    });

    // Emit user created notification
    await eventEmitter.emit('user:action', {
      userId: toStringId(dbUser['id']),
    });

    // Emit WebSocket event for real-time sync
    void realtimeEmitter.emitSystemEvent({
      eventType: 'user:created',
      source: 'users-admin-router',
      message: `User created: ${input.username}`,
      data: { userId: toStringId(dbUser['id']), username: input.username },
    });

    return mapDbUserToDomain(dbUser);
  }),

  /**
   * Update an existing user
   * Requires admin role
   */
  update: adminProcedure.input(updateUserSchema).mutation(async ({ input, ctx }): Promise<UserDomain> => {
    const { id, password, ...updateData } = input;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!existingUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    // Validate update operation (self-protection + conflicts)
    const currentUserId = getUserId(ctx);
    const validUpdateData = {
      ...(updateData.username !== undefined && { username: updateData.username }),
      ...(updateData.email !== undefined && { email: updateData.email }),
      ...(updateData.role !== undefined && { role: updateData.role }),
    };
    const validation = await validateAdminUpdate(id, validUpdateData, currentUserId);
    if (!validation.isValid) {
      throw new TRPCError({
        code: validation.code,
        message: validation.message,
      });
    }

    // Validate password and hash if provided
    let hashedPassword: string | undefined;
    if (password) {
      const hashResult = await validateAndHashPassword(password);
      if (!isSuccess(hashResult)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: isError(hashResult) ? hashResult.error.message : 'Password validation failed',
        });
      }
      hashedPassword = hashResult.data;
    }

    // Build update data using helper
    const updateDbData = buildUserUpdateData({
      ...(updateData.username ? { username: updateData.username } : {}),
      ...(updateData.email ? { email: updateData.email } : {}),
      ...(hashedPassword ? { hashedPassword } : {}),
      ...(updateData.role ? { role: updateData.role } : {}),
    });

    const updatedDbUser = await prisma.user.update({
      where: {
        id,
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
        avatar: true,
      },
    });

    // Emit user updated notification
    await eventEmitter.emit('user:action', {
      userId: toStringId(updatedDbUser['id']),
    });

    // If role was changed, emit specific role change event
    if (updateData.role && updateData.role !== existingUser.role) {
      await eventEmitter.emit('user:action', {
        userId: toStringId(updatedDbUser['id']),
      });
    }

    // Emit WebSocket event for real-time sync
    void realtimeEmitter.emitSystemEvent({
      eventType: 'user:updated',
      source: 'users-admin-router',
      message: `User updated: ${id}`,
      data: { userId: id, updatedFields: Object.keys(updateData) },
    });

    return mapDbUserToDomain(updatedDbUser);
  }),

  /**
   * Delete a user
   * Requires admin role
   */
  delete: adminProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<{
      success: boolean;
    }> => {
      // Prevent admin from deleting themselves
      const currentUserId = getUserId(ctx);
      if (currentUserId && toStringId(currentUserId) === input['id']) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot delete your own account',
        });
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: {
          id: input.id,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Check if this is the last admin
      if (user.role === UserRole.ADMIN) {
        const adminCount = await prisma.user.count({
          where: {
            role: UserRole.ADMIN,
          },
        });

        if (adminCount <= 1) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Cannot delete the last admin user',
          });
        }
      }

      // Delete user
      await prisma.user.delete({
        where: {
          id: input.id,
        },
      });

      // Emit user deleted notification
      await eventEmitter.emit('user:action', {
        userId: input.id,
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'user:deleted',
        source: 'users-admin-router',
        message: `User deleted: ${input.id}`,
        data: { userId: input.id },
      });

      return {
        success: true,
      };
    }),
});
