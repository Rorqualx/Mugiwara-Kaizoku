/**
 * Search Provider Registry Initialization Module
 *
 * This module ensures that the search provider registry is properly initialized
 * before any searches are performed. Now uses the UnifiedProviderRegistry.
 */
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import { unifiedProviderRegistry, searchProviderRegistry } from './UnifiedProviderRegistry';

import type { SearchProvider } from './types';

// Flag to track if the registry has been initialized
let registryInitialized = false;

/**
 * Ensure the search provider registry is initialized
 *
 * This function checks if the provider registry has been initialized,
 * and initializes it if necessary. It also validates that providers
 * were successfully registered.
 *
 * @returns Promise that resolves when the registry is ready
 */
export async function ensureProviderRegistryInitialized(): Promise<void> {
    if (registryInitialized) {
        return;
    }
    try {
        logger.info('Initializing unified provider registry');

        // Initialize the unified provider registry
        await unifiedProviderRegistry.initialize();

        // Verify that providers were registered
        const providers = unifiedProviderRegistry.getAvailableProviders();
        if (providers.length === 0) {
            throw new ValidationError('No search providers were registered');
        }

        // Mark as initialized
        registryInitialized = true;
        logger.info(`Unified provider registry initialized with ${providers.length} providers: ${providers.join(', ')}`);
    }
    catch (error: unknown) {
        logger.error('Failed to initialize unified provider registry:', error instanceof Error ? error.message : String(error));
        throw error;
    }
}

/**
 * Get the fully initialized provider registry
 *
 * This function ensures the provider registry is initialized before
 * returning it, making it safe to use anywhere in the application.
 *
 * @returns Promise that resolves to the initialized registry (backward compatible interface)
 */
export async function getInitializedProviderRegistry(): Promise<{ get: (name: string) => SearchProvider | undefined; getAll: () => Record<string, SearchProvider>; initialize: () => void; register: (provider: SearchProvider) => void }> {
    await ensureProviderRegistryInitialized();
    // Return the backward-compatible simple registry interface
    return searchProviderRegistry;
}
