/**
 * ComicVine Language Filtering Module
 *
 * Handles language detection and filtering for ComicVine search results.
 * Allows users to prioritize results in their preferred language.
 *
 * @module comicvine-language-filter
 */

import { NON_ENGLISH_PUBLISHERS } from '@/server/services/comicvine/constants';
import { logger } from '@/utils/logger';

/**
 * English publishers that contain non-English publisher name substrings.
 * Checked before the non-English list to prevent false positives.
 * e.g., "Kodansha Comics USA" contains "kodansha" but is English.
 */
const ENGLISH_PUBLISHER_ALLOWLIST: readonly string[] = [
  'kodansha comics',    // Kodansha Comics USA, Kodansha Comics
  'kodansha usa',       // Kodansha USA Publishing
  'square enix manga',  // Square Enix Manga & Books (English)
  'viz media',          // VIZ Media
  'yen press',          // Yen Press
  'seven seas',         // Seven Seas Entertainment
  'dark horse',         // Dark Horse Comics
  'vertical',           // Vertical Inc
  'tokyopop',           // Tokyopop (English) — "tokyopop de" is German
  'j-novel',            // J-Novel Club
] as const;

/**
 * Language detection result
 */
export interface LanguageDetectionResult {
  isNonEnglish: boolean;
  languageHint: string | null;
}

/**
 * Detect if a title appears to be non-English
 * Checks for Japanese/Chinese characters, language indicators, and common non-English patterns
 *
 * @param title - Title to check
 * @param publisher - Optional publisher name
 * @returns Object with isNonEnglish flag and detected language hint
 */
export function detectNonEnglishVariant(
  title: string,
  publisher?: string
): LanguageDetectionResult {
  const normalizedTitle = title.toLowerCase();
  // Strip diacritical marks so "Glénat" and "Glenat" both match "glénat"
  const normalizedPublisher = (publisher?.toLowerCase() ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Check for Japanese/Chinese/Korean characters in title
  const hasAsianChars = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7af]/.test(title);
  if (hasAsianChars) {
    return { isNonEnglish: true, languageHint: 'asian' };
  }

  // Common non-English language indicators in parentheses
  const languagePatterns: Array<{ pattern: RegExp; language: string }> = [
    { pattern: /\(french\)|\(français\)|\(fr\)/i, language: 'french' },
    { pattern: /\(spanish\)|\(español\)|\(es\)/i, language: 'spanish' },
    { pattern: /\(german\)|\(deutsch\)|\(de\)/i, language: 'german' },
    { pattern: /\(italian\)|\(italiano\)|\(it\)/i, language: 'italian' },
    { pattern: /\(portuguese\)|\(português\)|\(pt\)/i, language: 'portuguese' },
    { pattern: /\(japanese\)|\(日本語\)|\(jp\)/i, language: 'japanese' },
    { pattern: /\(chinese\)|\(中文\)|\(zh\)/i, language: 'chinese' },
    { pattern: /\(korean\)|\(한국어\)|\(ko\)/i, language: 'korean' },
  ];

  for (const { pattern, language } of languagePatterns) {
    if (pattern.test(normalizedTitle)) {
      return { isNonEnglish: true, languageHint: language };
    }
  }

  // Check English publisher allowlist BEFORE non-English check.
  // Some English publishers contain non-English publisher substrings
  // (e.g., "Kodansha Comics USA" contains "kodansha" which is a Japanese publisher).
  for (const eng of ENGLISH_PUBLISHER_ALLOWLIST) {
    if (normalizedPublisher.includes(eng)) {
      return { isNonEnglish: false, languageHint: null };
    }
  }

  for (const pub of NON_ENGLISH_PUBLISHERS) {
    const normalizedPub = pub.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalizedPublisher.includes(normalizedPub)) {
      return { isNonEnglish: true, languageHint: `publisher:${pub}` };
    }
  }

  return { isNonEnglish: false, languageHint: null };
}

/**
 * Map of language codes to detection hints
 */
const LANGUAGE_HINT_MAP: Record<string, string[]> = {
  'ja': ['japanese', 'asian', 'publisher:shueisha', 'publisher:kodansha', 'publisher:shogakukan', 'publisher:kadokawa', 'publisher:square enix', 'publisher:futabasha', 'publisher:akita shoten', 'publisher:hakusensha', 'publisher:shonen gahosha'],
  'fr': ['french', 'publisher:ki-oon', 'publisher:kana', 'publisher:glénat', 'publisher:delcourt', 'publisher:pika', 'publisher:soleil', 'publisher:tonkam', 'publisher:kazé', 'publisher:kurokawa', 'publisher:meian', 'publisher:mangetsu', 'publisher:akata'],
  'de': ['german', 'publisher:carlsen', 'publisher:egmont', 'publisher:tokyopop de'],
  'es': ['spanish', 'publisher:norma editorial', 'publisher:planeta', 'publisher:ivrea'],
  'it': ['italian', 'publisher:panini', 'publisher:planet manga', 'publisher:star comics'],
  'pt': ['portuguese', 'publisher:jbc', 'publisher:newpop', 'publisher:panini brasil'],
  'ko': ['korean', 'publisher:seoul munhwasa', 'publisher:seoul cultural publishers', 'publisher:daewon', 'publisher:haksan', 'publisher:sigongsa', 'publisher:anibooks', 'publisher:daiwon'],
  'zh': ['chinese'],
};

/**
 * Check if a result matches the preferred language
 * Returns true if the result should NOT be penalized
 *
 * @param title - Result title
 * @param publisher - Publisher name
 * @param preferredLanguage - User's preferred language code
 * @returns true if result matches preferred language
 */
export function matchesPreferredLanguage(
  title: string,
  publisher: string | undefined,
  preferredLanguage: string
): boolean {
  // 'any' means no filtering - all results match
  if (preferredLanguage === 'any') {
    return true;
  }

  const { isNonEnglish, languageHint } = detectNonEnglishVariant(title, publisher);

  // If preferred language is English, non-English results don't match
  if (preferredLanguage === 'en') {
    return !isNonEnglish;
  }

  // For other preferred languages, check if the detected language matches
  // If no language hint detected, assume it might be English (default)
  if (!languageHint) {
    // No language indicators - could be English or the target language
    // Don't penalize these ambiguous results
    return true;
  }

  const preferredHints = LANGUAGE_HINT_MAP[preferredLanguage] ?? [];
  return preferredHints.some(hint => languageHint.includes(hint));
}

/**
 * Apply language-based scoring adjustment to search results
 *
 * @param score - Original relevance score
 * @param title - Result title
 * @param publisher - Publisher name
 * @param preferredLanguage - User's preferred language code
 * @param penalty - Score penalty multiplier (default 0.3 = 30% reduction)
 * @returns Adjusted score
 */
export function applyLanguageScoring(
  score: number,
  title: string,
  publisher: string | undefined,
  preferredLanguage: string,
  penalty: number = 0.3
): number {
  const matchesLanguage = matchesPreferredLanguage(title, publisher, preferredLanguage);

  if (!matchesLanguage) {
    const adjustedScore = score * (1 - penalty);
    logger.debug(`[ComicVine] Applying language penalty to "${title}"`, {
      originalScore: score.toFixed(2),
      adjustedScore: adjustedScore.toFixed(2),
      preferredLanguage,
      publisher
    });
    return adjustedScore;
  }

  return score;
}

/**
 * Get preferred language from ComicVine config
 *
 * @returns Promise with preferred language code (default 'en')
 */
export async function getPreferredLanguage(): Promise<string> {
  try {
    const { comicvineConfigService } = await import('../../comicvine/configService');
    const config = await comicvineConfigService.loadConfig();
    return config.preferredLanguage;
  } catch {
    return 'en';
  }
}
