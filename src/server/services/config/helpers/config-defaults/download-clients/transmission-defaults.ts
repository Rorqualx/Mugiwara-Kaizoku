/**
 * Transmission Download Client Configuration Defaults
 */

import { ConfigValueType, ConfigScope, ConfigSource } from '@prisma/client';

import type { ConfigServiceMetadata } from '@/server/services/config/config-types';



/**
 * Returns Transmission client configuration defaults
 */
export function getTransmissionDefaults(): Record<string, ConfigServiceMetadata<unknown>> {
  const defaults: Record<string, ConfigServiceMetadata<unknown>> = {};

  defaults['download.transmission.enabled'] = {
    value: false,
    metadata: {
      key: 'download.transmission.enabled',
      label: 'Enable Transmission',
      description: 'Enable Transmission download client',
      type: ConfigValueType.BOOLEAN,
      defaultValue: false,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Clients'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.transmission.baseURL'] = {
    value: 'http://localhost:9091',
    metadata: {
      key: 'download.transmission.baseURL',
      label: 'Transmission Base URL',
      description: 'Base URL for Transmission API',
      type: ConfigValueType.STRING,
      defaultValue: 'http://localhost:9091',
      scope: ConfigScope.INTEGRATION,
      category: 'Download Clients'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.transmission.label'] = {
    value: 'manga',
    metadata: {
      key: 'download.transmission.label',
      label: 'Transmission Label',
      description: 'Label assigned to torrents in Transmission',
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
