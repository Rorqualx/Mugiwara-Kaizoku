-- API platform models: Permission, ApiMetric, ApiEvent + ApiKey.rateLimit
-- Completes the v1 API surface (api keys with permissions, request metrics, webhook event log)

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN "rateLimit" INTEGER NOT NULL DEFAULT 120;

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "apiKeyId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "actions" TEXT[],
    "scope" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiMetric" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "apiKeyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiEvent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Permission_apiKeyId_idx" ON "Permission"("apiKeyId");

-- CreateIndex
CREATE INDEX "ApiMetric_apiKeyId_idx" ON "ApiMetric"("apiKeyId");

-- CreateIndex
CREATE INDEX "ApiMetric_timestamp_idx" ON "ApiMetric"("timestamp");

-- CreateIndex
CREATE INDEX "ApiMetric_endpoint_idx" ON "ApiMetric"("endpoint");

-- CreateIndex
CREATE INDEX "ApiEvent_type_idx" ON "ApiEvent"("type");

-- CreateIndex
CREATE INDEX "ApiEvent_createdAt_idx" ON "ApiEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiMetric" ADD CONSTRAINT "ApiMetric_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
