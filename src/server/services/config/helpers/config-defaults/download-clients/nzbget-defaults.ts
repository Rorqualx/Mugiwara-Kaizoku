/**
 * NZBGet Download Client Configuration Defaults
 */

import { ConfigValueType, ConfigScope, ConfigSource } from '@prisma/client';

import type { ConfigServiceMetadata } from '@/server/services/config/config-types';



/**
 * Returns NZBGet client configuration defaults
 */
export function getNZBGetDefaults(): Record<string, ConfigServiceMetadata<unknown>> {
  const defaults: Record<string, ConfigServiceMetadata<unknown>> = {};

  defaults['download.nzbget.enabled'] = {
    value: false,
    metadata: {
      key: 'download.nzbget.enabled',
      label: 'Enable NZBGet',
      description: 'Enable NZBGet download client',
      type: ConfigValueType.BOOLEAN,
      defaultValue: false,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Clients'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.nzbget.baseURL'] = {
    value: 'http://localhost:6789',
    metadata: {
      key: 'download.nzbget.baseURL',
      label: 'NZBGet Base URL',
      description: 'Base URL for NZBGet API',
      type: ConfigValueType.STRING,
      defaultValue: 'http://localhost:6789',
      scope: ConfigScope.INTEGRATION,
      category: 'Download Clients'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.nzbget.username'] = {
    value: '',
    metadata: {
      key: 'download.nzbget.username',
      label: 'NZBGet Username',
      description: 'Username for NZBGet',
      type: ConfigValueType.STRING,
      defaultValue: '',
      scope: ConfigScope.INTEGRATION,
      category: 'Download Clients'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.nzbget.password'] = {
    value: '',
    metadata: {
      key: 'download.nzbget.password',
      label: 'NZBGet Password',
      description: 'Password for NZBGet',
      type: ConfigValueType.STRING,
      defaultValue: '',
      scope: ConfigScope.INTEGRATION,
      category: 'Download Clients',
      ui: {
        readonly: true
      }
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.nzbget.category'] = {
    value: 'manga',
    metadata: {
      key: 'download.nzbget.category',
      label: 'NZBGet Category',
      description: 'Category for organizing downloads in NZBGet',
      type: ConfigValueType.STRING,
      defaultValue: 'manga',
      scope: ConfigScope.INTEGRATION,
      category: 'Download Clients'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  return defaults;
}
