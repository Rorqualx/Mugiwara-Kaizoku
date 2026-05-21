-- AlterTable: Add galleryImages column to Metadata
ALTER TABLE "Metadata" ADD COLUMN IF NOT EXISTS "galleryImages" TEXT[] DEFAULT ARRAY[]::TEXT[];
