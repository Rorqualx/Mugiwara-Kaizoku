/**
 * Download Client Settings re-export module
 *
 * Provides a single import surface for the four download-client settings
 * components and their config types. The Download Clients settings page
 * (`pages/settings/download-clients.tsx`) consumes the four components
 * directly — there is no aggregator wrapper.
 *
 * @module ClientSettings
 */

import { DelugeSettings, DelugeTorrentSettings } from './DelugeSettings';
import { NZBGetSettings } from './NZBGetSettings';
import { SABnzbdSettings } from './SABnzbdSettings';
import { TransmissionSettings } from './TransmissionSettings';

export {
  TransmissionSettings,
  NZBGetSettings,
  SABnzbdSettings,
  DelugeSettings,
  DelugeTorrentSettings,
};

export type {
  TransmissionConfig,
  DelugeConfig,
  NzbgetConfig,
  SabnzbdConfig,
} from './types';
