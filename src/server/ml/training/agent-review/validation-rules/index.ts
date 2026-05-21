/**
 * Validation Rules Index
 *
 * Exports all validation rules and the main validation function.
 */

import type { EntityType } from '@/server/ml/features/bio-types';


import {
  TITLE_RULES,
  AUTHOR_RULES,
  ARTIST_RULES,
  SERIES_SUMMARY_RULES,
  CHAPTER_SUMMARY_RULES,
  VOLUME_COUNT_RULES,
  CHAPTER_COUNT_RULES,
  PAGE_COUNT_RULES,
  VOLUME_PAGE_COUNT_RULES,
  VOLUME_TITLE_RULES,
} from './entity-rules';
import {
  PUBLISHER_RULES,
  DEMOGRAPHIC_RULES,
  MAGAZINE_RULES,
  RELEASE_DATE_RULES,
  STATUS_RULES,
  FORMAT_RULES,
} from './entity-rules/metadata-rules';
import {
  ISBN_RULES,
  VOLUME_NUMBER_RULES,
  CHAPTER_NUMBER_RULES,
} from './identifier-rules';

import type {
  EntityValidationRule,
  PageType,
  ValidationContext,
  ValidationResult,
} from '../types';

// Re-export patterns for external use
export * from './patterns';

// ============================================================================
// All Validation Rules
// ============================================================================

/**
 * All validation rules indexed by entity type
 */
export const VALIDATION_RULES: Partial<Record<EntityType, EntityValidationRule>> = {
  TITLE: TITLE_RULES,
  AUTHOR: AUTHOR_RULES,
  ARTIST: ARTIST_RULES,
  SERIES_SUMMARY: SERIES_SUMMARY_RULES,
  CHAPTER_SUMMARY: CHAPTER_SUMMARY_RULES,
  VOLUME_COUNT: VOLUME_COUNT_RULES,
  CHAPTER_COUNT: CHAPTER_COUNT_RULES,
  PAGE_COUNT: PAGE_COUNT_RULES,
  VOLUME_PAGE_COUNT: VOLUME_PAGE_COUNT_RULES,
  ISBN: ISBN_RULES,
  VOLUME_NUMBER: VOLUME_NUMBER_RULES,
  CHAPTER_NUMBER: CHAPTER_NUMBER_RULES,
  VOLUME_TITLE: VOLUME_TITLE_RULES,
  PUBLISHER: PUBLISHER_RULES,
  DEMOGRAPHIC: DEMOGRAPHIC_RULES,
  MAGAZINE: MAGAZINE_RULES,
  RELEASE_DATE: RELEASE_DATE_RULES,
  STATUS: STATUS_RULES,
  FORMAT: FORMAT_RULES,
};

// ============================================================================
// Critical Entities by Page Type
// ============================================================================

/** Critical entities for series/manga pages */
export const CRITICAL_ENTITIES_SERIES: EntityType[] = ['TITLE', 'AUTHOR'];

/** Critical entities for volume pages */
export const CRITICAL_ENTITIES_VOLUME: EntityType[] = ['VOLUME_NUMBER', 'VOLUME_TITLE'];

/** Critical entities for chapter pages */
export const CRITICAL_ENTITIES_CHAPTER: EntityType[] = ['CHAPTER_NUMBER', 'CHAPTER_TITLE'];

/**
 * Get critical entities for a page type
 */
export function getCriticalEntitiesForPageType(pageType: PageType): EntityType[] {
  switch (pageType) {
    case 'SERIES_PAGE':
    case 'MANGA_PAGE':
      return CRITICAL_ENTITIES_SERIES;
    case 'INDIVIDUAL_VOLUME':
      return CRITICAL_ENTITIES_VOLUME;
    case 'INDIVIDUAL_CHAPTER':
      return CRITICAL_ENTITIES_CHAPTER;
    default:
      return ['TITLE'];
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

function createLengthIssue(
  entityType: EntityType,
  text: string,
  constraint: 'min' | 'max',
  limit: number
): ValidationResult {
  const message = constraint === 'min'
    ? `${entityType} "${text}" is too short (min: ${limit})`
    : `${entityType} is too long (max: ${limit})`;

  return {
    isValid: false,
    confidence: 0.85,
    issue: {
      type: 'truncated_entity',
      severity: 'warning',
      message,
      relatedEntity: entityType,
    },
  };
}

function checkLengthConstraints(
  rules: EntityValidationRule,
  text: string,
  entityType: EntityType
): ValidationResult {
  if (rules.minLength && text.length < rules.minLength) {
    return createLengthIssue(entityType, text, 'min', rules.minLength);
  }

  if (rules.maxLength && text.length > rules.maxLength) {
    return createLengthIssue(entityType, text, 'max', rules.maxLength);
  }

  return { isValid: true, confidence: 1 };
}

function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function checkInvalidPatterns(
  rules: EntityValidationRule,
  text: string,
  entityType: EntityType
): ValidationResult {
  if (!rules.invalidPatterns) {
    return { isValid: true, confidence: 1 };
  }

  const hasMatch = matchesAnyPattern(text, rules.invalidPatterns);
  if (hasMatch) {
    return {
      isValid: false,
      confidence: 0.8,
      issue: {
        type: 'navigation_as_content',
        severity: 'warning',
        message: `${entityType} "${text}" matches invalid pattern`,
        relatedEntity: entityType,
      },
    };
  }

  return { isValid: true, confidence: 1 };
}

function checkValidPageTypes(
  rules: EntityValidationRule,
  context: ValidationContext,
  entityType: EntityType
): ValidationResult {
  if (!rules.validPageTypes) {
    return { isValid: true, confidence: 1 };
  }

  if (!rules.validPageTypes.includes(context.pageType)) {
    return {
      isValid: false,
      confidence: 0.75,
      issue: {
        type: 'page_type_mismatch',
        severity: 'warning',
        message: `${entityType} not expected on ${context.pageType}`,
        relatedEntity: entityType,
      },
    };
  }

  return { isValid: true, confidence: 1 };
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate an entity value using its rules
 */
export function validateEntity(
  entityType: EntityType,
  text: string,
  context: ValidationContext
): ValidationResult {
  const rules = VALIDATION_RULES[entityType];

  if (!rules) {
    return { isValid: true, confidence: 0.7 };
  }

  // Check length constraints
  const lengthResult = checkLengthConstraints(rules, text, entityType);
  if (!lengthResult.isValid) {
    return lengthResult;
  }

  // Check invalid patterns
  const patternResult = checkInvalidPatterns(rules, text, entityType);
  if (!patternResult.isValid) {
    return patternResult;
  }

  // Check valid page types
  const pageTypeResult = checkValidPageTypes(rules, context, entityType);
  if (!pageTypeResult.isValid) {
    return pageTypeResult;
  }

  // Run custom validator if present
  if (rules.customValidator) {
    return rules.customValidator(text, context);
  }

  return { isValid: true, confidence: 0.85 };
}
