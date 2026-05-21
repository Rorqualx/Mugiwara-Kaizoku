/**
 * AI Agent Rollout Manager
 *
 * Manages gradual rollout of AI agent enrichment with percentage-based routing.
 * Provides deterministic routing based on mangaId to ensure consistent
 * behavior across requests for the same manga.
 */

import { logger } from '@/utils/logger';

const log = logger.child('AIAgentRollout');

/**
 * Configuration for AI agent rollout
 */
export interface RolloutConfig {
  /** Percentage of traffic to route to AI agent (0-100) */
  rolloutPercentage: number;
  /** Enable detailed logging of routing decisions */
  verboseLogging: boolean;
  /** Salt for deterministic hashing (change to force re-routing) */
  hashSalt: string;
}

/**
 * Default rollout configuration
 */
const DEFAULT_ROLLOUT_CONFIG: RolloutConfig = {
  rolloutPercentage: parseInt(process.env['AI_AGENT_ROLLOUT_PERCENTAGE'] ?? '100', 10),
  verboseLogging: process.env.NODE_ENV === 'development',
  hashSalt: process.env['AI_AGENT_ROLLOUT_SALT'] ?? 'mugiwara-kaizoku-ai-agent',
};

/**
 * Clamp a rollout percentage to the valid 0-100 range
 */
function clampPercentage(value: number): number {
  if (value < 0 || value > 100) {
    log.warn('Invalid rollout percentage, clamping to 0-100 range', { rolloutPercentage: value });
    return Math.max(0, Math.min(100, value));
  }
  return value;
}

/**
 * Get current rollout configuration
 */
export function getRolloutConfig(): RolloutConfig {
  return {
    ...DEFAULT_ROLLOUT_CONFIG,
    rolloutPercentage: clampPercentage(DEFAULT_ROLLOUT_CONFIG.rolloutPercentage),
  };
}

/**
 * Deterministic hash function for mangaId
 * Uses simple FNV-1a like hash for consistent results
 */
function deterministicHash(mangaId: number, salt: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  const data = `${salt}:${mangaId}`;

  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  // Ensure positive integer
  return Math.abs(hash) % 100;
}

/**
 * Determine whether to use AI agent for a specific manga
 *
 * Uses deterministic hash of mangaId to ensure consistent routing
 * for the same manga across multiple requests.
 */
export function shouldUseAIAgent(mangaId: number): boolean {
  const config = getRolloutConfig();
  const { rolloutPercentage, verboseLogging, hashSalt } = config;

  // If rollout is 0%, never use AI agent
  if (rolloutPercentage === 0) {
    if (verboseLogging) {
      log.debug('AI agent rollout 0%, using adaptive parser', { mangaId });
    }
    return false;
  }

  // If rollout is 100%, always use AI agent
  if (rolloutPercentage === 100) {
    if (verboseLogging) {
      log.debug('AI agent rollout 100%, using AI agent', { mangaId });
    }
    return true;
  }

  // Deterministic hash-based routing
  const hashValue = deterministicHash(mangaId, hashSalt);
  const useAgent = hashValue < rolloutPercentage;

  if (verboseLogging) {
    log.debug('Deterministic routing decision', {
      mangaId,
      rolloutPercentage,
      hashValue,
      useAgent,
      hashSalt,
    });
  }

  return useAgent;
}

/**
 * Get current rollout statistics
 */
export function getRolloutStats(): {
  rolloutPercentage: number;
  enabled: boolean;
  hashSalt: string;
} {
  const config = getRolloutConfig();
  return {
    rolloutPercentage: config.rolloutPercentage,
    enabled: config.rolloutPercentage > 0,
    hashSalt: config.hashSalt,
  };
}

/**
 * Update rollout percentage (for testing or dynamic configuration)
 * Note: This only affects in-memory configuration for the current process.
 * For production use, update environment variable or database configuration.
 */
export function updateRolloutPercentage(percentage: number): void {
  const oldPercentage = DEFAULT_ROLLOUT_CONFIG.rolloutPercentage;
  DEFAULT_ROLLOUT_CONFIG.rolloutPercentage = clampPercentage(percentage);

  log.info('Rollout percentage updated', {
    oldPercentage,
    newPercentage: DEFAULT_ROLLOUT_CONFIG.rolloutPercentage,
  });
}
