/**
 * tRPC Context Module
 *
 * This module defines the context type and creation function for tRPC requests.
 * The context is passed to all tRPC procedures and contains shared resources
 * like the Prisma client and request object.
 *
 * @module server/trpc/context
 */
import { logger } from '@/utils/logger';

import { prisma } from "../db";
import { configService } from '../services/config/configService';
import { setGlobalConfigService } from '../services/config/globalConfigService';
import { initializeConverterSystem, startConversionWorker } from '../services/conversion';

import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateNextContextOptions } from '@trpc/server/adapters/next';
// Initialize the global config service if not already initialized
let configInitialized = false;
let convertersInitialized = false;
let conversionWorkerStarted = false;
/**
 * Creates the context for tRPC requests
 *
 * This function is called for every tRPC request to create a context object
 * that will be available to all procedures. It provides:
 * - Prisma client instance for database operations
 * - Next.js request object for accessing request data
 *
 * @param {CreateNextContextOptions} opts - Options from Next.js API route
 * @returns {Promise<{prisma: PrismaClient, req: NextApiRequest}>} Context object
 *
 * @example
 * // Usage in tRPC procedure
 * const procedure = protectedProcedure.query(async ({ ctx }) => {
 *   const data = await ctx.prisma?.user.findMany();
 *   return data;
 * });
 */
/**
 * Resolve the client IP from proxy headers, falling back to the socket.
 * Used as the rate-limit identity for unauthenticated requests so anonymous
 * callers are bucketed per-IP instead of all sharing a single `anonymous` key.
 */
function resolveClientIp(req: CreateNextContextOptions['req']): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.length > 0) {
    return real;
  }
  return req.socket.remoteAddress ?? undefined;
}

export async function createContext(opts: CreateNextContextOptions): Promise<{
  prisma: typeof prisma;
  req: CreateNextContextOptions['req'];
  res?: CreateNextContextOptions['res'];
  ip?: string;
}> {
  // Initialize the config service on first request
  if (!configInitialized) {
    try {
      await configService.initialize();
      setGlobalConfigService(configService);
      configInitialized = true;
      logger.info('ConfigService initialized successfully');
    }
    catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Failed to initialize ConfigService:', errorMessage);
    }
  }

  // Initialize the converter system on first request
  if (!convertersInitialized) {
    try {
      initializeConverterSystem();
      convertersInitialized = true;
      logger.info('Converter system initialized successfully');
    }
    catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize converter system:', errorMessage);
    }
  }

  // Start the conversion worker on first request
  if (!conversionWorkerStarted) {
    try {
      // Start worker asynchronously (don't block context creation)
      startConversionWorker({
        batchSize: 5,
        maxConcurrency: 3,
        pollInterval: 2000 // 2 seconds
      }).then(() => {
        logger.info('Conversion worker started successfully');
      }).catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to start conversion worker:', errorMessage);
      });
      conversionWorkerStarted = true;
    }
    catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to start conversion worker:', errorMessage);
    }
  }

  // (queue worker bootstrap removed — `main-worker` is started once at server
  // startup in `src/server/index.ts` and serves the same `default` queue.
  // Spinning up a second `default-worker` here only added load and, before
  // createWorker became idempotent, raced with the startup-path worker.)

  const ip = resolveClientIp(opts.req);
  return {
    prisma,
    req: opts.req,
    res: opts.res,
    ...(ip !== undefined ? { ip } : {})
  };
}
/**
 * Type definition for tRPC context
 *
 * Infers the context type from the createContext function return type.
 * This type is used throughout the application to ensure type safety
 * when accessing context in tRPC procedures.
 *
 * @type {Context}
 */
export type Context = inferAsyncReturnType<typeof createContext>;