-- AlterTable
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "suwayomiEnabled" BOOLEAN NOT NULL DEFAULT false;
