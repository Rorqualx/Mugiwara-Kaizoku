/**
 * ConversionRequest helpers
 *
 * Shape adapters between the public ConversionRequest API and the
 * Prisma write/read layer for ConversionJob rows.
 */

import type { ConversionDefaults } from './defaults-loader';
import type { Prisma } from '@prisma/client';


interface ConversionRequestOverrides {
  quality?: number;
  compression?: number;
  bitrate?: string;
  metadata?: Record<string, unknown>;
}

export interface JobOverrideColumns {
  quality?: number;
  compression?: number;
  bitrate?: string;
  metadata?: Prisma.InputJsonValue;
}

export function buildOverrideColumns(request: ConversionRequestOverrides): JobOverrideColumns {
  const overrides: JobOverrideColumns = {};
  if (request.quality !== undefined) overrides.quality = request.quality;
  if (request.compression !== undefined) overrides.compression = request.compression;
  if (request.bitrate !== undefined) overrides.bitrate = request.bitrate;
  if (request.metadata !== undefined) overrides.metadata = request.metadata as Prisma.InputJsonValue;
  return overrides;
}

interface ConversionJobRow {
  quality: number | null;
  compression: number | null;
  bitrate: string | null;
  metadata: Prisma.JsonValue | null;
}

export interface ResolvedOptionOverrides {
  quality?: number;
  compression?: number;
  bitrate?: string;
  metadata?: Record<string, unknown>;
}

export function buildOptionOverrides(
  job: ConversionJobRow,
  defaults: ConversionDefaults
): ResolvedOptionOverrides {
  const resolved: ResolvedOptionOverrides = {};
  const quality = job.quality ?? defaults.quality;
  const compression = job.compression ?? defaults.compression;
  const bitrate = job.bitrate ?? defaults.bitrate;
  if (quality !== undefined) resolved.quality = quality;
  if (compression !== undefined) resolved.compression = compression;
  if (bitrate !== undefined) resolved.bitrate = bitrate;
  if (job.metadata !== null) resolved.metadata = job.metadata as Record<string, unknown>;
  return resolved;
}
