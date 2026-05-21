/**
 * Field Completeness Scorer Module
 *
 * Calculates completeness scores (0-100) for field values.
 * Assesses how complete/fully populated a field value is.
 *
 * Extracted from: field-quality-scorer.ts (lines 59-115)
 */


// ============================================================================
// Field Completeness Scoring
// ============================================================================

export class FieldCompletenessScorer {
  /**
   * Calculate completeness score for a field value
   */
  static calculate(field: string, value: unknown): number {
    if (value === undefined || value === null || value === '') {
      return 0;
    }

    let score = 100;

    // Delegate to specialized field handlers
    switch (field) {
      case 'title':
        score = this.calculateTitleCompleteness(value);
        break;

      case 'description':
        score = this.calculateDescriptionCompleteness(value);
        break;

      case 'volumes':
      case 'chapters':
        score = this.calculateCountCompleteness(value);
        break;

      case 'genres':
      case 'themes':
      case 'authors':
      case 'artists':
        score = this.calculateArrayCompleteness(value);
        break;

      case 'coverImage':
      case 'bannerImage':
        score = this.calculateImageCompleteness(value);
        break;

      default:
        // No specific penalties for other fields
        break;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate completeness for title fields
   */
  private static calculateTitleCompleteness(value: unknown): number {
    if (typeof value !== 'string') return 100;

    const trimmed = value.trim();
    if (trimmed.length < 2) return 10;
    if (trimmed.length < 5) return 50;
    return 100;
  }

  /**
   * Calculate completeness for description fields
   */
  private static calculateDescriptionCompleteness(value: unknown): number {
    if (typeof value !== 'string') return 100;

    const trimmed = value.trim();
    if (trimmed.length < 20) return 30;
    if (trimmed.length < 50) return 70;
    return 100;
  }

  /**
   * Calculate completeness for count fields (volumes, chapters)
   */
  private static calculateCountCompleteness(value: unknown): number {
    if (typeof value !== 'number') return 100;

    return value <= 0 ? 10 : 100;
  }

  /**
   * Calculate completeness for array fields (genres, themes, authors, artists)
   */
  private static calculateArrayCompleteness(value: unknown): number {
    if (!Array.isArray(value)) return 100;

    if (value.length === 0) return 10;
    if (value.length === 1) return 50;
    return 100;
  }

  /**
   * Calculate completeness for image fields
   */
  private static calculateImageCompleteness(value: unknown): number {
    if (typeof value !== 'string') return 100;

    return value.startsWith('http') ? 100 : 30;
  }
}