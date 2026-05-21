/**
 * Source types for manga sources
 */

import type { ProviderCapability } from '@prisma/client';

/**
 * Unified source type for Suwayomi sources
 */
export interface UnifiedSource {
  id: string;          // Unique identifier
  name: string;        // Display name
  enabled: boolean;    // Whether the source is enabled
  description: string; // Description of the source
  version: string;     // Version information
  author: string;      // Author/provider
  sourceType: 'suwayomi'; // Source type
  iconUrl?: string;    // Optional icon URL (for Suwayomi)
  lang?: string;       // Optional language (for Suwayomi)
  isNsfw?: boolean;    // Optional NSFW flag (for Suwayomi)
  isInstalled?: boolean; // Optional installation status (for Suwayomi)
}

export interface MangaSource {
  id: string;
  name: string;
  language: string;
  baseUrl: string;
  capabilities: ProviderCapability[];
  isActive: boolean;
  priority: number;
}

export interface SourceFilter {
  language?: string;
  capability?: ProviderCapability;
  isActive?: boolean;
}

export interface SourceStats {
  totalManga: number;
  totalChapters: number;
  lastSync?: Date;
  errorRate: number;
}