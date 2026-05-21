-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "anilistEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "anilistUseForMetadata" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prowlarrApiKey" TEXT,
ADD COLUMN     "prowlarrBaseURL" TEXT,
ADD COLUMN     "prowlarrEnabled" BOOLEAN NOT NULL DEFAULT false;
