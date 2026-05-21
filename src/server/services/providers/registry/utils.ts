/**
 * Provider Registry Utilities
 *
 * Utility functions for provider registry configuration, metrics, and management.
 * These are stateless functions that operate on registry state passed as parameters.
 *
 * Extracted from: registry.ts (lines 367-408)
 */

import { logger } from '@/utils/logger';

import type { ProviderConfig, ProviderStrategy } from './types';
import type { MetadataProvider } from '@prisma/client';

// ============================================================================
// Configuration Management
// ============================================================================

/**
 * Update provider configuration
 *
 * Updates the configuration for a specific provider and synchronizes
 * the config map with the provider's updated state.
 *
 * @param provider - The provider strategy to update
 * @param configs - Map of provider configurations
 * @param config - Partial configuration to merge
 */
export function updateProviderConfig(
  provider: ProviderStrategy,
  configs: Map<MetadataProvider, ProviderConfig>,
  config: Partial<ProviderConfig>
): void {
  provider.updateConfig(config);
  configs.set(provider.type, provider.getConfig());
  logger.info(`Updated configuration for provider ${provider.type}`);
}

// ============================================================================
// Metrics & Monitoring
// ============================================================================

/**
 * Get provider metrics
 *
 * Collects metrics and configuration data from all registered providers.
 * Returns a summary of the registry state including provider counts,
 * enabled status, and current configurations.
 *
 * @param providers - Map of registered provider strategies
 * @param configs - Map of provider configurations
 * @returns Metrics object containing provider statistics
 */
export function getMetrics(
  providers: Map<MetadataProvider, ProviderStrategy>,
  configs: Map<MetadataProvider, ProviderConfig>
): Record<string, unknown> {
  const providersData: Record<string, unknown> = {};

  providers.forEach((provider, type) => {
    providersData[type] = {
      name: provider.name,
      enabled: provider.isEnabled(),
      config: configs.get(type)
    };
  });

  return {
    totalProviders: providers.size,
    providers: providersData
  };
}

// ============================================================================
// Registry Management
// ============================================================================

/**
 * Clear all providers from registry
 *
 * Removes all registered providers and their configurations.
 * This operation is primarily used for testing or complete registry resets.
 *
 * @param providers - Map of registered provider strategies
 * @param configs - Map of provider configurations
 */
export function clearRegistry(
  providers: Map<MetadataProvider, ProviderStrategy>,
  configs: Map<MetadataProvider, ProviderConfig>
): void {
  providers.clear();
  configs.clear();
  logger.info('Provider registry cleared');
}
