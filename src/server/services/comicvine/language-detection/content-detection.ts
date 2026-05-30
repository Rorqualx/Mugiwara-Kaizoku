/**
 * Content-based language detection for ComicVine parser
 * Detects language from publisher lists, script patterns, and title indicators
 */

import { LANGUAGE_CONFIGS } from './publisher-data';

import type { ContentDetectionResult, DetectionMethodResult, SupportedLanguage } from './types';

/**
 * Normalize publisher name for comparison
 */
function normalizePublisher(publisher: string): string {
  return publisher.trim().toLowerCase();
}

/**
 * Check if publisher matches a language config
 */
function checkPublisherMatch(publisher: string, config: typeof LANGUAGE_CONFIGS[0]): boolean {
  const normalized = normalizePublisher(publisher);
  return config.publishers.some((p) => normalized.includes(p));
}

/**
 * Detect language from publisher name
 */
export function detectFromPublisher(publisher: string): DetectionMethodResult {
  const normalized = normalizePublisher(publisher);

  // Check each language config
  for (const config of LANGUAGE_CONFIGS) {
    if (checkPublisherMatch(normalized, config)) {
      return {
        match: true,
        language: config.code,
        confidence: 0.8,
        reason: `Publisher "${publisher}" is known ${config.code.toUpperCase()} publisher`,
      };
    }
  }

  return {
    match: false,
    confidence: 0,
    reason: `Publisher "${publisher}" not in known language publisher lists`,
  };
}

/**
 * Check single config for script pattern match
 */
function checkConfigScriptPatterns(text: string, config: typeof LANGUAGE_CONFIGS[0]): DetectionMethodResult | null {
  for (const pattern of config.scriptPatterns) {
    if (pattern.test(text)) {
      return {
        match: true,
        language: config.code,
        confidence: 0.6,
        reason: `Text contains script patterns for ${config.code.toUpperCase()}`,
      };
    }
  }
  return null;
}

/**
 * Check all language configs for script pattern match
 */
function checkScriptPatterns(text: string): DetectionMethodResult {
  // Check each language config
  for (const config of LANGUAGE_CONFIGS) {
    const result = checkConfigScriptPatterns(text, config);
    if (result) {
      return result;
    }
  }

  // Default to Latin script (English-like)
  return {
    match: true,
    language: 'en',
    confidence: 0.3,
    reason: 'Text appears to use Latin script, defaulting to English',
  };
}

/**
 * Detect language from script/text patterns
 */
export function detectFromScript(text: string): DetectionMethodResult {
  if (!text || text.length === 0) {
    return {
      match: false,
      confidence: 0,
      reason: 'No text provided for script detection',
    };
  }

  return checkScriptPatterns(text);
}

/**
 * Check single config for title indicator match
 */
function checkConfigTitleIndicators(title: string, config: typeof LANGUAGE_CONFIGS[0]): DetectionMethodResult | null {
  for (const pattern of config.titleIndicators) {
    if (pattern.test(title)) {
      return {
        match: true,
        language: config.code,
        confidence: 0.95,
        reason: `Title contains language indicator: ${config.code.toUpperCase()}`,
      };
    }
  }
  return null;
}

/**
 * Check if title matches any language indicators
 */
function checkTitleIndicators(title: string): DetectionMethodResult {
  const normalized = title.toLowerCase();

  // Check each language config
  for (const config of LANGUAGE_CONFIGS) {
    const result = checkConfigTitleIndicators(normalized, config);
    if (result) {
      return result;
    }
  }

  return {
    match: false,
    confidence: 0,
    reason: 'No language indicators found in title',
  };
}

/**
 * Detect language from title indicators
 */
export function detectFromTitleIndicator(title: string): DetectionMethodResult {
  if (!title || title.length === 0) {
    return {
      match: false,
      confidence: 0,
      reason: 'No title provided for indicator detection',
    };
  }

  return checkTitleIndicators(title);
}

/**
 * Description self-identification clauses. ComicVine volume descriptions for
 * translated editions routinely begin with phrases like "Polish edition of",
 * "Russian edition of", "Hungarian edition of" — written IN ENGLISH but
 * describing a NON-English book. The Kaiju 79 → 148344 incident landed
 * because the description "Polish edition of Kaiju No. 8 manga..." tricked
 * the script-fallback into voting English at 0.3, after Studio JG failed
 * the publisher list and Polish wasn't a supported language at all.
 *
 * These run BEFORE the script fallback in detectFromContent. The pattern
 * deliberately covers languages we don't yet have publisher lists for
 * (Polish, Russian, Czech, Hungarian, Dutch, Swedish, Turkish, etc.) —
 * any one of them is a clear non-English signal.
 */
const FOREIGN_EDITION_DESCRIPTION_CLAUSES: Array<{ pattern: RegExp; language: 'en' | 'ja' | 'fr' | 'de' | 'es' | 'it' | 'pt' | 'ko' | 'zh' | 'unknown' }> = [
  // Languages we already model — re-detect them from description for safety.
  { pattern: /\bfrench\s+(?:edition|version|translation)\s+of\b/i, language: 'fr' },
  { pattern: /\bgerman\s+(?:edition|version|translation)\s+of\b/i, language: 'de' },
  { pattern: /\bspanish\s+(?:edition|version|translation)\s+of\b/i, language: 'es' },
  { pattern: /\bitalian\s+(?:edition|version|translation)\s+of\b/i, language: 'it' },
  { pattern: /\bportuguese\s+(?:edition|version|translation)\s+of\b/i, language: 'pt' },
  { pattern: /\bkorean\s+(?:edition|version|translation)\s+of\b/i, language: 'ko' },
  { pattern: /\bchinese\s+(?:edition|version|translation)\s+of\b/i, language: 'zh' },
  { pattern: /\bjapanese\s+(?:edition|version|original)\s+of\b/i, language: 'ja' },
  // Languages we DON'T yet model — folded into the catch-all 'unknown' bucket.
  // Anything tagged 'unknown' will fail the `=== preferredLanguage` check in
  // the matcher (correct behavior: don't bind), regardless of which exotic
  // language it actually is.
  { pattern: /\bpolish\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\brussian\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\bczech\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\bhungarian\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\bdutch\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\bswedish\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\bnorwegian\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\bdanish\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\bfinnish\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\bturkish\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\bgreek\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\bromanian\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\bukrainian\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\bvietnamese\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\bindonesian\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
  { pattern: /\bthai\s+(?:edition|version|translation)\s+of\b/i, language: 'unknown' },
];

/**
 * Detect language from description self-identification clauses.
 *
 * Returns `'unknown'` for languages we don't yet model — that's intentional:
 * the matcher's `detectedLanguage === preferredLanguage` check will then
 * reject the candidate (because preferredLanguage is never 'unknown'),
 * which is exactly the right outcome.
 */
function detectFromDescriptionEditionClause(description: string): DetectionMethodResult {
  if (!description || description.length === 0) {
    return { match: false, confidence: 0, reason: 'No description provided' };
  }
  for (const marker of FOREIGN_EDITION_DESCRIPTION_CLAUSES) {
    if (marker.pattern.test(description)) {
      return {
        match: true,
        language: marker.language as SupportedLanguage,
        confidence: 0.97,
        reason: `Description self-identifies as a ${marker.language.toUpperCase()} edition`,
      };
    }
  }
  return { match: false, confidence: 0, reason: 'No foreign-edition clause in description' };
}

/**
 * Volume-name edition markers that uniquely identify a foreign-language reprint.
 * Higher confidence (0.97) than `titleIndicators` because these patterns appear
 * almost exclusively on translated editions, not on original-language entries.
 */
const VOLUME_NAME_EDITION_MARKERS: Array<{ pattern: RegExp; language: 'en' | 'ja' | 'fr' | 'de' | 'es' | 'it' | 'pt' | 'ko' | 'zh' }> = [
  // English
  { pattern: /\benglish\s+(?:edition|version|reprint)\b/i, language: 'en' },
  { pattern: /\bus\s+edition\b/i, language: 'en' },
  // Japanese (original)
  { pattern: /\bjapanese\s+(?:edition|version|original)\b/i, language: 'ja' },
  { pattern: /\bjp\s+edition\b/i, language: 'ja' },
  { pattern: /\boriginal\s+japanese\b/i, language: 'ja' },
  // French
  { pattern: /\bfrench\s+(?:edition|version)\b/i, language: 'fr' },
  { pattern: /\bedition\s+française\b/i, language: 'fr' },
  { pattern: /\bvf\b/, language: 'fr' }, // "Version Française"
  // German
  { pattern: /\bgerman\s+(?:edition|version)\b/i, language: 'de' },
  { pattern: /\bdeutsche\s+(?:ausgabe|version)\b/i, language: 'de' },
  // Spanish
  { pattern: /\bspanish\s+(?:edition|version)\b/i, language: 'es' },
  { pattern: /\bedición\s+española\b/i, language: 'es' },
  { pattern: /\bedicion\s+espanola\b/i, language: 'es' },
  // Italian
  { pattern: /\bitalian\s+(?:edition|version)\b/i, language: 'it' },
  { pattern: /\bedizione\s+italiana\b/i, language: 'it' },
  // Portuguese
  { pattern: /\bportuguese\s+(?:edition|version)\b/i, language: 'pt' },
  { pattern: /\bedição\s+portuguesa\b/i, language: 'pt' },
  // Korean
  { pattern: /\bkorean\s+(?:edition|version)\b/i, language: 'ko' },
  // Chinese
  { pattern: /\bchinese\s+(?:edition|version)\b/i, language: 'zh' },
  // Bracketed language tags (e.g., "[FR]", "[JP]")
  { pattern: /\[FR\]|\(FR\)/i, language: 'fr' },
  { pattern: /\[JP\]|\(JP\)/i, language: 'ja' },
  { pattern: /\[DE\]|\(DE\)/i, language: 'de' },
  { pattern: /\[ES\]|\(ES\)/i, language: 'es' },
  { pattern: /\[IT\]|\(IT\)/i, language: 'it' },
];

/**
 * Detect language from explicit edition markers in the volume name.
 *
 * This is the strongest non-script signal because edition markers like
 * "(French Edition)" or "Edición Española" only appear on intentional
 * translated reprints. Confidence is intentionally higher than the
 * generic title indicator check.
 */
export function detectFromVolumeName(volumeName: string): DetectionMethodResult {
  if (!volumeName || volumeName.length === 0) {
    return {
      match: false,
      confidence: 0,
      reason: 'No volume name provided for edition marker detection',
    };
  }

  for (const marker of VOLUME_NAME_EDITION_MARKERS) {
    if (marker.pattern.test(volumeName)) {
      return {
        match: true,
        language: marker.language,
        confidence: 0.97,
        reason: `Volume name contains edition marker for ${marker.language.toUpperCase()}`,
      };
    }
  }

  return {
    match: false,
    confidence: 0,
    reason: 'No edition markers found in volume name',
  };
}

/**
 * Create result when no content matches found
 */
function createNoContentMatchResult(): ContentDetectionResult {
  return {
    detectedLanguage: 'en',
    confidence: 0.1,
    reasons: ['No content-based language indicators detected, defaulting to English'],
  };
}

/**
 * Create result when single content match found
 */
function createSingleContentMatchResult(match: DetectionMethodResult): ContentDetectionResult {
  return {
    detectedLanguage: match.language ?? 'en',
    confidence: match.confidence,
    reasons: [match.reason],
  };
}

/**
 * Create result when multiple content matches agree.
 *
 * Uses noisy-OR aggregation: each agreeing detection independently confirms
 * the language, so combined confidence is `1 - Π(1 - cᵢ)`. This rewards
 * agreement instead of penalizing strong signals by averaging them with
 * weak ones (the previous behavior averaged publisher 0.8 with script 0.3
 * to 0.55, which made canonical Viz editions tie with miscategorized ones).
 *
 * Capped at 0.98 to leave headroom for explicit edition-marker overrides.
 */
function createAgreeingContentMatchesResult(matches: DetectionMethodResult[]): ContentDetectionResult {
  const language = matches[0]?.language ?? 'en';
  const noisyOr = matches.reduce((acc, m) => acc * (1 - m.confidence), 1);
  const combinedConfidence = Math.min(0.98, 1 - noisyOr);

  return {
    detectedLanguage: language,
    confidence: combinedConfidence,
    reasons: matches.map((m) => m.reason),
  };
}

/**
 * Create result when content matches conflict
 */
function createConflictingContentMatchesResult(matches: DetectionMethodResult[]): ContentDetectionResult {
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

/** Confidence floor above which a publisher detection is considered authoritative. */
const AUTHORITATIVE_PUBLISHER_CONFIDENCE = 0.8;

/**
 * Combined content detection function
 * Checks publisher, script, title indicator, and (optionally) volume name edition markers.
 *
 * Signal priority (highest first):
 *   1. Volume name edition marker (e.g., "(French Edition)") — 0.97
 *   2. Title indicator (e.g., "(JP)") — 0.95
 *   3. Publisher list match — 0.8 (treated as AUTHORITATIVE: when found,
 *      script detection is folded in only if it agrees, never as a conflict)
 *   4. Script pattern match — 0.6 / 0.3 (lowest because script regexes
 *      are imprecise: French/German Latin patterns also match plain English)
 *
 * @param publisher - Publisher name as returned by ComicVine
 * @param title - Title or description text used for script + indicator checks
 * @param description - Optional description for script detection
 * @param volumeName - Optional volume name for explicit edition marker detection
 *                    (e.g., "One Piece (French Edition)"). When provided, this is
 *                    the highest-confidence signal.
 */
/**
 * High-confidence early-return chain. Volume-name marker > title indicator >
 * description self-identification clause. Each returns at 0.95+ confidence and
 * is decisive enough to skip the publisher + script aggregation below. Pulled
 * out of detectFromContent to keep that function under the complexity cap.
 */
function detectFromHighConfidenceMarkers(
  title: string,
  description?: string,
  volumeName?: string,
): ContentDetectionResult | null {
  if (volumeName) {
    const editionMarker = detectFromVolumeName(volumeName);
    if (editionMarker.match && editionMarker.language) {
      return createSingleContentMatchResult(editionMarker);
    }
  }
  const titleIndicator = detectFromTitleIndicator(title);
  if (titleIndicator.match && titleIndicator.language) {
    return createSingleContentMatchResult(titleIndicator);
  }
  if (description) {
    const editionClause = detectFromDescriptionEditionClause(description);
    if (editionClause.match && editionClause.language) {
      return createSingleContentMatchResult(editionClause);
    }
  }
  return null;
}

export function detectFromContent(
  publisher: string,
  title: string,
  description?: string,
  volumeName?: string
): ContentDetectionResult {
  // 1. High-confidence markers (volume-name / title indicator / description
  //    self-identification) win outright. Description override is what catches
  //    the Kaiju 79 → 148344 case: "Polish edition of …" in English text
  //    would otherwise script-fallback to English at 0.3 confidence.
  const earlyReturn = detectFromHighConfidenceMarkers(title, description, volumeName);
  if (earlyReturn) return earlyReturn;

  const publisherResult = detectFromPublisher(publisher);
  const scriptResult = detectFromScript(title + (description ?? ''));

  // When the publisher is authoritative (in a known list), trust it.
  // Script detection only adds a confidence boost if it agrees.
  if (publisherResult.match && publisherResult.confidence >= AUTHORITATIVE_PUBLISHER_CONFIDENCE) {
    if (scriptResult.match && scriptResult.language === publisherResult.language) {
      return createAgreeingContentMatchesResult([publisherResult, scriptResult]);
    }
    // Script disagrees or didn't match — ignore it. Publisher is authoritative.
    return createSingleContentMatchResult(publisherResult);
  }

  // No authoritative publisher — fall back to standard match aggregation.
  const results: DetectionMethodResult[] = [];
  if (publisherResult.match && publisherResult.language) results.push(publisherResult);
  if (scriptResult.match && scriptResult.language) results.push(scriptResult);

  const matches = results.filter((r) => r.match && r.language);
  if (matches.length === 0) return createNoContentMatchResult();
  if (matches.length === 1) {
    return createSingleContentMatchResult(matches[0] ?? { confidence: 0, language: 'en', reason: '', match: false });
  }
  const languages = new Set(matches.map((m) => m.language));
  if (languages.size === 1) return createAgreeingContentMatchesResult(matches);
  return createConflictingContentMatchesResult(matches);
}
