-- AlterTable: Add galleryImages column to Metadata
ALTER TABLE "Metadata" ADD COLUMN "galleryImages" TEXT[] DEFAULT ARRAY[]::TEXT[];
