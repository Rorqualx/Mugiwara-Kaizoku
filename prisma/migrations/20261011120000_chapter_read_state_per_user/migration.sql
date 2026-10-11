-- Per-user chapter read state.
--
-- "Read" was the single column Chapter.isRead. The manga catalog is shared
-- between users (LibraryMembership), so one user's "mark all read" changed the
-- read state every other member of the title saw, and theirs overwrote it back.
-- Read state now lives in ChapterReadState, one row per (user, chapter).
--
-- Existing state is carried over, nothing is deleted:
--   1. Chapters a user finished in the reader (ReadingProgress.completedAt) are
--      read for that user. This was already per-user data.
--   2. Chapters flagged in the old shared column go to ONE user per title: the
--      owner of the library the title was added to (Manga.libraryId), provided
--      they still have the title; otherwise the member who has had it longest;
--      otherwise (no member at all) the library owner. The shared flag did not
--      record who set it, so the title's owner is the best available answer.
--
-- Chapter.isRead is deliberately left in place and untouched. The application
-- no longer reads or writes it; keeping it means the previous release still
-- works if this deploy is rolled back. Drop it in a later migration.

-- CreateTable
CREATE TABLE "ChapterReadState" (
    "userId" TEXT NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "mangaId" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterReadState_pkey" PRIMARY KEY ("userId","chapterId")
);

-- CreateIndex
CREATE INDEX "ChapterReadState_userId_mangaId_idx" ON "ChapterReadState"("userId", "mangaId");

-- CreateIndex
CREATE INDEX "ChapterReadState_chapterId_idx" ON "ChapterReadState"("chapterId");

-- CreateIndex
CREATE INDEX "ChapterReadState_mangaId_idx" ON "ChapterReadState"("mangaId");

-- AddForeignKey
ALTER TABLE "ChapterReadState" ADD CONSTRAINT "ChapterReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterReadState" ADD CONSTRAINT "ChapterReadState_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterReadState" ADD CONSTRAINT "ChapterReadState_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill 1: chapters each user finished in the reader. Runs first so the
-- real completion time wins over the approximation used in backfill 2.
INSERT INTO "ChapterReadState" ("userId", "chapterId", "mangaId", "readAt")
SELECT rp."userId", c."id", c."mangaId", rp."completedAt"
FROM "ReadingProgress" rp
JOIN "Chapter" c ON c."id" = rp."chapterId"
WHERE rp."completedAt" IS NOT NULL
ON CONFLICT ("userId", "chapterId") DO NOTHING;

-- Backfill 2: the old shared flag, attributed to one user per title.
-- readAt is the chapter's updatedAt, which is what "last read" sorting used.
WITH read_title_owner AS (
    SELECT
        m."id" AS "mangaId",
        COALESCE(
            (SELECT lm."userId"
               FROM "LibraryMembership" lm
              WHERE lm."mangaId" = m."id" AND lm."userId" = l."ownerId"),
            (SELECT lm."userId"
               FROM "LibraryMembership" lm
              WHERE lm."mangaId" = m."id"
              ORDER BY lm."addedAt" ASC, lm."id" ASC
              LIMIT 1),
            l."ownerId"
        ) AS "userId"
    FROM "Manga" m
    JOIN "Library" l ON l."id" = m."libraryId"
    WHERE EXISTS (SELECT 1 FROM "Chapter" c WHERE c."mangaId" = m."id" AND c."isRead")
)
INSERT INTO "ChapterReadState" ("userId", "chapterId", "mangaId", "readAt")
SELECT o."userId", c."id", c."mangaId", c."updatedAt"
FROM "Chapter" c
JOIN read_title_owner o ON o."mangaId" = c."mangaId"
WHERE c."isRead"
ON CONFLICT ("userId", "chapterId") DO NOTHING;
