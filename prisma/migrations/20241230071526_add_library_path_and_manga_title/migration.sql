-- AlterTable
ALTER TABLE "Manga" ADD COLUMN     "libraryPath" TEXT,
ADD COLUMN     "mangaTitle" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "interval" TEXT;
