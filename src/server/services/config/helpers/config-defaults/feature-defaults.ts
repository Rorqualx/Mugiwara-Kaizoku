/**
 * Feature Default Configuration Values
 *
 * This module provides feature-related configuration defaults including file organization
 * and feature flags.
 */

import { ConfigValueType, ConfigScope, ConfigSource } from '@prisma/client';

import type { ConfigServiceMetadata } from '@/server/services/config/config-types';



/**
 * Returns feature-related configuration defaults
 */
export function getFeatureDefaults(): Record<string, ConfigServiceMetadata<unknown>> {
  const defaults: Record<string, ConfigServiceMetadata<unknown>> = {};

  // File organization defaults
  defaults['fileOrganization.folderStructure'] = {
    value: 'byTitle',
    metadata: {
      key: 'fileOrganization.folderStructure',
      label: 'Folder Structure',
      description: 'How manga files should be organized on disk',
      type: ConfigValueType.STRING,
      defaultValue: 'byTitle',
      scope: ConfigScope.FEATURE,
      category: 'File Organization',
      options: [
        { value: 'flat', label: 'Flat structure (all in one folder)' },
        { value: 'byTitle', label: 'By manga title' },
        { value: 'byTitleYear', label: 'By manga title and year' },
        { value: 'byPublisher', label: 'By publisher' },
        { value: 'custom', label: 'Custom template' }
      ]
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  // Feature flags
  defaults['features.enableBatchOperations'] = {
    value: true,
    metadata: {
      key: 'features.enableBatchOperations',
      label: 'Enable Batch Operations',
      description: 'Allow batch operations for manga and chapters',
      type: ConfigValueType.BOOLEAN,
      defaultValue: true,
      scope: ConfigScope.FEATURE,
      category: 'Features'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  return defaults;
}
