/**
 * Default Configuration Values
 *
 * This module provides the default configuration values for the application.
 * These are used when no configuration exists in the database or files.
 */

import {
  getCoreDefaults,
  getFeatureDefaults,
  getDownloadClientDefaults,
  getIntegrationDefaults
} from './helpers/config-defaults';

import type { ConfigServiceMetadata } from './config-types';

/**
 * Returns the default configuration values for the application
 * These are used when no configuration exists from other sources
 */
export function getDefaultConfig(): Record<string, ConfigServiceMetadata<unknown>> {
  return {
    ...getCoreDefaults(),
    ...getFeatureDefaults(),
    ...getDownloadClientDefaults(),
    ...getIntegrationDefaults()
  };
}
