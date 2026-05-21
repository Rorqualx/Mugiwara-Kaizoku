/**
 * Parser Bridge Types
 *
 * Shared types for the parser bridge module.
 *
 * @module auto-labeling/parser-bridge/types
 */

import type { StaticAnalysisResult } from '@/server/services/fandom/adaptive/static-analyzer';
import type { AdaptiveParseResult } from '@/server/services/fandom/adaptive/types';

import type { ExtractedEntity } from '../types';

/**
 * Result of a parser extraction attempt.
 */
export interface ParserExtractionResult {
  success: boolean;
  entities: ExtractedEntity[];
  staticAnalysis: StaticAnalysisResult | null;
  parserResult: AdaptiveParseResult | null;
  error?: string;
  durationMs: number;
}

/**
 * Options for parser extraction.
 */
export interface ParserExtractionOptions {
  /** Timeout for the extraction in milliseconds */
  timeoutMs?: number;
  /** Whether to run static analysis */
  runStaticAnalysis?: boolean;
  /** Minimum confidence for entity extraction */
  minConfidence?: number;
}

export const DEFAULT_OPTIONS: Required<ParserExtractionOptions> = {
  timeoutMs: 30000,
  runStaticAnalysis: true,
  minConfidence: 0.5,
};
