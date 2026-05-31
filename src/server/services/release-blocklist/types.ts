/**
 * Release Blocklist Types
 *
 * Type definitions, interfaces, and type guards for release blocklist service.
 *
 * Extracted from: releaseBlocklistService.ts (lines 22-107)
 */

import { ReleaseBlocklistReason } from '@prisma/client';

// Re-export for convenience
export { ReleaseBlocklistReason };

// ============================================================================
// Core Types
// ============================================================================

export interface ReleaseIdentifier {
  releaseTitle: string;
  indexerId?: string | number;
  source?: string;
  mangaId?: number;
  chapterIds?: number[];
  releaseHash?: string;
  chapterNumber?: number;
}

export interface ReleaseQualityMetrics {
  resolution?: string;
  fileSize?: number;
  format?: string;
  hasWatermark?: boolean;
  isComplete?: boolean;
  languageCode?: string;
  downloadTime?: number; // Added for compatibility with downloadManager
}

export interface BlocklistCheckResult {
  isBlocked: boolean;
  reason?: ReleaseBlocklistReason;
  details?: string;
  alternatives?: ReleaseIdentifier[];
}

/**
 * Input shape consumed by `blocklist-manager.blockRelease`.
 *
 * The release identifier is REQUIRED and must be nested under `release` —
 * the manager only reads `input.release.*`. A flat top-level shape (legacy
 * leftover) silently failed validation with "Invalid release identifier"
 * and dropped the jobs-page "Cancel & Blocklist" action on the floor.
 */
export interface AddReleaseBlocklistInput {
  release: ReleaseIdentifier;
  reason: ReleaseBlocklistReason;
  reasonDetails?: string;
  blockPattern?: string;
  releaseGroup?: string;
  source?: string;
  metrics?: ReleaseQualityMetrics;
}

export interface ReleaseBlocklistEntry {
  id: string;
  releaseTitle: string;
  reason: ReleaseBlocklistReason;
  indexerId?: string | null;
  source?: string | null;
  mangaId?: number | null;
  chapterIds?: number[];
  autoBlocked: boolean;
  details?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlocklistStatistics {
  totalBlocked: number;
  autoBlocked: number;
  reasonCounts: Record<ReleaseBlocklistReason, number>;
  mostBlockedSources: Array<{
    source: string;
    count: number;
  }>;
  recentlyBlocked: ReleaseBlocklistEntry[];
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to validate ReleaseIdentifier
 */
export function isValidReleaseIdentifier(identifier: unknown): identifier is ReleaseIdentifier {
  if (!identifier || typeof identifier !== 'object') {
    return false;
  }
  const obj = identifier as Record<string, unknown>;
  return typeof obj['releaseTitle'] === 'string' && obj['releaseTitle'].length > 0;
}

/**
 * Type guard to validate ReleaseBlocklistReason
 */
export function isValidBlocklistReason(reason: unknown): reason is ReleaseBlocklistReason {
  return typeof reason === 'string' && Object.values(ReleaseBlocklistReason).includes(reason as ReleaseBlocklistReason);
}
