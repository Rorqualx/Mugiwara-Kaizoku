-- AlterTable: Add page count, resolution fields to Chapter model
ALTER TABLE "Chapter" ADD COLUMN "pageCount" INTEGER;
ALTER TABLE "Chapter" ADD COLUMN "resolutionWidth" INTEGER;
ALTER TABLE "Chapter" ADD COLUMN "resolutionHeight" INTEGER;
ALTER TABLE "Chapter" ADD COLUMN "resolutionLabel" TEXT;
ALTER TABLE "Chapter" ADD COLUMN "language" TEXT;

-- AlterTable: Add language and quality fields to Metadata model
ALTER TABLE "Metadata" ADD COLUMN "language" TEXT;
ALTER TABLE "Metadata" ADD COLUMN "languages" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Metadata" ADD COLUMN "qualityProfile" TEXT;
ALTER TABLE "Metadata" ADD COLUMN "averageResolution" TEXT;
ALTER TABLE "Metadata" ADD COLUMN "pageCount" INTEGER;
