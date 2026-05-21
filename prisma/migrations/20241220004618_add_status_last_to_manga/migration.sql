/*
  Warnings:

  - Added the required column `status` to the `Manga` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Manga" ADD COLUMN     "lastChecked" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL;
