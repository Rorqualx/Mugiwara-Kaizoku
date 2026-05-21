/**
 * Client Factory Functions
 *
 * Factory functions for creating download client instances.
 * Extracted to reduce complexity in clientDownload.ts
 *
 * @module server/services/download/client-factory
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';

import { DelugeClient } from './clients/delugeClient';
import { NzbgetClient } from './clients/nzbgetClient';
import { SabnzbdClient } from './clients/sabnzbdClient';
import { TransmissionClient } from './clients/transmission';

import type { BaseDownloadClient, ApiClientConfig } from './base';

/**
 * Base client configuration with required fields
 */
export type BaseClientConfig = ApiClientConfig & { type: string };

/**
 * Returns a client instance without pre-flight connection testing.
 *
 * Connection tests are skipped during client creation because:
 * 1. The actual download attempt (addUrl) is the real test
 * 2. sendToClientWithFailover already handles errors and tries the next client
 * 3. Pre-flight tests cause false negatives (transient auth/network issues)
 *    that block working clients from being used
 *
 * @param client - Client instance
 * @returns AsyncResult with the client instance
 */
function wrapClient(
  client: BaseDownloadClient,
): AsyncResult<BaseDownloadClient, Error> {
  return createSuccessResult(client);
}

/**
 * Builds base client config with common optional fields
 *
 * @param config - Raw configuration
 * @returns Sanitized ApiClientConfig
 */
function buildBaseConfig(config: BaseClientConfig): ApiClientConfig {
  return {
    host: config.host,
    port: config.port,
    ...(config.basePath && config.basePath !== '' && { basePath: config.basePath }),
    ...(config.username && { username: config.username }),
    ...(config.password && { password: config.password }),
    ...(config.apiKey && { apiKey: config.apiKey }),
    ...(config.ssl && { ssl: config.ssl }),
    // Empty-string is preserved here so users who clear the field can
    // intentionally suppress the per-client category at dispatch.
    ...(config.category !== undefined && { category: config.category })
  };
}

/**
 * Creates a Transmission client instance
 *
 * @param config - Client configuration
 * @returns AsyncResult containing Transmission client
 */
export function createTransmissionClient(
  config: BaseClientConfig
): Promise<AsyncResult<BaseDownloadClient, Error>> {
  const clientConfig = buildBaseConfig(config);
  const client = new TransmissionClient(clientConfig);
  return Promise.resolve(wrapClient(client));
}

/**
 * Creates a Deluge client instance
 *
 * @param config - Client configuration
 * @returns AsyncResult containing Deluge client
 */
export function createDelugeClient(
  config: BaseClientConfig
): Promise<AsyncResult<BaseDownloadClient, Error>> {
  if (!config.password) {
    return Promise.resolve(createErrorResult(
      new Error('Password is required for Deluge client')
    ));
  }

  const clientConfig = buildBaseConfig(config);
  const client = new DelugeClient(clientConfig);
  return Promise.resolve(wrapClient(client));
}

/**
 * Creates an NZBGet client instance
 *
 * @param config - Client configuration
 * @returns AsyncResult containing NZBGet client
 */
export function createNzbgetClient(
  config: BaseClientConfig
): Promise<AsyncResult<BaseDownloadClient, Error>> {
  if (!config.username || !config.password) {
    return Promise.resolve(createErrorResult(
      new Error('Username and password are required for NZBGet client')
    ));
  }

  const clientConfig = buildBaseConfig(config);
  const client = new NzbgetClient(clientConfig);
  return Promise.resolve(wrapClient(client));
}

/**
 * Creates a SABnzbd client instance
 *
 * @param config - Client configuration
 * @returns AsyncResult containing SABnzbd client
 */
export function createSabnzbdClient(
  config: BaseClientConfig
): Promise<AsyncResult<BaseDownloadClient, Error>> {
  if (!config.apiKey) {
    return Promise.resolve(createErrorResult(
      new Error('API key is required for SABnzbd client')
    ));
  }

  const clientConfig = buildBaseConfig(config);
  const client = new SabnzbdClient(clientConfig);
  return Promise.resolve(wrapClient(client));
}

/**
 * Client type to factory function mapping
 */
export const clientFactories: Record<
  string,
  (config: BaseClientConfig) => Promise<AsyncResult<BaseDownloadClient, Error>>
> = {
  transmission: createTransmissionClient,
  deluge: createDelugeClient,
  nzbget: createNzbgetClient,
  sabnzbd: createSabnzbdClient
};
