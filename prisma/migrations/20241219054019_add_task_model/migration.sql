/*
  Warnings:

  - You are about to drop the column `error` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "kavitaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kavitaHost" TEXT,
ADD COLUMN     "kavitaLibraries" TEXT[],
ADD COLUMN     "kavitaPassword" TEXT,
ADD COLUMN     "kavitaUser" TEXT,
ADD COLUMN     "komgaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "komgaHost" TEXT,
ADD COLUMN     "komgaLibraries" TEXT[],
ADD COLUMN     "komgaPassword" TEXT,
ADD COLUMN     "komgaUser" TEXT;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "error",
ADD COLUMN     "errorMessage" TEXT,
ALTER COLUMN "payload" SET DATA TYPE TEXT;
