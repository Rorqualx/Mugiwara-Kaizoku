-- AlterTable
ALTER TABLE "Manga" ADD COLUMN "searchProvider" TEXT NOT NULL DEFAULT 'anilist',
    ADD COLUMN "providerMetadata" JSONB,
    ADD COLUMN "monitoringConfig" JSONB;

-- CreateTable
CREATE TABLE "BatchOperation" (
    "id" SERIAL NOT NULL,
    "mangaId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "chapters" INTEGER[],
    "options" JSONB,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "errorLog" TEXT,

    CONSTRAINT "BatchOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BatchOperation_status_idx" ON "BatchOperation"("status");

-- CreateIndex
CREATE INDEX "BatchOperation_mangaId_idx" ON "BatchOperation"("mangaId");

-- CreateIndex
CREATE INDEX "BatchOperation_createdAt_idx" ON "BatchOperation"("createdAt");

-- CreateIndex
CREATE INDEX "Manga_searchProvider_idx" ON "Manga"("searchProvider");

-- AddForeignKey
ALTER TABLE "BatchOperation" ADD CONSTRAINT "BatchOperation_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;
