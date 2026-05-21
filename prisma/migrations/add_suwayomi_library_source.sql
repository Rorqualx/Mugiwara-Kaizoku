-- Migration: Suwayomi as headless library source
-- Adds per-manga plugin config, per-chapter Suwayomi id, and a new JobType value.
-- Applied out-of-band via psql because the migration history can't replay against a shadow DB
-- (pre-existing collision in 20251021_add_api_webhook_settings).

-- AlterEnum: must run outside a transaction in PostgreSQL
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'suwayomi_download';

-- AlterTable: Manga.suwayomiPluginConfig (per-manga JSON config)
ALTER TABLE "Manga" ADD COLUMN IF NOT EXISTS "suwayomiPluginConfig" JSONB;

-- AlterTable: Chapter.suwayomiChapterId (Suwayomi-internal chapter id)
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "suwayomiChapterId" TEXT;

-- Indexes for Chapter.suwayomiChapterId (unique + lookup)
CREATE UNIQUE INDEX IF NOT EXISTS "Chapter_suwayomiChapterId_key" ON "Chapter"("suwayomiChapterId");
CREATE INDEX IF NOT EXISTS "Chapter_suwayomiChapterId_idx" ON "Chapter"("suwayomiChapterId");
