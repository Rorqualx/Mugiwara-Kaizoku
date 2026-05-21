-- CreateTable
CREATE TABLE "SystemEvent" (
  "id" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "details" JSONB,
  "relatedEntityId" TEXT,
  "relatedEntityType" TEXT,

  CONSTRAINT "SystemEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemEvent_timestamp_idx" ON "SystemEvent"("timestamp");

-- CreateIndex
CREATE INDEX "SystemEvent_type_idx" ON "SystemEvent"("type");

-- CreateIndex
CREATE INDEX "SystemEvent_source_idx" ON "SystemEvent"("source");

-- CreateIndex
CREATE INDEX "SystemEvent_level_idx" ON "SystemEvent"("level");

-- CreateIndex
CREATE INDEX "SystemEvent_relatedEntityId_relatedEntityType_idx" ON "SystemEvent"("relatedEntityId", "relatedEntityType");
