-- Migration: Add specific status columns to Manga table
-- This migration adds new columns to separate different status concepts

-- Add new status columns (using TEXT for flexibility during migration)
ALTER TABLE "Manga" 
ADD COLUMN IF NOT EXISTS "publicationStatus" TEXT,
ADD COLUMN IF NOT EXISTS "fileStatus" TEXT,
ADD COLUMN IF NOT EXISTS "libraryStatus" TEXT;

-- Set default values based on existing status
UPDATE "Manga" 
SET 
  -- Map existing status to publication status
  "publicationStatus" = CASE 
    WHEN "status" IN ('COMPLETED', 'FINISHED') THEN 'COMPLETED'
    WHEN "status" IN ('ONGOING', 'RELEASING', 'PUBLISHING') THEN 'ONGOING'
    WHEN "status" IN ('CANCELLED', 'DISCONTINUED') THEN 'CANCELLED'
    WHEN "status" = 'HIATUS' THEN 'HIATUS'
    ELSE 'UNKNOWN'
  END,
  -- Map existing status to file status
  "fileStatus" = CASE
    WHEN "status" = 'PENDING' THEN 'PENDING'
    WHEN "status" = 'DOWNLOADING' THEN 'DOWNLOADING'
    WHEN "status" = 'COMPLETED' THEN 'DOWNLOADED'
    WHEN "status" = 'FAILED' THEN 'FAILED'
    WHEN "status" = 'ERROR' THEN 'ERROR'
    ELSE 'PENDING'
  END,
  -- Set default library status
  "libraryStatus" = CASE
    WHEN "status" IN ('COMPLETED', 'FINISHED') THEN 'COMPLETED'
    WHEN "status" IN ('ONGOING', 'RELEASING', 'PUBLISHING', 'DOWNLOADING') THEN 'READING'
    ELSE 'PLAN_TO_READ'
  END
WHERE "publicationStatus" IS NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_manga_publication_status" ON "Manga"("publicationStatus");
CREATE INDEX IF NOT EXISTS "idx_manga_file_status" ON "Manga"("fileStatus");
CREATE INDEX IF NOT EXISTS "idx_manga_library_status" ON "Manga"("libraryStatus");

-- Add comment to document the change
COMMENT ON COLUMN "Manga"."publicationStatus" IS 'Publication status from provider (ONGOING, COMPLETED, etc)';
COMMENT ON COLUMN "Manga"."fileStatus" IS 'File processing status (PENDING, DOWNLOADING, etc)';
COMMENT ON COLUMN "Manga"."libraryStatus" IS 'User library status (READING, COMPLETED, etc)';
COMMENT ON COLUMN "Manga"."status" IS 'DEPRECATED - Use specific status columns instead';