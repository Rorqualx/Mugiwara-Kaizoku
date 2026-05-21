/**
 * Download Client Proxy Configuration Module
 *
 * Configuration management and client-specific configuration extraction
 * for download client proxy operations.
 *
 * Extracted from: src/pages/api/proxy/download-client.ts
 */

import { ClientConfig } from './utils';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for Transmission client
 */
export interface TransmissionConfig {
  baseURL: string | null | undefined;
  auth: string | null;
}

/**
 * Configuration for Deluge client
 */
export interface DelugeConfig {
  baseURL: string | null | undefined;
  password: string | null;
}

/**
 * Configuration for NZBGet client
 */
export interface NZBGetConfig {
  baseURL: string | null | undefined;
  auth: string | null;
}

/**
 * Configuration for SABnzbd client
 */
export interface SABnzbdConfig {
  baseURL: string | null | undefined;
  auth: string | null;
}

// ============================================================================
// Configuration Getters
// ============================================================================

/**
 * Get client configuration by type
 * This function will be called from the main handler with the actual config data
 */
export function getClientConfig(clientType: string, configData: Record<string, unknown>): ClientConfig {
  switch (clientType) {
    case 'transmission': {
      const transmissionConfig = configData as unknown as TransmissionConfig;
      return {
        baseURL: transmissionConfig.baseURL,
        auth: transmissionConfig.auth
      };
    }
    case 'deluge': {
      const delugeConfig = configData as unknown as DelugeConfig;
      return {
        baseURL: delugeConfig.baseURL,
        auth: delugeConfig.password
      };
    }
    case 'nzbget': {
      const nzbgetConfig = configData as unknown as NZBGetConfig;
      return {
        baseURL: nzbgetConfig.baseURL,
        auth: nzbgetConfig.auth
      };
    }
    case 'sabnzbd': {
      const sabnzbdConfig = configData as unknown as SABnzbdConfig;
      return {
        baseURL: sabnzbdConfig.baseURL,
        auth: sabnzbdConfig.auth
      };
    }
    default:
      return {
        baseURL: null,
        auth: null
      };
  }
}

/**
 * Get client-specific authentication header
 */
export function getAuthHeader(clientType: string, auth: string): Record<string, string> {
  if (clientType === 'deluge') {
    return {
      'Content-Type': 'application/json'
    };
  }
  
  return {
    'X-API-Key': auth,
    'Content-Type': 'application/json'
  };
}

/**
 * Get client-specific timeout configuration
 */
export function getClientTimeout(clientType: string): number {
  switch (clientType) {
    case 'transmission':
      return 30000; // 30 seconds
    case 'deluge':
      return 45000; // 45 seconds
    case 'nzbget':
      return 25000; // 25 seconds
    case 'sabnzbd':
      return 25000; // 25 seconds
    default:
      return 30000; // 30 seconds default
  }
}

/**
 * Validate client configuration and return error message if invalid
 */
export function validateClientConfig(clientType: string, baseURL: string | null | undefined, auth: string | null): string | null {
  if (!baseURL) {
    return `Missing ${clientType} base URL configuration`;
  }
  
  if (!auth) {
    return `Missing ${clientType} authentication configuration`;
  }
  
  // Validate URL format
  try {
    new URL(baseURL);
  } catch {
    return `Invalid ${clientType} base URL format`;
  }
  
  return null;
}
