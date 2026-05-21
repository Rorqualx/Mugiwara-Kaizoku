/**
 * Pattern Learning Helpers Module
 *
 * Utility functions and business logic for pattern learning operations.
 *
 * Extracted from: usePatternLearning.ts (lines 501-600)
 */

import { ExtractedData, PatternSuggestion, validateCorrections } from './utils';

// ============================================================================
// Pattern Matching and Scoring
// ============================================================================

/**
 * Calculate confidence score for pattern suggestions
 */
export function calculateConfidenceScore(
  suggestions: PatternSuggestion[],
  userCorrections: Record<string, unknown>
): number {
  if (suggestions.length === 0) return 0;

  let totalScore = 0;
  let validSuggestions = 0;

  for (const suggestion of suggestions) {
    const userValue = userCorrections[suggestion.field];
    
    if (userValue !== undefined) {
      const matchScore = calculateFieldMatchScore(suggestion.suggestedValue, userValue);
      const weightedScore = matchScore * suggestion.confidence;
      totalScore += weightedScore;
      validSuggestions++;
    }
  }

  return validSuggestions > 0 ? totalScore / validSuggestions : 0;
}

/**
 * Calculate match score between suggested and user values
 */
export function calculateFieldMatchScore(
  suggestedValue: unknown,
  userValue: unknown
): number {
  // Exact match
  if (suggestedValue === userValue) return 1.0;

  // String comparison with normalization
  if (typeof suggestedValue === 'string' && typeof userValue === 'string') {
    const normalizedSuggested = suggestedValue.trim().toLowerCase();
    const normalizedUser = userValue.trim().toLowerCase();
    
    if (normalizedSuggested === normalizedUser) return 1.0;
    if (normalizedSuggested.includes(normalizedUser) || normalizedUser.includes(normalizedSuggested)) {
      return 0.8;
    }
  }

  // Numeric comparison with tolerance
  if (typeof suggestedValue === 'number' && typeof userValue === 'number') {
    const difference = Math.abs(suggestedValue - userValue);
    const tolerance = Math.max(1, suggestedValue * 0.1); // 10% tolerance
    if (difference <= tolerance) return 0.9;
  }

  // Array comparison
  if (Array.isArray(suggestedValue) && Array.isArray(userValue)) {
    // Type-safe array operations
    const intersection = suggestedValue.filter(item =>
      userValue.includes(item)
    ).length;
    // Create union with explicit type casting
    const unionArray = [...suggestedValue as unknown[], ...userValue as unknown[]];
    const union = new Set(unionArray).size;
    return union > 0 ? intersection / union : 0;
  }

  // Default low score for partial matches
  return 0.3;
}

/**
 * Filter suggestions by confidence threshold
 */
export function filterSuggestionsByConfidence(
  suggestions: PatternSuggestion[],
  minConfidence: number = 0.7
): PatternSuggestion[] {
  return suggestions.filter(suggestion => suggestion.confidence >= minConfidence);
}

/**
 * Group suggestions by field
 */
export function groupSuggestionsByField(
  suggestions: PatternSuggestion[]
): Record<string, PatternSuggestion[]> {
  return suggestions.reduce((groups, suggestion) => {
    const field = suggestion.field;
    const existing = groups[field] ?? [];
    return {
      ...groups,
      [field]: [...existing, suggestion]
    };
  }, {} as Record<string, PatternSuggestion[]>);
}

// ============================================================================
// Data Processing and Transformation
// ============================================================================

/**
 * Merge extracted data with corrections
 */
export function mergeDataWithCorrections(
  originalData: ExtractedData,
  corrections: Record<string, unknown>
): ExtractedData {
  const merged = { ...originalData };

  for (const [field, value] of Object.entries(corrections)) {
    if (value !== undefined && value !== null) {
      merged[field] = value;
    }
  }

  return merged;
}

/**
 * Extract field values for pattern analysis
 */
export function extractFieldValuesForAnalysis(
  data: ExtractedData,
  fields: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    if (field in data) {
      result[field] = data[field];
    }
  }

  return result;
}

/**
 * Normalize field values for comparison
 */
export function normalizeFieldValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }
  
  if (Array.isArray(value)) {
    const normalizedArray = value.map((item: unknown): unknown => {
      if (typeof item === 'string') {
        return item.trim().toLowerCase();
      }
      return item;
    });
    return normalizedArray;
  }

  return value;
}

// ============================================================================
// Validation and Error Handling
// ============================================================================

/**
 * Validate pattern learning configuration
 */
export function validatePatternLearningConfig(config: unknown): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be an object');
    return { isValid: false, errors };
  }

  const configObj = config as Record<string, unknown>;

  // Validate required fields
  if (typeof configObj['enabled'] !== 'boolean') {
    errors.push('Enabled field must be a boolean');
  }

  if (typeof configObj['minConfidence'] !== 'number' || configObj['minConfidence'] < 0 || configObj['minConfidence'] > 1) {
    errors.push('Minimum confidence must be a number between 0 and 1');
  }

  if (typeof configObj['maxSuggestions'] !== 'number' || configObj['maxSuggestions'] < 1) {
    errors.push('Maximum suggestions must be a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate corrections with enhanced error messages
 */
export function validateCorrectionsWithDetails(
  original: ExtractedData,
  corrected: ExtractedData
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
} {
  const { isValid, errors } = validateCorrections(original, corrected);
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check for potential issues
  if (typeof corrected.chapters === 'number' && corrected.chapters > 1000) {
    warnings.push('High chapter count detected - please verify accuracy');
  }

  if (typeof corrected.volumes === 'number' && corrected.volumes > 100) {
    warnings.push('High volume count detected - please verify accuracy');
  }

  // Check for missing important fields
  const importantFields = ['title', 'author', 'status'];
  for (const field of importantFields) {
    const fieldValue = corrected[field];
    if (!fieldValue || (typeof fieldValue === 'string' && fieldValue.trim().length === 0)) {
      suggestions.push(`Consider providing a value for ${field}`);
    }
  }

  // Check for data consistency
  if (typeof corrected.chapters === 'number' && typeof corrected.volumes === 'number') {
    if (corrected.chapters > 0 && corrected.volumes === 0) {
      suggestions.push('Consider adding volume information for better organization');
    }
  }

  return {
    isValid,
    errors,
    warnings,
    suggestions
  };
}

// ============================================================================
// Performance and Optimization
// ============================================================================

/**
 * Debounce function for pattern learning operations
 */
export function createDebouncedFunction<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

/**
 * Batch processing for multiple corrections
 */
export function batchProcessCorrections(
  corrections: Array<{ original: ExtractedData; corrected: ExtractedData }>,
  batchSize: number = 10
): Array<{ original: ExtractedData; corrected: ExtractedData; validation: ReturnType<typeof validateCorrections> }> {
  const results = [];

  for (let i = 0; i < corrections.length; i += batchSize) {
    const batch = corrections.slice(i, i + batchSize);
    
    for (const { original, corrected } of batch) {
      const validation = validateCorrections(original, corrected);
      results.push({ original, corrected, validation });
    }
  }

  return results;
}

/**
 * Optimize pattern learning data for storage
 */
export function optimizePatternData(data: unknown): unknown {
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const optimized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Remove undefined and null values
      if (value !== undefined && value !== null) {
        // Recursively optimize nested objects
        optimized[key] = optimizePatternData(value);
      }
    }

    return optimized;
  }

  return data;
}

// ============================================================================
// Export Helpers
// ============================================================================

/**
 * Format pattern learning data for export
 */
export function formatPatternDataForExport(
  data: unknown,
  format: 'json' | 'csv' = 'json'
): string {
  const optimized = optimizePatternData(data);

  if (format === 'json') {
    return JSON.stringify(optimized, null, 2);
  }

  // Basic CSV formatting for simple objects
  if (typeof optimized === 'object' && optimized !== null) {
    const obj = optimized as Record<string, unknown>;
    const headers = Object.keys(obj).join(',');
    const values = Object.values(obj).map(value => 
      typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
    ).join(',');
    
    return `${headers}\n${values}`;
  }

  return String(optimized);
}

/**
 * Parse imported pattern learning data
 */
export function parseImportedPatternData(data: string): unknown {
  try {
    // Try JSON first
    return JSON.parse(data);
  } catch {
    // Fall back to basic string parsing
    return data;
  }
}
