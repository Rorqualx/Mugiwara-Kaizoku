/**
 * Types and configuration for AI Agent Phase Orchestrator
 */

import type { SourceDataCollection } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import type { RetryConfig } from '@/server/utils/retry';

// Re-export ChapterDataItem from shared types for backward compatibility
export type { ChapterDataItem } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';

/**
 * Configuration for AI agent orchestration
 */
export interface AgentOrchestratorConfig {
  /** Minimum confidence threshold for agent decisions (0.0-1.0) */
  confidenceThreshold: number;
  /** Maximum agent processing time in milliseconds */
  timeoutMs: number;
  /** Enable fallback to adaptive parser on agent failure */
  enableFallback: boolean;
  /** Log detailed agent reasoning */
  verboseLogging: boolean;
}

export const DEFAULT_CONFIG: AgentOrchestratorConfig = {
  confidenceThreshold: 0.7,
  // No timeout — let the model finish on its own time.
  // 8B model with 32K context generating 700+ chapter JSON can take 15-30+ minutes.
  timeoutMs: 0,
  enableFallback: true,
  verboseLogging: process.env.NODE_ENV === 'development',
};

/**
 * Check if an error is a client error that shouldn't be retried
 */
export function isClientError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('validation') ||
    message.includes('invalid parameter') ||
    message.includes('not found')
  );
}

/**
 * Retry configuration for tool execution
 */
export const TOOL_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  useJitter: true,
  debug: process.env.NODE_ENV === 'development',
  shouldRetry: (error: unknown, _attempt: number): boolean => {
    // Don't retry if error indicates invalid parameters (client error)
    if (error instanceof Error && isClientError(error)) {
      return false;
    }
    return true;
  },
};

/**
 * Context for agent processing — uses SourceDataCollection for full data access
 */
export interface AgentProcessingContext {
  mangaId: number;
  title: string;
  sourceData: SourceDataCollection;
  /** @deprecated Use sourceData — kept for backward compatibility with old tests */
  rawProviderData?: unknown;
  existingDbState?: unknown;
  config: AgentOrchestratorConfig;
  /** User's preferred language for metadata (e.g. 'en', 'ja', 'fr') */
  preferredLanguage?: string;
}
