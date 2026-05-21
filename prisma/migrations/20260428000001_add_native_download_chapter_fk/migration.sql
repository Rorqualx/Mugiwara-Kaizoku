-- Add FK relation NativeDownload.chapterId -> Chapter.id (onDelete SET NULL).
-- Pre-flight cleanup is in scripts/surveys/cleanup-native-download-dangling-chapterIds.ts
-- (must run before this migration applies).
--
-- The FK ensures Chapter deletes do not strand NativeDownload rows pointing
-- to non-existent chapters — the same orphan class that produced 56 stuck
-- QUEUED rows in the D3 cleanup. SET NULL preserves the download history
-- (useful audit trail) while clearing the dangling pointer.

-- Idempotent guard: skip if FK already exists (e.g. on re-run against a
-- partially-applied state).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'NativeDownload_chapterId_fkey'
  ) THEN
    ALTER TABLE "NativeDownload"
      ADD CONSTRAINT "NativeDownload_chapterId_fkey"
      FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "NativeDownload_chapterId_idx"
  ON "NativeDownload"("chapterId");
