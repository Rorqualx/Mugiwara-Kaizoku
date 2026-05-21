/**
 * Default values for Download Client Configuration
 */

import type { DownloadClientConfig } from './types';

/**
 * Default download client configuration values
 */
export const defaultDownloadClientConfig: DownloadClientConfig = {
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
