/**
 * ComicVine Language Detection Module
 *
 * Multi-factor language detection combining:
 * - URL patterns (path, subdomain, TLD, query params)
 * - Content analysis (publisher, script, title indicators)
 * - Guard functions for filtering by preferred language
 *
 * Primary focus: English language editions
 * Infrastructure supports: Japanese, French, German, Spanish, Italian, Portuguese, Korean, Chinese
 *
 * @module comicvine/language-detection
 */

// Type definitions
export type {
  SupportedLanguage,
  DetectionMethodResult,
  LanguageDetectionResult,
  LanguageGuardResult,
  LanguageConfig,
  LanguageDetectionOptions,
  UrlDetectionResult,
  ContentDetectionResult,
} from './types';

// URL-based detection
export {
  detectFromUrl,
  detectFromUrlPath,
  detectFromSubdomain,
  detectFromDomain,
  detectFromQueryParams,
} from './url-detection';

// Content-based detection
export {
  detectFromContent,
  detectFromPublisher,
  detectFromScript,
  detectFromTitleIndicator,
  detectFromVolumeName,
} from './content-detection';

// Guard functions
export {
  guardPreferredLanguage,
  guardUrlLanguage,
  isSupportedLanguage,
  getDefaultLanguageForRegion,
} from './guard-functions';

// Publisher data (for reference/customization)
export { LANGUAGE_CONFIGS } from './publisher-data';
export {
  ENGLISH_PUBLISHERS,
  JAPANESE_PUBLISHERS,
  FRENCH_PUBLISHERS,
  GERMAN_PUBLISHERS,
  SPANISH_PUBLISHERS,
  ITALIAN_PUBLISHERS,
  PORTUGUESE_PUBLISHERS,
  KOREAN_PUBLISHERS,
  CHINESE_PUBLISHERS,
} from './publisher-data';
