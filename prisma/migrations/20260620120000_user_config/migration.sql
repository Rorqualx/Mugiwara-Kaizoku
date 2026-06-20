-- Per-user config override layer. A UserConfig(userId, key) row overrides the
-- global Config value for that user; absence falls back to global. Additive —
-- new table only, no backfill.

CREATE TABLE "UserConfig" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" "ConfigValueType" NOT NULL DEFAULT 'STRING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserConfig_pkey" PRIMARY KEY ("userId","key")
);

CREATE INDEX "UserConfig_userId_idx" ON "UserConfig"("userId");

ALTER TABLE "UserConfig"
  ADD CONSTRAINT "UserConfig_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
