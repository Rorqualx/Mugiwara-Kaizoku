/**
 * Schema Ensurer
 *
 * Ensures critical database tables exist on startup.
 * This handles the case where a Prisma schema model is added but
 * the database migration hasn't been run (e.g., after code updates).
 *
 * Uses CREATE TABLE IF NOT EXISTS — safe to run repeatedly.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

/**
 * Check if a table exists in the database
 */
async function tableExists(tableName: string): Promise<boolean> {
  const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) as exists
  `;
  return result[0]?.exists ?? false;
}

/**
 * Create the ChapterFile table and indexes
 */
async function createChapterFileTable(): Promise<void> {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ChapterFile" (
      id         SERIAL PRIMARY KEY,
      "chapterId"  INT NOT NULL,
      "filePath"   VARCHAR(500) NOT NULL,
      "fileName"   VARCHAR(255) NOT NULL,
      "fileSize"   INT NOT NULL DEFAULT 0,
      "isActive"   BOOLEAN NOT NULL DEFAULT false,
      "sourceType" VARCHAR(20) NOT NULL,
      "pageStart"  INT,
      "pageEnd"    INT,
      "pageCount"  INT,
      "importedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "ChapterFile_chapterId_fkey"
        FOREIGN KEY ("chapterId") REFERENCES "Chapter"(id) ON DELETE CASCADE,
      CONSTRAINT "ChapterFile_chapterId_filePath_key"
        UNIQUE ("chapterId", "filePath")
    )
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "ChapterFile_chapterId_idx"
      ON "ChapterFile" ("chapterId")
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "ChapterFile_filePath_idx"
      ON "ChapterFile" ("filePath")
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "ChapterFile_chapterId_isActive_idx"
      ON "ChapterFile" ("chapterId", "isActive")
  `;
}

/**
 * Ensure the ChapterFile table exists
 */
async function ensureChapterFileTable(): Promise<void> {
  if (await tableExists('ChapterFile')) return;

  logger.info('[SchemaEnsurer] Creating missing ChapterFile table');
  await createChapterFileTable();
  logger.info('[SchemaEnsurer] ChapterFile table created');
}

// ── UNLOGGED cache/infrastructure tables ──────────────────────────────

/**
 * Ensure the cache_unified UNLOGGED table exists.
 * Used by UnifiedCacheProvider for Redis-like caching.
 */
async function ensureCacheUnifiedTable(): Promise<void> {
  if (await tableExists('cache_unified')) return;

  logger.info('[SchemaEnsurer] Creating missing cache_unified table');
  await prisma.$executeRaw`
    CREATE UNLOGGED TABLE IF NOT EXISTS cache_unified (
      cache_key TEXT PRIMARY KEY,
      cache_value JSONB NOT NULL,
      data_type TEXT,
      namespace TEXT DEFAULT 'default',
      expires_at TIMESTAMP WITH TIME ZONE,
      access_count INTEGER DEFAULT 0,
      access_frequency REAL DEFAULT 1.0,
      last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      tags TEXT[] DEFAULT '{}',
      size_bytes INTEGER DEFAULT 0,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    ) WITH (fillfactor = 90)
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_cache_unified_expires
      ON cache_unified (expires_at) WHERE expires_at IS NOT NULL
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_cache_unified_namespace
      ON cache_unified (namespace)
  `;
  logger.info('[SchemaEnsurer] cache_unified table created');
}

/**
 * Ensure the hot_data_cache UNLOGGED table exists.
 * Used for frequently accessed manga/chapter data.
 */
async function ensureHotDataCacheTable(): Promise<void> {
  if (await tableExists('hot_data_cache')) return;

  logger.info('[SchemaEnsurer] Creating missing hot_data_cache table');
  await prisma.$executeRaw`
    CREATE UNLOGGED TABLE IF NOT EXISTS hot_data_cache (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      cache_data JSONB NOT NULL,
      hit_count INTEGER DEFAULT 0,
      heat_score REAL DEFAULT 1.0,
      last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE,
      tags TEXT[] DEFAULT '{}',
      PRIMARY KEY (entity_type, entity_id)
    ) WITH (fillfactor = 90)
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_hot_data_expires
      ON hot_data_cache (expires_at) WHERE expires_at IS NOT NULL
  `;
  logger.info('[SchemaEnsurer] hot_data_cache table created');
}

/**
 * Ensure the rate_limits UNLOGGED table exists.
 * Used for WebSocket/API rate limiting.
 */
async function ensureRateLimitsTable(): Promise<void> {
  if (await tableExists('rate_limits')) return;

  logger.info('[SchemaEnsurer] Creating missing rate_limits table');
  await prisma.$executeRaw`
    CREATE UNLOGGED TABLE IF NOT EXISTS rate_limits (
      limit_key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '1 minute'
    ) WITH (fillfactor = 70)
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_rate_limit_expires
      ON rate_limits (expires_at)
  `;
  logger.info('[SchemaEnsurer] rate_limits table created');
}

/**
 * Ensure all critical tables exist.
 * Add new table checks here as models are added to the Prisma schema.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  try {
    logger.info('[SchemaEnsurer] Checking database schema...');
    await ensureChapterFileTable();
    await ensureCacheUnifiedTable();
    await ensureHotDataCacheTable();
    await ensureRateLimitsTable();
    logger.info('[SchemaEnsurer] Database schema OK');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[SchemaEnsurer] Failed to ensure schema: ${errorMessage}`);
    // Non-fatal — app can still start, features using missing tables will fail gracefully
  }
}
