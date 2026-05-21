/**
 * Intelligent Metadata Merger
 *
 * Replaces provider-level priority system with intelligent field-level selection
 * based on data quality, completeness, and user preferences.
 */

import type { UnifiedMangaMetadata } from '@/types/search-types/metadata.types';
import type { FieldProviderMapping, ProviderQuality } from '@/types/search-types/unified-metadata-schema';
import { logger } from '@/utils/logger';

import { FieldQualityScorer } from './field-quality-scorer';
import { ProviderFieldMappingService } from './provider-field-mapping';

// ============================================================================
// Intelligent Merger Configuration
// ============================================================================

export interface IntelligentMergerConfig {
  // Core settings
  enableIntelligentSelection: boolean;
  confidenceThreshold: number; // 0-100
  useUserPreferences: boolean;

  // Provider preferences
  fallbackProviders: string[];
  providerOverrides: Record<string, {
    enabled: boolean;
    priority: number;
    fieldSpecific: Record<string, number>;
  }>;

  // Quality assessment
  minimumCompleteness: number; // 0-100
  minimumAccuracy: number; // 0-100

  // Conflict resolution
  preferUserSelection: boolean;
  preferHigherConfidence: boolean;
  allowPartialData: boolean;
}

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
// Intelligent Merger Service
// ============================================================================

export class IntelligentMetadataMerger {
  private config: IntelligentMergerConfig;

  constructor(config?: Partial<IntelligentMergerConfig>) {
    this.config = {
      enableIntelligentSelection: true,
      confidenceThreshold: 70,
      useUserPreferences: true,
      fallbackProviders: ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia'],
      providerOverrides: {},
      minimumCompleteness: 50,
      minimumAccuracy: 60,
      preferUserSelection: true,
      preferHigherConfidence: true,
      allowPartialData: true,
      ...config
    };
  }

  /**
   * Perform intelligent metadata selection across all available providers
   */
  mergeMetadata(
    availableProviders: string[],
    providerData: Record<string, Record<string, unknown>>,
    userPreferences?: Record<string, string[]>,
    existingMetadata?: Partial<UnifiedMangaMetadata>
  ): IntelligentSelectionResult {
    logger.info(`Starting intelligent metadata merge with ${availableProviders.length} providers`);

    // Generate provider quality mapping for all fields
    const providerQualityMapping = FieldQualityScorer.generateProviderQualityMapping(
      availableProviders,
      providerData,
      existingMetadata
    );

    // Select best data for each field
    const fieldSelection = this.selectBestDataForAllFields(
      providerQualityMapping,
      providerData,
      userPreferences
    );

    // Build unified metadata from selected fields
    const selectedMetadata = this.buildUnifiedMetadata(fieldSelection);

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(fieldSelection);

    // Identify missing fields
    const missingFields = this.identifyMissingFields(fieldSelection);

    // Detect and resolve conflicts
    const conflicts = this.detectConflicts(fieldSelection, providerData);

    const result: IntelligentSelectionResult = {
      selectedMetadata,
      fieldProvenance: fieldSelection,
      selectionMethod: this.config.enableIntelligentSelection ? 'intelligent' : 'user-preference',
      overallConfidence,
      missingFields,
      conflicts
    };

    logger.info(`Intelligent merge completed: ${Object.keys(selectedMetadata).length} fields, ${overallConfidence}% confidence`);
    return result;
  }

  /**
   * Select best data for each field based on quality and preferences
   */
  private selectBestDataForAllFields(
    providerQualityMapping: FieldProviderMapping,
    providerData: Record<string, Record<string, unknown>>,
    userPreferences?: Record<string, string[]>
  ): Record<string, {
    provider: string;
    confidence: number;
    quality: number;
    alternatives: Array<{
      provider: string;
      value: unknown;
      confidence: number;
      quality: number;
    }>;
  }> {
    const fieldSelection: Record<string, {
      provider: string;
      confidence: number;
      quality: number;
      alternatives: Array<{
        provider: string;
        value: unknown;
        confidence: number;
        quality: number;
      }>;
    }> = {};

    // Process each field
    for (const [field, providerQualities] of Object.entries(providerQualityMapping)) {
      const selection = this.selectBestProviderForField(
        field,
        providerQualities,
        providerData,
        userPreferences?.[field]
      );

      if (selection) {
        fieldSelection[field] = selection;
      }
    }

    return fieldSelection;
  }

  /**
   * Select best provider for a specific field
   */
  private selectBestProviderForField(
    field: string,
    providerQualities: ProviderQuality[],
    providerData: Record<string, Record<string, unknown>>,
    userFieldPreferences?: string[]
  ): {
    provider: string;
    confidence: number;
    quality: number;
    alternatives: Array<{
      provider: string;
      value: unknown;
      confidence: number;
      quality: number;
    }>;
  } | null {
    // Filter providers that actually have data for this field
    const providersWithData = providerQualities.filter(pq => {
      const value = providerData[pq.provider]?.[field];
      return value !== undefined && value !== null && value !== '';
    });

    if (providersWithData.length === 0) {
      return null;
    }

    // Apply user preferences if available
    if (this.config.useUserPreferences && userFieldPreferences && userFieldPreferences.length > 0) {
      for (const preferredProvider of userFieldPreferences) {
        const preferredQuality = providersWithData.find(pq => pq.provider === preferredProvider);
        if (preferredQuality && preferredQuality.confidence >= this.config.confidenceThreshold) {
          return this.buildSelectionResult(field, preferredProvider, providersWithData, providerData);
        }
      }
    }

    // Apply provider overrides
    for (const [provider, override] of Object.entries(this.config.providerOverrides)) {
      if (override.enabled && override.fieldSpecific[field] !== undefined) {
        const boostedProvider = providersWithData.find(pq => pq.provider === provider);
        if (boostedProvider) {
          const fieldSpecificBoost = override.fieldSpecific[field] ?? 0;
          const boostedConfidence = Math.min(100, boostedProvider.confidence + fieldSpecificBoost);
          if (boostedConfidence >= this.config.confidenceThreshold) {
            return this.buildSelectionResult(field, provider, providersWithData, providerData);
          }
        }
      }
    }

    // Intelligent selection based on quality and confidence
    const bestProvider = this.selectByIntelligentCriteria(providersWithData);
    if (bestProvider && bestProvider.confidence >= this.config.confidenceThreshold) {
      return this.buildSelectionResult(field, bestProvider.provider, providersWithData, providerData);
    }

    // Fallback to highest available confidence
    const fallbackProvider = providersWithData.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    return this.buildSelectionResult(field, fallbackProvider.provider, providersWithData, providerData);
  }

  /**
   * Select provider using intelligent criteria (quality + confidence weighted)
   */
  private selectByIntelligentCriteria(providerQualities: ProviderQuality[]): ProviderQuality | null {
    if (providerQualities.length === 0) return null;

    return providerQualities.reduce((best, current) => {
      const bestScore = (best.quality * 0.6) + (best.confidence * 0.4);
      const currentScore = (current.quality * 0.6) + (current.confidence * 0.4);
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Build selection result with alternatives
   */
  private buildSelectionResult(
    field: string,
    selectedProvider: string,
    allProviders: ProviderQuality[],
    providerData: Record<string, Record<string, unknown>>
  ): {
    provider: string;
    confidence: number;
    quality: number;
    alternatives: Array<{
      provider: string;
      value: unknown;
      confidence: number;
      quality: number;
    }>;
  } {
    const selectedQuality = allProviders.find(pq => pq.provider === selectedProvider);
    if (!selectedQuality) {
      throw new Error(`Selected provider ${selectedProvider} not found in available providers`);
    }

    const alternatives = allProviders
      .filter(pq => pq.provider !== selectedProvider)
      .map(pq => ({
        provider: pq.provider,
        value: providerData[pq.provider]?.[field],
        confidence: pq.confidence,
        quality: pq.quality
      }));

    return {
      provider: selectedProvider,
      confidence: selectedQuality.confidence,
      quality: selectedQuality.quality,
      alternatives
    };
  }

  /**
   * Build unified metadata from field selections
   */
  private buildUnifiedMetadata(
    fieldSelection: Record<string, {
      provider: string;
      confidence: number;
      quality: number;
      alternatives: Array<{
        provider: string;
        value: unknown;
        confidence: number;
        quality: number;
      }>;
    }>
  ): UnifiedMangaMetadata {
    const metadata: Partial<UnifiedMangaMetadata> = {};

    for (const [field, selection] of Object.entries(fieldSelection)) {
      // Map field selection to unified metadata structure
      // This would use the ProviderFieldMappingService to transform provider data
      // For now, we'll use a simplified approach
      const providerData = {}; // This would come from actual provider data
      const unifiedValue = ProviderFieldMappingService.mapProviderDataToUnifiedSchema(
        selection.provider,
        providerData
      );

      // Set the field value in unified metadata
      if (unifiedValue[field as keyof UnifiedMangaMetadata] !== undefined) {
        (metadata as Record<string, unknown>)[field] = unifiedValue[field as keyof UnifiedMangaMetadata];
      }
    }

    return metadata as UnifiedMangaMetadata;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(
    fieldSelection: Record<string, {
      provider: string;
      confidence: number;
      quality: number;
      alternatives: Array<{
        provider: string;
        value: unknown;
        confidence: number;
        quality: number;
      }>;
    }>
  ): number {
    const fields = Object.values(fieldSelection);
    if (fields.length === 0) return 0;

    const totalConfidence = fields.reduce((sum, field) => sum + field.confidence, 0);
    return Math.round(totalConfidence / fields.length);
  }

  /**
   * Identify fields that are missing from all providers
   */
  private identifyMissingFields(
    fieldSelection: Record<string, {
      provider: string;
      confidence: number;
      quality: number;
      alternatives: Array<{
        provider: string;
        value: unknown;
        confidence: number;
        quality: number;
      }>;
    }>
  ): string[] {
    const allFields = [
      'title', 'alternativeTitles', 'description', 'status', 'format', 'genres', 'themes', 'tags',
      'authors', 'artists', 'publisher', 'demographic', 'volumes', 'chapters', 'startDate', 'endDate',
      'coverImage', 'bannerImage', 'galleryImages', 'characters', 'staff', 'externalLinks',
      'averageScore', 'popularity', 'countryOfOrigin', 'isAdult', 'contentWarnings'
    ];

    return allFields.filter(field => !fieldSelection[field]);
  }

  /**
   * Detect and categorize conflicts between providers
   */
  private detectConflicts(
    fieldSelection: Record<string, {
      provider: string;
      confidence: number;
      quality: number;
      alternatives: Array<{
        provider: string;
        value: unknown;
        confidence: number;
        quality: number;
      }>;
    }>,
    providerData: Record<string, Record<string, unknown>>
  ): Array<{
    field: string;
    providers: string[];
    values: unknown[];
    resolution: 'highest-confidence' | 'user-preference' | 'manual';
  }> {
    const conflicts: Array<{
      field: string;
      providers: string[];
      values: unknown[];
      resolution: 'highest-confidence' | 'user-preference' | 'manual';
    }> = [];

    for (const [field, selection] of Object.entries(fieldSelection)) {
      // Check if there are significant alternatives with similar confidence
      const significantAlternatives = selection.alternatives.filter(alt =>
        alt.confidence >= selection.confidence - 20 // Within 20 points of selected
      );

      if (significantAlternatives.length > 0) {
        const allProviders = [selection.provider, ...significantAlternatives.map(alt => alt.provider)];
        const allValues = [
          providerData[selection.provider]?.[field],
          ...significantAlternatives.map(alt => alt.value)
        ];

        // Check if values are significantly different
        if (this.areValuesSignificantlyDifferent(allValues)) {
          conflicts.push({
            field,
            providers: allProviders,
            values: allValues,
            resolution: selection.confidence > 80 ? 'highest-confidence' : 'manual'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if values are significantly different
   */
  private areValuesSignificantlyDifferent(values: unknown[]): boolean {
    if (values.length <= 1) return false;

    // For strings, check if they're substantially different
    if (values.every(v => typeof v === 'string')) {
      const stringValues = values as string[];
      const firstValue = stringValues[0]?.toLowerCase().trim() ?? '';
      return !stringValues.every(v => v.toLowerCase().trim() === firstValue);
    }

    // For numbers, check if they're significantly different
    if (values.every(v => typeof v === 'number')) {
      const numberValues = values as number[];
      const firstValue = numberValues[0] ?? 0;
      return !numberValues.every(v => Math.abs(v - firstValue) <= firstValue * 0.1); // Within 10%
    }

    // For arrays, check if they have different content
    if (values.every(v => Array.isArray(v))) {
      const arrayValues = values as unknown[][];
      const firstArray = arrayValues[0] ?? [];
      return !arrayValues.every(arr =>
        arr.length === firstArray.length &&
        arr.every((item, index) => item === firstArray[index])
      );
    }

    // Default: consider different if not strictly equal
    return !values.every(v => v === values[0]);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<IntelligentMergerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Intelligent merger configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): IntelligentMergerConfig {
    return { ...this.config };
  }
}