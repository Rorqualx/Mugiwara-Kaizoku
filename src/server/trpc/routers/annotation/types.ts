/**
 * Annotation Router - Response Types
 */

import type { AnnotationSourceType, AnnotationStatus } from '@prisma/client';

export interface AnnotationStats {
  totalPages: number;
  bootstrapPages: number;
  agentReviewedPages: number;
  reviewedPages: number;
  goldPages: number;
  inProgressPages: number;
  rejectedPages: number;
  bySource: Record<AnnotationSourceType, number>;
  totalTokens: number;
  entityCounts: Record<string, number>;
}

/** Discovered URL from training data CSV */
export interface TrainingDiscoveredUrl {
  type: string;
  url: string;
  categoryName?: string | undefined;
}

export interface PageListItem {
  id: string;
  url: string;
  mangaTitle: string | null;
  sourceType: AnnotationSourceType;
  status: AnnotationStatus;
  tokenCount: number;
  createdAt: Date;
  updatedAt: Date;
  /** Training data fields - populated by matching mangaTitle to CSV */
  comicVineId?: string | null;
  fandomBaseUrl?: string | null;
  wikipediaBaseUrl?: string | null;
  fandomDiscoveredUrls?: TrainingDiscoveredUrl[];
  wikipediaDiscoveredUrls?: TrainingDiscoveredUrl[];
  comicVineDiscoveredUrls?: TrainingDiscoveredUrl[];
}

// Discovery types
export interface DiscoverableUrl {
  mangaId: number;
  mangaTitle: string;
  url: string;
  sourceType: AnnotationSourceType;
  alreadyAnnotated: boolean;
}

export interface DiscoveryResult {
  urls: DiscoverableUrl[];
  total: number;
  alreadyAnnotatedCount: number;
}

export interface BulkImportResult {
  added: number;
  skipped: number;
  failed: Array<{ url: string; error: string }>;
}
