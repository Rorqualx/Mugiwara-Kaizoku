/**
 * Field Options Handler for Universal Import Wizard
 *
 * Provides computed dropdown options for metadata fields based on:
 * - Provider-specific metadata
 * - Confidence scoring
 * - Field-specific transformations
 *
 * Handles options for: title, altTitles, description, status, format,
 * demographic, authors, genres, tags, externalIds, etc.
 *
 * @module field-options-handler
 * @provenance Extracted from UniversalImportWizard.tsx lines 670-813
 */

import { useCallback, useMemo } from 'react';

import { PROVIDER_DETAILS } from '@/components/metadata/ProviderBadge';
import { getFieldConfidence } from '@/lib/confidence';
import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import { cleanHtml, normalizeDateToMMDDYYYY } from '../wizard-utils';

// Type for logger instance
type Logger = typeof logger;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate confidence score based on dynamic field/value/provider analysis
 * Returns 0-1 scale for backwards compatibility
 */
function getProviderConfidenceForField(field: string, value: unknown, provider: string): number {
  // Use dynamic confidence service and normalize to 0-1 scale
  return getFieldConfidence(field, value, provider) / 100;
}

/**
 * Check if a value is valid (not null, undefined, empty, or placeholder)
 */
function isValidValue(value: unknown): boolean {
  return value !== null &&
    value !== undefined &&
    value !== '' &&
    value !== 'UNKNOWN' &&
    value !== 'undefined' &&
    value !== 'null';
}

/**
 * Extract string value from an item (handles objects with name/label properties)
 */
function extractItemValue(item: unknown): string | null {
  if (typeof item === 'string') {
    return item;
  }
  const itemObj = item as Record<string, unknown>;
  const extracted = itemObj["name"] ?? itemObj["label"] ?? String(item);
  if (extracted === 'undefined' || extracted === 'null') {
    return null;
  }
  return String(extracted);
}

/**
 * Get provider display name from PROVIDER_DETAILS
 */
function getProviderDisplayName(source: string): string {
  const providerInfo = PROVIDER_DETAILS[source.toLowerCase()] ?? PROVIDER_DETAILS['default'];
  return providerInfo?.label ?? source;
}

/**
 * Try to extract an external ID value from metadata
 */
function tryExtractExternalId(
  metadata: ProviderMetadata,
  provider: string,
  idType: string,
  seenIds: Set<string>,
  options: ExternalIdOption[]
): void {
  let idValue: string | number | undefined;
  let labelPrefix: string;

  // Provider's own ID (special handling)
  if (provider === 'anilist' && idType === 'anilistId') {
    idValue = metadata["id"] ?? metadata.anilistId ?? metadata.sourceId;
    labelPrefix = 'AniList';
  } else if (provider === 'comicvine' && idType === 'comicVineId') {
    idValue = metadata["id"] ?? metadata.comicVineId ?? metadata.sourceId;
    labelPrefix = 'ComicVine';
  } else if (idType === 'anilistId' && metadata.anilistId) {
    idValue = metadata.anilistId;
    labelPrefix = provider;
  } else if (idType === 'malId' && metadata.idMal) {
    idValue = metadata.idMal;
    labelPrefix = provider;
  } else if (idType === 'comicVineId' && metadata.comicVineId) {
    idValue = metadata.comicVineId;
    labelPrefix = provider;
  } else {
    return;
  }

  if (!idValue) return;

  const idStr = String(idValue);
  if (seenIds.has(idStr)) return;

  options.push({
    value: idStr,
    label: `${labelPrefix} - ID: ${idStr}`,
    provider
  });
  seenIds.add(idStr);
}

// ============================================================================
// Types
// ============================================================================

/**
 * Field option with provider attribution and confidence
 */
export interface FieldOption {
  value: string;
  label: string;
  provider: string;
  confidence: number;
}

/**
 * External ID option (simplified structure without confidence)
 */
export interface ExternalIdOption {
  value: string;
  label: string;
  provider: string;
}

/**
 * Parameters for the field options handler hook
 */
export interface UseFieldOptionsHandlerParams {
  selectedSourcesMetadata: Record<string, ProviderMetadata>;
  selectedSources: string[];
  logger: Logger;
}

/**
 * Return value from the field options handler hook
 */
export interface UseFieldOptionsHandlerResult {
  getFieldOptions: (field: string) => FieldOption[];
  statusOptions: FieldOption[];
  formatOptions: FieldOption[];
  demographicOptions: FieldOption[];
  getExternalIdOptions: (provider: string) => ExternalIdOption[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook that provides field options for the Universal Import Wizard
 *
 * Generates dropdown options for all metadata fields by aggregating data
 * from multiple providers, cleaning HTML content, and calculating confidence
 * scores based on provider reliability.
 *
 * @param params - Configuration object with metadata and logger
 * @returns Object containing field option getters and pre-computed options
 *
 * @example
 * ```tsx
 * const { getFieldOptions, statusOptions, formatOptions } = useFieldOptionsHandler({
 *   selectedSourcesMetadata: metadata,
 *   logger
 * });
 *
 * // Get options for any field
 * const titleOptions = getFieldOptions('title');
 *
 * // Use pre-computed options
 * <Select data={statusOptions} />
 * ```
 */
export function useFieldOptionsHandler(params: UseFieldOptionsHandlerParams): UseFieldOptionsHandlerResult {
  const { selectedSourcesMetadata, selectedSources, logger } = params;

  /**
   * Get field options for dropdowns
   *
   * Aggregates field values from all providers, formats them with provider
   * attribution, and filters out invalid values.
   *
   * @param field - Field name to get options for
   * @returns Array of field options with provider attribution
   */
  const getFieldOptions = useCallback((field: string): FieldOption[] => {
    const options: FieldOption[] = [];

    // Convert selectedSources to lowercase Set for comparison
    const selectedSourcesNormalized = new Set(
      selectedSources.map(s => s.toLowerCase())
    );

    // Debug: Log what's in selectedSourcesMetadata for authors/publisher fields
    if (field === 'authors' || field === 'publisher' || field === 'artists') {
      logger.debug(`[getFieldOptions] field=${field}`, { selectedSources });
      logger.debug('[getFieldOptions] selectedSourcesMetadata keys', { keys: Object.keys(selectedSourcesMetadata) });
      Object.entries(selectedSourcesMetadata).forEach(([source, meta]) => {
        const m = meta as Record<string, unknown>;
        logger.debug(`[getFieldOptions] ${source} metadata`, {
          authors: m['authors'],
          artists: m['artists'],
          publisher: m['publisher'],
          startDate: m['startDate']
        });
      });
    }

    Object.entries(selectedSourcesMetadata)
      .filter(([source]) => selectedSourcesNormalized.has(source.toLowerCase()))
      .forEach(([source, metadata]) => {
        const metadataObj = metadata as Record<string, unknown>;
        const value = metadataObj[field];

        // Handle arrays (like tags, genres, authors)
        if (Array.isArray(value)) {
          const validItems = value.filter(isValidValue);
          if (validItems.length === 0) return;

          // Create option for each valid item
          validItems.forEach((item: unknown) => {
            const itemValue = extractItemValue(item);
            if (!itemValue) return;

            const providerName = getProviderDisplayName(source);
            options.push({
              value: `${itemValue}::${source}`,
              label: `[${providerName}] ${itemValue}`,
              provider: source,
              confidence: getProviderConfidenceForField(field, item, source)
            });
          });
          return;
        }

        // Handle non-array values (allow numeric 0 for volumes/chapters)
        if (!isValidValue(value) && value !== 0) return;

        // Clean HTML from description fields and normalize date fields
        let displayValue: unknown;
        let stringValue: string;

        if (field === 'description' && typeof value === 'string') {
          displayValue = cleanHtml(value);
          stringValue = value;
        } else if (field === 'startDate' || field === 'endDate') {
          // Normalize dates to MM-DD-YYYY format
          const normalizedDate = normalizeDateToMMDDYYYY(value);
          displayValue = normalizedDate;
          stringValue = normalizedDate;
        } else {
          displayValue = value;
          stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        }
        const providerName = getProviderDisplayName(source);
        // Use dynamic confidence based on field, value, and provider
        const confidence = getProviderConfidenceForField(field, value, source);

        options.push({
          value: `${stringValue}::${source}`,
          label: `[${providerName}] ${displayValue}`,
          provider: source,
          confidence
        });
      });

    logger.debug(`[getFieldOptions] Generated ${options.length} options for field: ${field}`);
    return options;
  }, [selectedSourcesMetadata, selectedSources, logger]);

  /**
   * Pre-computed status options
   */
  const statusOptions = useMemo(() => getFieldOptions('status'), [getFieldOptions]);

  /**
   * Pre-computed format options
   */
  const formatOptions = useMemo(() => getFieldOptions('format'), [getFieldOptions]);

  /**
   * Pre-computed demographic options
   */
  const demographicOptions = useMemo(() => getFieldOptions('demographic'), [getFieldOptions]);

  /**
   * Get external ID options for a specific ID type
   *
   * Extracts external IDs from provider metadata, handling provider-specific
   * naming conventions (id, sourceId, anilistId, malId, etc.)
   *
   * @param idType - Type of external ID (e.g., 'anilistId', 'malId', 'comicVineId')
   * @returns Array of external ID options with provider attribution
   */
  const getExternalIdOptions = useCallback((idType: string): ExternalIdOption[] => {
    const options: ExternalIdOption[] = [];
    const seenIds = new Set<string>();

    // Convert selectedSources to lowercase Set for comparison
    const selectedSourcesNormalized = new Set(
      selectedSources.map(s => s.toLowerCase())
    );

    // Check selectedSourcesMetadata for each provider (only user-selected sources)
    Object.entries(selectedSourcesMetadata)
      .filter(([provider]) => selectedSourcesNormalized.has(provider.toLowerCase()))
      .forEach(([provider, metadata]) => {
        tryExtractExternalId(metadata, provider, idType, seenIds, options);
      });

    logger.debug(`[getExternalIdOptions] Generated ${options.length} options for ID type: ${idType}`);
    return options;
  }, [selectedSourcesMetadata, selectedSources, logger]);

  return {
    getFieldOptions,
    statusOptions,
    formatOptions,
    demographicOptions,
    getExternalIdOptions
  };
}
