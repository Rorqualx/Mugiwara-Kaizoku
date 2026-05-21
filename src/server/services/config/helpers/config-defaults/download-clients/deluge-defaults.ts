/**
 * Deluge Download Client Configuration Defaults
 */

import { ConfigValueType, ConfigScope, ConfigSource } from '@prisma/client';

import type { ConfigServiceMetadata } from '@/server/services/config/config-types';



/**
 * Returns Deluge client configuration defaults
 */
export function getDelugeDefaults(): Record<string, ConfigServiceMetadata<unknown>> {
  const defaults: Record<string, ConfigServiceMetadata<unknown>> = {};

  defaults['download.deluge.enabled'] = {
    value: false,
    metadata: {
      key: 'download.deluge.enabled',
      label: 'Enable Deluge',
      description: 'Enable Deluge download client',
      type: ConfigValueType.BOOLEAN,
      defaultValue: false,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Clients'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.deluge.baseURL'] = {
    value: 'http://localhost:8112',
    metadata: {
      key: 'download.deluge.baseURL',
      label: 'Deluge Base URL',
      description: 'Base URL for Deluge API',
      type: ConfigValueType.STRING,
      defaultValue: 'http://localhost:8112',
      scope: ConfigScope.INTEGRATION,
      category: 'Download Clients'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.deluge.password'] = {
    value: '',
    metadata: {
      key: 'download.deluge.password',
      label: 'Deluge Password',
      description: 'Password for Deluge',
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

  defaults['download.deluge.label'] = {
    value: 'manga',
    metadata: {
      key: 'download.deluge.label',
      label: 'Deluge Label',
      description: 'Label for organizing downloads in Deluge',
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
