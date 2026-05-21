/**
 * ComicVine Publisher Scoring
 *
 * Provides publisher detection and scoring for ComicVine search results.
 * Known manga publishers receive a scoring boost to prioritize them over
 * non-manga publishers when searching for manga content.
 */

import { logger } from '@/utils/logger';

import { getComicVineSearchConfig } from './search-config';

// ============================================================================
// Known Manga Publishers
// ============================================================================

/**
 * List of known manga publishers (US localization)
 *
 * These are US-based publishers that primarily release manga.
 * Results from these publishers receive a scoring boost.
 */
export const KNOWN_US_MANGA_PUBLISHERS: ReadonlyArray<string> = [
  'viz',
  'viz media',
  'kodansha usa',
  'kodansha comics',
  'kodansha america',
  'seven seas',
  'seven seas entertainment',
  'yen press',
  'yen on',
  'dark horse',
  'dark horse comics',
  'dark horse manga',
  'vertical',
  'vertical comics',
  'vertical inc',
  'tokyopop',
  'del rey',
  'del rey manga',
  'fantagraphics',
  'j-novel club',
  'one peace books',
  'square enix manga',
  'udon entertainment',
  'ghost ship',
] as const;

/**
 * List of known Japanese manga publishers
 *
 * Original Japanese publishers. Results from these indicate
 * the entry is for the Japanese edition.
 */
export const KNOWN_JAPANESE_PUBLISHERS: ReadonlyArray<string> = [
  'shueisha',
  'kodansha',
  'shogakukan',
  'shōgakukan',
  'square enix',
  'kadokawa',
  'kadokawa shoten',
  'ascii media works',
  'hakusensha',
  'akita shoten',
  'shonen jump',
  'weekly shonen jump',
  'shonen magazine',
  'young jump',
  'big comic spirits',
  'champion',
  'gangan',
  'dengeki',
  'enterbrain',
  'mag garden',
  'houbunsha',
  'futabasha',
  'ichijinsha',
  'takeshobo',
  'gentosha',
  'tokuma shoten',
  'coamix',
  'home-sha',
] as const;

/**
 * Combined list of all known manga publishers
 */
export const KNOWN_MANGA_PUBLISHERS: ReadonlyArray<string> = [
  ...KNOWN_US_MANGA_PUBLISHERS,
  ...KNOWN_JAPANESE_PUBLISHERS,
] as const;

// ============================================================================
// Publisher Detection
// ============================================================================

/**
 * Check if a publisher is a known manga publisher
 *
 * @param publisherName - Publisher name to check
 * @returns True if the publisher is a known manga publisher
 */
export function isKnownMangaPublisher(publisherName: string | undefined | null): boolean {
  if (!publisherName) return false;

  const normalized = publisherName.toLowerCase().trim();

  return KNOWN_MANGA_PUBLISHERS.some((publisher) =>
    normalized.includes(publisher) || publisher.includes(normalized)
  );
}

/**
 * Check if a publisher is a known US manga publisher
 *
 * @param publisherName - Publisher name to check
 * @returns True if the publisher is a US manga publisher
 */
export function isUSMangaPublisher(publisherName: string | undefined | null): boolean {
  if (!publisherName) return false;

  const normalized = publisherName.toLowerCase().trim();

  return KNOWN_US_MANGA_PUBLISHERS.some((publisher) =>
    normalized.includes(publisher) || publisher.includes(normalized)
  );
}

/**
 * Check if a publisher is a known Japanese publisher
 *
 * @param publisherName - Publisher name to check
 * @returns True if the publisher is a Japanese publisher
 */
export function isJapanesePublisher(publisherName: string | undefined | null): boolean {
  if (!publisherName) return false;

  const normalized = publisherName.toLowerCase().trim();

  return KNOWN_JAPANESE_PUBLISHERS.some((publisher) =>
    normalized.includes(publisher) || publisher.includes(normalized)
  );
}

// ============================================================================
// Publisher Scoring
// ============================================================================

/**
 * Apply publisher-based scoring adjustment
 *
 * Boosts the score for results from known manga publishers.
 * US/English publishers get a stronger boost than Japanese publishers
 * to prefer English-language editions with English descriptions.
 *
 * @param baseScore - Original relevance score (0-1)
 * @param publisherName - Publisher name from search result
 * @returns Adjusted score with publisher boost applied
 */
export async function applyPublisherScoring(
  baseScore: number,
  publisherName: string | undefined | null
): Promise<number> {
  const config = await getComicVineSearchConfig();

  if (!config.enablePublisherBoost) {
    return baseScore;
  }

  const multiplier = getPublisherMultiplier(publisherName, config.publisherBoostMultiplier);
  if (multiplier === 1.0) return baseScore;

  const boostedScore = Math.min(baseScore * multiplier, 1.0);

  logger.debug('[ComicVine] Applied publisher boost', {
    publisher: publisherName,
    category: getPublisherCategory(publisherName),
    baseScore: baseScore.toFixed(3),
    boostedScore: boostedScore.toFixed(3),
    multiplier,
  });

  return boostedScore;
}

/**
 * Get the appropriate multiplier for a publisher.
 * US/English publishers get the full boost, Japanese publishers get a smaller boost.
 */
function getPublisherMultiplier(
  publisherName: string | undefined | null,
  baseMultiplier: number,
): number {
  if (isUSMangaPublisher(publisherName)) {
    // US publishers get full boost — they have English descriptions
    return baseMultiplier;
  }
  if (isJapanesePublisher(publisherName)) {
    // Japanese publishers get a reduced boost — descriptions are often non-English
    return 1.0 + (baseMultiplier - 1.0) * 0.3;
  }
  if (isKnownMangaPublisher(publisherName)) {
    return baseMultiplier;
  }
  return 1.0;
}

/**
 * Apply publisher scoring synchronously using default multiplier
 *
 * US/English publishers get the full boost multiplier.
 * Japanese publishers get a reduced boost to deprioritize non-English editions.
 *
 * @param baseScore - Original relevance score (0-1)
 * @param publisherName - Publisher name from search result
 * @param boostMultiplier - Score multiplier for known US publishers (default: 1.3)
 * @returns Adjusted score with publisher boost applied
 */
export function applyPublisherScoringSync(
  baseScore: number,
  publisherName: string | undefined | null,
  boostMultiplier: number = 1.3
): number {
  const multiplier = getPublisherMultiplier(publisherName, boostMultiplier);
  if (multiplier === 1.0) return baseScore;
  return Math.min(baseScore * multiplier, 1.0);
}

/**
 * Get publisher category for logging/debugging
 *
 * @param publisherName - Publisher name to categorize
 * @returns Category string: 'us-manga', 'japanese', or 'other'
 */
export function getPublisherCategory(
  publisherName: string | undefined | null
): 'us-manga' | 'japanese' | 'other' {
  if (isUSMangaPublisher(publisherName)) {
    return 'us-manga';
  }
  if (isJapanesePublisher(publisherName)) {
    return 'japanese';
  }
  return 'other';
}
