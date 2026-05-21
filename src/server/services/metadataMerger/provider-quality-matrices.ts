/**
 * Provider Quality Matrices Module
 *
 * Contains provider quality matrices for different fields.
 * Provides base quality, accuracy, and freshness scores per provider.
 *
 * Extracted from: field-quality-scorer.ts (lines 315-370)
 */

// ============================================================================
// Provider Quality Matrices
// ============================================================================

export class ProviderQualityMatrices {
  /**
   * Get base provider quality for a field
   */
  static getBaseProviderQuality(field: string, provider: string): number {
    const qualityMatrix = {
      title: { anilist: 95, comicvine: 85, fandom: 80, wikipedia: 75 },
      description: { anilist: 90, comicvine: 85, fandom: 70, wikipedia: 95 },
      volumes: { anilist: 85, comicvine: 95, fandom: 90, wikipedia: 60 },
      chapters: { anilist: 85, comicvine: 90, fandom: 95, wikipedia: 50 },
      authors: { anilist: 90, comicvine: 95, fandom: 80, wikipedia: 75 },
      artists: { anilist: 90, comicvine: 95, fandom: 80, wikipedia: 75 },
      genres: { anilist: 95, comicvine: 90, fandom: 85, wikipedia: 80 },
      status: { anilist: 95, comicvine: 85, fandom: 80, wikipedia: 75 },
      format: { anilist: 95, comicvine: 90, fandom: 80, wikipedia: 70 },
      coverImage: { anilist: 95, comicvine: 90, fandom: 85, wikipedia: 70 },
      publisher: { anilist: 80, comicvine: 95, fandom: 85, wikipedia: 75 }
    };

    // Use type guards to narrow the types
    const fieldKey = field as keyof typeof qualityMatrix;
    if (!(fieldKey in qualityMatrix)) return 80; // Default for unknown fields
    const fieldQuality = qualityMatrix[fieldKey];

    const providerKey = provider as keyof typeof fieldQuality;
    if (!(providerKey in fieldQuality)) return 80; // Default for unknown providers
    return fieldQuality[providerKey];
  }

  /**
   * Get base provider accuracy for a field
   */
  static getBaseProviderAccuracy(field: string, provider: string): number {
    const accuracyMatrix = {
      title: { anilist: 98, comicvine: 90, fandom: 85, wikipedia: 80 },
      description: { anilist: 95, comicvine: 85, fandom: 75, wikipedia: 90 },
      volumes: { anilist: 90, comicvine: 95, fandom: 85, wikipedia: 70 },
      chapters: { anilist: 90, comicvine: 85, fandom: 90, wikipedia: 60 },
      authors: { anilist: 95, comicvine: 98, fandom: 85, wikipedia: 80 },
      artists: { anilist: 95, comicvine: 98, fandom: 85, wikipedia: 80 },
      genres: { anilist: 98, comicvine: 95, fandom: 90, wikipedia: 85 },
      status: { anilist: 98, comicvine: 90, fandom: 85, wikipedia: 80 },
      format: { anilist: 98, comicvine: 95, fandom: 85, wikipedia: 75 },
      coverImage: { anilist: 98, comicvine: 95, fandom: 90, wikipedia: 75 },
      publisher: { anilist: 85, comicvine: 98, fandom: 90, wikipedia: 80 }
    };

    // Use type guards to narrow the types
    const fieldKey = field as keyof typeof accuracyMatrix;
    if (!(fieldKey in accuracyMatrix)) return 80; // Default for unknown fields
    const fieldAccuracy = accuracyMatrix[fieldKey];

    const providerKey = provider as keyof typeof fieldAccuracy;
    if (!(providerKey in fieldAccuracy)) return 80; // Default for unknown providers
    return fieldAccuracy[providerKey];
  }

  /**
   * Get base provider freshness
   */
  static getBaseProviderFreshness(provider: string): number {
    const freshnessMatrix = {
      anilist: 95,
      comicvine: 85,
      fandom: 80,
      wikipedia: 90
    };

    // Use type guard to narrow the type
    const providerKey = provider as keyof typeof freshnessMatrix;
    if (!(providerKey in freshnessMatrix)) return 80;
    return freshnessMatrix[providerKey];
  }

  /**
   * Get all supported providers
   */
  static getSupportedProviders(): string[] {
    return ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia', 'mangaupdates', 'mal', 'kitsu'];
  }

  /**
   * Get all supported fields
   */
  static getSupportedFields(): string[] {
    return [
      'title', 'description', 'volumes', 'chapters', 'authors', 'artists',
      'genres', 'status', 'format', 'coverImage', 'publisher'
    ];
  }
}