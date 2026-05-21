/**
 * Download Client Default Configuration Values
 *
 * This module provides download client configuration defaults including Transmission,
 * Deluge, SABnzbd, NZBGet, client preferences, and retry settings.
 */

import type { ConfigServiceMetadata } from '@/server/services/config/config-types';

import {
  getTransmissionDefaults,
  getDelugeDefaults,
  getSABnzbdDefaults,
  getNZBGetDefaults,
  getDownloadPreferencesDefaults,
  getDownloadRetryDefaults,
  getDownloadCleanupDefaults
} from './download-clients';

/**
 * Returns all download client configuration defaults
 */
export function getDownloadClientDefaults(): Record<string, ConfigServiceMetadata<unknown>> {
  return {
    ...getTransmissionDefaults(),
    ...getDelugeDefaults(),
    ...getSABnzbdDefaults(),
    ...getNZBGetDefaults(),
    ...getDownloadPreferencesDefaults(),
    ...getDownloadRetryDefaults(),
    ...getDownloadCleanupDefaults()
  };
}
