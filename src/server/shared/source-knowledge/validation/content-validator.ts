/**
 * Content Validator
 *
 * Validates extracted entity content against blacklists and patterns.
 * Used by both ML bootstrap-labeler and app parser bridge.
 *
 * @module shared/source-knowledge/validation/content-validator
 */

import type { EntityType } from '@/server/ml/features/dom-linearizer';

import { TYPE_SPECIFIC_BLACKLISTS, UNIVERSAL_BLACKLIST } from './entity-blacklists';

/**
 * Check if a value is valid content (not blacklisted).
 *
 * @param value - The entity value to check
 * @param entityType - Optional entity type for type-specific filtering
 * @returns true if the value is valid content
 */
export function isValidEntityContent(value: string, entityType?: EntityType): boolean {
  const normalized = value.toLowerCase().trim();

  // Too short or too long
  if (normalized.length < 2 || normalized.length > 500) return false;

  // Universal blacklist
  if (UNIVERSAL_BLACKLIST.has(normalized)) return false;

  // Type-specific blacklist
  if (entityType) {
    const typeBlacklist = TYPE_SPECIFIC_BLACKLISTS[entityType];
    if (typeBlacklist?.has(normalized)) return false;
  }

  // Contains obvious wiki navigation patterns
  if (/^(view|edit|add|remove|delete|back|next|previous|click|tap)/i.test(normalized)) {
    return false;
  }

  // Just numbers, punctuation, or whitespace
  if (/^[\d\s\-_.,!?()[\]{}]+$/.test(normalized)) return false;

  // Type-specific pattern rejection
  if (entityType === 'RELEASE_DATE') {
    // Reject Wikipedia citation patterns like ". Retrieved July 24, 2022"
    if (/retrieved|accessed|archived|cited/i.test(normalized)) return false;
    // Reject ComicVine "In Cover Date" suffix (not already normalized)
    if (/in cover date/i.test(normalized)) return false;
  }

  return true;
}
