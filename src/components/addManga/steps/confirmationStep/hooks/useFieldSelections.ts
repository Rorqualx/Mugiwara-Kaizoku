import { useState, useCallback, useMemo } from 'react';

import { MangaPublicationStatus } from '@prisma/client';

import { logger } from '@/utils/logger';

/**
 * Field selection management for metadata mixing
 * Allows selecting different metadata fields from different providers
 */


// Define types locally since they don't exist in search.types
export interface FieldSelection {
  source: string;
  value: unknown;
  confidence?: number;
  isModified?: boolean;
}

export type FieldSelectionsState = Record<string, FieldSelection>;
export type FieldSelections = FieldSelectionsState;

// Helper functions
const _createFieldSelection = (source: string, value: unknown, confidence?: number): FieldSelection => {
  const selection: FieldSelection = {
    source,
    value,
    isModified: false
  };
  if (confidence !== undefined) {
    selection.confidence = confidence;
  }
  return selection;
};

const _mergeFieldSelections = (...selections: Partial<FieldSelectionsState>[]): FieldSelectionsState => {
  const result: FieldSelectionsState = {};
  for (const sel of selections) {
    for (const [key, value] of Object.entries(sel)) {
      if (value !== undefined) {
        result[key] = value as FieldSelection;
      }
    }
  }
  return result;
};

// Field initialization helper functions
type GetMetadataFieldFn = (manga: unknown, field: string, defaultValue?: unknown) => unknown;
type FormatDateFieldFn = (dateObj: unknown) => string | null;

const createBasicInfoFields = (manga: Record<string, unknown>, originalSourceKey: string, getMetadataField: GetMetadataFieldFn): FieldSelectionsState => ({
  title: {
    source: originalSourceKey,
    value: manga["title"]
  },
  alternativeTitles: {
    source: originalSourceKey,
    value: (getMetadataField(manga, 'alternativeTitles', []) ||
    getMetadataField(manga, 'synonyms', [])) ?? []
  },
  description: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'description', '')
  }
});

const createAdditionalDescriptionFields = (manga: Record<string, unknown>, originalSourceKey: string, getMetadataField: GetMetadataFieldFn): FieldSelectionsState => ({
  synopsis: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'synopsis', '')
  },
  plot: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'plot', '')
  },
  background: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'background', '')
  },
  history: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'history', '')
  }
});

const createImageFields = (manga: Record<string, unknown>, originalSourceKey: string, getMetadataField: GetMetadataFieldFn): FieldSelectionsState => ({
  cover: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'cover', '') ||
    getMetadataField(manga, 'coverImage', '') ||
    getMetadataField(manga, 'coverUrl', '')
  },
  bannerImage: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'bannerImage', '')
  }
});

const createPublicationInfoFields = (manga: Record<string, unknown>, originalSourceKey: string, getMetadataField: GetMetadataFieldFn): FieldSelectionsState => ({
  status: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'status', MangaPublicationStatus.UNKNOWN)
  },
  authors: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'authors', [])
  },
  artists: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'artists', [])
  },
  genres: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'genres', [])
  },
  tags: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'tags', [])
  },
  themes: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'themes', [])
  },
  demographics: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'demographics', [])
  }
});

const createDateFields = (manga: Record<string, unknown>, originalSourceKey: string, getMetadataField: GetMetadataFieldFn, formatDateField: FormatDateFieldFn): FieldSelectionsState => ({
  startDate: {
    source: originalSourceKey,
    value: formatDateField(getMetadataField(manga, 'startDate', null))
  },
  endDate: {
    source: originalSourceKey,
    value: formatDateField(getMetadataField(manga, 'endDate', null))
  },
  releaseYear: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'releaseYear', null) ||
    getMetadataField(manga, 'year', null)
  }
});

const createPublisherFields = (manga: Record<string, unknown>, originalSourceKey: string, getMetadataField: GetMetadataFieldFn): FieldSelectionsState => ({
  publisher: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'publisher', '')
  },
  serialization: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'serialization', '')
  }
});

const createFormatFields = (manga: Record<string, unknown>, originalSourceKey: string, getMetadataField: GetMetadataFieldFn): FieldSelectionsState => ({
  format: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'format', '') ||
    getMetadataField(manga, 'type', '')
  }
});

const createIdFields = (manga: Record<string, unknown>, originalSourceKey: string, getMetadataField: GetMetadataFieldFn): FieldSelectionsState => ({
  anilistId: {
    source: originalSourceKey,
    value: (manga["anilistId"] ||
           getMetadataField(manga, 'anilistId', '') ||
           getMetadataField(manga, 'idAnilist', '') ||
           ((manga["metadata"] as Record<string, unknown> | undefined)?.["anilistId"]) ||
           ((manga["metadata"] as Record<string, unknown> | undefined)?.["malId"])) ?? ''
  },
  malId: {
    source: originalSourceKey,
    value: (manga["malId"] ||
           getMetadataField(manga, 'malId', '') ||
           getMetadataField(manga, 'idMal', '') ||
           getMetadataField(manga, 'myAnimeListId', '') ||
           ((manga["metadata"] as Record<string, unknown> | undefined)?.["idMal"]) ||
           ((manga["metadata"] as Record<string, unknown> | undefined)?.["malId"])) ?? ''
  }
});

const createCountFields = (manga: Record<string, unknown>, originalSourceKey: string, getMetadataField: GetMetadataFieldFn): FieldSelectionsState => ({
  volumes: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'volumes', null)
  },
  chapters: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'chapters', null)
  }
});

const createRatingFields = (manga: Record<string, unknown>, originalSourceKey: string, getMetadataField: GetMetadataFieldFn): FieldSelectionsState => ({
  averageScore: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'averageScore', null) ||
    getMetadataField(manga, 'score', null)
  },
  popularity: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'popularity', null)
  },
  favorites: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'favorites', null)
  }
});

const createUrlFields = (manga: Record<string, unknown>, originalSourceKey: string, getMetadataField: GetMetadataFieldFn): FieldSelectionsState => ({
  sourceUrl: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'sourceUrl', '') ||
    getMetadataField(manga, 'url', '')
  },
  officialUrl: {
    source: originalSourceKey,
    value: getMetadataField(manga, 'officialUrl', '')
  }
});

const createInitialFieldSelections = (
  manga: Record<string, unknown>,
  originalSourceKey: string,
  getMetadataField: GetMetadataFieldFn,
  formatDateField: FormatDateFieldFn
): FieldSelectionsState => {
  return {
    ...createBasicInfoFields(manga, originalSourceKey, getMetadataField),
    ...createAdditionalDescriptionFields(manga, originalSourceKey, getMetadataField),
    ...createImageFields(manga, originalSourceKey, getMetadataField),
    ...createPublicationInfoFields(manga, originalSourceKey, getMetadataField),
    ...createDateFields(manga, originalSourceKey, getMetadataField, formatDateField),
    ...createPublisherFields(manga, originalSourceKey, getMetadataField),
    ...createFormatFields(manga, originalSourceKey, getMetadataField),
    ...createIdFields(manga, originalSourceKey, getMetadataField),
    ...createCountFields(manga, originalSourceKey, getMetadataField),
    ...createRatingFields(manga, originalSourceKey, getMetadataField),
    ...createUrlFields(manga, originalSourceKey, getMetadataField)
  };
};
/**
 * Hook for managing field-level metadata selections
 * Enables mix-and-match functionality across providers
 */
export function useFieldSelections(initialManga: unknown): {
  fieldSelections: FieldSelectionsState;
  setFieldSelections: (selections: FieldSelectionsState) => void;
  updateFieldSelection: (field: string, selection: FieldSelection) => void;
  updateMultipleFields: (updates: Record<string, FieldSelection>) => void;
  aggregatedMetadata: Record<string, unknown>;
  isFieldModified: (field: string) => boolean;
  modifiedFieldCount: number;
  getMetadataField: (manga: unknown, field: string, defaultValue?: unknown) => unknown;
} {
  const manga = initialManga as Record<string, unknown>;
  const originalSourceKey = `${manga["source"] || 'original'}_original`;

  // Helper to get metadata field with fallbacks
  const getMetadataField = useCallback((manga: unknown, field: string, defaultValue: unknown = ''): unknown => {
    const m = manga as Record<string, unknown>;
    // Check direct property
    if (field in m && m[field] !== undefined) {
      return m[field];
    }
    // Check metadata object
    const metadata = m["metadata"] as Record<string, unknown> | undefined;
    if (metadata && typeof metadata === 'object' && field in metadata && metadata[field] !== undefined) {
      return metadata[field];
    }
    // Check rawData
    const rawData = m["rawData"] as Record<string, unknown> | undefined;
    if (rawData && typeof rawData === 'object' && field in rawData && rawData[field] !== undefined) {
      return rawData[field];
    }
    // Check providerSpecific
    const providerSpecific = m["providerSpecific"] as Record<string, unknown> | undefined;
    if (providerSpecific && typeof providerSpecific === 'object' && field in providerSpecific) {
      return providerSpecific[field];
    }
    return defaultValue;
  }, []);

  // Helper to format AniList date objects to string
  const formatDateField = useCallback((dateObj: unknown): string | null => {
    if (!dateObj) return null;

    // If it's already a string, return it
    if (typeof dateObj === 'string') return dateObj;

    // If it's an AniList date object with year, month, day
    if (typeof dateObj === 'object' && 'year' in dateObj) {
      const d = dateObj as Record<string, unknown>;
      const year = d["year"];
      const month = d["month"];
      const day = d["day"];
      if (!year) return null;

      // Format as YYYY-MM-DD
      const monthStr = month ? String(month).padStart(2, '0') : '01';
      const dayStr = day ? String(day).padStart(2, '0') : '01';
      const formatted = `${year}-${monthStr}-${dayStr}`;
      logger.info('📅 [useFieldSelections] Formatted date object:', { input: dateObj, output: formatted });
      return formatted;
    }

    return null;
  }, []);

  // Initialize field selections with original manga data
  const [fieldSelections, setFieldSelections] = useState<FieldSelections>(() =>
    createInitialFieldSelections(manga, originalSourceKey, getMetadataField, formatDateField)
  );
  // Update a specific field selection
  const updateFieldSelection = useCallback((field: string, selection: FieldSelection): void => {
    setFieldSelections((prev) => ({
      ...prev,
      [field]: selection
    }));
  }, []);
  // Update multiple field selections
  const updateMultipleFields = useCallback((updates: Record<string, FieldSelection>): void => {
    setFieldSelections((prev) => {
      const newState: FieldSelectionsState = { ...prev };
      Object.entries(updates).forEach(([field, selection]) => {
        newState[field] = selection;
      });
      return newState;
    });
  }, []);
  // Get aggregated metadata from all field selections
  const aggregatedMetadata = useMemo(() => {
    const metadata: Record<string, unknown> = {};
    Object.entries(fieldSelections).forEach(([field, selection]) => {
      if (selection.value !== null && selection.value !== '') {
        metadata[field] = selection.value;
      }
    });
    return metadata;
  }, [fieldSelections]);
  // Check if a field has been modified from original
  const isFieldModified = useCallback((field: string): boolean => {
    const selection = fieldSelections[field];
    return Boolean(selection && selection["source"] !== originalSourceKey);
  }, [fieldSelections, originalSourceKey]);
  // Get count of modified fields
  const modifiedFieldCount = useMemo(() => {
    return Object.keys(fieldSelections).filter((field) => isFieldModified(field)).length;
  }, [fieldSelections, isFieldModified]);
  return {
    fieldSelections,
    setFieldSelections,
    updateFieldSelection,
    updateMultipleFields,
    aggregatedMetadata,
    isFieldModified,
    modifiedFieldCount,
    getMetadataField
  };
}