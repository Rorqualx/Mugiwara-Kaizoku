/**
 * Text Processing Module
 *
 * Unified text processing utilities for sentence boundary detection,
 * abbreviation handling, and context extraction. This module provides
 * a single source of truth for text processing logic used across
 * both client and server code.
 *
 * ## Usage
 *
 * ```ts
 * import {
 *   ABBREVIATIONS,
 *   ABBREVIATIONS_UNIFIED,
 *   isKnownAbbreviation,
 *   isSentenceAbbreviation,
 *   isEllipsis,
 *   isSentenceEndToken,
 *   isSentenceEndChar,
 * } from '@/lib/text-processing';
 * ```
 *
 * ## Client vs Server
 *
 * - **Client (character-based)**: Use `isSentenceEndChar`, `isSentenceAbbreviation`, `isEllipsis`
 * - **Server (token-based)**: Use `isSentenceEndToken`
 *
 * Both use the same abbreviations list to ensure consistent training data.
 *
 * @module lib/text-processing
 */

// Abbreviations
export {
  ABBREVIATIONS,
  ABBREVIATIONS_UNIFIED,
  isKnownAbbreviation,
} from './abbreviations';

// Sentence helpers
export {
  isSentenceAbbreviation,
  isEllipsis,
  isSentenceEndToken,
  isSentenceEndChar,
} from './sentence-helpers';

// Types
export type {
  SentenceContextResult,
  TokenSentenceContextResult,
  SelectionContextResult,
  WordBoundaryResult,
  SentenceEndOptions,
} from './types';
