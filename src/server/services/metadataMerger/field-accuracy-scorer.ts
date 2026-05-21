/**
 * Field Accuracy Scorer Module
 *
 * Calculates accuracy scores (0-100) for field values.
 * Assesses data accuracy based on provider reliability and validation rules.
 *
 * Extracted from: field-quality-scorer.ts (lines 120-177)
 */

import { ProviderQualityMatrices } from './provider-quality-matrices';

import type { UnifiedMangaMetadata } from './field-quality-types';

// ============================================================================
// Field Accuracy Scoring
// ============================================================================

export class FieldAccuracyScorer {
  /**
   * Calculate accuracy score based on provider reliability and data consistency
   */
  static calculate(
    field: string,
    value: unknown,
    provider: string,
    existingMetadata?: Partial<UnifiedMangaMetadata>
  ): number {
    let score = this.getBaseProviderAccuracy(field, provider);

    // Check consistency with existing metadata if available
    if (existingMetadata) {
      const existingValue = (existingMetadata as Record<string, unknown>)[field];
      if (existingValue !== undefined && existingValue !== null) {
        const consistency = this.calculateConsistency(field, value, existingValue);
        score = Math.round((score * 0.7) + (consistency * 0.3));
      }
    }

    // Apply field-specific accuracy adjustments
    score = this.applyFieldSpecificAdjustments(field, value, score);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get base provider accuracy for a field
   */
  private static getBaseProviderAccuracy(field: string, provider: string): number {
    return ProviderQualityMatrices.getBaseProviderAccuracy(field, provider);
  }

  /**
   * Calculate consistency between two values for the same field
   */
   
  private static calculateConsistency(_field: string, _value1: unknown, _value2: unknown): number {
    // This will be moved to field-consistency-scorer.ts
    // For now, return placeholder
    return 80;
  }

  /**
   * Apply field-specific accuracy adjustments
   */
  private static applyFieldSpecificAdjustments(field: string, value: unknown, currentScore: number): number {
    let adjustedScore = currentScore;

    switch (field) {
      case 'status':
        adjustedScore = this.adjustStatusAccuracy(value, adjustedScore);
        break;

      case 'format':
        adjustedScore = this.adjustFormatAccuracy(value, adjustedScore);
        break;

      case 'volumes':
      case 'chapters':
        adjustedScore = this.adjustCountAccuracy(value, adjustedScore);
        break;

      case 'startDate':
      case 'endDate':
        adjustedScore = this.adjustDateAccuracy(value, adjustedScore);
        break;

      default:
        // No specific accuracy adjustments for other fields
        break;
    }

    return adjustedScore;
  }

  /**
   * Adjust accuracy for status field
   */
  private static adjustStatusAccuracy(value: unknown, currentScore: number): number {
    if (typeof value !== 'string') return currentScore;

    const validStatuses = ['FINISHED', 'RELEASING', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS'];
    if (!validStatuses.includes(value.toUpperCase())) {
      return currentScore * 0.8;
    }
    return currentScore;
  }

  /**
   * Adjust accuracy for format field
   */
  private static adjustFormatAccuracy(value: unknown, currentScore: number): number {
    if (typeof value !== 'string') return currentScore;

    const validFormats = ['MANGA', 'MANHWA', 'MANHUA', 'NOVEL', 'ONE_SHOT', 'DOUJINSHI'];
    if (!validFormats.includes(value.toUpperCase())) {
      return currentScore * 0.8;
    }
    return currentScore;
  }

  /**
   * Adjust accuracy for count fields
   */
  private static adjustCountAccuracy(value: unknown, currentScore: number): number {
    if (typeof value !== 'number') return currentScore;

    return value > 10000 ? currentScore * 0.7 : currentScore;
  }

  /**
   * Adjust accuracy for date fields
   */
  private static adjustDateAccuracy(value: unknown, currentScore: number): number {
    if (!(value instanceof Date)) return currentScore;

    return value.getFullYear() < 1900 ? currentScore * 0.6 : currentScore;
  }
}