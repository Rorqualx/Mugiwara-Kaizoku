/**
 * SABnzbd Download Client Configuration Defaults
 */

import { ConfigValueType, ConfigScope, ConfigSource } from '@prisma/client';

import type { ConfigServiceMetadata } from '@/server/services/config/config-types';



/**
 * Returns SABnzbd client configuration defaults
 */
export function getSABnzbdDefaults(): Record<string, ConfigServiceMetadata<unknown>> {
  const defaults: Record<string, ConfigServiceMetadata<unknown>> = {};

  defaults['download.sabnzbd.enabled'] = {
    value: false,
    metadata: {
      key: 'download.sabnzbd.enabled',
      label: 'Enable SABnzbd',
      description: 'Enable SABnzbd download client',
      type: ConfigValueType.BOOLEAN,
      defaultValue: false,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Clients'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.sabnzbd.baseURL'] = {
    value: 'http://localhost:8080',
    metadata: {
      key: 'download.sabnzbd.baseURL',
      label: 'SABnzbd Base URL',
      description: 'Base URL for SABnzbd API',
      type: ConfigValueType.STRING,
      defaultValue: 'http://localhost:8080',
      scope: ConfigScope.INTEGRATION,
      category: 'Download Clients'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.sabnzbd.apiKey'] = {
    value: '',
    metadata: {
      key: 'download.sabnzbd.apiKey',
      label: 'SABnzbd API Key',
      description: 'API key for SABnzbd',
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

  defaults['download.sabnzbd.category'] = {
    value: 'manga',
    metadata: {
      key: 'download.sabnzbd.category',
      label: 'SABnzbd Category',
      description: 'Category for organizing downloads in SABnzbd',
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
