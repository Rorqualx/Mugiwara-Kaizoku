-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "mangalHost" TEXT,
ADD COLUMN     "mangalLibraries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mangalPassword" TEXT,
ADD COLUMN     "mangalUser" TEXT;
