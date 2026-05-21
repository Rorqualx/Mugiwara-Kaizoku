/**
 * Prowlarr Type Definitions
 * 
 * This module contains comprehensive type definitions for the Prowlarr API,
 * including interfaces for indexers, search results, and client configuration.
 */

/**
 * Prowlarr system status response
 */
export interface SystemStatus {
  version: string;
  buildTime: string;
  isDebug: boolean;
  isProduction: boolean;
  isAdmin: boolean;
  isUserInteractive: boolean;
  startupPath: string;
  appData: string;
  osName: string;
  osVersion: string;
  isMonoRuntime: boolean;
  isMono: boolean;
  isLinux: boolean;
  isOsx: boolean;
  isWindows: boolean;
  mode: string;
  branch: string;
  authentication: string;
  sqliteVersion: string;
  urlBase: string;
  startTime: string;
}

/**
 * Prowlarr indexer field
 */
export interface IndexerField {
  name: string;
  label: string;
  value: string | number | boolean | null;
  type: string;
  advanced: boolean;
  helpText?: string;
  required?: boolean;
}

/**
 * Prowlarr indexer capability
 */
export interface IndexerCapability {
  supportedCategories: string[] | number[];
  searchAvailable?: boolean;
  name?: string;
  [key: string]: unknown;
}

/**
 * Prowlarr indexer definition
 */
export interface ProwlarrIndexer {
  id: number;
  name: string;
  enabled: boolean;
  priority: number;
  implementation: string;
  implementationName: string;
  protocol: string;
  fields: IndexerField[];
  tags: string[];
  capabilities: {
    [key: string]: IndexerCapability;
  };
  configContract: string;
  supportsRss?: boolean;
  supportsSearch?: boolean;
}

/**
 * Prowlarr search result
 */
export interface ProwlarrSearchResult {
  guid: string;
  id: number;
  title: string;
  size: number;
  publishDate: string;
  downloadUrl?: string;
  infoUrl?: string;
  magnetUrl?: string;
  seeders?: number;
  leechers?: number;
  protocol: string;
  categories: number[] | string[];
  indexerId: number;
  indexerName: string;
  score?: number;
  status?: string;
  description?: string;
  coverUrl?: string;
  alternativeTitles?: string[];

  // Parsed metadata fields (added by releaseParser)
  languages?: string[] | undefined;           // Detected languages (e.g., ['English', 'Japanese'])
  audioLanguage?: string | undefined;         // Primary audio/content language
  subtitleLanguages?: string[] | undefined;   // Subtitle languages if any
  isMultiLanguage?: boolean | undefined;      // True if MULTI/DUAL tag detected
  isOfficial?: boolean | undefined;           // True if official publisher release
  quality?: string | undefined;               // Quality/Resolution (Digital HD, 1080p, etc.)
  format?: string | undefined;                // File format (CBZ, CBR, PDF, EPUB)
  publisher?: string | undefined;             // Publisher/group name
  tags?: string[] | undefined;                // Additional tags (Complete, Omnibus, etc.)

  // Blocklist warning fields (added by searchManga when checking blocklist)
  isBlocked?: boolean | undefined;            // True if release is on blocklist
  blockReason?: string | undefined;           // Reason why release is blocked

  [key: string]: unknown;
}

/**
 * Prowlarr search options
 */
export interface SearchOptions {
  categories?: string[] | number[];
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

/**
 * Prowlarr settings from app config
 */
export interface ProwlarrSettings {
  prowlarrEnabled: boolean;
  prowlarrHost: string;
  prowlarrApiKey: string;
  prowlarrPriority: number;
  prowlarrCategories: string[];
}

/**
 * Prowlarr API client configuration
 */
export interface ProwlarrClientConfig {
  baseURL: string;
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
  notifyOnError?: boolean;
}

/**
 * Extended connection status with detailed information
 */
export interface ConnectionStatusDetails {
  connected: boolean;
  lastChecked?: Date | string;
  error?: string;
  version?: string;
}

/**
 * Connection status for Prowlarr integration
 */
export type ConnectionStatus = 'active' | 'inactive' | 'error' | ConnectionStatusDetails;

/**
 * Prowlarr context type
 */
export interface ProwlarrContextType {
  /** Prowlarr API client instance */
  api: ProwlarrApi | null;
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Function to test the Prowlarr connection */
  testConnection: () => Promise<boolean>;
  /** Error message if connection failed */
  error?: string;
  /** Function to set API configuration */
  setApiConfig: (baseURL: string, apiKey: string) => void;
}

/**
 * Prowlarr API client interface
 */
export interface ProwlarrApi {
  getSystemStatus: () => Promise<SystemStatus>;
  getIndexers: () => Promise<ProwlarrIndexer[]>;
  search: (query: string, options?: SearchOptions) => Promise<ProwlarrSearchResult[]>;
  testConnection: () => Promise<boolean>;
}

/**
 * Prowlarr system status (exported for components)
 */
export interface ProwlarrSystemStatus {
  version: string;
  buildTime: string;
  isDebug: boolean;
  isProduction: boolean;
  osName: string;
  osVersion: string;
  mode: string;
  branch: string;
  authentication: string;
  startTime: string;
  databaseType?: string;
  databaseVersion?: string;
  isDocker?: boolean;
}

/**
 * Prowlarr API error
 */
export interface ProwlarrError {
  message: string;
  description?: string;
  type?: string;
  propertyName?: string;
  propertyValue?: unknown;
  details?: unknown[];
}

/**
 * Common Prowlarr response types
 */
export interface ProwlarrResponse<T> {
  page: number;
  pageSize: number;
  sortKey: string;
  sortDirection: string;
  totalRecords: number;
  records: T[];
}