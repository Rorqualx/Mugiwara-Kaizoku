-- CreateTable
CREATE TABLE "ChapterFile" (
    "id" SERIAL NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" VARCHAR(20) NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "pageCount" INTEGER,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChapterFile_chapterId_filePath_key" ON "ChapterFile"("chapterId", "filePath");
CREATE INDEX "ChapterFile_chapterId_idx" ON "ChapterFile"("chapterId");
CREATE INDEX "ChapterFile_filePath_idx" ON "ChapterFile"("filePath");
CREATE INDEX "ChapterFile_chapterId_isActive_idx" ON "ChapterFile"("chapterId", "isActive");

-- AddForeignKey
ALTER TABLE "ChapterFile" ADD CONSTRAINT "ChapterFile_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: Populate ChapterFile from existing Chapter rows
-- Detect sourceType: if a filePath appears in multiple chapters, it's likely a 'volume' file
-- NOTE: This heuristic is imperfect — duplicate filePaths from import errors would also be
-- flagged as 'volume'. The application layer uses ParsedFileInfo.isVolumeFile for new imports,
-- which is more accurate. This is acceptable for a one-time migration.
INSERT INTO "ChapterFile" ("chapterId", "filePath", "fileName", "fileSize", "isActive", "sourceType")
SELECT
    c."id",
    c."filePath",
    c."fileName",
    c."size",
    true,
    CASE
        WHEN file_counts.cnt > 1 THEN 'volume'
        ELSE 'chapter'
    END
FROM "Chapter" c
INNER JOIN (
    SELECT "filePath", COUNT(*) as cnt
    FROM "Chapter"
    WHERE "filePath" IS NOT NULL
    GROUP BY "filePath"
) file_counts ON file_counts."filePath" = c."filePath"
WHERE c."filePath" IS NOT NULL;
