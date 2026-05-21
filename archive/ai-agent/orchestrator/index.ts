/**
 * AI Agent Orchestrator - Main Exports
 *
 * Centralized exports for AI agent orchestration components.
 */

export { runAIAgentEnrichment, runAgentEnrichmentPhases } from './phase-orchestrator';
export { fallbackHandler, executeAdaptiveParserFallback } from './fallback-handler';
export { shouldUseAIAgent, getRolloutStats, updateRolloutPercentage, type RolloutConfig } from './rollout-manager';

/**
 * Check if AI agent enrichment is enabled via feature flag
 */
export async function isAIAgentEnabled(): Promise<boolean> {
  try {
    const { checkFeatureFlag } = await import('@/config/featureFlags');
    return await checkFeatureFlag('aiAgentEnrichment');
  } catch {
    return false;
  }
}