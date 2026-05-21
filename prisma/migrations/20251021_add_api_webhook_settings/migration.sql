-- Add API Authentication and Webhook System Models
-- Adds ApiKey, Webhook, WebhookDelivery, and Settings models
-- Required for API authentication, webhook subscriptions, and global settings

-- ============================================================================
-- API KEY AUTHENTICATION
-- ============================================================================

-- ApiKey: API key authentication for external integrations
CREATE TABLE "ApiKey" (
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

-- Indexes for efficient API key lookups
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");
CREATE INDEX "ApiKey_key_idx" ON "ApiKey"(key);

-- ============================================================================
-- WEBHOOK SYSTEM
-- ============================================================================

-- Webhook: Webhook subscription endpoints
CREATE TABLE "Webhook" (
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

-- Index for user webhook lookups
CREATE INDEX "Webhook_userId_idx" ON "Webhook"("userId");

-- WebhookDelivery: Webhook delivery history and status
CREATE TABLE "WebhookDelivery" (
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

-- Indexes for webhook delivery queries
CREATE INDEX "WebhookDelivery_webhookId_idx" ON "WebhookDelivery"("webhookId");
CREATE INDEX "WebhookDelivery_attemptedAt_idx" ON "WebhookDelivery"("attemptedAt" DESC);

-- ============================================================================
-- GLOBAL SETTINGS
-- ============================================================================

-- Settings: Global system configuration (singleton table)
CREATE TABLE "Settings" (
    id SERIAL PRIMARY KEY,
    "suwayomiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "suwayomiServerPath" TEXT,
    "suwayomiConfigPath" TEXT,
    "suwayomiPort" INTEGER,
    "suwayomiSources" JSONB,
    metadata JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. ApiKey table uses UUID for globally unique API keys
-- 2. Webhook events stored as TEXT[] (array of event type strings)
-- 3. WebhookDelivery tracks all delivery attempts with status
-- 4. Settings is a singleton table (no unique constraints needed)
-- 5. All foreign keys cascade on delete to maintain referential integrity
-- 6. Indexes optimized for common query patterns:
--    - User-centric queries (userId indexes)
--    - Key lookups (ApiKey.key index)
--    - Temporal queries (attemptedAt index)
