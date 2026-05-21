/**
 * Metadata Entity Validation Rules
 *
 * Validation rules for PUBLISHER, DEMOGRAPHIC, MAGAZINE, RELEASE_DATE, STATUS, and FORMAT entities.
 */

import type { EntityValidationRule, ValidationContext, ValidationResult } from '@/server/ml/training/agent-review/types';

import {
  NAVIGATION_PATTERNS,
  PLACEHOLDER_PATTERNS,
  PUBLISHER_CONTEXT_LABELS,
  DEMOGRAPHIC_CONTEXT_LABELS,
  MAGAZINE_CONTEXT_LABELS,
  RELEASE_DATE_CONTEXT_LABELS,
  VALID_DEMOGRAPHICS,
  KNOWN_PUBLISHERS,
  VALID_STATUS_VALUES,
  VALID_FORMAT_VALUES,
  UI_NAVIGATION_PATTERNS,
} from '../patterns';

// ============================================================================
// Publisher Rules
// ============================================================================

export const PUBLISHER_RULES: EntityValidationRule = {
  entityType: 'PUBLISHER',
  minLength: 2,
  maxLength: 100,
  invalidPatterns: [
    ...NAVIGATION_PATTERNS,
    ...PLACEHOLDER_PATTERNS,
    ...UI_NAVIGATION_PATTERNS,
  ],
  requirePatternContext: true,
  validPageTypes: ['SERIES_PAGE', 'MANGA_PAGE', 'VOLUME_OVERVIEW', 'INDIVIDUAL_VOLUME'],
  customValidator: validatePublisher,
};

function validatePublisher(text: string, ctx: ValidationContext): ValidationResult {
  const normalizedText = text.toLowerCase().trim();

  // Check for UI navigation patterns (high priority rejection)
  if (UI_NAVIGATION_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    return {
      isValid: false,
      confidence: 0.95,
      issue: {
        type: 'navigation_as_content',
        severity: 'error',
        message: `Publisher "${text}" is UI navigation text`,
        relatedEntity: 'PUBLISHER',
      },
    };
  }

  // Boost confidence for known publishers
  const isKnownPublisher = KNOWN_PUBLISHERS.some((pub) => normalizedText.includes(pub));

  if (isKnownPublisher) {
    return { isValid: true, confidence: 0.95 };
  }

  // Check for context
  const hasContext = PUBLISHER_CONTEXT_LABELS.some(
    (label) => ctx.precedingText?.toLowerCase().includes(label)
  );

  if (!hasContext && ctx.sourceType === 'FANDOM') {
    return {
      isValid: false,
      confidence: 0.7,
      issue: {
        type: 'low_confidence_span',
        severity: 'warning',
        message: `Publisher "${text}" not preceded by publisher label`,
        relatedEntity: 'PUBLISHER',
      },
    };
  }

  return { isValid: true, confidence: 0.85 };
}

// ============================================================================
// Demographic Rules
// ============================================================================

export const DEMOGRAPHIC_RULES: EntityValidationRule = {
  entityType: 'DEMOGRAPHIC',
  minLength: 3,
  maxLength: 30,
  invalidPatterns: [
    ...NAVIGATION_PATTERNS,
    ...PLACEHOLDER_PATTERNS,
    ...UI_NAVIGATION_PATTERNS,
  ],
  validPageTypes: ['SERIES_PAGE', 'MANGA_PAGE'],
  customValidator: validateDemographic,
};

function validateDemographic(text: string, ctx: ValidationContext): ValidationResult {
  const normalizedText = text.toLowerCase().trim();

  // Check for UI navigation patterns
  if (UI_NAVIGATION_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    return {
      isValid: false,
      confidence: 0.95,
      issue: {
        type: 'navigation_as_content',
        severity: 'error',
        message: `Demographic "${text}" is UI navigation text`,
        relatedEntity: 'DEMOGRAPHIC',
      },
    };
  }

  // Validate against known demographics
  const isValidDemographic = VALID_DEMOGRAPHICS.some((demo) => normalizedText.includes(demo));

  if (isValidDemographic) {
    return { isValid: true, confidence: 0.95 };
  }

  // Check for context
  const hasContext = DEMOGRAPHIC_CONTEXT_LABELS.some(
    (label) => ctx.precedingText?.toLowerCase().includes(label)
  );

  if (!hasContext) {
    return {
      isValid: false,
      confidence: 0.6,
      issue: {
        type: 'low_confidence_span',
        severity: 'warning',
        message: `Demographic "${text}" not in known list and lacks context`,
        relatedEntity: 'DEMOGRAPHIC',
      },
    };
  }

  return { isValid: true, confidence: 0.7 };
}

// ============================================================================
// Magazine Rules
// ============================================================================

export const MAGAZINE_RULES: EntityValidationRule = {
  entityType: 'MAGAZINE',
  minLength: 2,
  maxLength: 150,
  invalidPatterns: [
    ...NAVIGATION_PATTERNS,
    ...PLACEHOLDER_PATTERNS,
    ...UI_NAVIGATION_PATTERNS,
  ],
  requirePatternContext: true,
  validPageTypes: ['SERIES_PAGE', 'MANGA_PAGE'],
  customValidator: validateMagazine,
};

function validateMagazine(text: string, ctx: ValidationContext): ValidationResult {
  const normalizedText = text.toLowerCase().trim();

  // Check for UI navigation patterns
  if (UI_NAVIGATION_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    return {
      isValid: false,
      confidence: 0.95,
      issue: {
        type: 'navigation_as_content',
        severity: 'error',
        message: `Magazine "${text}" is UI navigation text`,
        relatedEntity: 'MAGAZINE',
      },
    };
  }

  // Check for context
  const hasContext = MAGAZINE_CONTEXT_LABELS.some(
    (label) => ctx.precedingText?.toLowerCase().includes(label)
  );

  if (!hasContext && ctx.sourceType === 'FANDOM') {
    return {
      isValid: false,
      confidence: 0.7,
      issue: {
        type: 'low_confidence_span',
        severity: 'warning',
        message: `Magazine "${text}" not preceded by magazine/serialization label`,
        relatedEntity: 'MAGAZINE',
      },
    };
  }

  return { isValid: true, confidence: 0.85 };
}

// ============================================================================
// Release Date Rules
// ============================================================================

export const RELEASE_DATE_RULES: EntityValidationRule = {
  entityType: 'RELEASE_DATE',
  minLength: 4,
  maxLength: 100,
  invalidPatterns: [
    ...NAVIGATION_PATTERNS,
    ...PLACEHOLDER_PATTERNS,
    ...UI_NAVIGATION_PATTERNS,
  ],
  validPageTypes: ['SERIES_PAGE', 'MANGA_PAGE', 'INDIVIDUAL_VOLUME', 'INDIVIDUAL_CHAPTER'],
  customValidator: validateReleaseDate,
};

function validateReleaseDate(text: string, ctx: ValidationContext): ValidationResult {
  const normalizedText = text.toLowerCase().trim();

  // Check for UI navigation patterns
  if (UI_NAVIGATION_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    return {
      isValid: false,
      confidence: 0.95,
      issue: {
        type: 'navigation_as_content',
        severity: 'error',
        message: `Release date "${text}" is UI navigation text`,
        relatedEntity: 'RELEASE_DATE',
      },
    };
  }

  // Check for date patterns (year, month names, date formats)
  const yearPattern = /\b(19|20)\d{2}\b/;
  const monthPattern = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
  const dateFormatPattern = /\d{1,4}[-/]\d{1,2}([-/]\d{1,4})?/;

  const hasDatePattern =
    yearPattern.test(text) || monthPattern.test(text) || dateFormatPattern.test(text);

  if (hasDatePattern) {
    return { isValid: true, confidence: 0.9 };
  }

  // Check for context
  const hasContext = RELEASE_DATE_CONTEXT_LABELS.some(
    (label) => ctx.precedingText?.toLowerCase().includes(label)
  );

  if (!hasContext) {
    return {
      isValid: false,
      confidence: 0.6,
      issue: {
        type: 'low_confidence_span',
        severity: 'warning',
        message: `Release date "${text}" lacks date pattern and context`,
        relatedEntity: 'RELEASE_DATE',
      },
    };
  }

  return { isValid: true, confidence: 0.75 };
}

// ============================================================================
// Status Rules
// ============================================================================

export const STATUS_RULES: EntityValidationRule = {
  entityType: 'STATUS',
  minLength: 3,
  maxLength: 30,
  invalidPatterns: [
    ...NAVIGATION_PATTERNS,
    ...PLACEHOLDER_PATTERNS,
    ...UI_NAVIGATION_PATTERNS,
  ],
  validPageTypes: ['SERIES_PAGE', 'MANGA_PAGE'],
  customValidator: validateStatus,
};

function validateStatus(text: string, _ctx: ValidationContext): ValidationResult {
  const normalizedText = text.toLowerCase().trim();

  // Critical: Check for UI navigation patterns (blocks "Font-size" etc.)
  if (UI_NAVIGATION_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    return {
      isValid: false,
      confidence: 0.98,
      issue: {
        type: 'navigation_as_content',
        severity: 'error',
        message: `Status "${text}" is UI text (not a status value)`,
        relatedEntity: 'STATUS',
      },
    };
  }

  // Validate against known status values
  const isValidStatus = VALID_STATUS_VALUES.some((status) => normalizedText.includes(status));

  if (isValidStatus) {
    return { isValid: true, confidence: 0.95 };
  }

  // If not a known status, likely mislabeled
  return {
    isValid: false,
    confidence: 0.7,
    issue: {
      type: 'wrong_entity_type',
      severity: 'warning',
      message: `Status "${text}" is not a recognized status value`,
      relatedEntity: 'STATUS',
    },
  };
}

// ============================================================================
// Format Rules
// ============================================================================

export const FORMAT_RULES: EntityValidationRule = {
  entityType: 'FORMAT',
  minLength: 3,
  maxLength: 30,
  invalidPatterns: [
    ...NAVIGATION_PATTERNS,
    ...PLACEHOLDER_PATTERNS,
    ...UI_NAVIGATION_PATTERNS,
  ],
  validPageTypes: ['SERIES_PAGE', 'MANGA_PAGE'],
  customValidator: validateFormat,
};

function validateFormat(text: string, _ctx: ValidationContext): ValidationResult {
  const normalizedText = text.toLowerCase().trim();

  // Check for UI navigation patterns
  if (UI_NAVIGATION_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    return {
      isValid: false,
      confidence: 0.95,
      issue: {
        type: 'navigation_as_content',
        severity: 'error',
        message: `Format "${text}" is UI navigation text`,
        relatedEntity: 'FORMAT',
      },
    };
  }

  // Validate against known format types
  const isValidFormat = VALID_FORMAT_VALUES.some((format) => normalizedText.includes(format));

  if (isValidFormat) {
    return { isValid: true, confidence: 0.95 };
  }

  // If not a known format, likely mislabeled
  return {
    isValid: false,
    confidence: 0.7,
    issue: {
      type: 'wrong_entity_type',
      severity: 'warning',
      message: `Format "${text}" is not a recognized format type`,
      relatedEntity: 'FORMAT',
    },
  };
}
