/**
 * Identifier Validation Rules
 *
 * Validation rules for ISBN, volume numbers, and chapter numbers.
 */

import type { EntityValidationRule, ValidationContext, ValidationResult } from '../types';

// ============================================================================
// ISBN Validation Helpers
// ============================================================================

function createInvalidISBNResult(text: string, format: string): ValidationResult {
  return {
    isValid: false,
    confidence: 0.9,
    issue: {
      type: 'impossible_value',
      severity: 'error',
      message: `Invalid ${format} format: ${text}`,
      relatedEntity: 'ISBN',
    },
  };
}

function validateISBN10(cleanISBN: string, originalText: string): ValidationResult {
  const isValidFormat = /^\d{9}[\dX]$/.test(cleanISBN);
  if (!isValidFormat) {
    return createInvalidISBNResult(originalText, 'ISBN-10');
  }
  return { isValid: true, confidence: 0.95 };
}

function validateISBN13(cleanISBN: string, originalText: string): ValidationResult {
  const isValidFormat = /^97[89]\d{10}$/.test(cleanISBN);
  if (!isValidFormat) {
    return createInvalidISBNResult(originalText, 'ISBN-13');
  }
  return { isValid: true, confidence: 0.95 };
}

function validateISBN(text: string, _ctx: ValidationContext): ValidationResult {
  const cleanISBN = text.replace(/[-\s]/g, '');

  if (cleanISBN.length === 10) {
    return validateISBN10(cleanISBN, text);
  }

  if (cleanISBN.length === 13) {
    return validateISBN13(cleanISBN, text);
  }

  return {
    isValid: false,
    confidence: 0.8,
    issue: {
      type: 'impossible_value',
      severity: 'warning',
      message: `ISBN "${text}" has unusual length (${cleanISBN.length} digits)`,
      relatedEntity: 'ISBN',
    },
  };
}

// ============================================================================
// ISBN Rules
// ============================================================================

export const ISBN_RULES: EntityValidationRule = {
  entityType: 'ISBN',
  minLength: 10,
  maxLength: 17,
  validPatterns: [
    /^97[89][- ]?\d{1,5}[- ]?\d{1,7}[- ]?\d{1,7}[- ]?\d$/,  // ISBN-13
    /^\d{1,5}[- ]?\d{1,7}[- ]?\d{1,7}[- ]?[\dX]$/,          // ISBN-10
  ],
  customValidator: validateISBN,
};

// ============================================================================
// Volume Number Rules
// ============================================================================

function validateVolumeNumber(text: string, _ctx: ValidationContext): ValidationResult {
  const numMatch = text.match(/\d+/);
  if (!numMatch) {
    return {
      isValid: false,
      confidence: 0.9,
      issue: {
        type: 'impossible_value',
        severity: 'error',
        message: `Volume number "${text}" contains no number`,
        relatedEntity: 'VOLUME_NUMBER',
      },
    };
  }

  const numValue = parseInt(numMatch[0], 10);
  if (numValue > 500) {
    return {
      isValid: false,
      confidence: 0.7,
      issue: {
        type: 'impossible_value',
        severity: 'warning',
        message: `Volume number ${numValue} seems unusually high`,
        relatedEntity: 'VOLUME_NUMBER',
      },
    };
  }

  return { isValid: true, confidence: 0.9 };
}

export const VOLUME_NUMBER_RULES: EntityValidationRule = {
  entityType: 'VOLUME_NUMBER',
  minValue: 0,
  maxValue: 500,
  validPageTypes: ['INDIVIDUAL_VOLUME', 'VOLUME_OVERVIEW'],
  validPatterns: [/^(vol\.?|volume)\s*\d+$/i, /^\d+$/],
  customValidator: validateVolumeNumber,
};

// ============================================================================
// Chapter Number Rules
// ============================================================================

function validateChapterNumber(text: string, _ctx: ValidationContext): ValidationResult {
  const numMatch = text.match(/\d+(\.\d+)?/);
  if (!numMatch) {
    return {
      isValid: false,
      confidence: 0.9,
      issue: {
        type: 'impossible_value',
        severity: 'error',
        message: `Chapter number "${text}" contains no number`,
        relatedEntity: 'CHAPTER_NUMBER',
      },
    };
  }

  return { isValid: true, confidence: 0.9 };
}

export const CHAPTER_NUMBER_RULES: EntityValidationRule = {
  entityType: 'CHAPTER_NUMBER',
  minValue: 0,
  maxValue: 2000,
  validPageTypes: ['INDIVIDUAL_CHAPTER', 'CHAPTER_OVERVIEW'],
  validPatterns: [/^(ch\.?|chapter)\s*\d+(\.\d+)?$/i, /^\d+(\.\d+)?$/],
  customValidator: validateChapterNumber,
};
