/**
 * Field Freshness Scorer Module
 *
 * Calculates freshness scores (0-100) for field values.
 * Assesses how recent/up-to-date field data is.
 *
 * Extracted from: field-quality-scorer.ts (lines 182-194)
 */

import { ProviderQualityMatrices } from './provider-quality-matrices';

// ============================================================================
// Field Freshness Scoring
// ============================================================================

export class FieldFreshnessScorer {
  /**
   * Calculate freshness score (currently simplified)
   */
  static calculate(field: string, value: unknown, provider: string): number {
    // For now, use provider reliability as freshness proxy
    // In a real implementation, this would use actual timestamps
    const baseFreshness = this.getBaseProviderFreshness(provider);

    // Some fields are more time-sensitive than others
    const timeSensitiveFields = ['status', 'chapters', 'volumes', 'endDate'];
    if (timeSensitiveFields.includes(field)) {
      return Math.round(baseFreshness * 0.9);
    }

    return baseFreshness;
  }

  /**
   * Get base provider freshness
   */
  private static getBaseProviderFreshness(provider: string): number {
    return ProviderQualityMatrices.getBaseProviderFreshness(provider);
  }

  /**
   * Check if a field is time-sensitive
   */
  private static isTimeSensitiveField(field: string): boolean {
    const timeSensitiveFields = ['status', 'chapters', 'volumes', 'endDate'];
    return timeSensitiveFields.includes(field);
  }
}