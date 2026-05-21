-- Task Enum Migration Script
-- This script migrates task type and status from string fields to enum fields
-- in a safe, backward-compatible way

-- Step 1: Run analysis query to identify any unexpected values
-- (Run this separately and review results before proceeding)
/*
SELECT DISTINCT type AS task_type FROM "Task";
SELECT DISTINCT status AS task_status FROM "Task";
*/

-- Step 2: Create the enum types
CREATE TYPE "TaskType" AS ENUM (
  'CHECK_CHAPTERS',
  'UPDATE_METADATA',
  'FIX_OUT_OF_SYNC',
  'NOTIFY',
  'BACKUP',
  'LIBRARY_SCAN',
  'METADATA_REFRESH',
  'CHAPTER_DOWNLOAD',
  'MANGA_IMPORT',
  'SYSTEM_MAINTENANCE',
  'SYNC_FIX',
  'CUSTOM'
);

CREATE TYPE "TaskStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'PAUSED',
  'OUT_OF_SYNC',
  'SCHEDULED'
);

-- Step 3: Add temporary columns with the new enum types
ALTER TABLE "Task" ADD COLUMN "type_enum" "TaskType";
ALTER TABLE "Task" ADD COLUMN "status_enum" "TaskStatus";

-- Step 4: Populate the enum columns with mapped values from the string columns
-- For TaskType
UPDATE "Task" SET "type_enum" = 
  CASE 
    WHEN "type" = 'checkChapters' THEN 'CHECK_CHAPTERS'::"TaskType"
    WHEN "type" = 'updateMetadata' THEN 'UPDATE_METADATA'::"TaskType"
    WHEN "type" = 'fixOutOfSyncChapters' THEN 'FIX_OUT_OF_SYNC'::"TaskType"
    WHEN "type" = 'notify' THEN 'NOTIFY'::"TaskType"
    WHEN "type" = 'backup' THEN 'BACKUP'::"TaskType"
    WHEN "type" = 'library_scan' THEN 'LIBRARY_SCAN'::"TaskType"
    WHEN "type" = 'metadata_refresh' THEN 'METADATA_REFRESH'::"TaskType"
    WHEN "type" = 'chapter_download' THEN 'CHAPTER_DOWNLOAD'::"TaskType"
    WHEN "type" = 'manga_import' THEN 'MANGA_IMPORT'::"TaskType"
    WHEN "type" = 'system_maintenance' THEN 'SYSTEM_MAINTENANCE'::"TaskType"
    WHEN "type" = 'sync_fix' THEN 'SYNC_FIX'::"TaskType"
    ELSE 'CUSTOM'::"TaskType"
  END;

-- For TaskStatus
UPDATE "Task" SET "status_enum" = 
  CASE 
    WHEN "status" = 'PENDING' OR "status" = 'pending' THEN 'PENDING'::"TaskStatus"
    WHEN "status" = 'IN_PROGRESS' OR "status" = 'in_progress' THEN 'IN_PROGRESS'::"TaskStatus"
    WHEN "status" = 'RUNNING' OR "status" = 'running' THEN 'RUNNING'::"TaskStatus"
    WHEN "status" = 'COMPLETED' OR "status" = 'completed' THEN 'COMPLETED'::"TaskStatus"
    WHEN "status" = 'FAILED' OR "status" = 'failed' THEN 'FAILED'::"TaskStatus"
    WHEN "status" = 'CANCELLED' OR "status" = 'cancelled' THEN 'CANCELLED'::"TaskStatus"
    WHEN "status" = 'PAUSED' OR "status" = 'paused' THEN 'PAUSED'::"TaskStatus"
    WHEN "status" = 'OUT_OF_SYNC' OR "status" = 'out_of_sync' THEN 'OUT_OF_SYNC'::"TaskStatus"
    WHEN "status" = 'SCHEDULED' OR "status" = 'scheduled' THEN 'SCHEDULED'::"TaskStatus"
    ELSE 'PENDING'::"TaskStatus"  -- Default to PENDING for unrecognized values
  END;

-- Step 5: Verify that all rows have been properly converted
-- Ensure no NULL values in the enum columns
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM "Task" WHERE "type_enum" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Conversion error: % rows have NULL type_enum values', null_count;
  END IF;
  
  SELECT COUNT(*) INTO null_count FROM "Task" WHERE "status_enum" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Conversion error: % rows have NULL status_enum values', null_count;
  END IF;
END $$;

-- Step 6: Create views for backward compatibility (optional)
CREATE OR REPLACE VIEW task_legacy_view AS
  SELECT 
    id,
    type,
    status,
    -- Other fields...
    retryCount,
    createdAt,
    updatedAt,
    errorMessage,
    lastChecked,
    scheduledAt,
    interval,
    chapterId,
    mangaId,
    maxRetries,
    priority,
    queueId
  FROM "Task";

-- Step 7: Rename columns and set defaults
-- Note: This step requires application downtime
-- Save this for a separate migration
/*
ALTER TABLE "Task" DROP COLUMN "type";
ALTER TABLE "Task" DROP COLUMN "status";
ALTER TABLE "Task" RENAME COLUMN "type_enum" TO "type";
ALTER TABLE "Task" RENAME COLUMN "status_enum" TO "status";
ALTER TABLE "Task" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"TaskStatus";
*/

-- Step 8: Add indexes to maintain query performance
CREATE INDEX IF NOT EXISTS "task_type_enum_idx" ON "Task" ("type_enum");
CREATE INDEX IF NOT EXISTS "task_status_enum_idx" ON "Task" ("status_enum");

-- Step 9: Update the Prisma schema to use these enum types
-- This requires updating the schema.prisma file and generating a new Prisma client