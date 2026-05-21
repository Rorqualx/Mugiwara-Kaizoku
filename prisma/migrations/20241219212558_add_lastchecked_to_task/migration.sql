/*
  Warnings:

  - The `payload` column on the `Task` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
DROP COLUMN "payload",
ADD COLUMN     "payload" JSONB;
