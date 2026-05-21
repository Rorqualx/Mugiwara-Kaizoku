/**
 * Integration Store Slice Module
 * 
 * This module manages the state for all third-party service integrations including:
 * - Manga servers (Komga, Kavita)
 * - Notification services (Telegram, Apprise)
 * - Metadata providers (AniList, Prowlarr)
 * - Download clients (Transmission, Deluge, SABnzbd, NZBGet)
 * - Manga source management (Suwayomi)
 * 
 * The state includes configuration settings, connection status,
 * and preferences for each integrated service.
 * 
 * @module integrationSlice
 */

import { createIdleResult } from '../utils/async-result';

import { createAppSlice } from './createStore';

import type { AsyncResult} from '../utils/async-result';
import type { ProviderType, ProviderStatus } from '@prisma/client';

// Define local types until Prisma models are added
interface ProviderEntity {
  id: string;
  name: string;
  type: ProviderType;
  status: ProviderStatus;
  config: Record<string, unknown>;
}

/**
 * Base configuration interface for manga server integrations
 */
export interface IntegrationConfig {
  enabled: boolean;
  host: string;
  user: string;
  password: string;
  libraries: string[];
}

/**
 * Telegram notification settings
 */
export interface TelegramConfig {
  enabled: boolean;
  token: string;
  chatId: string;
  sendSilently: boolean;
}

/**
 * Apprise notification settings
 */
export interface AppriseConfig {
  enabled: boolean;
  host: string;
  urls: string[];
}

/**
 * Prowlarr indexer settings
 */
export interface ProwlarrConfig {
  enabled: boolean;
  baseURL: string;
  apiKey: string;
  username?: string;
  password?: string;
}

/**
 * AniList metadata settings
 */
export interface AnilistConfig {
  enabled: boolean;
  useForMetadata: boolean;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
}

/**
 * ComicVine metadata settings
 */
export interface ComicVineConfig {
  enabled: boolean;
  apiKey: string;
}

/**
 * Sync status interface for integrations
 */
interface Integrationstring {
  lastSync: Date | null;
  syncing: boolean;
  error: string | null;
  komga?: {
    lastSync: Date | null;
    syncing: boolean;
    error: string | null;
  };
  kavita?: {
    lastSync: Date | null;
    syncing: boolean;
    error: string | null;
  };
}

/**
 * Fandom metadata settings
 */
export interface FandomConfig {
  enabled: boolean;
  defaultWikis?: string[];
}

/**
 * Suwayomi source settings
 */
export interface SuwayomiConfig {
  enabled: boolean;
  serverPath: string;
  configPath: string;
  port: number;
  sources: string[];
}

/**
 * Transmission client settings
 */
export interface TransmissionConfig {
  enabled: boolean;
  baseURL: string;
  apiKey: string;
}

/**
 * Deluge client settings
 */
export interface DelugeConfig {
  enabled: boolean;
  baseURL: string;
  password: string;
}

/**
 * SABnzbd client settings
 */
export interface SabnzbdConfig {
  enabled: boolean;
  baseURL: string;
  apiKey: string;
}

/**
 * NZBGet client settings
 */
export interface NzbgetConfig {
  enabled: boolean;
  baseURL: string;
  username: string;
  password: string;
}

/**
 * Download client preferences
 */
export interface DownloadClientPreferences {
  preferredTorrentClient: 'transmission' | 'deluge' | null;
  preferredUsenetClient: 'sabnzbd' | 'nzbget' | null;
  autoSelectClient: boolean;
}

// Use string from domain types instead of defining it here

/**
 * Complete integration state data structure
 *
 * Contains configuration and state for all supported integrations:
 * - Manga Servers
 * - Notification Services
 * - Metadata Providers
 * - Download Clients
 * - Source Management
 */
export type IntegrationStateData = {
  komga: IntegrationConfig;
  kavita: IntegrationConfig;
  telegram: TelegramConfig;
  apprise: AppriseConfig;
  prowlarr: ProwlarrConfig;
  anilist: AnilistConfig;
  comicvine: ComicVineConfig;
  fandom: FandomConfig;
  suwayomi: SuwayomiConfig;
  transmission: TransmissionConfig;
  deluge: DelugeConfig;
  sabnzbd: SabnzbdConfig;
  nzbget: NzbgetConfig;
  downloadClientPreferences: DownloadClientPreferences;
  syncStatus: Integrationstring;

  // Async results
  providerConfigResult: AsyncResult<ProviderEntity, Error>;
  connectionTestResult: AsyncResult<{success: boolean, message: string}, Error>;
} & Record<string, unknown>;

/**
 * Integration action types
 */
export type IntegrationServiceKey = 
  'komga' | 
  'kavita' | 
  'telegram' | 
  'apprise' | 
  'prowlarr' | 
  'anilist' | 
  'comicvine' | 
  'fandom' | 
  'suwayomi' | 
  'transmission' | 
  'deluge' | 
  'sabnzbd' | 
  'nzbget';

/**
 * Integration store actions interface
 * 
 * Defines all available actions for updating integration settings:
 * - Update individual service configurations
 * - Update download client preferences
 * - Update sync status
 * - Reset services to default settings
 * - Set async operation results
 */
export type IntegrationActions = {
  // Synchronous actions
  updateIntegration: (service: 'komga' | 'kavita', updates: Partial<IntegrationConfig>) => void;
  updateTelegram: (updates: Partial<TelegramConfig>) => void;
  updateApprise: (updates: Partial<AppriseConfig>) => void;
  updateProwlarr: (updates: Partial<ProwlarrConfig>) => void;
  updateAnilist: (updates: Partial<AnilistConfig>) => void;
  updateComicVine: (updates: Partial<ComicVineConfig>) => void;
  updateFandom: (updates: Partial<FandomConfig>) => void;
  updateSuwayomi: (updates: Partial<SuwayomiConfig>) => void;
  updateTransmission: (updates: Partial<TransmissionConfig>) => void;
  updateDeluge: (updates: Partial<DelugeConfig>) => void;
  updateSabnzbd: (updates: Partial<SabnzbdConfig>) => void;
  updateNzbget: (updates: Partial<NzbgetConfig>) => void;
  updateDownloadClientPreferences: (updates: Partial<DownloadClientPreferences>) => void;
  setstring: (updates: Partial<Integrationstring>) => void;
  resetIntegration: (service: IntegrationServiceKey) => void;
  
  // Async result setters
  setProviderConfigResult: (result: AsyncResult<ProviderEntity, Error>) => void;
  setConnectionTestResult: (result: AsyncResult<{success: boolean, message: string}, Error>) => void;
} & Record<string, unknown>;

/**
 * Combined integration state type
 * Includes both state data and actions
 */
export type IntegrationState = IntegrationStateData & IntegrationActions;

/**
 * Initial integration state
 * 
 * Provides default values for all integration settings:
 * - All services disabled by default
 * - Default server URLs and ports
 * - Empty credentials
 * - Auto-select enabled for download clients
 * - Idle async results
 */
const initialState: IntegrationStateData = {
  komga: {
    enabled: false,
    host: '',
    user: '',
    password: '',
    libraries: [],
  },
  kavita: {
    enabled: false,
    host: '',
    user: '',
    password: '',
    libraries: [],
  },
  telegram: {
    enabled: false,
    token: '',
    chatId: '',
    sendSilently: false,
  },
  apprise: {
    enabled: false,
    host: '',
    urls: [],
  },
  prowlarr: {
    enabled: false,
    baseURL: '',
    apiKey: '',
  },
  anilist: {
    enabled: true,
    useForMetadata: true,
    clientId: '',
    clientSecret: '',
    accessToken: '',
  },
  comicvine: {
    enabled: false,
    apiKey: '',
  },
  fandom: {
    enabled: false,
    defaultWikis: ['anime', 'manga', 'onepiece', 'naruto', 'bleach', 'dragonball'],
  },
  suwayomi: {
    enabled: false,
    serverPath: '',
    configPath: '',
    port: 4567,
    sources: [],
  },
  transmission: {
    enabled: false,
    baseURL: 'http://localhost:9091',
    apiKey: '',
  },
  deluge: {
    enabled: false,
    baseURL: 'http://localhost:8112',
    password: '',
  },
  sabnzbd: {
    enabled: false,
    baseURL: 'http://localhost:8080',
    apiKey: '',
  },
  nzbget: {
    enabled: false,
    baseURL: 'http://localhost:6789',
    username: '',
    password: '',
  },
  downloadClientPreferences: {
    preferredTorrentClient: null,
    preferredUsenetClient: null,
    autoSelectClient: true,
  },
  syncStatus: {
    lastSync: null,
    syncing: false,
    error: null,
  },
  providerConfigResult: createIdleResult<ProviderEntity, Error>(),
  connectionTestResult: createIdleResult<{success: boolean, message: string}, Error>(),
};

/**
 * Integration store slice
 * 
 * Creates a store slice with state and actions for managing integrations.
 * Uses immer for immutable state updates.
 * 
 * @example
 * // Update Telegram settings
 * useIntegrationStore.getState().updateTelegram({
 *   enabled: true,
 *   token: 'bot-token',
 *   chatId: 'chat-id'
 * });
 * 
 * // Reset a service to defaults
 * useIntegrationStore.getState().resetIntegration('komga');
 */
export const useIntegrationStore = createAppSlice<IntegrationStateData, IntegrationActions>(
  initialState,
  'integration'
)((set) => ({
  ...initialState,
  updateIntegration: (service: 'komga' | 'kavita', updates: Partial<IntegrationConfig>) =>
    set((state) => {
      state[service] = { ...state[service], ...updates };
    }),
  updateTelegram: (updates: Partial<TelegramConfig>) =>
    set((state) => {
      state.telegram = { ...state.telegram, ...updates };
    }),
  updateApprise: (updates: Partial<AppriseConfig>) =>
    set((state) => {
      state.apprise = { ...state.apprise, ...updates };
    }),
  updateProwlarr: (updates: Partial<ProwlarrConfig>) =>
    set((state) => {
      state.prowlarr = { ...state.prowlarr, ...updates };
    }),
  updateAnilist: (updates: Partial<AnilistConfig>) =>
    set((state) => {
      state.anilist = { ...state.anilist, ...updates };
    }),
  updateComicVine: (updates: Partial<ComicVineConfig>) =>
    set((state) => {
      state.comicvine = { ...state.comicvine, ...updates };
    }),
  updateFandom: (updates: Partial<FandomConfig>) =>
    set((state) => {
      state.fandom = { ...state.fandom, ...updates };
    }),
  updateSuwayomi: (updates: Partial<SuwayomiConfig>) =>
    set((state) => {
      state.suwayomi = { ...state.suwayomi, ...updates };
    }),
  updateTransmission: (updates: Partial<TransmissionConfig>) =>
    set((state) => {
      state.transmission = { ...state.transmission, ...updates };
    }),
  updateDeluge: (updates: Partial<DelugeConfig>) =>
    set((state) => {
      state.deluge = { ...state.deluge, ...updates };
    }),
  updateSabnzbd: (updates: Partial<SabnzbdConfig>) =>
    set((state) => {
      state.sabnzbd = { ...state.sabnzbd, ...updates };
    }),
  updateNzbget: (updates: Partial<NzbgetConfig>) =>
    set((state) => {
      state.nzbget = { ...state.nzbget, ...updates };
    }),
  updateDownloadClientPreferences: (updates: Partial<DownloadClientPreferences>) =>
    set((state) => {
      state.downloadClientPreferences = { ...state.downloadClientPreferences, ...updates };
    }),
  setstring: (updates: Partial<Integrationstring>) =>
    set((state) => {
      state.syncStatus = { ...state.syncStatus, ...updates };
    }),
  resetIntegration: (service: IntegrationServiceKey) =>
    set((state) => {
      // Use type assertion to safely access the dynamic property
      (state as Record<IntegrationServiceKey, unknown>)[service] = 
        (initialState as Record<IntegrationServiceKey, unknown>)[service];
    }),
  setProviderConfigResult: (result: AsyncResult<ProviderEntity, Error>) =>
    set((state) => {
      state.providerConfigResult = result;
    }),
  setConnectionTestResult: (result: AsyncResult<{success: boolean, message: string}, Error>) =>
    set((state) => {
      state.connectionTestResult = result;
    }),
}));