/**
 * Provider Strengths Configuration
 * 
 * This file contains the strength ratings for each metadata provider across
 * different field types. These ratings are used to provide visual cues about
 * which providers excel at different types of metadata.
 * 
 * Ratings are on a scale of 0-5, where:
 * 5 = Excellent (comprehensive, high-quality data)
 * 4 = Very Good (reliable with occasional gaps)
 * 3 = Good (adequate for most uses)
 * 2 = Fair (limited but usable)
 * 1 = Poor (very limited or frequently incorrect)
 * 0 = Not Available
 */

/**
 * Interface for provider strength data
 */
export interface ProviderStrengths {
  [providerId: string]: {
    [fieldName: string]: number;
  };
}

/**
 * Provider strength ratings for different metadata fields
 */
export const PROVIDER_STRENGTHS: ProviderStrengths = {
  // AniList
  // Strengths: Japanese manga, anime adaptations, character data
  // Weaknesses: Western comics, older series
  anilist: {
    title: 5, // Official titles and romanizations
    summary: 4, // Detailed but occasionally fan-submitted
    genres: 5, // Comprehensive genre tagging
    authors: 4, // Good author coverage
    characters: 5, // Excellent character data
    cover: 4, // High-quality cover images
    status: 5, // Up-to-date publication status
    startDate: 5, // Accurate publication dates
    endDate: 5, // Accurate completion dates
    volumes: 4, // Good volume data for most series
    chapters: 4, // Reliable chapter counts
    synonyms: 5, // Comprehensive alternative titles
    tags: 5, // Detailed tagging system
  },
  
  // ComicVine
  // Strengths: Western comics, publisher information, precise publication dates
  // Weaknesses: Manga-specific information, non-English content
  comicvine: {
    title: 4, // Good title accuracy
    summary: 4, // Detailed, professionally written descriptions
    genres: 4, // Standard genre classification
    authors: 5, // Comprehensive credits and roles
    characters: 4, // Good character listings
    cover: 4, // High-quality but sometimes missing variants
    status: 4, // Accurate publication status
    startDate: 5, // Precise publication dates
    endDate: 4, // Well-tracked for completed series
    volumes: 5, // Excellent volume tracking
    chapters: 4, // Issue numbering rather than chapters
    synonyms: 3, // Limited alternative titles
    tags: 3, // Basic tagging
  },
  
  // Fandom
  // Strengths: Fan-maintained details, chapter summaries, character details
  // Weaknesses: Cover art, standardization, smaller series
  fandom: {
    title: 3, // Sometimes informal or fan titles
    summary: 5, // Extremely detailed plot descriptions
    genres: 3, // Basic genre coverage
    authors: 3, // Limited author details
    characters: 5, // Extensive character information
    cover: 2, // Variable quality, often missing
    status: 3, // Sometimes outdated
    startDate: 3, // Basic publication information
    endDate: 3, // Sometimes missing
    volumes: 4, // Good volume listings for popular series
    chapters: 5, // Comprehensive chapter listings and summaries
    synonyms: 4, // Good alternative title coverage
    tags: 3, // Limited tagging
  },
};

/**
 * Get strength color based on rating
 */
export function getStrengthColor(strength: number): string {
  if (strength >= 5) return 'green';
  if (strength >= 4) return 'teal';
  if (strength >= 3) return 'blue';
  if (strength >= 2) return 'yellow';
  if (strength >= 1) return 'orange';
  return 'gray';
}

/**
 * Get strength description based on rating
 */
export function getStrengthDescription(strength: number): string {
  if (strength >= 5) return 'Excellent';
  if (strength >= 4) return 'Very Good';
  if (strength >= 3) return 'Good';
  if (strength >= 2) return 'Fair';
  if (strength >= 1) return 'Limited';
  return 'Not Available';
}

/**
 * Get provider strength for a specific field
 */
export function getProviderStrength(providerId: string, fieldName: string): number {
  return PROVIDER_STRENGTHS[providerId]?.[fieldName] ?? 0;
}

/**
 * Get the best provider for a specific field
 */
export function getBestProviderForField(fieldName: string): string {
  let bestProvider = '';
  let bestStrength = 0;
  
  Object.entries(PROVIDER_STRENGTHS).forEach(([providerId, fields]) => {
    const strength = fields[fieldName] ?? 0;
    if (strength > bestStrength) {
      bestStrength = strength;
      bestProvider = providerId;
    }
  });
  
  return bestProvider;
}

/**
 * Get all providers sorted by strength for a specific field
 */
export function getProvidersForFieldSorted(fieldName: string): Array<{providerId: string; strength: number}> {
  const providers = Object.entries(PROVIDER_STRENGTHS)
    .map(([providerId, fields]) => ({
      providerId,
      strength: fields[fieldName] ?? 0
    }))
    .filter(p => p.strength > 0)
    .sort((a, b) => b.strength - a.strength);
  
  return providers;
}