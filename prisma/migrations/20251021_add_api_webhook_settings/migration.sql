-- Add API Authentication and Webhook System Models
-- Adds ApiKey, Webhook, WebhookDelivery models + extends Settings.
-- Note: Settings was originally created by migration
-- 20241218214143_update_metadata_and_add_tasks. This migration extends
-- it with new columns; the CREATE TABLE here was the original duplicate
-- bug that broke fresh installs.

-- ============================================================================
-- API KEY AUTHENTICATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ApiKey" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    name TEXT NOT NULL,
    key TEXT UNIQUE NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx" ON "ApiKey"("userId");
CREATE INDEX IF NOT EXISTS "ApiKey_key_idx" ON "ApiKey"(key);

-- ============================================================================
-- WEBHOOK SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS "Webhook" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Webhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Webhook_userId_idx" ON "Webhook"("userId");

CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "webhookId" TEXT NOT NULL,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    "statusCode" INTEGER,
    success BOOLEAN NOT NULL DEFAULT false,
    error TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WebhookDelivery_webhookId_idx" ON "WebhookDelivery"("webhookId");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_attemptedAt_idx" ON "WebhookDelivery"("attemptedAt" DESC);

-- ============================================================================
-- GLOBAL SETTINGS (extend the existing table; do not recreate)
-- ============================================================================

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "suwayomiEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "suwayomiServerPath" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "suwayomiConfigPath" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "suwayomiPort" INTEGER;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "suwayomiSources" JSONB;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
