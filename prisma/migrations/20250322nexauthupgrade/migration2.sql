-- NextAuth Migration Part 2
-- Modifies existing tables for NextAuth compatibility
-- Created: 2025-03-22

-- Update Session table to be compatible with NextAuth
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "sessionToken" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "expires" TIMESTAMP(3);

-- Create unique index on sessionToken
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");

-- Update User table for NextAuth compatibility
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT;

-- Set name from userName for existing users
UPDATE "User" SET "name" = "userName" WHERE "name" IS NULL;