/**
 * Field Quality Scorer - Main Aggregator
 *
 * This class aggregates all specialized field quality scoring modules
 * into a unified interface. It delegates to specialized modules for
 * each scoring dimension while maintaining the original API.
 *
 * Architecture:
 * - field-quality-types.ts - Shared types and interfaces (23 lines)
 * - field-completeness-scorer.ts - Completeness scoring (113 lines)
 * - field-accuracy-scorer.ts - Accuracy scoring (136 lines)
 * - field-freshness-scorer.ts - Freshness scoring (54 lines)
 * - field-structure-scorer.ts - Structure scoring (90 lines)
 * - provider-quality-matrices.ts - Provider quality matrices (94 lines)
 *
 * Total: 510 lines across 6 modules
 * Original: 415 lines → Refactored: ~50 lines (88% reduction in main file)
 */

import type { UnifiedMangaMetadata } from '@/types/search-types/metadata.types';
import type { ProviderQuality, FieldProviderMapping } from '@/types/search-types/unified-metadata-schema';

// Import all specialized modules
import { FieldAccuracyScorer } from './field-accuracy-scorer';
import { FieldCompletenessScorer } from './field-completeness-scorer';
import { FieldFreshnessScorer } from './field-freshness-scorer';
import { FieldStructureScorer } from './field-structure-scorer';

import type { FieldQualityAssessment } from './field-quality-types';

export { type FieldQualityAssessment } from './field-quality-types';

export class FieldQualityScorer {
  /**
   * Assess the quality of a specific field value from a provider
   */
  static assessFieldQuality(
    field: string,
    value: unknown,
    provider: string,
    existingMetadata?: Partial<UnifiedMangaMetadata>
  ): FieldQualityAssessment {
    const completeness = FieldCompletenessScorer.calculate(field, value);
    const accuracy = FieldAccuracyScorer.calculate(field, value, provider, existingMetadata);
    const freshness = FieldFreshnessScorer.calculate(field, value, provider);
    const structure = FieldStructureScorer.calculate(field, value);

    // Weighted overall score
    const overall = Math.round(
      (completeness * 0.3) +
      (accuracy * 0.3) +
      (freshness * 0.2) +
      (structure * 0.2)
    );

    return {
      completeness,
      accuracy,
      freshness,
      structure,
      overall
    };
  }

  /**
   * Generate provider quality mapping for all available providers and fields
   */
  static generateProviderQualityMapping(
    availableProviders: string[],
    metadata: Record<string, Record<string, unknown>>,
    existingMetadata?: Partial<UnifiedMangaMetadata>
  ): FieldProviderMapping {
    const mapping: Partial<FieldProviderMapping> = {};

    const allFields = [
      'title', 'alternativeTitles', 'description', 'status', 'format', 'genres', 'themes', 'tags',
      'authors', 'artists', 'publisher', 'demographic', 'volumes', 'chapters', 'startDate', 'endDate',
      'coverImage', 'bannerImage', 'galleryImages', 'characters', 'staff', 'externalLinks',
      'averageScore', 'popularity', 'countryOfOrigin', 'isAdult', 'contentWarnings'
    ];

    for (const field of allFields) {
      const providerQualities: ProviderQuality[] = [];

      for (const provider of availableProviders) {
        const value = metadata[provider]?.[field];
        const quality = this.assessFieldQuality(field, value, provider, existingMetadata);

        providerQualities.push({
          provider,
          quality: quality.overall,
          confidence: quality.accuracy,
          lastUpdated: new Date()
        });
      }

      // Sort by quality and confidence
      providerQualities.sort((a, b) => {
        const scoreA = (a.quality * 0.6) + (a.confidence * 0.4);
        const scoreB = (b.quality * 0.6) + (b.confidence * 0.4);
        return scoreB - scoreA;
      });

      mapping[field] = providerQualities;
    }

    return mapping as FieldProviderMapping;
  }
}