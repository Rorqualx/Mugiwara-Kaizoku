/**
 * URL-based language detection for ComicVine parser
 * Detects language from URL path patterns, subdomains, TLDs, and query parameters
 */

import type { SupportedLanguage, UrlDetectionResult, DetectionMethodResult } from './types';

/**
 * Language code mappings for URL detection
 */
const LANGUAGE_CODES: Record<string, SupportedLanguage> = {
  en: 'en',
  english: 'en',
  ja: 'ja',
  japanese: 'ja',
  fr: 'fr',
  french: 'fr',
  de: 'de',
  german: 'de',
  es: 'es',
  spanish: 'es',
  it: 'it',
  italian: 'it',
  pt: 'pt',
  portuguese: 'pt',
  ko: 'ko',
  korean: 'ko',
  zh: 'zh',
  chinese: 'zh',
};

/**
 * TLD to language mapping
 */
const TLD_LANGUAGES: Record<string, SupportedLanguage> = {
  '.jp': 'ja',
  '.co.jp': 'ja',
  '.ne.jp': 'ja',
  '.fr': 'fr',
  '.de': 'de',
  '.es': 'es',
  '.it': 'it',
  '.pt': 'pt',
  '.br': 'pt',
  '.co.kr': 'ko',
  '.kr': 'ko',
  '.cn': 'zh',
  '.com.tw': 'zh',
  '.tw': 'zh',
};

/**
 * Helper function to extract subdomain from hostname
 */
function extractSubdomain(hostname: string): string | null {
  const parts = hostname.split('.');
  if (parts.length < 3) {
    return null;
  }
  return parts[0] ?? null;
}

/**
 * Helper function to create a detection result for a matched subdomain
 */
function createSubdomainMatchResult(subdomain: string, language: SupportedLanguage): DetectionMethodResult {
  return {
    match: true,
    language,
    confidence: 0.85,
    reason: `Subdomain indicates language: ${subdomain}.`,
  };
}

/**
 * Helper function to check if a value is a valid language code
 */
function detectLanguageFromValue(value: string): SupportedLanguage | null {
  // Handle formats like: en, en_US, ja_JP, fr-FR
  const parts = value.split(/[_-]/);
  const langCode = parts[0];
  if (!langCode) {
    return null;
  }
  return LANGUAGE_CODES[langCode] ?? null;
}

/**
 * Helper function to check a single query parameter for language
 */
function checkQueryParam(params: URLSearchParams, param: string): DetectionMethodResult | null {
  const value = params.get(param);
  if (!value) {
    return null;
  }

  const detected = detectLanguageFromValue(value);
  if (!detected) {
    return null;
  }

  return {
    match: true,
    language: detected,
    confidence: 0.95,
    reason: `Query parameter ${param}=${value} indicates language`,
  };
}

/**
 * Helper function to check all language query parameters
 */
function checkAllQueryParams(params: URLSearchParams): DetectionMethodResult | null {
  const langParams = ['lang', 'language', 'locale', 'hl'];

  for (const param of langParams) {
    const result = checkQueryParam(params, param);
    if (result) {
      return result;
    }
  }

  return null;
}

/**
 * Helper function to process URL path and detect language
 */
function processUrlPath(normalizedUrl: string): DetectionMethodResult {
  // Check for language path segment patterns
  // Matches: /en/, /ja/, /fr/, /de/, /es/, /it/, /pt/, /ko/, /zh/
  const pathMatch = normalizedUrl.match(/\/(en|ja|fr|de|es|it|pt|ko|zh|english|japanese|french|german|spanish|italian|portuguese|korean|chinese)(\/|$)/);

  if (!pathMatch) {
    return {
      match: false,
      confidence: 0,
      reason: 'No language path segment detected',
    };
  }

  const langCode = pathMatch[1];
  if (!langCode) {
    return {
      match: false,
      confidence: 0,
      reason: 'No language path segment detected',
    };
  }

  const detected = LANGUAGE_CODES[langCode];

  if (!detected) {
    return {
      match: false,
      confidence: 0,
      reason: 'No language path segment detected',
    };
  }

  return {
    match: true,
    language: detected,
    confidence: 0.9,
    reason: `URL path contains language segment: /${langCode}/`,
  };
}

/**
 * Detect language from URL path segment (e.g., /jp/, /fr/)
 */
export function detectFromUrlPath(url: string): DetectionMethodResult {
  try {
    const normalizedUrl = url.trim().toLowerCase();
    return processUrlPath(normalizedUrl);
  } catch (error) {
    return {
      match: false,
      confidence: 0,
      reason: `URL parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Detect language from subdomain (e.g., en.example.com, ja.example.com)
 */
export function detectFromSubdomain(url: string): DetectionMethodResult {
  try {
    const normalizedUrl = url.trim().toLowerCase();
    const urlObj = new URL(normalizedUrl);
    const hostname = urlObj.hostname;

    const subdomain = extractSubdomain(hostname);
    if (subdomain === null) {
      return {
        match: false,
        confidence: 0,
        reason: 'No subdomain detected',
      };
    }

    const detected = LANGUAGE_CODES[subdomain];
    if (!detected) {
      return {
        match: false,
        confidence: 0,
        reason: 'Subdomain does not match known language codes',
      };
    }

    return createSubdomainMatchResult(subdomain, detected);
  } catch (error) {
    return {
      match: false,
      confidence: 0,
      reason: `Subdomain parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Helper function to check domain TLD against language mapping
 */
function checkDomainTld(hostname: string): DetectionMethodResult | null {
  // Check TLDs from most specific to least (e.g., .co.jp before .jp)
  for (const [tld, language] of Object.entries(TLD_LANGUAGES)) {
    if (hostname.endsWith(tld)) {
      return {
        match: true,
        language,
        confidence: 0.8,
        reason: `Domain TLD indicates language: ${tld}`,
      };
    }
  }
  return null;
}

/**
 * Detect language from domain TLD (e.g., .jp, .fr, .de)
 */
export function detectFromDomain(url: string): DetectionMethodResult {
  try {
    const normalizedUrl = url.trim().toLowerCase();
    const urlObj = new URL(normalizedUrl);
    const hostname = urlObj.hostname;

    const tldResult = checkDomainTld(hostname);
    if (tldResult) {
      return tldResult;
    }

    // .com is neutral - default to English but low confidence
    if (hostname.endsWith('.com')) {
      return {
        match: true,
        language: 'en',
        confidence: 0.3,
        reason: 'Domain TLD is .com (defaults to English with low confidence)',
      };
    }

    return {
      match: false,
      confidence: 0,
      reason: 'Domain TLD does not indicate a specific language',
    };
  } catch (error) {
    return {
      match: false,
      confidence: 0,
      reason: `Domain parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Detect language from query parameters (e.g., ?lang=en, ?locale=ja_JP)
 */
export function detectFromQueryParams(url: string): DetectionMethodResult {
  try {
    const normalizedUrl = url.trim().toLowerCase();
    const urlObj = new URL(normalizedUrl);
    const params = urlObj.searchParams;

    const result = checkAllQueryParams(params);
    if (result) {
      return result;
    }

    return {
      match: false,
      confidence: 0,
      reason: 'No language query parameters detected',
    };
  } catch (error) {
    return {
      match: false,
      confidence: 0,
      reason: `Query parameter parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Helper function to handle no URL matches
 */
function createNoUrlMatchResult(): UrlDetectionResult {
  return {
    detectedLanguage: 'en',
    confidence: 0.1,
    reasons: ['No URL-based language indicators detected, defaulting to English'],
  };
}

/**
 * Helper function to handle single URL match
 */
function createSingleUrlMatchResult(match: DetectionMethodResult): UrlDetectionResult {
  return {
    detectedLanguage: match.language ?? 'en',
    confidence: match.confidence,
    reasons: [match.reason],
  };
}

/**
 * Helper function to handle agreeing URL matches
 */
function createAgreeingUrlMatchesResult(matches: DetectionMethodResult[]): UrlDetectionResult {
  const language = matches[0]?.language ?? 'en';
  const combinedConfidence = Math.min(0.98, matches.reduce((sum, m) => sum + m.confidence / matches.length, 0));

  return {
    detectedLanguage: language,
    confidence: combinedConfidence,
    reasons: matches.map((m) => m.reason),
  };
}

/**
 * Helper function to handle conflicting URL matches
 */
function createConflictingUrlMatchesResult(matches: DetectionMethodResult[]): UrlDetectionResult {
  const highestConfidence = matches.reduce(
    (best, current) => (current.confidence > best.confidence ? current : best),
    { confidence: 0, language: 'en', reason: '', match: false }
  );

  return {
    detectedLanguage: highestConfidence.language ?? 'en',
    confidence: highestConfidence.confidence * 0.7, // Reduce confidence due to conflict
    reasons: [
      ...matches.map((m) => m.reason),
      'Warning: Conflicting language signals, using highest confidence',
    ],
  };
}

/**
 * Combined URL detection function
 * Checks all URL-based methods and returns combined result
 */
export function detectFromUrl(url: string): UrlDetectionResult {
  const results: DetectionMethodResult[] = [];

  // Run all URL-based detection methods
  results.push(detectFromUrlPath(url));
  results.push(detectFromSubdomain(url));
  results.push(detectFromDomain(url));
  results.push(detectFromQueryParams(url));

  // Find matches
  const matches = results.filter((r) => r.match && r.language);

  // No matches - default to English with very low confidence
  if (matches.length === 0) {
    return createNoUrlMatchResult();
  }

  // Single match - use it
  if (matches.length === 1) {
    return createSingleUrlMatchResult(matches[0] ?? { confidence: 0, language: 'en', reason: '', match: false });
  }

  // Multiple matches - check if they agree
  const languages = new Set(matches.map((m) => m.language));
  if (languages.size === 1) {
    return createAgreeingUrlMatchesResult(matches);
  }

  // Conflicting signals - use highest confidence
  return createConflictingUrlMatchesResult(matches);
}
