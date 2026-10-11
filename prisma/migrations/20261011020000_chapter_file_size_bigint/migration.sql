-- ChapterFile.fileSize holds a byte count. A whole-volume or omnibus archive
-- can exceed the int4 maximum of 2,147,483,647 bytes (largest stored today:
-- 1,316,655,370), and the insert would then fail for that file. Same widening
-- as Chapter.size in 20261010230000.
ALTER TABLE "ChapterFile" ALTER COLUMN "fileSize" TYPE BIGINT;
