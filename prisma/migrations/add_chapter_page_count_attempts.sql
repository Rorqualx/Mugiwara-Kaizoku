-- Migration: Add pageCountAttempts to Chapter
-- Adds a retry counter the ghost-recount sweep (cleanupGhostCompletedChapters)
-- uses to permanently skip rows whose archive can never be read (corrupted
-- zip signatures, dir-of-images before the page-counter dir branch was added,
-- mis-imported placeholders). Rows with `pageCountAttempts >= 3` are filtered
-- out of the sweep so the 2-minute retry loop stops firing on them.

ALTER TABLE "Chapter"
ADD COLUMN IF NOT EXISTS "pageCountAttempts" INTEGER NOT NULL DEFAULT 0;
