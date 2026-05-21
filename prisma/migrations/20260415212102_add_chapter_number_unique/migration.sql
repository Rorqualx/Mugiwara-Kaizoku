-- Remove duplicate (mangaId, chapterNumber) rows, keeping the one with best metadata.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "mangaId", "chapterNumber"
      ORDER BY
        CASE WHEN "filePath" IS NOT NULL THEN 1 ELSE 0 END DESC,
        CASE WHEN "coverImage" IS NOT NULL THEN 1 ELSE 0 END DESC,
        CASE WHEN "description" IS NOT NULL THEN 1 ELSE 0 END DESC,
        CASE WHEN "releaseDate" IS NOT NULL THEN 1 ELSE 0 END DESC,
        "updatedAt" DESC
    ) as rn
  FROM "Chapter"
  WHERE "chapterNumber" IS NOT NULL
  AND ("mangaId", "chapterNumber") IN (
    SELECT "mangaId", "chapterNumber"
    FROM "Chapter"
    WHERE "chapterNumber" IS NOT NULL
    GROUP BY "mangaId", "chapterNumber"
    HAVING COUNT(*) > 1
  )
)
DELETE FROM "Chapter" WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Partial unique index: only enforces when chapterNumber IS NOT NULL.
CREATE UNIQUE INDEX "Chapter_mangaId_chapterNumber_unique"
ON "Chapter" ("mangaId", "chapterNumber")
WHERE "chapterNumber" IS NOT NULL;
