-- Add autoStart column to FlareSolverrConfig (default to stopped)
ALTER TABLE "FlareSolverrConfig" ADD COLUMN IF NOT EXISTS "autoStart" BOOLEAN NOT NULL DEFAULT false;
