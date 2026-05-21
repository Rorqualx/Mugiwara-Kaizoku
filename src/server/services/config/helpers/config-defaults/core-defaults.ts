/**
 * Core Default Configuration Values
 *
 * This module provides core configuration defaults including theme and server settings.
 */

import { ConfigValueType, ConfigScope, ConfigSource } from '@prisma/client';

import type { ConfigServiceMetadata } from '@/server/services/config/config-types';



/**
 * Returns core configuration defaults (theme and server settings)
 */
export function getCoreDefaults(): Record<string, ConfigServiceMetadata<unknown>> {
  const defaults: Record<string, ConfigServiceMetadata<unknown>> = {};

  // Theme defaults - Mugiwara themed
  defaults['theme.primary'] = {
    value: '#d32f2f', // Red - Luffy's signature color
    metadata: {
      key: 'theme.primary',
      label: 'Primary Theme Color',
      description: 'Main brand color used throughout the application',
      type: ConfigValueType.STRING,
      defaultValue: '#d32f2f',
      scope: ConfigScope.GLOBAL,
      category: 'Theme',
      ui: {
        component: 'color-picker',
        order: 1,
        group: 'Colors'
      }
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  // Server defaults
  defaults['server.port'] = {
    value: 3000,
    metadata: {
      key: 'server.port',
      label: 'Server Port',
      description: 'Port number for the application server',
      type: ConfigValueType.NUMBER,
      defaultValue: 3000,
      scope: ConfigScope.SYSTEM,
      category: 'Server',
      validation: {
        min: 1,
        max: 65535
      }
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  return defaults;
}
