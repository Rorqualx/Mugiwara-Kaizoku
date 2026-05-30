-- Phase 1.5 — Cross-source consensus selector surface.
--
-- Adds the per-field-dissenters column on Metadata and the per-selector-pass
-- telemetry table that drives the selector-loop scorecard. No consumer
-- wiring lights up in this migration — code arrives in subsequent commits.

-- AlterTable
ALTER TABLE "Metadata" ADD COLUMN     "fieldAlternatives" JSONB;

-- CreateTable
CREATE TABLE "MetadataSelectionAttempt" (
    "id" BIGSERIAL NOT NULL,
    "mangaId" INTEGER NOT NULL,
    "selectorVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "selections" JSONB NOT NULL DEFAULT '{}',
    "refusedFields" JSONB NOT NULL DEFAULT '[]',
    "shadowDeltas" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetadataSelectionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetadataSelectionAttempt_mangaId_createdAt_idx" ON "MetadataSelectionAttempt"("mangaId", "createdAt");

-- CreateIndex
CREATE INDEX "MetadataSelectionAttempt_selectorVersion_createdAt_idx" ON "MetadataSelectionAttempt"("selectorVersion", "createdAt");
