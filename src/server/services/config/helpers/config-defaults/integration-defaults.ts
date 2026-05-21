/**
 * Integration Default Configuration Values
 *
 * This module provides integration configuration defaults including Suwayomi.
 */

import * as path from 'path';

import { ConfigValueType, ConfigScope, ConfigSource } from '@prisma/client';

import type { ConfigServiceMetadata } from '@/server/services/config/config-types';



/**
 * Returns Suwayomi integration configuration defaults
 */
export function getIntegrationDefaults(): Record<string, ConfigServiceMetadata<unknown>> {
  const defaults: Record<string, ConfigServiceMetadata<unknown>> = {};

  // Suwayomi defaults
  defaults['suwayomi.enabled'] = {
    value: false,
    metadata: {
      key: 'suwayomi.enabled',
      label: 'Enable Suwayomi',
      description: 'Enable Suwayomi integration for manga sources',
      type: ConfigValueType.BOOLEAN,
      defaultValue: false,
      scope: ConfigScope.INTEGRATION,
      category: 'Suwayomi'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['suwayomi.autoStart'] = {
    value: true, // Changed to true for automatic startup
    metadata: {
      key: 'suwayomi.autoStart',
      label: 'Auto-start Suwayomi',
      description: 'Automatically start Suwayomi server when the application starts',
      type: ConfigValueType.BOOLEAN,
      defaultValue: true, // Changed to true for automatic startup
      scope: ConfigScope.INTEGRATION,
      category: 'Suwayomi'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['suwayomi.serverPath'] = {
    value: path.join(process.cwd(), 'data', 'suwayomi-server'),
    metadata: {
      key: 'suwayomi.serverPath',
      label: 'Suwayomi Server Path',
      description: 'Path to the Suwayomi server installation',
      type: ConfigValueType.STRING,
      defaultValue: path.join(process.cwd(), 'data', 'suwayomi-server'),
      scope: ConfigScope.INTEGRATION,
      category: 'Suwayomi'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['suwayomi.configPath'] = {
    value: path.join(process.cwd(), 'data', 'suwayomi-config'),
    metadata: {
      key: 'suwayomi.configPath',
      label: 'Suwayomi Config Path',
      description: 'Path to store Suwayomi configuration files',
      type: ConfigValueType.STRING,
      defaultValue: path.join(process.cwd(), 'data', 'suwayomi-config'),
      scope: ConfigScope.INTEGRATION,
      category: 'Suwayomi'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['suwayomi.port'] = {
    value: 4567,
    metadata: {
      key: 'suwayomi.port',
      label: 'Suwayomi Port',
      description: 'Port number for Suwayomi server',
      type: ConfigValueType.NUMBER,
      defaultValue: 4567,
      scope: ConfigScope.INTEGRATION,
      category: 'Suwayomi',
      validation: {
        min: 1,
        max: 65535
      }
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['suwayomi.sources'] = {
    value: [],
    metadata: {
      key: 'suwayomi.sources',
      label: 'Suwayomi Sources',
      description: 'List of enabled manga sources/extensions',
      type: ConfigValueType.ARRAY,
      defaultValue: [],
      scope: ConfigScope.INTEGRATION,
      category: 'Suwayomi'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['suwayomi.downloadDir'] = {
    value: path.join(process.cwd(), 'downloads'),
    metadata: {
      key: 'suwayomi.downloadDir',
      label: 'Suwayomi Download Directory',
      description: 'Directory to save downloaded manga chapters',
      type: ConfigValueType.STRING,
      defaultValue: path.join(process.cwd(), 'downloads'),
      scope: ConfigScope.INTEGRATION,
      category: 'Suwayomi'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  return defaults;
}
