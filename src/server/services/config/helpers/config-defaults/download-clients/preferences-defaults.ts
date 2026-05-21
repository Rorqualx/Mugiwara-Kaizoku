/**
 * Download Client Preferences Configuration Defaults
 */

import { ConfigValueType, ConfigScope, ConfigSource } from '@prisma/client';

import type { ConfigServiceMetadata } from '@/server/services/config/config-types';



/**
 * Returns download client preference configuration defaults
 */
export function getDownloadPreferencesDefaults(): Record<string, ConfigServiceMetadata<unknown>> {
  const defaults: Record<string, ConfigServiceMetadata<unknown>> = {};

  defaults['download.preferences.preferredTorrentClient'] = {
    value: '',
    metadata: {
      key: 'download.preferences.preferredTorrentClient',
      label: 'Preferred Torrent Client',
      description: 'The preferred torrent client to use when multiple are available',
      type: ConfigValueType.STRING,
      defaultValue: '',
      scope: ConfigScope.INTEGRATION,
      category: 'Download Preferences'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.preferences.preferredUsenetClient'] = {
    value: '',
    metadata: {
      key: 'download.preferences.preferredUsenetClient',
      label: 'Preferred Usenet Client',
      description: 'The preferred usenet client to use when multiple are available',
      type: ConfigValueType.STRING,
      defaultValue: '',
      scope: ConfigScope.INTEGRATION,
      category: 'Download Preferences'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.preferences.autoSelectClient'] = {
    value: true,
    metadata: {
      key: 'download.preferences.autoSelectClient',
      label: 'Auto-select Client',
      description: 'Automatically select an available download client if preferred is not available',
      type: ConfigValueType.BOOLEAN,
      defaultValue: true,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Preferences'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  return defaults;
}
