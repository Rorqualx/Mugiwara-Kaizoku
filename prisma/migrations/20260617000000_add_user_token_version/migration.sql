-- Add tokenVersion for JWT invalidation on password/role change.
-- Idempotent so it is safe on databases where the column already exists.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
