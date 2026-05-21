/**
 * Pattern Learning Utilities
 *
 * Extracted helper functions from usePatternLearning hook for better modularity.
 */

import { notify } from '@/utils/notify';

import { isString } from '../utils/type-guards';

export interface ExtractedData {
  title?: string;
  description?: string;
  author?: string[];
  chapters?: number;
  volumes?: number;
  status?: string;
  [key: string]: unknown;
}

export interface PatternSuggestion {
  field: string;
  suggestedValue: unknown;
  confidence: number;
  reason: string;
}

/**
 * Get AI suggestions for corrections
 * @param data - The extracted data to get suggestions for
 * @param url - The URL the data was extracted from
 * @returns Promise resolving to array of pattern suggestions
 */
export const getSuggestions = async (
  data: ExtractedData,
  url: string
): Promise<PatternSuggestion[]> => {
  try {
    const response = await fetch('/api/pattern-recognition/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, url })
    });

    if (!response.ok) {
      throw new Error('Failed to get suggestions');
    }

    const suggestions: unknown = await response.json();
    if (Array.isArray(suggestions)) {
      return suggestions as PatternSuggestion[];
    }
    return [];
  } catch (error: unknown) {
    console.error('Error getting suggestions:', error);
    return [];
  }
};

/**
 * Validate corrections before submission
 * @param original - Original extracted data
 * @param corrected - Corrected data to validate
 * @returns Validation result with isValid flag and error messages
 */
export const validateCorrections = (
  original: ExtractedData,
  corrected: ExtractedData
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check for required fields
  if (!corrected['title'] || (isString(corrected['title']) && corrected['title'].trim().length === 0)) {
    errors.push('Title is required');
  }

  // Validate numeric fields
  if (typeof corrected['chapters'] === 'number' && corrected['chapters'] < 0) {
    errors.push('Chapters must be positive');
  }
  if (typeof corrected.volumes === 'number' && corrected.volumes < 0) {
    errors.push('Volumes must be positive');
  }

  // Check for meaningful corrections
  const hasChanges = Object.keys(corrected).some(
    (key) => JSON.stringify(corrected[key]) !== JSON.stringify(original[key])
  );
  if (!hasChanges) {
    errors.push('No corrections were made');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Get correction history for a URL
 * @param url - The URL to get correction history for
 * @returns Promise resolving to correction history data
 */
export const getCorrectionHistory = async (url: string): Promise<unknown> => {
  try {
    const response = await fetch(
      `/api/pattern-recognition/corrections/history?url=${encodeURIComponent(url)}`
    );
    const data: unknown = await response.json();
    return data;
  } catch (error: unknown) {
    console.error('Error fetching correction history:', error);
    return Promise.resolve([]);
  }
};

/**
 * Export corrections for review
 * @returns Promise that resolves when export is complete
 */
export const exportCorrections = async (): Promise<void> => {
  try {
    const response = await fetch('/api/pattern-recognition/corrections/export');
    const blob = await response.blob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corrections_${new Date().toISOString()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  } catch (error: unknown) {
    console.error('Error exporting corrections:', error);
    notify({ severity: 'ERROR', title: 'Export Failed', message: 'Failed to export corrections' });
  }
};