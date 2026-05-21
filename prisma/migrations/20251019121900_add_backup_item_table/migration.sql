-- CreateTable: BackupItem for tracking backup contents
CREATE TABLE "BackupItem" (
    "id" SERIAL NOT NULL,
    "backupId" INTEGER NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemPath" TEXT NOT NULL,
    "itemSize" INTEGER NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupItem_backupId_idx" ON "BackupItem"("backupId");

-- CreateIndex
CREATE INDEX "BackupItem_itemType_idx" ON "BackupItem"("itemType");

-- AddForeignKey
ALTER TABLE "BackupItem" ADD CONSTRAINT "BackupItem_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "Backup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
