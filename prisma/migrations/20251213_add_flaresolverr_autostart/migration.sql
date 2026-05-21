-- Add autoStart column to FlareSolverrConfig (default to stopped)
ALTER TABLE "FlareSolverrConfig" ADD COLUMN "autoStart" BOOLEAN NOT NULL DEFAULT false;
