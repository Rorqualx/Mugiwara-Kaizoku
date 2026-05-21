-- AlterTable
ALTER TABLE "ConversionJob"
  ADD COLUMN IF NOT EXISTS "quality"     INTEGER,
  ADD COLUMN IF NOT EXISTS "compression" INTEGER,
  ADD COLUMN IF NOT EXISTS "metadata"    JSONB,
  ADD COLUMN IF NOT EXISTS "bitrate"     TEXT;
