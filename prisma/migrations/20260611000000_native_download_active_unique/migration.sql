-- NativeDownload double-enqueue fix (audit task #2).
--
-- The release dispatcher snapshots in-flight chapters once per run
-- (dispatch.ts readInFlightChapterNumbers) and six entry points can run
-- concurrently for the same manga with no locking, so two dispatchers can
-- both pass the stale check and create duplicate QUEUED rows for the same
-- (mangaId, chapterNumber) — see the B3 backfill that cancelled 244 orphans.
--
-- This migration adds a hard database barrier: at most ONE active
-- (QUEUED/DOWNLOADING) NativeDownload per (mangaId, chapterNumber).
-- Terminal states (COMPLETED/FAILED/CANCELLED) stay duplicable so retries
-- and re-downloads keep working. Prisma cannot express partial unique
-- indexes, so this lives in raw SQL like the jobs partition indexes.

-- Step 1: cancel existing duplicate active rows so the index can be built.
-- Keep one winner per (mangaId, chapterNumber): prefer a row a worker is
-- actively DOWNLOADING over a stale QUEUED one, then the oldest by
-- startTime, then the smallest id. Losers are CANCELLED (not deleted) to
-- preserve history, matching the B3 backfill semantics.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "mangaId", "chapterNumber"
      ORDER BY
        CASE WHEN "status" = 'DOWNLOADING' THEN 0 ELSE 1 END,
        "startTime",
        "id"
    ) AS rn
  FROM "NativeDownload"
  WHERE "status" IN ('QUEUED', 'DOWNLOADING')
)
UPDATE "NativeDownload" nd
SET
  "status"  = 'CANCELLED',
  "error"   = 'Cancelled by migration 20260611: duplicate active download (dispatch race cleanup)',
  "endTime" = NOW()
FROM ranked r
WHERE nd."id" = r."id"
  AND r.rn > 1;

-- Step 2: the partial unique index. Concurrent creates that lose the race
-- now fail with a unique violation (Prisma P2002), which the dispatcher
-- catches and treats as "already enqueued by someone else".
CREATE UNIQUE INDEX IF NOT EXISTS "idx_native_download_active_unique"
  ON "NativeDownload" ("mangaId", "chapterNumber")
  WHERE "status" IN ('QUEUED', 'DOWNLOADING');
