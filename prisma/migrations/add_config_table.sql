-- CreateTable
CREATE TABLE "Config" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "valueType" TEXT NOT NULL DEFAULT 'string',
  "scope" TEXT NOT NULL DEFAULT 'system',
  "source" TEXT NOT NULL DEFAULT 'database',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Config_key_key" ON "Config"("key");

-- CreateIndex
CREATE INDEX "Config_key_idx" ON "Config"("key");

-- CreateIndex
CREATE INDEX "Config_scope_idx" ON "Config"("scope");

-- CreateIndex
CREATE INDEX "Config_source_idx" ON "Config"("source");