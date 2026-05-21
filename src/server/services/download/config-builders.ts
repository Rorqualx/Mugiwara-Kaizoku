/**
 * Client Configuration Builders
 *
 * Helper functions for building download client configurations.
 * Extracted to reduce complexity in clientDownload.ts
 *
 * @module server/services/download/config-builders
 */

import type { ApiClientConfig } from './base';

/**
 * Type for client configuration with type field
 */
export type TypedClientConfig = ApiClientConfig & { type: string };

/**
 * Parses a URL and extracts common configuration properties
 *
 * @param urlString - URL string to parse
 * @param defaultUrl - Default URL if parsing fails
 * @returns Parsed URL configuration
 */
export function parseUrlConfig(urlString: string | undefined, defaultUrl: string): {
  host: string;
  port: number;
  ssl: boolean;
  basePath: string;
  baseURL: string;
} {
  const url = new URL(urlString ?? defaultUrl);
  return {
    host: url.hostname,
    port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
    ssl: url.protocol === 'https:',
    basePath: url.pathname !== '/' ? url.pathname : '',
    baseURL: urlString ?? defaultUrl
  };
}

/**
 * Checks if a client is enabled based on config map
 *
 * @param configMap - Configuration map
 * @returns True if client is enabled
 */
export function isClientEnabled(configMap: Map<string, string>): boolean {
  return configMap.get('enabled')?.toLowerCase() === 'true';
}

/**
 * Builds Transmission client configuration
 *
 * Transmission's RPC client doesn't authenticate requests in this codebase,
 * so no credential fields are read.
 *
 * @param configMap - Configuration map from database
 * @returns Transmission client configuration
 */
export function buildTransmissionConfig(configMap: Map<string, string>): TypedClientConfig {
  const urlConfig = parseUrlConfig(configMap.get('baseURL'), 'http://localhost:9091');
  const label = configMap.get('label');

  return {
    type: 'transmission',
    ...urlConfig,
    ...(label !== undefined ? { category: label } : {})
  };
}

/**
 * Builds Deluge client configuration
 *
 * @param configMap - Configuration map from database
 * @returns Deluge client configuration
 */
export function buildDelugeConfig(configMap: Map<string, string>): TypedClientConfig {
  const urlConfig = parseUrlConfig(configMap.get('baseURL'), 'http://localhost:8112');
  const password = configMap.get('password');
  const label = configMap.get('label');

  return {
    type: 'deluge',
    ...urlConfig,
    ...(password ? { password } : {}),
    ...(label !== undefined ? { category: label } : {})
  };
}

/**
 * Builds NZBGet client configuration
 *
 * @param configMap - Configuration map from database
 * @returns NZBGet client configuration
 */
export function buildNzbgetConfig(configMap: Map<string, string>): TypedClientConfig {
  const urlConfig = parseUrlConfig(configMap.get('baseURL'), 'http://localhost:6789');
  const category = configMap.get('category');

  return {
    type: 'nzbget',
    ...urlConfig,
    username: configMap.get('username') ?? 'nzbget',
    password: configMap.get('password') ?? '',
    ...(category !== undefined ? { category } : {})
  };
}

/**
 * Builds SABnzbd client configuration
 *
 * @param configMap - Configuration map from database
 * @returns SABnzbd client configuration
 */
export function buildSabnzbdConfig(configMap: Map<string, string>): TypedClientConfig {
  const urlConfig = parseUrlConfig(configMap.get('baseURL'), 'http://localhost:8080');
  const apiKey = configMap.get('apiKey');
  const category = configMap.get('category');

  return {
    type: 'sabnzbd',
    ...urlConfig,
    ...(apiKey ? { apiKey } : {}),
    ...(category !== undefined ? { category } : {})
  };
}

/**
 * Client type to builder function mapping
 */
export const clientConfigBuilders: Record<string, (configMap: Map<string, string>) => TypedClientConfig> = {
  transmission: buildTransmissionConfig,
  deluge: buildDelugeConfig,
  nzbget: buildNzbgetConfig,
  sabnzbd: buildSabnzbdConfig
};

/**
 * Client type to display name mapping for error messages
 */
export const clientDisplayNames: Record<string, string> = {
  transmission: 'Transmission',
  deluge: 'Deluge',
  nzbget: 'NZBGet',
  sabnzbd: 'SABnzbd'
};
