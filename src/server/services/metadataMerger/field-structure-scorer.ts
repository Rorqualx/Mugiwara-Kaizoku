/**
 * Field Structure Scorer Module
 *
 * Calculates structure scores (0-100) for field values.
 * Assesses if complex data types have proper structure/format.
 *
 * Extracted from: field-quality-scorer.ts (lines 199-246)
 */

// ============================================================================
// Field Structure Scoring
// ============================================================================

export class FieldStructureScorer {
  /**
   * Calculate structure score for data format
   */
  static calculate(field: string, value: unknown): number {
    let score = 100;

    switch (field) {
      case 'tags':
        score = this.calculateTagsStructure(value);
        break;

      case 'characters':
      case 'staff':
        score = this.calculateCharacterStaffStructure(value);
        break;

      case 'externalLinks':
        score = this.calculateExternalLinksStructure(value);
        break;

      default:
        // No specific structure adjustments for other fields
        break;
    }

    return score;
  }

  /**
   * Calculate structure score for tags array
   */
  private static calculateTagsStructure(value: unknown): number {
    if (!Array.isArray(value)) return 100;

    // Check if tags have proper structure
    const hasStructure = value.every(tag =>
      typeof tag === 'object' && tag !== null && 'name' in tag
    );

    return hasStructure ? 100 : 60;
  }

  /**
   * Calculate structure score for characters/staff arrays
   */
  private static calculateCharacterStaffStructure(value: unknown): number {
    if (!Array.isArray(value)) return 100;

    // Check if characters/staff have proper structure
    const hasStructure = value.every(item =>
      typeof item === 'object' && item !== null && 'name' in item
    );

    return hasStructure ? 100 : 70;
  }

  /**
   * Calculate structure score for external links array
   */
  private static calculateExternalLinksStructure(value: unknown): number {
    if (!Array.isArray(value)) return 100;

    // Check if external links have proper structure
    const hasStructure = value.every(link =>
      typeof link === 'object' && link !== null && 'url' in link
    );

    return hasStructure ? 100 : 70;
  }

  /**
   * Check if value is a properly structured object with required property
   */
  private static hasRequiredProperty(obj: unknown, property: string): boolean {
    return typeof obj === 'object' && obj !== null && property in obj;
  }
}