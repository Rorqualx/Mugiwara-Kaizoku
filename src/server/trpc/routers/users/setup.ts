/**
 * User Setup Router
 *
 * First-time setup procedure for creating the initial admin user.
 *
 * Procedures:
 * - firstTimeSetup: Create first admin user (only when no users exist)
 */

import { UserRole } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import { prisma } from '@/server/db';
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

      const dbUser = await prisma.user.create({
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

      logger.info(`First admin user created: ${dbUser.userName} (${dbUser.email})`);

      return {
        success: true,
        user: mapDbUserToDomain(dbUser)
      };
    }),
});
