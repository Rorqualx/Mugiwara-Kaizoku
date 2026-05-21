/**
 * Language guard functions for ComicVine parser
 * Validates whether content matches preferred language settings
 */

import { detectFromContent } from './content-detection';
import { detectFromUrl } from './url-detection';

import type { DetectionMethodResult, LanguageGuardResult, LanguageDetectionResult, SupportedLanguage } from './types';

/**
 * Check if detected language matches preferred language
 */
function isLanguageMatch(detected: SupportedLanguage, preferred: SupportedLanguage): boolean {
  // 'any' allows everything
  if (preferred === 'any') {
    return true;
  }

  // Exact match
  return detected === preferred;
}

/**
 * Create guard result for allowed content
 */
function createAllowedResult(
  detectedLanguage: SupportedLanguage,
  confidence: number,
  reasons: string[]
): LanguageGuardResult {
  return {
    allowed: true,
    detectedLanguage,
    confidence,
    reasons,
  };
}

/**
 * Create guard result for blocked content
 */
function createBlockedResult(
  detectedLanguage: SupportedLanguage,
  confidence: number,
  reasons: string[],
  preferredLanguage: SupportedLanguage
): LanguageGuardResult {
  return {
    allowed: false,
    detectedLanguage,
    confidence,
    reasons,
    suggestion: `Detected ${detectedLanguage.toUpperCase()} but preferred language is ${preferredLanguage.toUpperCase()}`,
  };
}

/**
 * Create detection method result object
 */
function createMethodResult(
  match: boolean,
  language: SupportedLanguage,
  confidence: number,
  reason: string
): DetectionMethodResult {
  return {
    match,
    language,
    confidence,
    reason,
  };
}

/**
 * Create agreed detection result (URL and content match)
 */
function createAgreedDetectionResult(
  urlResult: ReturnType<typeof detectFromUrl>,
  contentResult: ReturnType<typeof detectFromContent>,
  allReasons: string[]
): LanguageDetectionResult {
  return {
    detectedLanguage: urlResult.detectedLanguage,
    confidence: Math.max(urlResult.confidence, contentResult.confidence),
    methods: {
      urlPath: createMethodResult(
        urlResult.confidence > 0.5,
        urlResult.detectedLanguage,
        urlResult.confidence,
        urlResult.reasons[0] ?? ''
      ),
      publisher: createMethodResult(
        contentResult.confidence > 0.5,
        contentResult.detectedLanguage,
        contentResult.confidence,
        contentResult.reasons[0] ?? ''
      ),
    },
    reasons: allReasons,
  };
}

/**
 * Create URL-priority detection result (URL has higher confidence)
 */
function createUrlPriorityResult(
  urlResult: ReturnType<typeof detectFromUrl>,
  contentResult: ReturnType<typeof detectFromContent>,
  allReasons: string[]
): LanguageDetectionResult {
  return {
    detectedLanguage: urlResult.detectedLanguage,
    confidence: urlResult.confidence * 0.8, // Reduce confidence due to conflict
    methods: {
      urlPath: createMethodResult(true, urlResult.detectedLanguage, urlResult.confidence, urlResult.reasons[0] ?? ''),
      publisher: createMethodResult(
        true,
        contentResult.detectedLanguage,
        contentResult.confidence,
        contentResult.reasons[0] ?? ''
      ),
    },
    reasons: [...allReasons, 'URL and content signals conflict, using URL detection'],
  };
}

/**
 * Create content-priority detection result (content has higher confidence)
 */
function createContentPriorityResult(
  urlResult: ReturnType<typeof detectFromUrl>,
  contentResult: ReturnType<typeof detectFromContent>,
  allReasons: string[]
): LanguageDetectionResult {
  return {
    detectedLanguage: contentResult.detectedLanguage,
    confidence: contentResult.confidence * 0.8, // Reduce confidence due to conflict
    methods: {
      urlPath: createMethodResult(true, urlResult.detectedLanguage, urlResult.confidence, urlResult.reasons[0] ?? ''),
      publisher: createMethodResult(
        true,
        contentResult.detectedLanguage,
        contentResult.confidence,
        contentResult.reasons[0] ?? ''
      ),
    },
    reasons: [...allReasons, 'URL and content signals conflict, using content detection'],
  };
}

/**
 * Combine URL and content detection results
 */
function combineDetectionResults(
  urlResult: ReturnType<typeof detectFromUrl>,
  contentResult: ReturnType<typeof detectFromContent>
): LanguageDetectionResult {
  const allReasons = [...urlResult.reasons, ...contentResult.reasons];

  // If both agree, use higher confidence
  if (urlResult.detectedLanguage === contentResult.detectedLanguage) {
    return createAgreedDetectionResult(urlResult, contentResult, allReasons);
  }

  // Conflict - use URL detection with higher confidence, then content
  if (urlResult.confidence > contentResult.confidence) {
    return createUrlPriorityResult(urlResult, contentResult, allReasons);
  }

  return createContentPriorityResult(urlResult, contentResult, allReasons);
}

/**
 * Guard function to validate if content matches preferred language
 * Uses both URL and content-based detection methods
 *
 * @param url - The URL to check for language indicators
 * @param publisher - The publisher name
 * @param title - The title to check
 * @param preferredLanguage - The preferred language (default: 'en')
 * @param description - Optional description for better script detection
 */
export function guardPreferredLanguage(
  url: string,
  publisher: string,
  title: string,
  preferredLanguage: SupportedLanguage = 'en',
  description?: string
): LanguageGuardResult {
  // Run both detection methods
  const urlResult = detectFromUrl(url);
  const contentResult = detectFromContent(publisher, title, description);

  // Combine results
  const detectionResult = combineDetectionResults(urlResult, contentResult);

  // Check if detected language matches preferred
  if (isLanguageMatch(detectionResult.detectedLanguage, preferredLanguage)) {
    return createAllowedResult(
      detectionResult.detectedLanguage,
      detectionResult.confidence,
      [
        ...detectionResult.reasons,
        `Detected language ${detectionResult.detectedLanguage.toUpperCase()} matches preferred ${preferredLanguage.toUpperCase()}`,
      ]
    );
  }

  // Language mismatch - block content
  return createBlockedResult(
    detectionResult.detectedLanguage,
    detectionResult.confidence,
    detectionResult.reasons,
    preferredLanguage
  );
}

/**
 * Simplified guard function that only checks URL-based language detection
 * Useful for quick filtering before fetching content
 *
 * @param url - The URL to check
 * @param preferredLanguage - The preferred language (default: 'en')
 */
export function guardUrlLanguage(url: string, preferredLanguage: SupportedLanguage = 'en'): LanguageGuardResult {
  const result = detectFromUrl(url);

  if (isLanguageMatch(result.detectedLanguage, preferredLanguage)) {
    return createAllowedResult(
      result.detectedLanguage,
      result.confidence,
      [
        ...result.reasons,
        `URL language ${result.detectedLanguage.toUpperCase()} matches preferred ${preferredLanguage.toUpperCase()}`,
      ]
    );
  }

  return createBlockedResult(result.detectedLanguage, result.confidence, result.reasons, preferredLanguage);
}

/**
 * Check if a language code is supported
 */
export function isSupportedLanguage(code: string): code is SupportedLanguage {
  const supported: SupportedLanguage[] = ['en', 'ja', 'fr', 'de', 'es', 'it', 'pt', 'ko', 'zh', 'any'];
  return supported.includes(code as SupportedLanguage);
}

/**
 * Get default language code for a region
 */
export function getDefaultLanguageForRegion(region: string): SupportedLanguage {
  const regionMap: Record<string, SupportedLanguage> = {
    us: 'en',
    gb: 'en',
    ca: 'en',
    au: 'en',
    nz: 'en',
    jp: 'ja',
    fr: 'fr',
    de: 'de',
    es: 'es',
    it: 'it',
    pt: 'pt',
    br: 'pt',
    kr: 'ko',
    cn: 'zh',
    tw: 'zh',
  };

  return regionMap[region.toLowerCase()] ?? 'en';
}
