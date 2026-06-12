/**
 * Database Connection Singleton
 *
 * Provides a singleton PrismaClient instance to prevent connection pool exhaustion.
 * Handles connection lifecycle, error recovery, and graceful shutdown.
 *
 * Features:
 * - Connection pool management
 * - Automatic reconnection
 * - Query logging in development
 * - Graceful shutdown handling
 * - Connection health monitoring
 *
 * @module server/db
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { JobType, PrismaClient } from '@prisma/client';
import { Pool } from 'pg';


import { env } from '../env/server';
import { logger } from '../utils/logger';

import { realtimeEmitter } from './services/realtime/RealtimeEventEmitter';

// Global type declaration for development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Database configuration
 */
const DB_CONFIG = {
  // UI pool — reserved for page requests and tRPC queries
  uiConnectionLimit: 15,
  // Background pool — enrichment pipeline, download monitor, etc.
  backgroundConnectionLimit: 5,
  // Query timeout in ms
  queryTimeout: 20000,
  // Enable query logging in development
  logQueries: env.NODE_ENV === 'development',
  // Slow query threshold in ms (emit warning for queries taking longer)
  slowQueryThreshold: 1000,
  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Force every pooled connection to UTC. Without this, PostgreSQL inherits the
 * server's local timezone (`America/Denver` on dev), and bare `Timestamptz`
 * literals from Prisma's client-side `@default(now())` get interpreted in local
 * time — pushing `jobs.scheduled_for` six hours into the future and stalling
 * every queue producer until the offset rolls forward.
 */
function enforceUtc(pool: Pool): void {
  pool.on('connect', (client) => {
    client.query("SET TIME ZONE 'UTC'").catch(() => {
      // Non-fatal: a single connection without UTC is better than refusing service.
    });
  });
}

/**
 * Primary PostgreSQL connection pool (UI / tRPC requests)
 */
const pgPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: DB_CONFIG.uiConnectionLimit,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: DB_CONFIG.queryTimeout,
});
enforceUtc(pgPool);

const adapter = new PrismaPg(pgPool);

/**
 * Background PostgreSQL connection pool (enrichment, batch jobs).
 * Isolated from pgPool so background work never starves UI requests.
 */
const backgroundPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: DB_CONFIG.backgroundConnectionLimit,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: DB_CONFIG.queryTimeout,
});
enforceUtc(backgroundPool);

const backgroundAdapter = new PrismaPg(backgroundPool);

/**
 * Custom Prisma Client with enhanced logging and error handling
 */
class EnhancedPrismaClient extends PrismaClient {
  private connectionAttempts = 0;
  private isShuttingDown = false;

  constructor() {
    super({
      adapter,
      log: DB_CONFIG.logQueries
        ? [
            { level: 'query', emit: 'event' },
            { level: 'error', emit: 'event' },
            { level: 'warn', emit: 'event' },
          ]
        : ['error'],
    });

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up Prisma event listeners
   */
  private setupEventListeners(): void {
    if (DB_CONFIG.logQueries) {
      // @ts-ignore - Prisma types don't include $on for all log levels
      this.$on('query', (e: unknown) => {
        const event = e as Record<string, unknown>;
        const duration = typeof event['duration'] === 'number' ? event['duration'] : 0;
        const query = String(event['query'] ?? '');

        logger.debug(`Query: ${query}`, {
          params: event['params'],
          duration,
        });

        // Detect slow queries and emit warning
        if (duration > DB_CONFIG.slowQueryThreshold) {
          logger.warn('Slow query detected', {
            query: query.substring(0, 200), // Truncate for logging
            duration,
            threshold: DB_CONFIG.slowQueryThreshold,
          });

          // Emit WebSocket event for slow query monitoring
          void realtimeEmitter.emitSystemEvent({
            eventType: 'database:slow_query',
            source: 'prismaMiddleware',
            message: `Slow query detected: ${duration}ms`,
            data: {
              duration,
              threshold: DB_CONFIG.slowQueryThreshold,
              query: query.substring(0, 100), // Truncate for WebSocket
              timestamp: new Date().toISOString()
            }
          });
        }
      });
    }

    // @ts-ignore - Prisma types don't include $on for error event
    this.$on('error', (e: unknown) => {
      // Serialize error properly to avoid [object Object] in logs
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error('Database error', { error: errorMessage });

      // NOTE: Do NOT emit WebSocket events here - it causes a feedback loop
      // when the WebSocket/DistributedMessageRouter also has database issues
    });

    // @ts-ignore - Prisma types don't include $on for warn event
    this.$on('warn', (e: unknown) => {
      const warnMessage = e instanceof Error ? e.message : String(e);
      logger.warn('Database warning', { warning: warnMessage });
    });
  }

  /**
   * Connect to database with retry logic
   */
  async connectWithRetry(): Promise<void> {
    while (this.connectionAttempts < DB_CONFIG.maxRetries && !this.isShuttingDown) {
      try {
        this.connectionAttempts++;
        logger.info(`Connecting to database (attempt ${this.connectionAttempts})...`);

        // eslint-disable-next-line no-await-in-loop -- Retry logic requires sequential execution
        await this.$connect();

        logger.info('Successfully connected to database');
        this.connectionAttempts = 0;
        return;
      } catch (error: unknown) {
        logger.error(`Failed to connect to database (attempt ${this.connectionAttempts}):`, error);

        if (this.connectionAttempts >= DB_CONFIG.maxRetries) {
          throw new Error(`Failed to connect to database after ${DB_CONFIG.maxRetries} attempts`);
        }

        // Wait before retrying
        // eslint-disable-next-line no-await-in-loop -- Retry delay requires sequential execution
        await new Promise(resolve => {
          setTimeout(resolve, DB_CONFIG.retryDelay);
        });
      }
    }
  }

  /**
   * Gracefully disconnect from database
   */
  async gracefulDisconnect(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    logger.info('Disconnecting from database...');

    try {
      await this.$disconnect();
      await backgroundPrisma.$disconnect();
      await pgPool.end();
      await backgroundPool.end();
      logger.info('Successfully disconnected from database');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error disconnecting from database:', errorMessage);
    }
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Database health check failed:', errorMessage);
      return false;
    }
  }
}

/**
 * Create or get the singleton Prisma Client instance
 */
function createPrismaClient(): EnhancedPrismaClient {
  if (env.NODE_ENV === 'production') {
    // In production, always create a new instance
    return new EnhancedPrismaClient();
  } else {
    // In development, use global to prevent multiple instances
    global.prisma ??= new EnhancedPrismaClient();
    return global.prisma as EnhancedPrismaClient;
  }
}

/**
 * Singleton Prisma Client instance (UI pool, 15 connections)
 */
export const prisma = createPrismaClient();

/**
 * Background Prisma Client (5 connections, isolated from UI pool).
 * Used by enrichment pipeline and batch jobs so they never starve UI requests.
 */
export const backgroundPrisma = new PrismaClient({
  adapter: backgroundAdapter,
  log: ['error'],
}) as PrismaClient;

/**
 * Database utility functions
 */
export const db = {
  /**
   * Get the Prisma client instance
   */
  get client(): EnhancedPrismaClient {
    return prisma;
  },

  /**
   * Connect to database
   */
  async connect(): Promise<void> {
    return prisma.connectWithRetry();
  },

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    return prisma.gracefulDisconnect();
  },

  /**
   * Check database health
   */
  async health(): Promise<boolean> {
    return prisma.healthCheck();
  },

  /**
   * Execute a transaction with automatic retry
   */
  async transaction<T>(
    fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
    }
  ): Promise<T> {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        // eslint-disable-next-line no-await-in-loop -- Transaction retry requires sequential execution
        return await (prisma.$transaction(fn as unknown as (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>) => Promise<unknown>, {
          maxWait: options?.maxWait ?? 2000,
          timeout: options?.timeout ?? DB_CONFIG.queryTimeout,
          ...(options?.isolationLevel !== undefined ? { isolationLevel: options.isolationLevel } : {}),
        }) as Promise<T>);
      } catch (error: unknown) {
        // Check if it's a deadlock or timeout error
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          attempts < maxAttempts &&
          (errorMessage === 'P2034' || // Transaction conflict
           errorMessage === 'P2024' || // Timeout
           errorMessage.includes('deadlock'))
        ) {
          logger.warn(`Transaction failed (attempt ${attempts}), retrying...`, error);
          // eslint-disable-next-line no-await-in-loop -- Retry delay requires sequential execution
          await new Promise(resolve => {
            setTimeout(resolve, 100 * attempts);
          });
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Transaction failed after ${maxAttempts} attempts`);
  },

  /**
   * Clean up old records (for maintenance)
   */
  async cleanup(options?: {
    daysToKeep?: number;
    tables?: string[];
  }): Promise<{ notifications: number }> {
    const daysToKeep = options?.daysToKeep ?? 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      // Clean up old notifications
      const deletedNotifications = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          read: true,
        },
      });
      logger.info(`Deleted ${deletedNotifications.count} old read notifications`);

      return {
        notifications: deletedNotifications.count,
      };
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Database cleanup failed:', errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Enqueue a background job for execution
   */
  async enqueueJob(
    type: JobType,
    payload: Record<string, unknown>,
    options: { scheduledAt?: Date } = {}
  ): Promise<bigint> {
    const { queueManager } = await import('./queue/queueManager');
    const jobId = await queueManager.enqueue(type, payload, {
      ...(options.scheduledAt !== undefined ? { scheduledFor: options.scheduledAt } : {})
    });
    return jobId;
  },
};

// Note: Signal handlers removed — shutdown is centralized in server-shutdown.ts
// which calls db.disconnect() (gracefulDisconnect) as part of ordered cleanup.

// Export type for use in other modules
export type DbClient = typeof prisma;

export default prisma;