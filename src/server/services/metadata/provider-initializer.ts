/**
 * Provider Initialization Utilities
 *
 * Handles initialization of both legacy metadata providers (adapters) and
 * the new provider registry system. Provides configuration helpers.
 *
 * Extracted from metadataService.ts for better organization.
 *
 * @module provider-initializer
 */


import { MetadataProvider } from '@prisma/client';

import type { BaseProviderConfig } from '@/server/adapters/base-metadata-adapter';
import { UnifiedAniListAdapter } from '@/server/adapters/unified-anilist-adapter';
import { UnifiedComicVineAdapter } from '@/server/adapters/unified-comicvine-adapter';
import type { ProviderConfigs, MetadataServiceLogger } from '@/server/services/metadata/metadata-types';
import { MetadataServiceError } from '@/server/services/metadata/metadata-types';
import { MetadataAdapterWrapper } from '@/server/services/metadata/metadataAdapterWrapper';
import { ProviderRegistry } from '@/server/services/providers/registry';
import type { IntegrationAdapter } from '@/utils/integration-adapter';


/**
 * Provider Initializer utility class
 *
 * Static utility methods for initializing metadata providers and registry.
 */
export class ProviderInitializer {
	/**
	 * Initialize legacy metadata provider adapters
	 *
	 * Creates and configures provider adapters for AniList and ComicVine.
	 * These are wrapped in MetadataAdapterWrapper for compatibility.
	 *
	 * @param configs - Provider configurations
	 * @param logger - Logger function
	 * @returns Record of initialized provider adapters
	 * @throws {MetadataServiceError} If required configuration is missing
	 */
	static initializeProviders(
		configs: ProviderConfigs,
		logger: MetadataServiceLogger
	): Record<string, IntegrationAdapter<BaseProviderConfig>> {
		const providers: Record<string, IntegrationAdapter<BaseProviderConfig>> = {};

		try {
			// Initialize AniList provider if configured
			if (configs['anilist']?.enabled) {
				const config: BaseProviderConfig & { apiUrl: string; apiEndpoint: string } = {
					enabled: true,
					apiUrl: this.getConfigProperty(
						configs['anilist'],
						'apiUrl',
						'https://graphql.anilist.co'
					) as string,
					apiEndpoint: this.getConfigProperty(
						configs['anilist'],
						'apiUrl',
						'https://graphql.anilist.co'
					) as string,
					priority: 1,
					timeout: 30000,
				};
				const adapter = new UnifiedAniListAdapter(config);
				providers['anilist'] = new MetadataAdapterWrapper(adapter, config);
				logger('AniList provider initialized');
			}

			// Note: MangaDex uses the search provider pattern (MangaDexProvider.ts)
			// rather than the legacy adapter pattern used here

			// Initialize ComicVine provider if configured
			if (configs['comicvine']?.enabled) {
				// Get required ComicVine specific config properties
				const apiKey = this.getConfigProperty(configs['comicvine'], 'apiKey') as string;
				const apiEndpoint = this.getConfigProperty(
					configs['comicvine'],
					'apiEndpoint',
					'https://comicvine.gamespot.com/api'
				) as string;

				if (!apiKey) {
					throw new MetadataServiceError('ComicVine provider requires an API key');
				}

				const config: BaseProviderConfig & { apiUrl: string; apiEndpoint: string; apiKey: string } = {
					enabled: true,
					apiUrl: apiEndpoint,
					apiEndpoint: apiEndpoint,
					apiKey: apiKey,
					priority: 2,
					timeout: 30000,
				};
				const adapter = new UnifiedComicVineAdapter(config);
				providers['comicvine'] = new MetadataAdapterWrapper(adapter, config);
				logger('ComicVine provider initialized');
			}

			// Fandom provider not yet implemented with unified adapter

			logger(`Initialized ${Object.keys(providers).length} metadata providers`);
			return providers;
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger('Error initializing providers', errorMessage);
			throw new Error(errorMessage);
		}
	}

	/**
	 * Initialize provider registry with configurations
	 *
	 * Configures the provider registry with settings for Fandom, Wikipedia,
	 * AniList, and ComicVine providers.
	 *
	 * @param configs - Provider configurations
	 * @param registry - Provider registry instance
	 * @param logger - Logger function
	 */
	static initializeProviderRegistry(
		configs: ProviderConfigs,
		registry: ProviderRegistry,
		logger: MetadataServiceLogger
	): void {
		try {
			// Configure Fandom provider
			if (configs['fandom']?.enabled) {
				registry.updateProviderConfig(MetadataProvider.FANDOM, {
					enabled: true,
					priority: this.getConfigProperty(configs['fandom'], 'priority', 3) as number,
					timeout: this.getConfigProperty(configs['fandom'], 'timeout', 30000) as number,
					fallbackProviders: [MetadataProvider.WIKIPEDIA],
				});
				logger('Fandom provider configured in registry');
			}

			// Configure Wikipedia provider
			if (configs['wikipedia']?.enabled) {
				registry.updateProviderConfig(MetadataProvider.WIKIPEDIA, {
					enabled: true,
					priority: this.getConfigProperty(configs['wikipedia'], 'priority', 4) as number,
					timeout: this.getConfigProperty(configs['wikipedia'], 'timeout', 30000) as number,
				});
				logger('Wikipedia provider configured in registry');
			}

			// Configure AniList provider in registry
			if (configs['anilist']?.enabled) {
				registry.updateProviderConfig(MetadataProvider.ANILIST, {
					enabled: true,
					priority: this.getConfigProperty(configs['anilist'], 'priority', 1) as number,
					timeout: this.getConfigProperty(configs['anilist'], 'timeout', 30000) as number,
					apiKey: this.getConfigProperty(configs['anilist'], 'apiKey') as string,
					fallbackProviders: [MetadataProvider.FANDOM],
				});
				logger('AniList provider configured in registry');
			}

			// Configure ComicVine provider in registry
			if (configs['comicvine']?.enabled) {
				const apiKey = this.getConfigProperty(configs['comicvine'], 'apiKey') as string;
				if (apiKey) {
					registry.updateProviderConfig(MetadataProvider.COMICVINE, {
						enabled: true,
						priority: this.getConfigProperty(configs['comicvine'], 'priority', 2) as number,
						timeout: this.getConfigProperty(configs['comicvine'], 'timeout', 30000) as number,
						apiKey: apiKey,
						fallbackProviders: [MetadataProvider.WIKIPEDIA],
					});
					logger('ComicVine provider configured in registry');
				}
			}

			// getEnabledProviders is async but we're in constructor context
			// Just log that we configured providers
			logger(`Configured providers in registry`);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger('Error initializing provider registry', errorMessage);
			// Non-fatal error - legacy providers will still work
		}
	}

	/**
	 * Safely get typed property from config
	 *
	 * Extracts a property from a configuration object with type safety.
	 * Returns the default value if config is undefined or property doesn't exist.
	 *
	 * @param config - Configuration object
	 * @param key - Property key to extract
	 * @param defaultValue - Optional default value
	 * @returns Property value or default
	 */
	static getConfigProperty<T>(
		config: BaseProviderConfig | undefined,
		key: string,
		defaultValue?: T
	): T | undefined {
		if (!config) return defaultValue;

		// Cast to unknown first, then to the expected type
		const value = (config as unknown as Record<string, unknown>)[key];
		return value !== undefined ? (value as T) : defaultValue;
	}
}
