/**
 * Download Cleanup Configuration Defaults
 *
 * Defines default values for post-import cleanup behavior — removing the
 * completed torrent/NZB from its client and optionally deleting the source
 * files on disk after a successful pack import.
 */

import { ConfigValueType, ConfigScope, ConfigSource } from '@prisma/client';

import type { ConfigServiceMetadata } from '@/server/services/config/config-types';

/**
 * Returns download cleanup configuration defaults
 */
export function getDownloadCleanupDefaults(): Record<string, ConfigServiceMetadata<unknown>> {
  const defaults: Record<string, ConfigServiceMetadata<unknown>> = {};

  defaults['download.cleanup.enabled'] = {
    value: true,
    metadata: {
      key: 'download.cleanup.enabled',
      label: 'Enable Post-Import Cleanup',
      description: 'Remove the completed download from its client (Transmission, Deluge, NZBGet, SABnzbd) after a successful pack import',
      type: ConfigValueType.BOOLEAN,
      defaultValue: true,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Cleanup'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.cleanup.deleteFiles'] = {
    value: true,
    metadata: {
      key: 'download.cleanup.deleteFiles',
      label: 'Delete Source Files After Import',
      description: 'Delete the original download files on disk when removing the download from its client. The library copy is already imported, so the source files are duplicates.',
      type: ConfigValueType.BOOLEAN,
      defaultValue: true,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Cleanup'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  defaults['download.cleanup.keepTorrentsForSeeding'] = {
    value: false,
    metadata: {
      key: 'download.cleanup.keepTorrentsForSeeding',
      label: 'Keep Torrents Seeding (Seedbox Mode)',
      description: 'When enabled, completed torrents are NOT removed after import so they keep seeding for tracker ratio. NZB downloads (SABnzbd, NZBGet) are unaffected by this setting.',
      type: ConfigValueType.BOOLEAN,
      defaultValue: false,
      scope: ConfigScope.INTEGRATION,
      category: 'Download Cleanup'
    },
    source: ConfigSource.DEFAULT,
    updatedAt: new Date()
  };

  return defaults;
}
