/**
 * Express Context Module for tRPC Integration
 * 
 * This module provides the context creation functionality for tRPC when used with Express.
 * It injects the Prisma client and Express request object into the tRPC context,
 * making them available throughout the API router chain.
 * 
 * @module expressContext
 */

import { logger } from '@/utils/logger';

import { prisma } from "./db";
import { configService } from './services/config/configService';
import { setGlobalConfigService } from './services/config/globalConfigService';

import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';


// Initialize the global config service if not already initialized
let configInitialized = false;

/**
 * Creates a context object for tRPC procedures when using Express adapter
 * 
 * This function is called for each incoming request to create a context object
 * that will be available in all tRPC procedures. It provides access to:
 * - Prisma client for database operations
 * - Express request object for HTTP request details
 * 
 * @param {CreateExpressContextOptions} opts - Options provided by the Express adapter
 * @returns {Object} Context object containing prisma client and request object
 * 
 * @example
 * // Usage in tRPC procedure
 * export const myProcedure = t.procedure.query(async ({ ctx }) => {
 *   // Access prisma client from context
 *   const users = await ctx.prisma?.user.findMany();
 *   
 *   // Access request headers
 *   const authHeader = ctx.req.headers.authorization;
 *   
 *   return users;
 * });
 */
export function createExpressContext(opts: CreateExpressContextOptions): {
  prisma: typeof prisma;
  req: CreateExpressContextOptions['req'];
  res: CreateExpressContextOptions['res'];
} {
  // Initialize the config service on first request
  if (!configInitialized) {
    try {
      // Synchronously initialize if possible, otherwise schedule for next tick
      configService.initialize().then(() => {
        setGlobalConfigService(configService);
        logger.info('ConfigService initialized successfully (Express)');
      }).catch((error) => {
        console.error('Failed to initialize ConfigService (Express):', error);
      });
      configInitialized = true;
    } catch (error: unknown) {
      console.error('Failed to start ConfigService initialization (Express):', error);
    }
  }

  return {
    prisma,
    req: opts.req,
    res: opts.res
  };
}

/**
 * Type definition for the Express context
 * 
 * This type represents the shape of the context object that will be
 * available in all tRPC procedures. It includes:
 * - PrismaClient instance
 * - Express Request object
 * 
 * @example
 * // Using Context type in a custom middleware
 * const withUser = t.middleware(({ ctx }: { ctx: Context }) => {
 *   if (!ctx.req.session?.userId) {
 *     throw new TRPCError({ code: 'UNAUTHORIZED' });
 *   }
 *   return next();
 * });
 */
export type Context = ReturnType<typeof createExpressContext>;