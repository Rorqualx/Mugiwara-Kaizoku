/**
 * Configuration Service Type Definitions
 * 
 * This module provides standardized interfaces for configuration services across the application.
 * These interfaces ensure consistent access patterns to configuration data and provide
 * type safety for configuration operations.
 */

/**
 * Base Configuration Service Interface
 * 
 * Defines the core methods that all configuration services should implement
 * to provide consistent access to configuration settings across the application.
 */
export interface BaseConfigService {
  /**
   * Check if the associated service/integration is enabled
   * 
   * @returns Promise resolving to boolean indicating enabled status
   */
  isEnabled(): Promise<boolean>;
  
  /**
   * Load configuration data from storage
   * 
   * @returns Promise resolving to the configuration data
   */
  loadConfig(): Promise<unknown>;
  
  /**
   * Save configuration data to storage
   * 
   * @param config Configuration data to save
   * @returns Promise resolving when save is complete
   */
  saveConfig(config: unknown): Promise<void>;
}

/**
 * API Configuration Service Interface
 * 
 * Extends the base configuration service with API-specific methods
 * for managing credentials and endpoints.
 */
export interface ApiConfigService extends BaseConfigService {
  /**
   * Get API credentials for authentication
   * 
   * @returns Promise resolving to API credentials object
   */
  getApiCredentials(): Promise<{
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    apiUrl?: string;
    [key: string]: string | undefined;
  }>;
  
  /**
   * Get API endpoint URL
   * 
   * @returns Promise resolving to API endpoint URL
   */
  getApiUrl(): Promise<string>;
  
  /**
   * Update API credentials in storage
   * 
   * @param credentials New API credentials
   * @returns Promise resolving when update is complete
   */
  updateApiCredentials(credentials: {
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    apiUrl?: string;
    [key: string]: string | undefined;
  }): Promise<void>;
}

/**
 * Metadata Provider Configuration Service Interface
 * 
 * Specialized configuration service for metadata providers with
 * methods for managing provider settings and priorities.
 */
export interface MetadataConfigService extends ApiConfigService {
  /**
   * Get provider-specific settings
   * 
   * @returns Promise resolving to provider settings
   */
  getProviderSettings(): Promise<{
    enabled: boolean;
    priority: number;
    fields?: string[];
    options?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  
  /**
   * Update provider-specific settings
   * 
   * @param settings New provider settings
   * @returns Promise resolving when update is complete
   */
  updateProviderSettings(settings: {
    enabled?: boolean;
    priority?: number;
    fields?: string[];
    options?: Record<string, unknown>;
    [key: string]: unknown;
  }): Promise<void>;
  
  /**
   * Get provider priority
   * 
   * @returns Promise resolving to provider priority number
   */
  getPriority(): Promise<number>;
  
  /**
   * Set provider priority
   * 
   * @param priority New priority value
   * @returns Promise resolving when update is complete
   */
  setPriority(priority: number): Promise<void>;
}

/**
 * Search Configuration Service Interface
 * 
 * Specialized configuration service for search providers with
 * methods for managing search settings and default providers.
 */
export interface SearchConfigService extends BaseConfigService {
  /**
   * Get the default search provider
   * 
   * @returns Promise resolving to default provider ID
   */
  getDefaultProvider(): Promise<string>;
  
  /**
   * Set the default search provider
   * 
   * @param providerId Provider ID to set as default
   * @returns Promise resolving when update is complete
   */
  setDefaultProvider(providerId: string): Promise<void>;
  
  /**
   * Get search-specific settings
   * 
   * @returns Promise resolving to search settings
   */
  getSearchSettings(): Promise<{
    defaultSortBy?: string;
    defaultSortOrder?: string;
    includeAdult?: boolean;
    maxResults?: number;
    [key: string]: unknown;
  }>;
  
  /**
   * Update search-specific settings
   * 
   * @param settings New search settings
   * @returns Promise resolving when update is complete
   */
  updateSearchSettings(settings: {
    defaultSortBy?: string;
    defaultSortOrder?: string;
    includeAdult?: boolean;
    maxResults?: number;
    [key: string]: unknown;
  }): Promise<void>;
}

/**
 * General Configuration Service Interface
 * 
 * Generic configuration service type that extends the base configuration
 * service with additional methods for managing complex settings.
 */
export interface ConfigService extends BaseConfigService {
  /**
   * Get a specific configuration value
   * 
   * @param key Configuration key to retrieve
   * @param defaultValue Default value if key not found
   * @returns Promise resolving to configuration value
   */
  getValue<T>(key: string, defaultValue?: T): Promise<T>;
  
  /**
   * Set a specific configuration value
   * 
   * @param key Configuration key to set
   * @param value Value to store
   * @returns Promise resolving when update is complete
   */
  setValue<T>(key: string, value: T): Promise<void>;
  
  /**
   * Check if a configuration key exists
   * 
   * @param key Configuration key to check
   * @returns Promise resolving to boolean indicating existence
   */
  hasKey(key: string): Promise<boolean>;
  
  /**
   * Remove a configuration key
   * 
   * @param key Configuration key to remove
   * @returns Promise resolving when removal is complete
   */
  removeKey(key: string): Promise<void>;
}

/**
 * Database Configuration Service Interface
 * 
 * Specialized configuration service for database-stored configurations
 * with methods for transaction support and bulk operations.
 */
export interface DatabaseConfigService extends ConfigService {
  /**
   * Begin a configuration transaction
   * 
   * @returns Promise resolving to transaction object
   */
  beginTransaction(): Promise<unknown>;
  
  /**
   * Commit a configuration transaction
   * 
   * @param transaction Transaction to commit
   * @returns Promise resolving when commit is complete
   */
  commitTransaction(transaction: unknown): Promise<void>;
  
  /**
   * Rollback a configuration transaction
   * 
   * @param transaction Transaction to rollback
   * @returns Promise resolving when rollback is complete
   */
  rollbackTransaction(transaction: unknown): Promise<void>;
  
  /**
   * Get multiple configuration values at once
   * 
   * @param keys Array of configuration keys to retrieve
   * @returns Promise resolving to object with key-value pairs
   */
  getValues(keys: string[]): Promise<Record<string, unknown>>;
  
  /**
   * Set multiple configuration values at once
   * 
   * @param values Object with key-value pairs to set
   * @returns Promise resolving when updates are complete
   */
  setValues(values: Record<string, unknown>): Promise<void>;
}