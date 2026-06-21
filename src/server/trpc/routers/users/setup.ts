/**
 * User Setup Router
 *
 * First-time setup procedure for creating the initial admin user.
 *
 * Procedures:
 * - firstTimeSetup: Create first admin user (only when no users exist)
 */

import { UserRole, Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { ensureDefaultLibrary } from '@/server/services/library/default-library';
import { publicProcedure, rateLimitedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import {
  mapDbUserToDomain,
  validateAndHashPassword,
  checkUserConflicts,
  passwordSchema,
} from './utils';

import type { UserDomain } from './utils';

const setupProcedure = rateLimitedProcedure(5, publicProcedure);

export const usersSetupRouter = router({
  /**
   * First-time setup - create the initial admin user.
   * Only works when no users exist; rate-limited to 5 req/min.
   */
  firstTimeSetup: setupProcedure
    .input(z.object({
      userName: z.string().min(3).max(50),
      email: z.string().email(),
      password: passwordSchema
    }))
    .mutation(async ({ input }): Promise<{ success: boolean; user: UserDomain }> => {
      // Cheap gate first — bail before doing bcrypt work if setup is already done.
      const userCount = await prisma.user.count();
      if (userCount > 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'First-time setup can only be used when no users exist'
        });
      }

      const conflictResult = await checkUserConflicts(input.userName, input.email);
      if (isError(conflictResult)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: conflictResult.error.message
        });
      }

      // SECURITY: Validate password strength and hash (OWASP A07:2021)
      const hashResult = await validateAndHashPassword(input.password);
      if (isError(hashResult)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: hashResult.error.message
        });
      }
      if (hashResult.status !== 'success') {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Password validation failed unexpectedly'
        });
      }
      const hashedPassword = hashResult.data;

      // SECURITY: Re-check the user count and create the admin inside one
      // serializable transaction. The cheap gate above is racy on its own —
      // two concurrent setup calls with different usernames could both pass it
      // and create two admins during the empty-install window. Serializable
      // isolation forces one of the racing transactions to abort.
      const dbUser = await prisma.$transaction(async (tx) => {
        const racedCount = await tx.user.count();
        if (racedCount > 0) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'First-time setup can only be used when no users exist'
          });
        }

        return tx.user.create({
          data: {
            id: nanoid(),
            userName: input.userName,
            email: input.email,
            hashedPassword,
            role: UserRole.ADMIN,
            updatedAt: new Date(),
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
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      logger.info(`First admin user created: ${dbUser.userName} (${dbUser.email})`);

      // Give the first admin the standard default "My Manga" library too.
      await ensureDefaultLibrary(dbUser.id).catch((err: unknown) =>
        logger.error('Failed to auto-create default library for first admin', { userId: dbUser.id, err }),
      );

      return {
        success: true,
        user: mapDbUserToDomain(dbUser)
      };
    }),
});
