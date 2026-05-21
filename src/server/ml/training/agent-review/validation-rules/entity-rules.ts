/**
 * Entity-Specific Validation Rules
 *
 * Validation rules for each entity type defining valid content.
 */

import {
  NAVIGATION_PATTERNS,
  PLACEHOLDER_PATTERNS,
  CHARACTER_NAME_PATTERNS,
  AUTHOR_CONTEXT_LABELS,
  ARTIST_CONTEXT_LABELS,
  VOLUME_CONTEXT_LABELS,
  CHAPTER_CONTEXT_LABELS,
  UI_NAVIGATION_PATTERNS,
} from './patterns';

import type { EntityValidationRule, ValidationContext, ValidationResult } from '../types';

// ============================================================================
// Title Rules
// ============================================================================

export const TITLE_RULES: EntityValidationRule = {
  entityType: 'TITLE',
  minLength: 2,
  maxLength: 200,
  invalidPatterns: [
    ...NAVIGATION_PATTERNS,
    ...PLACEHOLDER_PATTERNS,
    /^(chapter|volume|episode)\s*\d+$/i,
    /^(issue|part)\s*#?\d+$/i,
    /^v\d+$/i,
  ],
  validPageTypes: [
    'SERIES_PAGE',
    'MANGA_PAGE',
    'VOLUME_OVERVIEW',
    'CHAPTER_OVERVIEW',
    'INDIVIDUAL_VOLUME',
    'INDIVIDUAL_CHAPTER',
  ],
  customValidator: validateTitle,
};

function validateTitle(text: string, _ctx: ValidationContext): ValidationResult {
  // Title shouldn't be all lowercase if it's a real title
  const isAllLowercase = text.length > 5 && text === text.toLowerCase() && /^[a-z\s]+$/.test(text);
  if (isAllLowercase) {
    return {
      isValid: false,
      confidence: 0.6,
      issue: {
        type: 'wrong_entity_type',
        severity: 'warning',
        message: `Title "${text}" is all lowercase - may be navigation text`,
        relatedEntity: 'TITLE',
      },
    };
  }

  // Title shouldn't be a URL or contain URL parts
  if (text.includes('://') || text.includes('www.')) {
    return {
      isValid: false,
      confidence: 0.95,
      issue: {
        type: 'navigation_as_content',
        severity: 'error',
        message: 'Title contains URL - likely navigation',
        relatedEntity: 'TITLE',
      },
    };
  }

  return { isValid: true, confidence: 0.9 };
}

// ============================================================================
// Author Rules
// ============================================================================

export const AUTHOR_RULES: EntityValidationRule = {
  entityType: 'AUTHOR',
  minLength: 2,
  maxLength: 100,
  invalidPatterns: [
    ...NAVIGATION_PATTERNS,
    ...PLACEHOLDER_PATTERNS,
    ...CHARACTER_NAME_PATTERNS,
    /^(staff|team|studio|production)/i,
  ],
  requirePatternContext: true,
  customValidator: validateAuthor,
};

function validateAuthor(text: string, ctx: ValidationContext): ValidationResult {
  const hasContext = AUTHOR_CONTEXT_LABELS.some(
    (label) => ctx.precedingText?.toLowerCase().includes(label)
  );

  if (!hasContext && ctx.sourceType === 'FANDOM') {
    return {
      isValid: false,
      confidence: 0.7,
      issue: {
        type: 'author_attribution_error',
        severity: 'warning',
        message: `Author "${text}" not preceded by author label - may be character name`,
        relatedEntity: 'AUTHOR',
      },
    };
  }

  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount > 5) {
    return {
      isValid: false,
      confidence: 0.6,
      issue: {
        type: 'truncated_entity',
        severity: 'warning',
        message: `Author "${text}" seems too long - may include extra text`,
        relatedEntity: 'AUTHOR',
      },
    };
  }

  return { isValid: true, confidence: 0.85 };
}

// ============================================================================
// Artist Rules
// ============================================================================

export const ARTIST_RULES: EntityValidationRule = {
  entityType: 'ARTIST',
  minLength: 2,
  maxLength: 100,
  invalidPatterns: [
    ...NAVIGATION_PATTERNS,
    ...PLACEHOLDER_PATTERNS,
    ...CHARACTER_NAME_PATTERNS,
  ],
  requirePatternContext: true,
  customValidator: validateArtist,
};

function validateArtist(text: string, ctx: ValidationContext): ValidationResult {
  const hasContext = ARTIST_CONTEXT_LABELS.some(
    (label) => ctx.precedingText?.toLowerCase().includes(label)
  );

  if (!hasContext && ctx.sourceType === 'FANDOM') {
    return {
      isValid: false,
      confidence: 0.7,
      issue: {
        type: 'author_attribution_error',
        severity: 'warning',
        message: `Artist "${text}" not preceded by artist label`,
        relatedEntity: 'ARTIST',
      },
    };
  }

  return { isValid: true, confidence: 0.85 };
}

// ============================================================================
// Summary Rules
// ============================================================================

export const SERIES_SUMMARY_RULES: EntityValidationRule = {
  entityType: 'SERIES_SUMMARY',
  minLength: 80,
  maxLength: 5000,
  invalidPatterns: [
    ...NAVIGATION_PATTERNS,
    /^(browse all|welcome to|this (category|page))/i,
    /^(read more|see also|external links)/i,
    /^(click here|tap to|learn more)/i,
  ],
  requireSentences: true,
  validPageTypes: ['SERIES_PAGE', 'MANGA_PAGE'],
  customValidator: validateSeriesSummary,
};

function validateSeriesSummary(text: string, ctx: ValidationContext): ValidationResult {
  const sentencePattern = /[.!?]\s*([A-Z]|$)/;
  if (!sentencePattern.test(text)) {
    return {
      isValid: false,
      confidence: 0.75,
      issue: {
        type: 'summary_is_navigation',
        severity: 'warning',
        message: 'Summary lacks proper sentence structure',
        relatedEntity: 'SERIES_SUMMARY',
      },
    };
  }

  if (ctx.pageType === 'INDIVIDUAL_CHAPTER') {
    return {
      isValid: false,
      confidence: 0.9,
      issue: {
        type: 'wrong_page_type_context',
        severity: 'error',
        message: 'SERIES_SUMMARY found on chapter page - should be CHAPTER_SUMMARY',
        relatedEntity: 'SERIES_SUMMARY',
        suggestedAction: 'Change to CHAPTER_SUMMARY',
      },
    };
  }

  return { isValid: true, confidence: 0.85 };
}

export const CHAPTER_SUMMARY_RULES: EntityValidationRule = {
  entityType: 'CHAPTER_SUMMARY',
  minLength: 40,
  maxLength: 3000,
  invalidPatterns: [...NAVIGATION_PATTERNS],
  requireSentences: true,
  validPageTypes: ['INDIVIDUAL_CHAPTER', 'CHAPTER_OVERVIEW'],
  customValidator: validateChapterSummary,
};

function validateChapterSummary(_text: string, ctx: ValidationContext): ValidationResult {
  if (ctx.pageType === 'SERIES_PAGE' || ctx.pageType === 'MANGA_PAGE') {
    return {
      isValid: false,
      confidence: 0.9,
      issue: {
        type: 'wrong_page_type_context',
        severity: 'error',
        message: 'CHAPTER_SUMMARY found on series page - should be SERIES_SUMMARY',
        relatedEntity: 'CHAPTER_SUMMARY',
        suggestedAction: 'Change to SERIES_SUMMARY',
      },
    };
  }

  return { isValid: true, confidence: 0.85 };
}

// ============================================================================
// Count Rules
// ============================================================================

export const VOLUME_COUNT_RULES: EntityValidationRule = {
  entityType: 'VOLUME_COUNT',
  minValue: 1,
  maxValue: 500,
  requirePatternContext: true,
  validPageTypes: ['SERIES_PAGE', 'MANGA_PAGE', 'VOLUME_OVERVIEW'],
  customValidator: validateVolumeCount,
};

function validateVolumeCount(text: string, ctx: ValidationContext): ValidationResult {
  const numValue = parseInt(text.replace(/[^\d]/g, ''), 10);

  if (isNaN(numValue)) {
    return {
      isValid: false,
      confidence: 0.95,
      issue: {
        type: 'impossible_value',
        severity: 'error',
        message: `Volume count "${text}" is not a valid number`,
        relatedEntity: 'VOLUME_COUNT',
      },
    };
  }

  if (numValue > 500) {
    return {
      isValid: false,
      confidence: 0.8,
      issue: {
        type: 'impossible_value',
        severity: 'warning',
        message: `Volume count ${numValue} seems unusually high`,
        relatedEntity: 'VOLUME_COUNT',
      },
    };
  }

  const hasContext = VOLUME_CONTEXT_LABELS.some(
    (label) => ctx.precedingText?.toLowerCase().includes(label)
  );

  if (!hasContext) {
    return {
      isValid: false,
      confidence: 0.6,
      issue: {
        type: 'numeric_collision',
        severity: 'warning',
        message: `Number ${numValue} not in volume count context - may be page/chapter count`,
        relatedEntity: 'VOLUME_COUNT',
      },
    };
  }

  return { isValid: true, confidence: 0.9 };
}

function validateChapterCount(text: string, ctx: ValidationContext): ValidationResult {
  const numValue = parseInt(text.replace(/[^\d]/g, ''), 10);

  if (isNaN(numValue)) {
    return {
      isValid: false,
      confidence: 0.95,
      issue: {
        type: 'impossible_value',
        severity: 'error',
        message: `Chapter count "${text}" is not a valid number`,
        relatedEntity: 'CHAPTER_COUNT',
      },
    };
  }

  if (numValue > 2000) {
    return {
      isValid: false,
      confidence: 0.7,
      issue: {
        type: 'impossible_value',
        severity: 'warning',
        message: `Chapter count ${numValue} seems unusually high`,
        relatedEntity: 'CHAPTER_COUNT',
      },
    };
  }

  const hasContext = CHAPTER_CONTEXT_LABELS.some(
    (label) => ctx.precedingText?.toLowerCase().includes(label)
  );

  if (!hasContext) {
    return {
      isValid: false,
      confidence: 0.6,
      issue: {
        type: 'numeric_collision',
        severity: 'warning',
        message: `Number ${numValue} not in chapter count context`,
        relatedEntity: 'CHAPTER_COUNT',
      },
    };
  }

  return { isValid: true, confidence: 0.9 };
}

export const CHAPTER_COUNT_RULES: EntityValidationRule = {
  entityType: 'CHAPTER_COUNT',
  minValue: 1,
  maxValue: 2000,
  requirePatternContext: true,
  validPageTypes: ['SERIES_PAGE', 'MANGA_PAGE', 'CHAPTER_OVERVIEW', 'INDIVIDUAL_VOLUME'],
  customValidator: validateChapterCount,
};

// ============================================================================
// Page Count Rules
// ============================================================================

export const PAGE_COUNT_RULES: EntityValidationRule = {
  entityType: 'PAGE_COUNT',
  minValue: 1,
  maxValue: 500,
  requirePatternContext: true,
  validPageTypes: ['INDIVIDUAL_CHAPTER'],
  customValidator: validatePageCount,
};

function validatePageCount(text: string, _ctx: ValidationContext): ValidationResult {
  const numValue = parseInt(text.replace(/[^\d]/g, ''), 10);

  if (isNaN(numValue)) {
    return {
      isValid: false,
      confidence: 0.95,
      issue: {
        type: 'impossible_value',
        severity: 'error',
        message: `Page count "${text}" is not a valid number`,
        relatedEntity: 'PAGE_COUNT',
      },
    };
  }

  if (numValue > 500) {
    return {
      isValid: false,
      confidence: 0.9,
      issue: {
        type: 'impossible_value',
        severity: 'warning',
        message: `Page count ${numValue} seems unusually high for a chapter`,
        relatedEntity: 'PAGE_COUNT',
      },
    };
  }

  if (numValue < 1) {
    return {
      isValid: false,
      confidence: 0.95,
      issue: {
        type: 'impossible_value',
        severity: 'error',
        message: `Page count ${numValue} must be at least 1`,
        relatedEntity: 'PAGE_COUNT',
      },
    };
  }

  return { isValid: true, confidence: 0.9 };
}

// ============================================================================
// Volume Page Count Rules
// ============================================================================

export const VOLUME_PAGE_COUNT_RULES: EntityValidationRule = {
  entityType: 'VOLUME_PAGE_COUNT',
  minValue: 1,
  maxValue: 1000,
  requirePatternContext: true,
  validPageTypes: ['INDIVIDUAL_VOLUME', 'VOLUME_OVERVIEW'],
  customValidator: validateVolumePageCount,
};

function validateVolumePageCount(text: string, _ctx: ValidationContext): ValidationResult {
  const numValue = parseInt(text.replace(/[^\d]/g, ''), 10);

  if (isNaN(numValue)) {
    return {
      isValid: false,
      confidence: 0.95,
      issue: {
        type: 'impossible_value',
        severity: 'error',
        message: `Volume page count "${text}" is not a valid number`,
        relatedEntity: 'VOLUME_PAGE_COUNT',
      },
    };
  }

  if (numValue > 1000) {
    return {
      isValid: false,
      confidence: 0.9,
      issue: {
        type: 'impossible_value',
        severity: 'warning',
        message: `Volume page count ${numValue} seems unusually high`,
        relatedEntity: 'VOLUME_PAGE_COUNT',
      },
    };
  }

  if (numValue < 1) {
    return {
      isValid: false,
      confidence: 0.95,
      issue: {
        type: 'impossible_value',
        severity: 'error',
        message: `Volume page count ${numValue} must be at least 1`,
        relatedEntity: 'VOLUME_PAGE_COUNT',
      },
    };
  }

  return { isValid: true, confidence: 0.9 };
}

// ============================================================================
// Volume Title Rules
// ============================================================================

/**
 * Patterns that indicate metadata field labels (not actual volume titles)
 */
const VOLUME_TITLE_INVALID_METADATA = [
  /^(volume|vol\.?|v\.)$/i,
  /^(isbn|release|date|pages|chapters?)$/i,
  /^(cover|synopsis|summary|description)$/i,
  /^(previous|next|navigation|contents)$/i,
  /^(history|talk|edit|view)$/i,
  /^volume\s*\d+$/i, // "Volume 1", "Volume 2" - these are volume references, not titles
];

export const VOLUME_TITLE_RULES: EntityValidationRule = {
  entityType: 'VOLUME_TITLE',
  minLength: 2,
  maxLength: 200,
  invalidPatterns: [
    ...NAVIGATION_PATTERNS,
    ...PLACEHOLDER_PATTERNS,
    ...VOLUME_TITLE_INVALID_METADATA,
  ],
  validPageTypes: ['INDIVIDUAL_VOLUME', 'VOLUME_OVERVIEW'],
  customValidator: validateVolumeTitle,
};

function validateVolumeTitle(text: string, _ctx: ValidationContext): ValidationResult {
  const normalizedText = text.toLowerCase().trim();

  // Check for navigation table pattern "Volume X:" (navigation links, not volume titles)
  if (/^volume\s+\d+:?$/i.test(text.trim())) {
    return {
      isValid: false,
      confidence: 0.9,
      issue: {
        type: 'navigation_as_content',
        severity: 'error',
        message: `"${text}" is a navigation link, not a volume title`,
        relatedEntity: 'VOLUME_TITLE',
        suggestedAction: 'Label as VOLUMES_LIST_URL or exclude',
      },
    };
  }

  // Check for UI navigation patterns
  if (UI_NAVIGATION_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    return {
      isValid: false,
      confidence: 0.95,
      issue: {
        type: 'navigation_as_content',
        severity: 'error',
        message: `Volume title "${text}" is UI navigation text`,
        relatedEntity: 'VOLUME_TITLE',
      },
    };
  }

  // Check for metadata field labels
  if (VOLUME_TITLE_INVALID_METADATA.some((pattern) => pattern.test(normalizedText))) {
    return {
      isValid: false,
      confidence: 0.9,
      issue: {
        type: 'navigation_as_content',
        severity: 'warning',
        message: `Volume title "${text}" is a metadata field label`,
        relatedEntity: 'VOLUME_TITLE',
      },
    };
  }

  // Check for single-character or very short fragments that aren't real titles
  if (text.length === 1 && !/[A-Za-z0-9]/.test(text)) {
    return {
      isValid: false,
      confidence: 0.95,
      issue: {
        type: 'truncated_entity',
        severity: 'warning',
        message: `Volume title "${text}" is a single punctuation character`,
        relatedEntity: 'VOLUME_TITLE',
      },
    };
  }

  // Check for volume reference patterns (e.g., "Volume 1", "Vol. 2")
  if (/^vol(ume)?\.?\s*\d+$/i.test(normalizedText)) {
    return {
      isValid: false,
      confidence: 0.85,
      issue: {
        type: 'wrong_entity_type',
        severity: 'warning',
        message: `"${text}" is a volume reference, not a title`,
        relatedEntity: 'VOLUME_TITLE',
        suggestedAction: 'This may be a VOLUME_NUMBER reference instead',
      },
    };
  }

  // Volume titles typically have meaningful content - reject if it's just numbers
  if (/^\d+$/.test(text.trim())) {
    return {
      isValid: false,
      confidence: 0.85,
      issue: {
        type: 'wrong_entity_type',
        severity: 'warning',
        message: `Volume title "${text}" is just a number - may be volume/page count`,
        relatedEntity: 'VOLUME_TITLE',
      },
    };
  }

  return { isValid: true, confidence: 0.85 };
}
