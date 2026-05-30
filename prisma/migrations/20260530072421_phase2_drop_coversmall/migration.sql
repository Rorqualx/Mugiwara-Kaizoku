-- Phase 2 #1 — Drop `coverSmall` from Metadata.
--
-- Zero providers populate this column (verified 2026-05-30 live DB: 0/4013
-- rows non-null). Removing it eliminates a dead column + simplifies the
-- buildCoverVariants logic in metadata-persister.ts.

ALTER TABLE "Metadata" DROP COLUMN "coverSmall";
