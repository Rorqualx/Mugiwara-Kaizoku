/**
 * Validation utilities for ComicVine API key
 */

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Validate ComicVine API key. ComicVine keys are 40-char lowercase hex
 * (the exact format documented at comicvine.gamespot.com/api/).
 */
const COMICVINE_KEY_PATTERN = /^[a-f0-9]{40}$/i;

export function validateApiKey(apiKey: string): ValidationResult {
  const trimmed = apiKey.trim();
  if (trimmed === '') {
    return { isValid: false, error: 'API key is required' };
  }
  if (!COMICVINE_KEY_PATTERN.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid API key format — expected 40 hex characters',
    };
  }
  return { isValid: true, error: null };
}
