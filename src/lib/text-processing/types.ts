/**
 * Text Processing Types
 *
 * Shared type definitions for sentence boundary detection and text context extraction.
 *
 * @module lib/text-processing/types
 */

/**
 * Result of character-based sentence extraction (client-side).
 * Used in annotation editor for UI context display.
 */
export interface SentenceContextResult {
  /** The extracted sentence (trimmed) */
  sentence: string;
  /** Start character position of the sentence in the full text */
  sentenceStart: number;
  /** End character position of the sentence in the full text */
  sentenceEnd: number;
}

/**
 * Result of token-based sentence extraction (server-side).
 * Used for training data export with N-sentence context.
 */
export interface TokenSentenceContextResult {
  /** Context text before the target token (N sentences) */
  before: string;
  /** Context text after the target token (N sentences) */
  after: string;
}

/**
 * Result of selection context extraction with dynamic sizing.
 */
export interface SelectionContextResult {
  /** Prefix text before the selection */
  prefix: string;
  /** Suffix text after the selection */
  suffix: string;
  /** The context size that was used (32, 64, 128, or 256) */
  contextSize: number;
  /** Whether the selection is unique within the full text using this context */
  isUnique: boolean;
}

/**
 * Result of word boundary detection.
 */
export interface WordBoundaryResult {
  /** Start character position of the word */
  start: number;
  /** End character position of the word */
  end: number;
}

/**
 * Options for sentence end detection.
 */
export interface SentenceEndOptions {
  /** Custom abbreviations set (defaults to ABBREVIATIONS_UNIFIED) */
  abbreviations?: Set<string>;
  /** Text of the next token (for lookahead checks in token-based detection) */
  nextTokenText?: string;
}
