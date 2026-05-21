-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "BackupSchedule" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BackupContent" AS ENUM ('DATABASE', 'CONFIGURATION', 'MEDIA_FILES');

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "backupCustomCron" TEXT,
ADD COLUMN     "backupEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "backupIncludeConfig" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "backupIncludeDatabase" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "backupIncludeMedia" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "backupMaxCount" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "backupPath" TEXT,
ADD COLUMN     "backupRetentionDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "backupSchedule" "BackupSchedule" NOT NULL DEFAULT 'DAILY';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "backupPayload" JSONB;

-- CreateTable
CREATE TABLE "Backup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "status" "BackupStatus" NOT NULL DEFAULT 'PENDING',
    "type" "BackupType" NOT NULL DEFAULT 'MANUAL',
    "contents" "BackupContent"[],
    "hash" TEXT,
    "notes" TEXT,

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Backup_name_key" ON "Backup"("name");

-- CreateIndex
CREATE INDEX "Backup_createdAt_idx" ON "Backup"("createdAt");

-- CreateIndex
CREATE INDEX "Backup_status_idx" ON "Backup"("status");

-- CreateIndex
CREATE INDEX "Backup_type_idx" ON "Backup"("type");
