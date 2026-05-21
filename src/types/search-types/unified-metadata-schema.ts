/**
 * Unified Metadata Schema for Intelligent Provider Selection
 *
 * Extends existing metadata types with field-level provider selection,
 * quality scoring, and provenance tracking for consistent metadata
 * across all primary source combinations.
 */

import type { UnifiedMangaMetadata } from './metadata.types';


// ============================================================================
// Provider Quality Scoring
// ============================================================================

export interface ProviderQuality {
  provider: string;
  quality: number; // 0-100 based on field completeness and accuracy
  confidence: number; // 0-100 based on provider reliability for this field type
  lastUpdated: Date;
}

export interface FieldProviderMapping {
  title: ProviderQuality[];
  alternativeTitles: ProviderQuality[];
  description: ProviderQuality[];
  status: ProviderQuality[];
  format: ProviderQuality[];
  genres: ProviderQuality[];
  themes: ProviderQuality[];
  tags: ProviderQuality[];
  authors: ProviderQuality[];
  artists: ProviderQuality[];
  publisher: ProviderQuality[];
  demographic: ProviderQuality[];
  volumes: ProviderQuality[];
  chapters: ProviderQuality[];
  startDate: ProviderQuality[];
  endDate: ProviderQuality[];
  coverImage: ProviderQuality[];
  bannerImage: ProviderQuality[];
  galleryImages: ProviderQuality[];
  characters: ProviderQuality[];
  staff: ProviderQuality[];
  externalLinks: ProviderQuality[];
  averageScore: ProviderQuality[];
  popularity: ProviderQuality[];
  countryOfOrigin: ProviderQuality[];
  isAdult: ProviderQuality[];
  contentWarnings: ProviderQuality[];
  // Index signature for dynamic fields
  [field: string]: ProviderQuality[];
}

// ============================================================================
// Enhanced Provider Preferences
// ============================================================================

export interface EnhancedProviderPreferences {
  // Current system fields
  quickAddEnabled: boolean;
  fieldProviderPreferences: Record<string, string[]>; // field -> ordered provider preferences

  // Enhanced intelligent selection features
  intelligentSelection: boolean; // Enable automatic best-data selection
  fallbackProviders: string[]; // Order for fallback when preferred unavailable
  confidenceThreshold: number; // Minimum confidence for auto-selection (0-100)
  useActualUserPreferences: boolean; // Replace hardcoded defaults with real user settings

  // Provider-specific overrides
  providerOverrides: Record<string, {
    enabled: boolean;
    priority: number;
    fieldSpecific: Record<string, number>; // field -> priority boost
  }>;
}

// ============================================================================
// Intelligent Metadata Selection Result
// ============================================================================

export interface IntelligentSelectionResult {
  selectedMetadata: UnifiedMangaMetadata;
  fieldProvenance: Record<string, {
    provider: string;
    confidence: number;
    quality: number;
    alternatives: Array<{
      provider: string;
      value: unknown;
      confidence: number;
      quality: number;
    }>;
  }>;
  selectionMethod: 'user-preference' | 'intelligent' | 'manual' | 'fallback';
  overallConfidence: number;
  missingFields: string[];
  conflicts: Array<{
    field: string;
    providers: string[];
    values: unknown[];
    resolution: 'highest-confidence' | 'user-preference' | 'manual';
  }>;
}

// ============================================================================
// Field Quality Matrix (Provider-Specific Quality Scores)
// ============================================================================

export const FIELD_QUALITY_MATRIX: Record<string, Record<string, { quality: number; confidence: number }>> = {
  title: {
    anilist: { quality: 95, confidence: 98 },
    comicvine: { quality: 85, confidence: 90 },
    fandom: { quality: 80, confidence: 85 },
    wikipedia: { quality: 75, confidence: 80 }
  },
  description: {
    anilist: { quality: 90, confidence: 95 },
    comicvine: { quality: 85, confidence: 85 },
    fandom: { quality: 70, confidence: 75 },
    wikipedia: { quality: 95, confidence: 90 }
  },
  volumes: {
    anilist: { quality: 85, confidence: 90 },
    comicvine: { quality: 95, confidence: 95 },
    fandom: { quality: 90, confidence: 85 },
    wikipedia: { quality: 60, confidence: 70 }
  },
  chapters: {
    anilist: { quality: 85, confidence: 90 },
    comicvine: { quality: 90, confidence: 85 },
    fandom: { quality: 95, confidence: 90 },
    wikipedia: { quality: 50, confidence: 60 }
  },
  authors: {
    anilist: { quality: 90, confidence: 95 },
    comicvine: { quality: 95, confidence: 98 },
    fandom: { quality: 80, confidence: 85 },
    wikipedia: { quality: 75, confidence: 80 }
  },
  artists: {
    anilist: { quality: 90, confidence: 95 },
    comicvine: { quality: 95, confidence: 98 },
    fandom: { quality: 80, confidence: 85 },
    wikipedia: { quality: 75, confidence: 80 }
  },
  genres: {
    anilist: { quality: 95, confidence: 98 },
    comicvine: { quality: 90, confidence: 95 },
    fandom: { quality: 85, confidence: 90 },
    wikipedia: { quality: 80, confidence: 85 }
  },
  themes: {
    anilist: { quality: 95, confidence: 98 },
    comicvine: { quality: 90, confidence: 95 },
    fandom: { quality: 85, confidence: 90 },
    wikipedia: { quality: 70, confidence: 75 }
  },
  status: {
    anilist: { quality: 95, confidence: 98 },
    comicvine: { quality: 85, confidence: 90 },
    fandom: { quality: 80, confidence: 85 },
    wikipedia: { quality: 75, confidence: 80 }
  },
  format: {
    anilist: { quality: 95, confidence: 98 },
    comicvine: { quality: 90, confidence: 95 },
    fandom: { quality: 80, confidence: 85 },
    wikipedia: { quality: 70, confidence: 75 }
  },
  coverImage: {
    anilist: { quality: 95, confidence: 98 },
    comicvine: { quality: 90, confidence: 95 },
    fandom: { quality: 85, confidence: 90 },
    wikipedia: { quality: 70, confidence: 75 }
  },
  bannerImage: {
    anilist: { quality: 95, confidence: 98 },
    comicvine: { quality: 85, confidence: 90 },
    fandom: { quality: 80, confidence: 85 },
    wikipedia: { quality: 60, confidence: 70 }
  },
  startDate: {
    anilist: { quality: 90, confidence: 95 },
    comicvine: { quality: 85, confidence: 90 },
    fandom: { quality: 80, confidence: 85 },
    wikipedia: { quality: 75, confidence: 80 }
  },
  endDate: {
    anilist: { quality: 90, confidence: 95 },
    comicvine: { quality: 85, confidence: 90 },
    fandom: { quality: 80, confidence: 85 },
    wikipedia: { quality: 75, confidence: 80 }
  },
  publisher: {
    anilist: { quality: 80, confidence: 85 },
    comicvine: { quality: 95, confidence: 98 },
    fandom: { quality: 85, confidence: 90 },
    wikipedia: { quality: 75, confidence: 80 }
  },
  demographic: {
    anilist: { quality: 95, confidence: 98 },
    comicvine: { quality: 80, confidence: 85 },
    fandom: { quality: 85, confidence: 90 },
    wikipedia: { quality: 70, confidence: 75 }
  },
  averageScore: {
    anilist: { quality: 95, confidence: 98 },
    comicvine: { quality: 70, confidence: 75 },
    fandom: { quality: 60, confidence: 65 },
    wikipedia: { quality: 50, confidence: 55 }
  },
  popularity: {
    anilist: { quality: 95, confidence: 98 },
    comicvine: { quality: 70, confidence: 75 },
    fandom: { quality: 60, confidence: 65 },
    wikipedia: { quality: 50, confidence: 55 }
  },
  countryOfOrigin: {
    anilist: { quality: 90, confidence: 95 },
    comicvine: { quality: 80, confidence: 85 },
    fandom: { quality: 75, confidence: 80 },
    wikipedia: { quality: 85, confidence: 90 }
  },
  characters: {
    anilist: { quality: 95, confidence: 98 },
    comicvine: { quality: 90, confidence: 95 },
    fandom: { quality: 80, confidence: 85 },
    wikipedia: { quality: 70, confidence: 75 }
  },
  staff: {
    anilist: { quality: 95, confidence: 98 },
    comicvine: { quality: 90, confidence: 95 },
    fandom: { quality: 80, confidence: 85 },
    wikipedia: { quality: 70, confidence: 75 }
  },
  externalLinks: {
    anilist: { quality: 95, confidence: 98 },
    comicvine: { quality: 85, confidence: 90 },
    fandom: { quality: 80, confidence: 85 },
    wikipedia: { quality: 75, confidence: 80 }
  }
};

// ============================================================================
// Type Guards and Validation
// ============================================================================

export function isValidProvider(provider: string): provider is 'anilist' | 'mangadex' | 'comicvine' | 'fandom' | 'wikipedia' {
  return ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia'].includes(provider);
}

export function isValidMetadataField(field: string): boolean {
  const validFields = [
    'title', 'alternativeTitles', 'description', 'status', 'format', 'genres', 'themes', 'tags',
    'authors', 'artists', 'publisher', 'demographic', 'volumes', 'chapters', 'startDate', 'endDate',
    'coverImage', 'bannerImage', 'galleryImages', 'characters', 'staff', 'externalLinks',
    'averageScore', 'popularity', 'countryOfOrigin', 'isAdult', 'contentWarnings'
  ];
  return validFields.includes(field);
}

export function getProviderQuality(field: string, provider: string): { quality: number; confidence: number } {
  const providerQuality = FIELD_QUALITY_MATRIX[field]?.[provider];
  return providerQuality ?? { quality: 50, confidence: 50 }; // Default to medium quality/confidence
}

// ============================================================================
// Utility Functions
// ============================================================================

export function calculateFieldConfidence(
  value: unknown,
  provider: string,
  field: string
): number {
  const baseQuality = getProviderQuality(field, provider);
  let confidence = baseQuality.confidence;

  // Adjust confidence based on data quality
  if (value === undefined || value === null || value === '') {
    confidence *= 0.1; // Severely penalize missing data
  } else if (Array.isArray(value) && value.length === 0) {
    confidence *= 0.3; // Penalize empty arrays
  } else if (typeof value === 'string' && value.trim().length < 2) {
    confidence *= 0.5; // Penalize very short strings
  } else if (typeof value === 'number' && value <= 0) {
    confidence *= 0.7; // Penalize zero/negative numbers for counts
  }

  return Math.max(0, Math.min(100, Math.round(confidence)));
}

export function getBestProviderForField(
  field: string,
  availableProviders: string[],
  userPreferences?: string[]
): { provider: string; confidence: number; quality: number } {
  const providers = availableProviders.filter(isValidProvider);

  // If user has preferences, respect them
  if (userPreferences && userPreferences.length > 0) {
    for (const preferredProvider of userPreferences) {
      if (isValidProvider(preferredProvider) && providers.includes(preferredProvider)) {
        const quality = getProviderQuality(field, preferredProvider);
        return {
          provider: preferredProvider,
          confidence: quality.confidence,
          quality: quality.quality
        };
      }
    }
  }

  // Otherwise, use intelligent selection based on quality matrix
  let bestProvider = providers[0] ?? 'anilist';
  let bestConfidence = 0;
  let bestQuality = 0;

  for (const provider of providers) {
    const quality = getProviderQuality(field, provider);
    const weightedScore = (quality.quality * 0.6) + (quality.confidence * 0.4);

    if (weightedScore > (bestQuality * 0.6 + bestConfidence * 0.4)) {
      bestProvider = provider;
      bestConfidence = quality.confidence;
      bestQuality = quality.quality;
    }
  }

  return {
    provider: bestProvider,
    confidence: bestConfidence,
    quality: bestQuality
  };
}