-- AlterTable
ALTER TABLE "ConversionJob"
  ADD COLUMN "quality"     INTEGER,
  ADD COLUMN "compression" INTEGER,
  ADD COLUMN "metadata"    JSONB,
  ADD COLUMN "bitrate"     TEXT;
