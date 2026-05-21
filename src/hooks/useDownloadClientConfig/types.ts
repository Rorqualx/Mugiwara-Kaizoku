/**
 * Type definitions for Download Client Configuration Hook
 *
 * Contains all interfaces and types used throughout the hook modules.
 */

/**
 * Interface for Transmission client configuration
 */
export interface TransmissionConfig {
  enabled: boolean;
  baseURL: string;
  apiKey: string;
}

/**
 * Interface for Deluge client configuration
 */
export interface DelugeConfig {
  enabled: boolean;
  baseURL: string;
  password: string;
}

/**
 * Interface for SABnzbd client configuration
 */
export interface SabnzbdConfig {
  enabled: boolean;
  baseURL: string;
  apiKey: string;
}

/**
 * Interface for NZBGet client configuration
 */
export interface NzbgetConfig {
  enabled: boolean;
  baseURL: string;
  username: string;
  password: string;
}

/**
 * Download client type union
 */
export type DownloadClientType = 'transmission' | 'deluge' | 'sabnzbd' | 'nzbget';

/**
 * Interface for download client preferences
 */
export interface DownloadClientPreferences {
  preferredTorrentClient: 'transmission' | 'deluge' | null;
  preferredUsenetClient: 'sabnzbd' | 'nzbget' | null;
  autoSelectClient: boolean;
}

/**
 * Interface for all download client settings
 */
export interface DownloadClientConfig {
  transmission: TransmissionConfig;
  deluge: DelugeConfig;
  sabnzbd: SabnzbdConfig;
  nzbget: NzbgetConfig;
  preferences: DownloadClientPreferences;
}

/**
 * Interface for test connection state
 */
export interface TestConnectionState {
  client: string;
  status: 'idle' | 'testing' | 'success' | 'error';
  message: string;
}

/**
 * Return type for useDownloadClientConfig hook
 */
export interface UseDownloadClientConfigResult {
  config: DownloadClientConfig;
  isLoading: boolean;
  saving: boolean;
  error: string | null;
  testState: TestConnectionState;
  updateTransmissionSetting: <K extends keyof TransmissionConfig>(
    key: K,
    value: TransmissionConfig[K]
  ) => Promise<void>;
  updateDelugeSetting: <K extends keyof DelugeConfig>(
    key: K,
    value: DelugeConfig[K]
  ) => Promise<void>;
  updateSabnzbdSetting: <K extends keyof SabnzbdConfig>(
    key: K,
    value: SabnzbdConfig[K]
  ) => Promise<void>;
  updateNzbgetSetting: <K extends keyof NzbgetConfig>(
    key: K,
    value: NzbgetConfig[K]
  ) => Promise<void>;
  updatePreference: <K extends keyof DownloadClientPreferences>(
    key: K,
    value: DownloadClientPreferences[K]
  ) => Promise<void>;
  updateConfig: (config: Partial<DownloadClientConfig>) => Promise<void>;
  testConnection: (clientType: DownloadClientType) => Promise<void>;
  validateUrl: (url: string) => boolean;
  refresh: () => Promise<void>;
}

/**
 * Type for the config getter function
 */
export type ConfigGetter = <T>(key: string) => Promise<T | undefined>;

/**
 * Type for the config setter function
 */
export type ConfigSetter = (key: string, value: unknown) => Promise<void>;

/**
 * Type for state setters used in factory functions
 */
export type SetDownloadClientConfig = React.Dispatch<React.SetStateAction<DownloadClientConfig>>;
export type SetSaving = React.Dispatch<React.SetStateAction<boolean>>;
export type SetError = React.Dispatch<React.SetStateAction<string | null>>;
export type SetTestState = React.Dispatch<React.SetStateAction<TestConnectionState>>;
export type SetIsLoading = React.Dispatch<React.SetStateAction<boolean>>;
