-- CreateTable
CREATE TABLE "Library" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,

    CONSTRAINT "Library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manga" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "interval" TEXT NOT NULL DEFAULT 'never',
    "libraryId" INTEGER,
    "metadataId" INTEGER,

    CONSTRAINT "Manga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT,
    "index" INTEGER,
    "size" INTEGER NOT NULL,
    "mangaId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutOfSyncChapter" (
    "id" SERIAL NOT NULL,
    "mangaId" INTEGER NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "OutOfSyncChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metadata" (
    "id" SERIAL NOT NULL,
    "coverExtraLarge" TEXT,
    "coverLarge" TEXT,
    "coverMedium" TEXT,
    "coverSmall" TEXT,
    "summary" TEXT,
    "genres" TEXT[],
    "authors" TEXT[],
    "status" TEXT NOT NULL,
    "tags" TEXT[],
    "characters" TEXT[],
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "synonyms" TEXT[],
    "urls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "error" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" SERIAL NOT NULL,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "telegramToken" TEXT,
    "telegramChatId" TEXT,
    "telegramSendSilently" BOOLEAN NOT NULL DEFAULT false,
    "appriseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "appriseHost" TEXT,
    "appriseUrls" TEXT[],

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Manga_metadataId_key" ON "Manga"("metadataId");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_mangaId_index_key" ON "Chapter"("mangaId", "index");

-- AddForeignKey
ALTER TABLE "Manga" ADD CONSTRAINT "Manga_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manga" ADD CONSTRAINT "Manga_metadataId_fkey" FOREIGN KEY ("metadataId") REFERENCES "Metadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutOfSyncChapter" ADD CONSTRAINT "OutOfSyncChapter_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutOfSyncChapter" ADD CONSTRAINT "OutOfSyncChapter_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
