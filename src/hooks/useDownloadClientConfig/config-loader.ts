/**
 * Download Client Configuration Loader
 *
 * Function to load download client configuration from server.
 *
 * Extracted from: useDownloadClientConfig.ts
 */

import type { Dispatch, SetStateAction } from 'react';

import { logger } from '@/utils/logger';

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
 * Default download client configuration values
 */
const defaultDownloadClientConfig: DownloadClientConfig = {
  transmission: {
    enabled: false,
    baseURL: 'http://localhost:9091',
    apiKey: ''
  },
  deluge: {
    enabled: false,
    baseURL: 'http://localhost:8112',
    password: ''
  },
  sabnzbd: {
    enabled: false,
    baseURL: 'http://localhost:8080',
    apiKey: ''
  },
  nzbget: {
    enabled: false,
    baseURL: 'http://localhost:6789',
    username: '',
    password: ''
  },
  preferences: {
    preferredTorrentClient: null,
    preferredUsenetClient: null,
    autoSelectClient: true
  }
};

/**
 * Parse client preference string to typed value
 *
 * @param value - The preference string value
 * @param validValues - Array of valid client types
 * @returns Typed client preference or null
 */
function parseClientPreference<T extends string>(
  value: string | null | undefined,
  validValues: T[]
): T | null {
  if (!value) return null;

  return validValues.includes(value as T) ? (value as T) : null;
}

/**
 * Load download client configuration from the server
 *
 * @param get - Config getter function from useConfig hook
 * @param setDownloadClientConfig - State setter for config
 * @param setIsLoading - State setter for loading
 * @param setError - State setter for error
 */
export async function loadDownloadClientConfig(
  get: <T>(key: string) => Promise<T | undefined>,
  setDownloadClientConfig: Dispatch<SetStateAction<DownloadClientConfig>>,
  setIsLoading: Dispatch<SetStateAction<boolean>>,
  setError: Dispatch<SetStateAction<string | null>>
): Promise<void> {
  setIsLoading(true);
  setError(null);

  try {
    // Transmission settings
    const transmissionEnabled =
      (await get<boolean>('download.transmission.enabled')) ??
      defaultDownloadClientConfig.transmission.enabled;
    const transmissionBaseURL =
      (await get<string>('download.transmission.baseURL')) ??
      defaultDownloadClientConfig.transmission.baseURL;
    const transmissionApiKey =
      (await get<string>('download.transmission.apiKey')) ??
      defaultDownloadClientConfig.transmission.apiKey;

    // Deluge settings
    const delugeEnabled =
      (await get<boolean>('download.deluge.enabled')) ?? defaultDownloadClientConfig.deluge.enabled;
    const delugeBaseURL =
      (await get<string>('download.deluge.baseURL')) ?? defaultDownloadClientConfig.deluge.baseURL;
    const delugePassword =
      (await get<string>('download.deluge.password')) ?? defaultDownloadClientConfig.deluge.password;

    // SABnzbd settings
    const sabnzbdEnabled =
      (await get<boolean>('download.sabnzbd.enabled')) ??
      defaultDownloadClientConfig.sabnzbd.enabled;
    const sabnzbdBaseURL =
      (await get<string>('download.sabnzbd.baseURL')) ?? defaultDownloadClientConfig.sabnzbd.baseURL;
    const sabnzbdApiKey =
      (await get<string>('download.sabnzbd.apiKey')) ?? defaultDownloadClientConfig.sabnzbd.apiKey;

    // NZBGet settings
    const nzbgetEnabled =
      (await get<boolean>('download.nzbget.enabled')) ?? defaultDownloadClientConfig.nzbget.enabled;
    const nzbgetBaseURL =
      (await get<string>('download.nzbget.baseURL')) ?? defaultDownloadClientConfig.nzbget.baseURL;
    const nzbgetUsername =
      (await get<string>('download.nzbget.username')) ?? defaultDownloadClientConfig.nzbget.username;
    const nzbgetPassword =
      (await get<string>('download.nzbget.password')) ?? defaultDownloadClientConfig.nzbget.password;

    // Client preferences
    const preferredTorrentClientString = await get<string>(
      'download.preferences.preferredTorrentClient'
    );
    const preferredUsenetClientString = await get<string>(
      'download.preferences.preferredUsenetClient'
    );

    const preferredTorrentClient = parseClientPreference<'transmission' | 'deluge'>(
      preferredTorrentClientString,
      ['transmission', 'deluge']
    );

    const preferredUsenetClient = parseClientPreference<'sabnzbd' | 'nzbget'>(
      preferredUsenetClientString,
      ['sabnzbd', 'nzbget']
    );

    const autoSelectClient =
      (await get<boolean>('download.preferences.autoSelectClient')) ??
      defaultDownloadClientConfig.preferences.autoSelectClient;

    // Update local state
    setDownloadClientConfig({
      transmission: {
        enabled: transmissionEnabled,
        baseURL: transmissionBaseURL,
        apiKey: transmissionApiKey
      },
      deluge: {
        enabled: delugeEnabled,
        baseURL: delugeBaseURL,
        password: delugePassword
      },
      sabnzbd: {
        enabled: sabnzbdEnabled,
        baseURL: sabnzbdBaseURL,
        apiKey: sabnzbdApiKey
      },
      nzbget: {
        enabled: nzbgetEnabled,
        baseURL: nzbgetBaseURL,
        username: nzbgetUsername,
        password: nzbgetPassword
      },
      preferences: {
        preferredTorrentClient,
        preferredUsenetClient,
        autoSelectClient
      }
    });
  } catch (err: unknown) {
    setError(
      `Failed to load download client configuration: ${err instanceof Error ? err.message : String(err)}`
    );
    logger.error('Error loading download client configuration', { error: err });
  } finally {
    setIsLoading(false);
  }
}
