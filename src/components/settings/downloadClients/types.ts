/**
 * Download Client Types
 *
 * Shared types for download client settings components
 *
 * @module components/settings/downloadClients/types
 */

export type TransmissionConfig = {
  enabled: boolean;
  baseURL: string;
  label: string;
};

export type DelugeConfig = {
  enabled: boolean;
  baseURL: string;
  password: string;
  label: string;
};

export type NzbgetConfig = {
  enabled: boolean;
  baseURL: string;
  username: string;
  password: string;
  category: string;
};

export type SabnzbdConfig = {
  enabled: boolean;
  baseURL: string;
  apiKey: string;
  category: string;
};
