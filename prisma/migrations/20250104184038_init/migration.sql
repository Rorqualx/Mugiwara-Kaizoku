/*
  Warnings:

  - You are about to alter the column `fileName` on the `Chapter` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `title` on the `Chapter` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The `status` column on the `Manga` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `created_at` on the `Queue` table. All the data in the column will be lost.
  - You are about to drop the column `error_message` on the `Queue` table. All the data in the column will be lost.
  - You are about to drop the column `max_retry_count` on the `Queue` table. All the data in the column will be lost.
  - You are about to drop the column `next_retry_at` on the `Queue` table. All the data in the column will be lost.
  - You are about to drop the column `payload` on the `Queue` table. All the data in the column will be lost.
  - You are about to drop the column `retry_count` on the `Queue` table. All the data in the column will be lost.
  - You are about to drop the column `task_type` on the `Queue` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `Queue` table. All the data in the column will be lost.
  - You are about to drop the column `payload` on the `Task` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[hash]` on the table `Chapter` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[title]` on the table `Manga` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[mangaId,chapterId]` on the table `OutOfSyncChapter` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Queue` will be added. If there are existing duplicate values, this will fail.
  - Made the column `fileName` on table `Chapter` required. This step will fail if there are existing NULL values in that column.
  - Made the column `index` on table `Chapter` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `Manga` table without a default value. This is not possible if the table is not empty.
  - Made the column `libraryId` on table `Manga` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `OutOfSyncChapter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Queue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Queue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Queue` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MangaStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'ERROR', 'DELETED');

-- CreateEnum
CREATE TYPE "ChapterStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'COMPLETED', 'ERROR', 'DELETED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'FAILED');

-- DropForeignKey
ALTER TABLE "Chapter" DROP CONSTRAINT "Chapter_mangaId_fkey";

-- DropForeignKey
ALTER TABLE "Manga" DROP CONSTRAINT "Manga_libraryId_fkey";

-- DropForeignKey
ALTER TABLE "OutOfSyncChapter" DROP CONSTRAINT "OutOfSyncChapter_chapterId_fkey";

-- DropForeignKey
ALTER TABLE "OutOfSyncChapter" DROP CONSTRAINT "OutOfSyncChapter_mangaId_fkey";

-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "downloadStatus" "ChapterStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "downloadUrl" TEXT,
ADD COLUMN     "hash" TEXT,
ADD COLUMN     "mimeType" VARCHAR(100),
ALTER COLUMN "fileName" SET NOT NULL,
ALTER COLUMN "fileName" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "index" SET NOT NULL,
ALTER COLUMN "size" SET DEFAULT 0,
ALTER COLUMN "title" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "Library" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Manga" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "lastErrorAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "syncCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "libraryId" SET NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "MangaStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Metadata" ADD COLUMN     "cover" TEXT NOT NULL DEFAULT '/cover-not-found.jpg',
ADD COLUMN     "lastFetch" TIMESTAMP(3),
ADD COLUMN     "source" VARCHAR(100),
ADD COLUMN     "sourceId" VARCHAR(100),
ALTER COLUMN "genres" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "authors" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "status" SET DEFAULT 'UNKNOWN',
ALTER COLUMN "tags" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "characters" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "synonyms" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "urls" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "OutOfSyncChapter" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "resolution" TEXT,
ADD COLUMN     "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Queue" DROP COLUMN "created_at",
DROP COLUMN "error_message",
DROP COLUMN "max_retry_count",
DROP COLUMN "next_retry_at",
DROP COLUMN "payload",
DROP COLUMN "retry_count",
DROP COLUMN "task_type",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastProcessed" TIMESTAMP(3),
ADD COLUMN     "maxConcurrent" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "maxRetries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "processingRate" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "retryDelay" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Settings" ALTER COLUMN "appriseUrls" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "payload",
ADD COLUMN     "chapterId" INTEGER,
ADD COLUMN     "checkChaptersPayload" JSONB,
ADD COLUMN     "fixOutOfSyncPayload" JSONB,
ADD COLUMN     "mangaId" INTEGER,
ADD COLUMN     "maxRetries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "notifyPayload" JSONB,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "queueId" INTEGER,
ADD COLUMN     "updateMetadataPayload" JSONB,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_hash_key" ON "Chapter"("hash");

-- CreateIndex
CREATE INDEX "Chapter_downloadStatus_idx" ON "Chapter"("downloadStatus");

-- CreateIndex
CREATE INDEX "Chapter_createdAt_idx" ON "Chapter"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Manga_title_key" ON "Manga"("title");

-- CreateIndex
CREATE INDEX "Manga_source_status_idx" ON "Manga"("source", "status");

-- CreateIndex
CREATE INDEX "Manga_lastChecked_idx" ON "Manga"("lastChecked");

-- CreateIndex
CREATE INDEX "Manga_createdAt_idx" ON "Manga"("createdAt");

-- CreateIndex
CREATE INDEX "Metadata_source_sourceId_idx" ON "Metadata"("source", "sourceId");

-- CreateIndex
CREATE INDEX "Metadata_createdAt_idx" ON "Metadata"("createdAt");

-- CreateIndex
CREATE INDEX "OutOfSyncChapter_status_idx" ON "OutOfSyncChapter"("status");

-- CreateIndex
CREATE INDEX "OutOfSyncChapter_createdAt_idx" ON "OutOfSyncChapter"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutOfSyncChapter_mangaId_chapterId_key" ON "OutOfSyncChapter"("mangaId", "chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "Queue_name_key" ON "Queue"("name");

-- CreateIndex
CREATE INDEX "Queue_type_status_idx" ON "Queue"("type", "status");

-- CreateIndex
CREATE INDEX "Queue_priority_idx" ON "Queue"("priority");

-- CreateIndex
CREATE INDEX "Task_type_status_idx" ON "Task"("type", "status");

-- CreateIndex
CREATE INDEX "Task_scheduledAt_idx" ON "Task"("scheduledAt");

-- CreateIndex
CREATE INDEX "Task_mangaId_idx" ON "Task"("mangaId");

-- CreateIndex
CREATE INDEX "Task_chapterId_idx" ON "Task"("chapterId");

-- AddForeignKey
ALTER TABLE "Manga" ADD CONSTRAINT "Manga_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutOfSyncChapter" ADD CONSTRAINT "OutOfSyncChapter_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutOfSyncChapter" ADD CONSTRAINT "OutOfSyncChapter_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "Queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
