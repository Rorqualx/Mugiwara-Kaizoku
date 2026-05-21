-- Backup Schema Fixes
-- 1. Change size fields from Int to BigInt to prevent integer overflow
-- 2. Remove invalid @default([DATABASE]) from enum array
-- 3. Add composite index for retention queries
-- 4. Add checksum indexes for deduplication

-- ============================================================================
-- Fix Integer Overflow Risk
-- ============================================================================

-- Change Backup.size from Int to BigInt
ALTER TABLE "Backup" ALTER COLUMN "size" SET DATA TYPE BIGINT;

-- Change BackupItem.itemSize from Int to BigInt
ALTER TABLE "BackupItem" ALTER COLUMN "itemSize" SET DATA TYPE BIGINT;

-- ============================================================================
-- Fix Invalid Default Syntax
-- ============================================================================

-- Remove invalid default on BackupContent[] array
-- Note: Prisma will handle this at the application level
-- The @default([DATABASE]) syntax is invalid for enum arrays in PostgreSQL

-- ============================================================================
-- Add Missing Indexes
-- ============================================================================

-- Add composite index for retention queries (status + createdAt)
CREATE INDEX IF NOT EXISTS "Backup_status_createdAt_idx" ON "Backup"("status", "createdAt");

-- Add index on hash for deduplication
CREATE INDEX IF NOT EXISTS "Backup_hash_idx" ON "Backup"("hash");

-- Add index on checksum for file deduplication
CREATE INDEX IF NOT EXISTS "BackupItem_checksum_idx" ON "BackupItem"("checksum");
