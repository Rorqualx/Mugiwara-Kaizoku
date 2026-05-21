/**
 * Central Configuration Types
 * 
 * This file contains all configuration interfaces for the application.
 * These are the SINGLE SOURCE OF TRUTH for configuration types.
 * All other modules should import from here.
 */

/**
 * Base configuration interface for all integrations
 */
export interface BaseIntegrationConfig {
  enabled: boolean;
  name?: string;
  id?: string;
  priority?: number;
  timeout?: number;
}

/**
 * ComicVine API configuration
 */
export interface ComicVineConfig extends BaseIntegrationConfig {
  // Required fields
  apiKey: string;
  
  // API configuration
  apiEndpoint?: string;
  baseUrl?: string;
  retryAttempts?: number;
  throttleMs?: number;
  
  // Provider configuration
  capabilities?: string[];
  
  // Rate limiting
  rateLimit?: {
    requests: number;
    window: number;
  };
}

/**
 * Suwayomi server configuration
 */
export interface SuwayomiConfig extends BaseIntegrationConfig {
  // Connection settings
  baseUrl?: string;
  host?: string;
  port?: number;
  pathPrefix?: string;
  
  // Authentication
  username?: string;
  password?: string;
  
  // Additional options
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  enabledSources?: string[];
}

/**
 * Native Download configuration
 */
export interface NativeDownloadConfig extends BaseIntegrationConfig {
  // Connection settings
  url: string;
  apiKey: string;
  baseUrl?: string;
  
  // Native Download-specific settings
  rootFolder?: string;
  qualityProfile?: string;
  metadataProfile?: string;
  selectors?: unknown; // Website selectors for parsing
}

/**
 * Fandom wiki configuration
 */
export interface FandomConfig extends BaseIntegrationConfig {
  baseUrl?: string;
  apiKey?: string;
  wikiDomain?: string;
}

/**
 * AniList configuration
 */
export interface AnilistConfig extends BaseIntegrationConfig {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
}

/**
 * Download client configurations
 */
export interface TransmissionConfig extends BaseIntegrationConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export interface DelugeConfig extends BaseIntegrationConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export interface SABnzbdConfig extends BaseIntegrationConfig {
  host: string;
  port: number;
  apiKey: string;
  ssl?: boolean;
  urlBase?: string;
}

export interface NZBGetConfig extends BaseIntegrationConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  ssl?: boolean;
  urlBase?: string;
}

/**
 * Prowlarr configuration
 */
export interface ProwlarrConfig extends BaseIntegrationConfig {
  apiUrl: string;
  apiKey: string;
  syncCategories?: number[];
}

/**
 * Notification configurations
 */
export interface DiscordConfig extends BaseIntegrationConfig {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
}

export interface EmailConfig extends BaseIntegrationConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  from: string;
  to: string[];
  ssl?: boolean;
}

export interface SlackConfig extends BaseIntegrationConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export interface TelegramConfig extends BaseIntegrationConfig {
  botToken: string;
  chatId: string;
}

export interface AppriseConfig extends BaseIntegrationConfig {
  serviceUrl: string;
  services: string[];
}

/**
 * Kavita configuration - consolidated definition
 */
export interface KavitaConfig extends BaseIntegrationConfig {
  type?: 'kavita';
  host?: string;
  baseUrl?: string;
  apiUrl?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  syncEnabled?: boolean;
  autoImport?: boolean;
  libraries?: string[];
  syncInterval?: number;
  autoSync?: boolean;
  syncDirection?: 'toKavita' | 'fromKavita' | 'bidirectional';
  lastSync?: Date;
}

/**
 * Komga configuration - consolidated definition
 */
export interface KomgaConfig extends BaseIntegrationConfig {
  type?: 'komga';
  host?: string;
  baseUrl?: string;
  apiUrl?: string;
  authMethod?: 'basic' | 'apikey';
  username?: string;
  password?: string;
  apiKey?: string;
  syncEnabled?: boolean;
  autoImport?: boolean;
  libraries?: string[];
  syncInterval?: number;
  autoSync?: boolean;
  syncDirection?: 'toKomga' | 'fromKomga' | 'bidirectional';
  lastSync?: Date;
}

/**
 * Integration settings stored in database (nested configs)
 * This is for API responses that group configs by integration
 */
export interface NestedIntegrationSettings {
  kavita?: KavitaConfig;
  komga?: KomgaConfig;
  prowlarr?: ProwlarrConfig;
  suwayomi?: SuwayomiConfig;
  comicvine?: ComicVineConfig;
  anilist?: AnilistConfig;
  fandom?: FandomConfig;
  nativeDownload?: NativeDownloadConfig;
  
  // Download clients
  transmission?: TransmissionConfig;
  deluge?: DelugeConfig;
  sabnzbd?: SABnzbdConfig;
  nzbget?: NZBGetConfig;
  
  // Notifications
  discord?: DiscordConfig;
  email?: EmailConfig;
  slack?: SlackConfig;
  telegram?: TelegramConfig;
}

/**
 * Integration settings matching Prisma Settings model (flat structure)
 * This is what components expect to work with
 */
export interface IntegrationSettings {
  // Komga settings
  komgaEnabled: boolean;
  komgaHost: string | null;
  komgaUser: string | null;
  komgaPassword: string | null;
  komgaLibraries: string[];

  // Kavita settings
  kavitaEnabled: boolean;
  kavitaHost: string | null;
  kavitaUser: string | null;
  kavitaPassword: string | null;
  kavitaLibraries: string[];

  // Prowlarr settings
  prowlarrEnabled: boolean;
  prowlarrBaseURL: string | null;
  prowlarrApiKey: string | null;

  // AniList settings
  anilistEnabled: boolean;
  anilistUseForMetadata: boolean;
  anilistUseNativeProvider?: boolean;
  anilistClientId?: string | null;
  anilistClientSecret?: string | null;
  anilistAccessToken?: string | null;

  // Suwayomi settings
  suwayomiEnabled: boolean;
  suwayomiServerPath: string | null;
  suwayomiConfigPath: string | null;
  suwayomiPort: number;
  suwayomiSources: string[];

  // Index signature to allow dynamic property access
  [key: string]: unknown;
}


// Re-export for backward compatibility
export type {
  BaseIntegrationConfig as BaseConfig,
  ComicVineConfig as ComicVineAdapterConfig,
  SuwayomiConfig as SuwayomiAdapterConfig,
  NativeDownloadConfig as NativeDownloadProviderConfig,
  FandomConfig as FandomAdapterConfig,
  AnilistConfig as AnilistAdapterConfig
};