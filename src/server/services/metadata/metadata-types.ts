/**
 * Metadata Service Types
 *
 * Type definitions, interfaces, and error classes for the metadata service.
 * Extracted from metadataService.ts for better modularity.
 *
 * @module metadata-types
 */

import type { BaseProviderConfig } from '@/server/adapters/base-metadata-adapter';

/**
 * Logger function type for metadata service operations
 */
export type MetadataServiceLogger = (message: string, error?: unknown) => void;

/**
 * Provider-specific configuration mapping
 */
export type ProviderConfigs = Record<string, BaseProviderConfig | undefined>;

/**
 * Configuration options for MetadataService
 */
export interface MetadataServiceOptions {
	/** Provider configurations */
	providerConfigs: ProviderConfigs;
	/** Optional logger function */
	logger?: MetadataServiceLogger;
}

/**
 * Generic error type for the metadata service
 */
export class MetadataServiceError extends Error {
	/**
	 * Create a new MetadataServiceError
	 *
	 * @param message - Error message
	 * @param cause - Optional error cause
	 */
	constructor(message: string, public readonly cause?: unknown) {
		super(message);
		this.name = 'MetadataServiceError';
		Object.setPrototypeOf(this, MetadataServiceError.prototype);
	}
}
