/**
 * Error Classifier
 *
 * Classifies labeling failures into categories for analysis and improvement.
 * Provides suggestions for fixing common error patterns.
 *
 * @module auto-labeling/error-classifier
 */

import { ErrorCategory, type FailureDetails, type LabelingAttempt } from './types';

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Classify a failure based on attempt details.
 */
export function classifyFailure(
  attempt: LabelingAttempt,
  errorMessage?: string
): FailureDetails {
  // Check for fetch/HTTP errors
  if (isFetchError(errorMessage)) {
    return createFailureDetails(ErrorCategory.FETCH_ERROR, errorMessage ?? 'Network error');
  }

  // Check for ground truth errors
  if (isGroundTruthError(attempt)) {
    return createFailureDetails(ErrorCategory.GROUND_TRUTH_ERROR, 'Failed to fetch AniList metadata');
  }

  // Check for timeout
  if (isTimeoutError(errorMessage)) {
    return createFailureDetails(ErrorCategory.TIMEOUT, errorMessage ?? 'Operation timed out');
  }

  // Check for parse errors
  if (isParseError(errorMessage)) {
    return createFailureDetails(ErrorCategory.PARSE_ERROR, errorMessage ?? 'HTML parsing failed');
  }

  // Analyze based on results
  if (attempt.staticAnalysis) {
    return classifyFromStaticAnalysis(attempt);
  }

  if (attempt.parserResult) {
    return classifyFromParserResult(attempt);
  }

  if (attempt.bootstrapResult) {
    return classifyFromBootstrapResult(attempt);
  }

  // Unknown error
  return createFailureDetails(
    ErrorCategory.UNKNOWN,
    errorMessage ?? 'Unknown error occurred'
  );
}

/**
 * Create failure details with suggestion.
 */
function createFailureDetails(
  category: ErrorCategory,
  message: string,
  extras?: Partial<FailureDetails>
): FailureDetails {
  return {
    category,
    message,
    suggestion: getSuggestionForCategory(category),
    ...extras,
  };
}

// ============================================================================
// Error Detection Helpers
// ============================================================================

function isFetchError(message?: string): boolean {
  if (!message) return false;
  const patterns = ['fetch', 'network', 'ECONNREFUSED', 'ETIMEDOUT', '404', '500', '503'];
  const lowerMessage = message.toLowerCase();
  return patterns.some(p => lowerMessage.includes(p.toLowerCase()));
}

function isGroundTruthError(attempt: LabelingAttempt): boolean {
  return attempt.expectedEntities.length === 0 && attempt.extractedEntities.length > 0;
}

function isTimeoutError(message?: string): boolean {
  if (!message) return false;
  return message.toLowerCase().includes('timeout') || message.includes('ETIMEDOUT');
}

function isParseError(message?: string): boolean {
  if (!message) return false;
  const patterns = ['parse', 'cheerio', 'DOM', 'invalid html'];
  const lowerMessage = message.toLowerCase();
  return patterns.some(p => lowerMessage.includes(p.toLowerCase()));
}

// ============================================================================
// Result-Based Classification
// ============================================================================

/**
 * Classify from static analysis results.
 */
function classifyFromStaticAnalysis(attempt: LabelingAttempt): FailureDetails {
  const analysis = attempt.staticAnalysis;
  if (!analysis) {
    return createFailureDetails(ErrorCategory.UNKNOWN, 'No static analysis available');
  }

  // Check if structure was detected
  const hasStructure = analysis.tables.totalCount > 0 ||
    analysis.lists.totalCount > 0 ||
    analysis.headers.h2Count + analysis.headers.h3Count > 0;

  if (!hasStructure) {
    return createFailureDetails(
      ErrorCategory.NO_CONTENT,
      'Page has no extractable structure (no tables, lists, or headers)'
    );
  }

  // Structure detected but low confidence
  if (analysis.recommendedParser.confidence < 0.5) {
    return createFailureDetails(
      ErrorCategory.STRUCTURE_NOT_RECOGNIZED,
      `Structure detected but confidence too low (${(analysis.recommendedParser.confidence * 100).toFixed(0)}%)`,
      {
        recommendedParser: analysis.recommendedParser.primary,
        confidenceLevel: analysis.recommendedParser.confidence,
      }
    );
  }

  // Check if entities were extracted - if so, it's a matching issue, not parser failure
  const extractedCount = attempt.extractedEntities.length;
  const metrics = attempt.metrics;

  if (extractedCount > 0 && metrics) {
    // Entities were extracted but F1 is low - this is a matching/accuracy issue
    if (metrics.f1 > 0 && metrics.f1 < 0.5) {
      return createFailureDetails(
        ErrorCategory.PATTERN_MISMATCH,
        `Extracted ${extractedCount} entities but F1 too low (${(metrics.f1 * 100).toFixed(0)}% < 50%). TP=${metrics.truePositives}, FP=${metrics.falsePositives}, FN=${metrics.falseNegatives}`,
        {
          selectedParser: analysis.recommendedParser.primary,
          confidenceLevel: metrics.f1,
        }
      );
    }
  }

  // Parser was recommended but extraction failed
  return createFailureDetails(
    ErrorCategory.PARSER_SELECTION_FAILED,
    `Parser ${analysis.recommendedParser.primary} was recommended but extraction failed`,
    {
      selectedParser: analysis.recommendedParser.primary,
      recommendedParser: analysis.recommendedParser.primary,
    }
  );
}

/**
 * Classify from parser results.
 */
function classifyFromParserResult(attempt: LabelingAttempt): FailureDetails {
  const result = attempt.parserResult;
  if (!result) {
    return createFailureDetails(ErrorCategory.UNKNOWN, 'No parser result available');
  }

  if (!result.success) {
    const extras: Partial<FailureDetails> = { confidenceLevel: result.confidence };
    if (result.structureType) {
      extras.selectedParser = result.structureType;
    }
    return createFailureDetails(
      ErrorCategory.ENTITY_EXTRACTION_FAILED,
      result.error ?? 'Parser extraction failed',
      extras
    );
  }

  // Parser succeeded but entities didn't match
  if (result.confidence < 0.5) {
    return createFailureDetails(
      ErrorCategory.CONFIDENCE_TOO_LOW,
      `Parser confidence too low (${(result.confidence * 100).toFixed(0)}%)`,
      { confidenceLevel: result.confidence }
    );
  }

  // Check if any data was extracted
  const data = result.data;
  if (!data || (!data.volumeList?.length && !data.chapterList?.length)) {
    return createFailureDetails(
      ErrorCategory.ENTITY_EXTRACTION_FAILED,
      'Parser succeeded but no volume/chapter data extracted'
    );
  }

  return createFailureDetails(
    ErrorCategory.PATTERN_MISMATCH,
    'Data extracted but did not match expected entities'
  );
}

/**
 * Classify from bootstrap labeler results.
 */
function classifyFromBootstrapResult(attempt: LabelingAttempt): FailureDetails {
  const result = attempt.bootstrapResult;
  if (!result) {
    return createFailureDetails(ErrorCategory.UNKNOWN, 'No bootstrap result available');
  }

  // Check if any spans were found
  if (result.spans.length === 0) {
    return createFailureDetails(
      ErrorCategory.PATTERN_MISMATCH,
      'Bootstrap labeler found no entity spans'
    );
  }

  // Check confidence
  if (result.confidence < 0.5) {
    return createFailureDetails(
      ErrorCategory.CONFIDENCE_TOO_LOW,
      `Bootstrap confidence too low (${(result.confidence * 100).toFixed(0)}%)`,
      { confidenceLevel: result.confidence }
    );
  }

  return createFailureDetails(
    ErrorCategory.ENTITY_EXTRACTION_FAILED,
    'Bootstrap labeler found spans but extraction did not match expected'
  );
}

// ============================================================================
// Suggestions
// ============================================================================

/**
 * Get improvement suggestion for an error category.
 */
function getSuggestionForCategory(category: ErrorCategory): string {
  switch (category) {
    case ErrorCategory.PARSER_SELECTION_FAILED:
      return 'Review parser selection logic. Consider adding a new parser pattern for this page structure.';
    case ErrorCategory.STRUCTURE_NOT_RECOGNIZED:
      return 'Add new structure detection patterns to static analyzer for this page layout.';
    case ErrorCategory.ENTITY_EXTRACTION_FAILED:
      return 'Review extraction selectors. The structure may have changed or use non-standard markup.';
    case ErrorCategory.PATTERN_MISMATCH:
      return 'Add label mappings to pattern detector for this content format.';
    case ErrorCategory.CONFIDENCE_TOO_LOW:
      return 'Review confidence thresholds or add more pattern signals for this entity type.';
    case ErrorCategory.FETCH_ERROR:
      return 'Check URL validity and network connectivity. Consider adding retry logic.';
    case ErrorCategory.GROUND_TRUTH_ERROR:
      return 'Verify AniList ID is correct. The manga may not exist in AniList database.';
    case ErrorCategory.PARSE_ERROR:
      return 'Review HTML structure. The page may have invalid HTML or require special handling.';
    case ErrorCategory.NO_CONTENT:
      return 'This page may not contain extractable content. Consider filtering it from training data.';
    case ErrorCategory.TIMEOUT:
      return 'Increase timeout or optimize processing. Consider breaking into smaller chunks.';
    case ErrorCategory.UNKNOWN:
    default:
      return 'Review error logs for more details. Add specific error handling for this case.';
  }
}

/**
 * Get detailed fix suggestion based on failure details.
 */
export function suggestFix(failure: FailureDetails): string {
  const baseSuggestion = failure.suggestion ?? getSuggestionForCategory(failure.category);

  const details: string[] = [baseSuggestion];

  if (failure.selectedParser && failure.recommendedParser) {
    if (failure.selectedParser !== failure.recommendedParser) {
      details.push(`Selected parser: ${failure.selectedParser}, but recommended: ${failure.recommendedParser}`);
    }
  }

  if (failure.failedPatterns && failure.failedPatterns.length > 0) {
    details.push(`Failed patterns: ${failure.failedPatterns.join(', ')}`);
  }

  if (failure.confidenceLevel !== undefined) {
    details.push(`Confidence: ${(failure.confidenceLevel * 100).toFixed(0)}%`);
  }

  return details.join('\n');
}

// ============================================================================
// Batch Analysis
// ============================================================================

/**
 * Analyze failures across multiple attempts.
 */
export function analyzeFailures(attempts: LabelingAttempt[]): {
  byCategory: Record<ErrorCategory, number>;
  topPatterns: Array<{ pattern: string; count: number }>;
  suggestions: string[];
} {
  const failedAttempts = attempts.filter(a => !a.success);
  const byCategory = countByCategory(failedAttempts);
  const topPatterns = findTopPatterns(failedAttempts);
  const suggestions = generateSuggestions(byCategory);

  return { byCategory, topPatterns, suggestions };
}

/**
 * Count failures by category.
 */
function countByCategory(attempts: LabelingAttempt[]): Record<ErrorCategory, number> {
  const counts = Object.fromEntries(
    Object.values(ErrorCategory).map(cat => [cat, 0])
  ) as Record<ErrorCategory, number>;

  for (const attempt of attempts) {
    const category = attempt.errorCategory ?? ErrorCategory.UNKNOWN;
    counts[category]++;
  }

  return counts;
}

/**
 * Find top failure patterns.
 */
function findTopPatterns(attempts: LabelingAttempt[]): Array<{ pattern: string; count: number }> {
  const patterns = new Map<string, number>();

  for (const attempt of attempts) {
    const key = getPatternKey(attempt);
    patterns.set(key, (patterns.get(key) ?? 0) + 1);
  }

  return Array.from(patterns.entries())
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Get pattern key for an attempt.
 */
function getPatternKey(attempt: LabelingAttempt): string {
  const category = attempt.errorCategory ?? ErrorCategory.UNKNOWN;
  const source = attempt.page.source;
  const urlType = attempt.page.urlType;

  return `${category}:${source}:${urlType}`;
}

/**
 * Generate suggestions based on category counts.
 */
function generateSuggestions(byCategory: Record<ErrorCategory, number>): string[] {
  const suggestions: string[] = [];

  const sortedCategories = Object.entries(byCategory)
    .filter(([_, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  for (const [category, count] of sortedCategories) {
    if (count > 0) {
      const suggestion = getSuggestionForCategory(category as ErrorCategory);
      suggestions.push(`[${count} errors] ${category}: ${suggestion}`);
    }
  }

  return suggestions;
}
